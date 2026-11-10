import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedDirectoryCompany } from './types';
import {
  extractCleanDomain,
  isAggregatorOrSocial,
  cleanCompanyName,
  isInvalidCompanyName,
  isArticleUrl,
} from './domainDetector';
import { getSettings } from '../storage';
import { globalAiResilience } from '../services/aiResilience';

const DIRECTORY_FETCH_TIMEOUT_MS = 6000;

/**
 * Fetches and extracts individual companies from a directory, listicle, or article page
 */
export async function extractCompaniesFromDirectory(
  sourceUrl: string,
  sourceTitle: string
): Promise<ExtractedDirectoryCompany[]> {
  const companies: ExtractedDirectoryCompany[] = [];
  const seenNames = new Set<string>();
  const sourceDomain = extractCleanDomain(sourceUrl);

  // Fast rejection of non-business sites (educational, dictionaries, math vocabulary, academic)
  const lowerUrl = (sourceUrl || '').toLowerCase();
  if (
    /(splashlearn\.com|khanacademy\.org|quizlet\.com|brainly\.com|chegg\.com|mathisfun\.com|ixl\.com)/.test(lowerUrl) ||
    /\/(math-vocabulary|algebra|grammar|curriculum|worksheet|k12|lesson-plan)\//.test(lowerUrl)
  ) {
    return [];
  }

  const addCompany = (name: string, website?: string, description?: string) => {
    const cleanedName = cleanCompanyName(name);
    if (!cleanedName) return;

    // Strict validation: Reject article headlines, generic phrases, directory names
    if (isInvalidCompanyName(cleanedName, sourceDomain)) {
      return;
    }

    const normKey = cleanedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normKey || normKey.length < 2 || seenNames.has(normKey)) return;
    seenNames.add(normKey);

    let cleanWeb = '';
    if (website) {
      const dom = extractCleanDomain(website);
      // Ensure outbound website is NOT the directory itself, not social, and not an article link
      if (dom && dom !== sourceDomain && !isAggregatorOrSocial(dom) && !isArticleUrl(website)) {
        cleanWeb = website.startsWith('http') ? website : `https://${dom}`;
      }
    }

    companies.push({
      name: cleanedName,
      website: cleanWeb,
      description: description?.trim() || '',
      sourceUrl,
      sourceTitle,
    });
  };

  // Step 1: Direct HTML Fetch & Cheerio Structural Heuristic Parsing
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DIRECTORY_FETCH_TIMEOUT_MS);

    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);

      // Strip non-content elements
      $('script, style, nav, footer, noscript, header, aside, .sidebar, .comments').remove();

      // Heuristic 1: Heading elements (h2, h3, h4) with numbers or short titles
      $('h2, h3, h4').each((_, el) => {
        const text = $(el).text().trim();
        if (!text || text.length > 80) return;

        // Pattern matching: "1. Datadog", "2. Gusto - HR Software", "#3 HubSpot", "Stripe: Payments"
        let rawName = text;
        if (/^(\d+[\.\-\)]|\#\d+)\s+/.test(rawName)) {
          rawName = rawName.replace(/^(\d+[\.\-\)]|\#\d+)\s*/, '');
        }

        // Split after hyphen, colon, or pipe (e.g. "Gusto - Payroll platform" -> "Gusto")
        rawName = rawName.split(/[\-–—:\|]/)[0].trim();

        if (rawName && !isInvalidCompanyName(rawName, sourceDomain)) {
          let outLink = '';
          const linkInHeading = $(el).find('a').attr('href');
          if (linkInHeading) {
            outLink = linkInHeading;
          } else {
            const nextLink = $(el).next().find('a').attr('href') || $(el).next('a').attr('href');
            if (nextLink) {
              outLink = nextLink;
            }
          }

          const snippet = $(el).next('p').text().trim().slice(0, 200);
          addCompany(rawName, outLink, snippet);
        }
      });

      // Heuristic 2: List elements (ol > li, ul > li) containing strong/b tags or links
      if (companies.length < 5) {
        $('ol > li, ul > li').each((_, li) => {
          const strongTag = $(li).find('strong, b').first();
          let rawName = strongTag.text().trim();
          let link = $(li).find('a').attr('href');

          if (!rawName) {
            // Check if first anchor tag in li has the name
            const firstA = $(li).find('a').first();
            if (firstA.length > 0) {
              rawName = firstA.text().trim();
              link = firstA.attr('href');
            }
          }

          if (rawName && rawName.length > 2 && rawName.length < 50) {
            rawName = rawName.replace(/^(\d+[\.\-\)]|\#\d+)\s*/, '').split(/[\-–—:\|]/)[0].trim();
            const desc = $(li).text().replace(rawName, '').trim().slice(0, 180);
            addCompany(rawName, link, desc);
          }
        });
      }

      // Heuristic 3: Table rows
      if (companies.length < 5) {
        $('table tr').each((_, tr) => {
          const firstCol = $(tr).find('td').first().text().trim();
          const link = $(tr).find('a').attr('href');
          if (firstCol && firstCol.length > 2 && firstCol.length < 50) {
            addCompany(firstCol, link);
          }
        });
      }
    }
  } catch {
    // 3rd-party directory or article URL failed to fetch (offline, DNS failure, or bot protection)
    // Silently continue to fallback without emitting error notice
  }

  // Step 2: Google Search Grounding & Gemini extraction fallback if page was protected/blocked or few companies extracted
  if (companies.length < 3) {
    const settings = getSettings();
    const hasKey = Boolean(settings.gemini_api_key || process.env.GEMINI_API_KEY || process.env.NVIDIA_API_KEY);

    if (hasKey) {
      try {
        const prompt = `Search the live web for the article or list titled "${sourceTitle}" at "${sourceUrl}".
Extract all individual real company names mentioned in this directory or listicle.
For each company, provide their company name, brief description, and official website domain if mentioned.
Do NOT include the article publisher (${sourceDomain}).
Do NOT invent fake companies. Only extract real companies actually mentioned in this source.

Return strict JSON array with schema:
[
  { "name": "Company Name", "website": "https://company.com", "description": "Brief description" }
]`;

        const text = await globalAiResilience.generateWithDualProvider({
          prompt,
          systemInstruction: 'You are an expert sales prospect extraction engine. Output strict JSON array only.',
          jsonMode: true,
          taskLabel: `Directory Extraction ("${sourceTitle.slice(0, 30)}...")`,
        });

        if (text) {
          try {
            let cleanText = text.trim();
            if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
            }
            const list = JSON.parse(cleanText);
            if (Array.isArray(list)) {
              for (const item of list) {
                if (item && item.name) {
                  addCompany(item.name, item.website, item.description);
                }
              }
            }
          } catch {}
        }
      } catch {
        // Silently continue if external AI directory extraction encounters an issue
      }
    }
  }

  return companies;
}
