import {
  ResearchedCompanyProfile,
  ResearchedField,
  ResearchedPerson,
  ResearchEvidenceStatus,
  ResearchPromptContext,
  RawResearchExtraction,
  ResearchSourceItem,
} from './types';
import { extractCleanDomain } from '../discovery/domainDetector';

export class CompanyEvidenceExtractor {
  /**
   * Construct strict, grounded system and user prompts
   */
  public buildPrompt(context: ResearchPromptContext): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are an elite, objective B2B company intelligence and firmographics researcher.
Your job is to read retrieved web search results and extract verifiable facts about the target company.

STRICT RESEARCH STANDARDS:
1. ONLY extract facts directly supported by the provided search evidence.
2. NEVER invent, hallucinate, extrapolate, or guess any employee counts, founding years, LinkedIn URLs, people, or details.
3. If an item is not found or unsupported by the evidence, leave it null or omit it. DO NOT insert placeholder numbers (like 0, 1, or "unknown").
4. EMPLOYEE COUNT:
   - Preserve what the source says: exact count, approximate, or range (e.g. "11-50", "35", "50+").
   - NEVER convert a range into a single number.
   - Do NOT count the number of people in a team snippet to infer total company size.
5. FOUNDING YEAR vs INCORPORATION:
   - Differentiate "Company Founded" from "Legal Incorporation", "Domain Registered", or "Acquired".
   - Only fill founded_year if the source explicitly states when the company was founded or established.
   - If the source explicitly states legal incorporation, store it in incorporation_year.
6. LINKEDIN PRESENCE:
   - Preserve exact public URLs found.
   - Distinguish company pages (linkedin.com/company/...) from individual profiles (linkedin.com/in/...).
7. DECISION-MAKERS & LEADERSHIP:
   - Prioritize senior leaders: founders, CEOs, managing partners, partners, principals, directors, presidents.
   - For law firms: include Managing Partner, Equity Partner, Partner, Principal, Founder.
   - Each person MUST have: full_name, job_title, company_association, source_url, evidence_snippet.
   - NEVER invent email addresses or private phone numbers.

Output MUST be a valid JSON object matching the requested schema.`;

    const sourcesBlock = context.sources.map((s, idx) => {
      return `[SOURCE ${idx + 1}]
Title: ${s.title}
URL: ${s.url}
Type: ${s.source_type}
Snippet: ${s.snippet}
`;
    }).join('\n');

    const userPrompt = `Target Company to Research:
Name: "${context.companyName}"
Domain / Website: "${context.domain || context.website || 'Not specified'}"
Location: "${context.location || 'Not specified'}"

RETRIEVED PUBLIC SEARCH SOURCES:
${sourcesBlock || 'No public sources retrieved.'}

Please extract structured company facts from these sources.
Return JSON with this exact structure:
{
  "company_identity": {
    "official_name": "string or null",
    "website": "string or null",
    "domain": "string or null",
    "linkedin_url": "string or null (must be linkedin.com/company/...)",
    "location": "string or null",
    "industry": "string or null",
    "source_url": "string or null",
    "evidence": "string or null"
  },
  "company_profile": {
    "what_it_does": "string or null (clear summary of business)",
    "products_services": ["string"] or null,
    "description": "string or null",
    "business_category": "string or null",
    "source_url": "string or null",
    "evidence": "string or null"
  },
  "firmographics": {
    "employee_count": "string or null (e.g. '35')",
    "employee_range": "string or null (e.g. '11-50')",
    "employee_count_type": "exact | approximate | range | lower_bound | upper_bound",
    "founded_year": "string or null (4 digits, e.g. '2012')",
    "incorporation_year": "string or null (if specifically incorporated)",
    "count_source_url": "string or null",
    "count_evidence": "string or null",
    "founded_source_url": "string or null",
    "founded_evidence": "string or null"
  },
  "decision_makers": [
    {
      "full_name": "string",
      "job_title": "string",
      "company_association": "string",
      "department": "string or null",
      "profile_url": "string or null (e.g. linkedin.com/in/...)",
      "is_company_page": false,
      "source_url": "string",
      "evidence_snippet": "string"
    }
  ]
}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Determine evidence confidence status from source URL and company domain
   */
  public evaluateConfidence(
    sourceUrl?: string,
    companyDomain?: string,
    isContradicted: boolean = false
  ): ResearchEvidenceStatus {
    if (!sourceUrl) return 'Unknown';
    if (isContradicted) return 'Conflicting evidence';

    const cleanDomain = companyDomain ? extractCleanDomain(companyDomain) : '';
    const srcDomain = extractCleanDomain(sourceUrl);

    if (cleanDomain && (srcDomain === cleanDomain || srcDomain.endsWith(`.${cleanDomain}`))) {
      return 'Official source';
    }

    const lower = sourceUrl.toLowerCase();
    if (
      lower.includes('.gov') ||
      lower.includes('companieshouse') ||
      lower.includes('sec.gov') ||
      lower.includes('crunchbase.com') ||
      lower.includes('bloomberg.com') ||
      lower.includes('dnb.com')
    ) {
      return 'Credible secondary source';
    }

    if (lower.includes('linkedin.com')) {
      return 'Credible secondary source';
    }

    return 'Search lead — needs verification';
  }

  /**
   * Validate and sanitize raw year string
   */
  public validateYear(rawYear?: string): string | undefined {
    if (!rawYear) return undefined;
    const clean = String(rawYear).trim();
    const match = clean.match(/\b(1[7-9]\d{2}|20[0-2]\d)\b/);
    if (match) {
      const yearNum = parseInt(match[1], 10);
      const currentYear = new Date().getFullYear();
      if (yearNum >= 1700 && yearNum <= currentYear) {
        return String(yearNum);
      }
    }
    return undefined;
  }

  /**
   * Validate and sanitize employee count / range
   */
  public validateEmployeeMetrics(
    rawCount?: string,
    rawRange?: string
  ): {
    count?: string;
    range?: string;
    type?: 'exact' | 'approximate' | 'range' | 'lower_bound' | 'upper_bound';
  } {
    let cleanCount: string | undefined = undefined;
    let cleanRange: string | undefined = undefined;
    let countType: 'exact' | 'approximate' | 'range' | 'lower_bound' | 'upper_bound' | undefined = undefined;

    const countStr = rawCount ? String(rawCount).trim() : '';
    const rangeStr = rawRange ? String(rawRange).trim() : '';

    // 1. Check for range in rangeStr or countStr
    const rangeTarget = rangeStr || (countStr.includes('-') || countStr.includes('–') || countStr.includes('—') || countStr.includes(' to ') ? countStr : '');
    const rangeMatch = rangeTarget.match(/(\d+)\s*[-–—to]+\s*(\d+)/i);
    if (rangeMatch) {
      cleanRange = `${rangeMatch[1]}-${rangeMatch[2]}`;
      countType = 'range';
    }

    // 2. Check for exact count if countStr contains numeric digits and is not solely a range
    if (countStr && !/^\s*\d+\s*[-–—to]+\s*\d+\s*$/i.test(countStr)) {
      const numMatch = countStr.replace(/,/g, '').match(/\b(\d+)\b/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val > 0 && val < 5000000) {
          cleanCount = String(val);
          countType = countStr.includes('+')
            ? 'lower_bound'
            : countStr.includes('~') || /approx|about/i.test(countStr)
            ? 'approximate'
            : 'exact';
        }
      }
    }

    // Reject placeholder values
    if (cleanCount && (cleanCount === '0' || /^(unknown|n\/a|not found)$/i.test(cleanCount))) {
      cleanCount = undefined;
    }
    if (cleanRange && /^(unknown|n\/a|not found)$/i.test(cleanRange)) {
      cleanRange = undefined;
    }

    return { count: cleanCount, range: cleanRange, type: countType };
  }

  /**
   * Validate URL format
   */
  public validateUrl(rawUrl?: string): string | undefined {
    if (!rawUrl) return undefined;
    let url = String(rawUrl).trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    try {
      const parsed = new URL(url);
      if (parsed.hostname && parsed.hostname.includes('.')) {
        return parsed.toString();
      }
    } catch {}
    return undefined;
  }

  /**
   * Transform raw extraction into structured, verified ResearchedCompanyProfile
   */
  public parseAndValidate(
    raw: RawResearchExtraction,
    companyDomain?: string
  ): {
    profile: ResearchedCompanyProfile;
    sources: ResearchSourceItem[];
  } {
    const today = new Date().toISOString();
    const cleanDomain = companyDomain ? extractCleanDomain(companyDomain) : '';

    const identity = raw.company_identity || {};
    const profileData = raw.company_profile || {};
    const firmo = raw.firmographics || {};
    const rawDecisionMakers = Array.isArray(raw.decision_makers) ? raw.decision_makers : [];

    const sourcesMap = new Map<string, ResearchSourceItem>();

    const recordSource = (url?: string, type?: any, title?: string, snippet?: string) => {
      if (!url) return;
      const valid = this.validateUrl(url);
      if (valid && !sourcesMap.has(valid)) {
        sourcesMap.set(valid, {
          title: title || valid,
          url: valid,
          snippet: snippet || '',
          source_type: type || 'general_web',
        });
      }
    };

    // 1. Identity Fields
    const officialName = identity.official_name?.trim();
    const officialWebsite = this.validateUrl(identity.website || (cleanDomain ? `https://${cleanDomain}` : undefined));
    const domain = cleanDomain || (officialWebsite ? extractCleanDomain(officialWebsite) : undefined);

    let linkedinPage: string | undefined = undefined;
    if (identity.linkedin_url) {
      const validLd = this.validateUrl(identity.linkedin_url);
      if (validLd && validLd.toLowerCase().includes('linkedin.com/company/')) {
        linkedinPage = validLd;
      }
    }

    const idSource = this.validateUrl(identity.source_url) || officialWebsite;
    if (idSource) recordSource(idSource, 'official_site', officialName, identity.evidence);

    // 2. Profile Fields
    const whatItDoes = profileData.what_it_does?.trim();
    const desc = profileData.description?.trim();
    const businessCat = profileData.business_category?.trim();
    const products = Array.isArray(profileData.products_services)
      ? profileData.products_services.map((p) => String(p).trim()).filter(Boolean)
      : undefined;

    const profSource = this.validateUrl(profileData.source_url) || idSource;
    if (profSource) recordSource(profSource, 'general_web', officialName, profileData.evidence);

    // 3. Firmographics
    const empMetrics = this.validateEmployeeMetrics(firmo.employee_count, firmo.employee_range);
    const validFounded = this.validateYear(firmo.founded_year);
    const validIncorp = this.validateYear(firmo.incorporation_year);

    const countSource = this.validateUrl(firmo.count_source_url) || idSource;
    const foundedSource = this.validateUrl(firmo.founded_source_url) || idSource;

    if (countSource) recordSource(countSource, 'business_directory', 'Employee Count Source', firmo.count_evidence);
    if (foundedSource) recordSource(foundedSource, 'business_directory', 'Founded Year Source', firmo.founded_evidence);

    // 4. Decision Makers
    const decisionMakers: ResearchedPerson[] = [];
    for (const dm of rawDecisionMakers) {
      const name = dm.full_name?.trim();
      const title = dm.job_title?.trim();
      if (!name || !title || name.length < 2) continue;

      const dmSource = this.validateUrl(dm.source_url) || idSource || '';
      let profileUrl = this.validateUrl(dm.profile_url);
      const isCompanyPage = Boolean(profileUrl && profileUrl.toLowerCase().includes('linkedin.com/company/'));

      if (profileUrl && isCompanyPage) {
        // Misattributed company page as personal profile
        if (!linkedinPage) linkedinPage = profileUrl;
        profileUrl = undefined;
      }

      if (dmSource) {
        recordSource(dmSource, dmSource.includes('linkedin.com') ? 'linkedin_public' : 'general_web', name, dm.evidence_snippet);
      }

      decisionMakers.push({
        full_name: name,
        job_title: title,
        company_association: dm.company_association || officialName || cleanDomain || 'Target Company',
        department: dm.department?.trim() || undefined,
        profile_url: profileUrl,
        is_company_page: isCompanyPage,
        source_url: dmSource,
        evidence_snippet: dm.evidence_snippet || '',
        confidence: this.evaluateConfidence(dmSource, cleanDomain),
        research_timestamp: today,
        needs_review: !dmSource || !dm.evidence_snippet,
      });
    }

    const profile: ResearchedCompanyProfile = {
      official_company_name: officialName
        ? {
            value: officialName,
            source_url: idSource,
            source_type: 'official_site',
            evidence_snippet: identity.evidence,
            confidence: this.evaluateConfidence(idSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      official_website: officialWebsite
        ? {
            value: officialWebsite,
            source_url: idSource,
            source_type: 'official_site',
            confidence: 'Official source',
            research_date: today,
          }
        : undefined,

      domain: domain
        ? {
            value: domain,
            source_url: idSource,
            source_type: 'official_site',
            confidence: 'Official source',
            research_date: today,
          }
        : undefined,

      linkedin_page: linkedinPage
        ? {
            value: linkedinPage,
            source_url: idSource,
            source_type: 'linkedin_public',
            confidence: 'Credible secondary source',
            research_date: today,
          }
        : undefined,

      location: identity.location?.trim()
        ? {
            value: identity.location.trim(),
            source_url: idSource,
            source_type: 'official_site',
            evidence_snippet: identity.evidence,
            confidence: this.evaluateConfidence(idSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      industry: identity.industry?.trim()
        ? {
            value: identity.industry.trim(),
            source_url: idSource,
            source_type: 'official_site',
            confidence: this.evaluateConfidence(idSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      what_company_does: whatItDoes
        ? {
            value: whatItDoes,
            source_url: profSource,
            source_type: 'general_web',
            evidence_snippet: profileData.evidence,
            confidence: this.evaluateConfidence(profSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      main_products_or_services: products && products.length > 0
        ? {
            value: products,
            source_url: profSource,
            source_type: 'general_web',
            confidence: this.evaluateConfidence(profSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      company_description: desc
        ? {
            value: desc,
            source_url: profSource,
            source_type: 'general_web',
            evidence_snippet: profileData.evidence,
            confidence: this.evaluateConfidence(profSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      business_category: businessCat
        ? {
            value: businessCat,
            source_url: profSource,
            source_type: 'general_web',
            confidence: this.evaluateConfidence(profSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      employee_count: empMetrics.count
        ? {
            value: empMetrics.count,
            source_url: countSource,
            source_type: 'business_directory',
            evidence_snippet: firmo.count_evidence,
            confidence: this.evaluateConfidence(countSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      employee_range: empMetrics.range
        ? {
            value: empMetrics.range,
            source_url: countSource,
            source_type: 'business_directory',
            evidence_snippet: firmo.count_evidence,
            confidence: this.evaluateConfidence(countSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      employee_count_type: empMetrics.type,

      founded_year: validFounded
        ? {
            value: validFounded,
            source_url: foundedSource,
            source_type: 'business_directory',
            evidence_snippet: firmo.founded_evidence,
            confidence: this.evaluateConfidence(foundedSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      incorporation_year: validIncorp
        ? {
            value: validIncorp,
            source_url: foundedSource,
            source_type: 'government_registry',
            evidence_snippet: firmo.founded_evidence,
            confidence: this.evaluateConfidence(foundedSource, cleanDomain),
            research_date: today,
          }
        : undefined,

      decision_makers: decisionMakers,
    };

    return {
      profile,
      sources: Array.from(sourcesMap.values()),
    };
  }
}

export const globalEvidenceExtractor = new CompanyEvidenceExtractor();
