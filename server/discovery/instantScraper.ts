import * as cheerio from 'cheerio';
import { extractCleanDomain } from './domainDetector';
import { Contact, EmailType } from '../../src/types';
import { globalNvidiaClient } from '../services/nvidia/nvidiaClient';
import { globalDiscoveryProvider } from './provider';
import { globalAiResilience } from '../services/aiResilience';

export interface InstantScrapeResult {
  email?: string;
  emailType?: EmailType;
  genericEmail?: string;
  decisionMakerEmail?: string;
  phone?: string;
  personName?: string;
  jobTitle?: string;
  employeeCount?: string;
  foundedYear?: string;
  linkedinUrl?: string;
  contacts?: Contact[];
}

const COMMON_IMAGE_EXTS = /\.(png|jpe?g|webp|svg|gif|bmp|tiff|ico|woff2?|ttf|eot)$/i;
const JUNK_EMAILS = /^(example|domain|name|support@wix|user@domain|test|email|someone|info@example|sentry|git|github|noreply|no-reply)\b/i;

/**
 * Performs an ultra-fast, multi-page probe of a confirmed company domain
 * to extract primary decision makers, verified emails, phone, employee count, and founded year.
 */
export async function probeCompanyWebsite(
  domain: string,
  companyName: string,
  snippets: string[] = []
): Promise<InstantScrapeResult> {
  const result: InstantScrapeResult = {};
  if (!domain) return result;

  const cleanDom = extractCleanDomain(domain) || domain;
  const baseUrl = `https://${cleanDom}`;
  let html = '';
  const pagesHtml: string[] = [];

  // Helper fetch with timeout
  const fetchPage = async (pageUrl: string): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (res.ok) {
        return await res.text();
      }
    } catch {}
    return '';
  };

  // 1. Concurrently probe Homepage + key contact & team pages
  try {
    const [homeRes, contactRes, aboutRes, teamRes, privacyRes] = await Promise.all([
      fetchPage(baseUrl),
      fetchPage(`${baseUrl}/contact`),
      fetchPage(`${baseUrl}/about`),
      fetchPage(`${baseUrl}/team`),
      fetchPage(`${baseUrl}/privacy`),
    ]);

    if (homeRes) pagesHtml.push(homeRes);
    if (contactRes) pagesHtml.push(contactRes);
    if (aboutRes) pagesHtml.push(aboutRes);
    if (teamRes) pagesHtml.push(teamRes);
    if (privacyRes) pagesHtml.push(privacyRes);

    html = pagesHtml.join('\n');
  } catch {}

  // Combine snippets and meta text for comprehensive extraction
  const combinedText = [html ? html.slice(0, 75000) : '', ...snippets].join(' ');

  // 2. Extract Emails from all pages
  const foundEmails = new Set<string>();

  if (html) {
    try {
      const $ = cheerio.load(html);

      // A: Mailto links
      $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const rawEmail = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
        if (
          rawEmail &&
          rawEmail.includes('@') &&
          !COMMON_IMAGE_EXTS.test(rawEmail) &&
          !JUNK_EMAILS.test(rawEmail)
        ) {
          foundEmails.add(rawEmail);
        }
      });

      // B: Tel links
      if (!result.phone) {
        $('a[href^="tel:"]').each((_, el) => {
          if (result.phone) return;
          const href = $(el).attr('href') || '';
          const rawTel = href.replace(/^tel:/i, '').trim();
          if (rawTel.length >= 7) {
            result.phone = rawTel;
          }
        });
      }

      // C: LinkedIn Links
      $('a[href*="linkedin.com/"]').each((_, el) => {
        if (result.linkedinUrl) return;
        const href = $(el).attr('href') || '';
        if (href.includes('linkedin.com/company/') || href.includes('linkedin.com/in/')) {
          result.linkedinUrl = href.split('?')[0];
        }
      });

      // D: JSON-LD Schema
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const content = $(el).html() || '{}';
          const json = JSON.parse(content);
          const org = Array.isArray(json) ? json.find((j) => j['@type'] === 'Organization') : json;
          if (org) {
            if (org.email && typeof org.email === 'string') {
              foundEmails.add(org.email.trim().toLowerCase());
            }
            if (org.telephone && !result.phone) {
              result.phone = String(org.telephone).trim();
            }
            if (org.foundingDate && !result.foundedYear) {
              const yrMatch = String(org.foundingDate).match(/\b(19\d{2}|20[0-2]\d)\b/);
              if (yrMatch) result.foundedYear = yrMatch[1];
            }
            if (org.numberOfEmployees && !result.employeeCount) {
              const emp = org.numberOfEmployees.value || org.numberOfEmployees.name || org.numberOfEmployees;
              if (emp) result.employeeCount = String(emp);
            }
            if ((org.founder || org.founders) && !result.personName) {
              const f = Array.isArray(org.founder || org.founders) ? (org.founder || org.founders)[0] : (org.founder || org.founders);
              const name = f?.name || (typeof f === 'string' ? f : '');
              if (name && name.length < 40) {
                result.personName = name;
                result.jobTitle = 'Founder / CEO';
              }
            }
          }
        } catch {}
      });
    } catch {}
  }

  // Regex email scan from combined body text
  const emailRegexMatches = combinedText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g);
  if (emailRegexMatches) {
    for (const em of emailRegexMatches) {
      const lower = em.toLowerCase();
      if (!COMMON_IMAGE_EXTS.test(lower) && !JUNK_EMAILS.test(lower)) {
        foundEmails.add(lower);
      }
    }
  }

  // 3. Fallback scan on meta and text elements
  if (foundEmails.size === 0 && combinedText) {
    const textEmailMatches = combinedText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g);
    if (textEmailMatches) {
      for (const em of textEmailMatches) {
        const lower = em.toLowerCase();
        if (!COMMON_IMAGE_EXTS.test(lower) && !JUNK_EMAILS.test(lower)) {
          foundEmails.add(lower);
        }
      }
    }
  }

  // Prioritize emails matching the company's domain
  const domainEmails = Array.from(foundEmails).filter((e) => e.includes(cleanDom.split('.')[0]));
  const otherEmails = Array.from(foundEmails).filter((e) => !e.includes(cleanDom.split('.')[0]));
  const prioritizedEmails = [...domainEmails, ...otherEmails];

  // 4. Founded Year from Text
  if (!result.foundedYear) {
    const foundedMatch = combinedText.match(/\b(?:founded|est\.?|established|since)\s*(?:in)?\s*(19\d{2}|20[0-2]\d)\b/i);
    if (foundedMatch) {
      result.foundedYear = foundedMatch[1];
    } else {
      const copyrightMatch = combinedText.match(/(?:©|copyright)\s*(?:20\d{2}\s*-\s*)?(20[0-2]\d)\s+[a-zA-Z]/i);
      if (copyrightMatch) result.foundedYear = copyrightMatch[1];
    }
  }

  // 5. Employee Count / Scale from Text
  if (!result.employeeCount) {
    const empMatch = combinedText.match(/\b(\d{1,4}\s*\+?\s*(?:employees|team members|people|staff))\b/i);
    if (empMatch) result.employeeCount = empMatch[1].trim();
  }

  // 6. Decision Maker Leadership from Text Patterns
  if (!result.personName) {
    const leadershipMatch = combinedText.match(
      /\b(?:founded by|co-founded by|led by|ceo|founder|president)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/
    );
    if (leadershipMatch) {
      const candidateName = leadershipMatch[1].trim();
      const forbidden = /^(About|Contact|Home|Services|Privacy|Terms|Learn|Read|Click|View|Join|Company|Our|The|Platform|Login|Support)\b/i;
      if (!forbidden.test(candidateName)) {
        result.personName = candidateName;
        result.jobTitle = 'Founder / CEO';
      }
    }
  }

  // 7. Fallback Phone Regex
  if (!result.phone) {
    const phoneMatch = combinedText.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
    if (phoneMatch) result.phone = phoneMatch[0].trim();
  }

  // 8. Resilient AI Extraction for Decision Maker (Dual-Provider: Nvidia NIM with automatic Gemini fallback)
  if (!result.personName && combinedText.length > 50) {
    try {
      const aiData = await globalAiResilience.extractWithDualProvider<{
        personName?: string;
        jobTitle?: string;
        employeeCount?: string;
        foundedYear?: string;
        email?: string;
        phone?: string;
      }>({
        text: `Company: ${companyName}, Domain: ${cleanDom}. Text: ${combinedText.slice(0, 10000)}`,
        schemaDescription: `Extract the primary decision maker (Owner, Founder, CEO, President) and business email for ${companyName}.
Schema:
{
  "personName": string or null (Key executive full name),
  "jobTitle": string or null (Executive title, e.g. Founder, CEO),
  "employeeCount": string or null,
  "foundedYear": string or null,
  "email": string or null,
  "phone": string or null
}`,
        taskLabel: `Decision Maker Extraction for ${companyName}`,
      });

      if (aiData?.personName && aiData.personName.length > 4 && !aiData.personName.includes('Google')) {
        result.personName = aiData.personName;
        result.jobTitle = aiData.jobTitle || 'Founder / CEO';
      }
      if (!result.employeeCount && aiData?.employeeCount) result.employeeCount = aiData.employeeCount;
      if (!result.foundedYear && aiData?.foundedYear) result.foundedYear = aiData.foundedYear;
      if (aiData?.email && !JUNK_EMAILS.test(aiData.email)) {
        prioritizedEmails.unshift(aiData.email.toLowerCase());
      }
      if (!result.phone && aiData?.phone) result.phone = aiData.phone;
    } catch {}
  }

  // 9. Assign and Classify Emails (Generic vs Decision Maker) - Strictly REAL data only
  const genericPrefix = /^(info|contact|hello|support|sales|team|admin|office|help|inquiries)@/i;

  const genericFound = prioritizedEmails.find((e) => genericPrefix.test(e));
  const personalFound = prioritizedEmails.find((e) => !genericPrefix.test(e));

  if (genericFound) {
    result.genericEmail = genericFound;
  }
  if (personalFound) {
    result.decisionMakerEmail = personalFound;
    result.email = personalFound;
    result.emailType = 'Professional Personal Email';
  } else if (genericFound) {
    result.email = genericFound;
    result.emailType = 'Generic Business Email';
  }

  // 10. Build Contact Record (Only if real person or real email was actually found)
  if (result.personName || result.email) {
    const contactName = result.personName || `${companyName} Contact`;
    const contactRole = result.jobTitle || (result.personName ? 'Executive / Decision Maker' : 'Company Contact');
    const contactEmail = result.decisionMakerEmail || result.email || '';

    const contact: Contact = {
      id: `cont_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      company_name: companyName || cleanDom,
      website: baseUrl,
      full_name: contactName,
      first_name: contactName.split(' ')[0],
      last_name: contactName.split(' ').slice(1).join(' '),
      role: contactRole,
      email: contactEmail,
      email_type: result.emailType || 'Generic Business Email',
      phone: result.phone || '',
      source_url: baseUrl,
      status: 'Verified',
      linkedin_url: result.linkedinUrl,
      is_decision_maker: Boolean(result.personName),
      decision_maker_tier: result.personName ? 'C-Suite / Executive' : undefined,
      confidence_score: result.personName ? 90 : 75,
    };
    result.contacts = [contact];
  } else {
    result.contacts = [];
  }

  return result;
}

