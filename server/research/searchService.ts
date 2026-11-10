import { SearchRetrieverResult, ResearchSourceType } from './types';
import { DuckDuckGoDiscoveryProvider, GoogleGeminiDiscoveryProvider } from '../discovery/provider';
import { extractCleanDomain } from '../discovery/domainDetector';
import { getSettings } from '../storage';

export class CompanySearchRetriever {
  private ddgProvider = new DuckDuckGoDiscoveryProvider();
  private geminiProvider = new GoogleGeminiDiscoveryProvider();

  /**
   * Determine source type from URL and content
   */
  public classifySourceType(url: string, title?: string, snippet?: string): ResearchSourceType {
    const lowerUrl = url.toLowerCase();
    const text = `${title || ''} ${snippet || ''}`.toLowerCase();

    if (lowerUrl.includes('linkedin.com/company') || lowerUrl.includes('linkedin.com/in')) {
      return 'linkedin_public';
    }
    if (
      lowerUrl.includes('sec.gov') ||
      lowerUrl.includes('companieshouse.gov.uk') ||
      lowerUrl.includes('.gov') ||
      lowerUrl.includes('.gob') ||
      lowerUrl.includes('sos.') ||
      lowerUrl.includes('corporations.') ||
      text.includes('secretary of state') ||
      text.includes('official registry')
    ) {
      return 'government_registry';
    }
    if (
      lowerUrl.includes('crunchbase.com') ||
      lowerUrl.includes('bloomberg.com') ||
      lowerUrl.includes('pitchbook.com') ||
      lowerUrl.includes('zoominfo.com') ||
      lowerUrl.includes('apollo.io') ||
      lowerUrl.includes('dnb.com') ||
      lowerUrl.includes('g2.com') ||
      lowerUrl.includes('clutch.co') ||
      lowerUrl.includes('martindale.com') ||
      lowerUrl.includes('avvo.com') ||
      lowerUrl.includes('findlaw.com') ||
      lowerUrl.includes('superlawyers.com')
    ) {
      return 'business_directory';
    }
    if (
      lowerUrl.includes('reuters.com') ||
      lowerUrl.includes('prnewswire.com') ||
      lowerUrl.includes('businesswire.com') ||
      lowerUrl.includes('forbes.com') ||
      lowerUrl.includes('wsj.com') ||
      lowerUrl.includes('techcrunch.com') ||
      lowerUrl.includes('globenewswire.com')
    ) {
      return 'press_or_report';
    }
    return 'general_web';
  }

  /**
   * Search public web for targeted company facts
   */
  public async retrieveCompanyEvidence(params: {
    companyName: string;
    domain?: string;
    location?: string;
    maxResults?: number;
    provider?: 'auto' | 'openrouter_web' | 'duckduckgo';
  }): Promise<{
    sources: SearchRetrieverResult[];
    searchIntegration: string;
    isAvailable: boolean;
  }> {
    const { companyName, domain, location } = params;
    const cleanDomain = domain ? extractCleanDomain(domain) : '';
    const cleanName = companyName.trim();
    const maxResults = params.maxResults || 15;

    const queries: { query: string; purpose: string }[] = [];

    // 1. Overview & Identity Query
    const locSnippet = location ? ` "${location}"` : '';
    const domSnippet = cleanDomain ? ` OR site:${cleanDomain}` : '';
    queries.push({
      query: `"${cleanName}" (about OR company OR headquarters OR overview)${locSnippet}`,
      purpose: 'company_identity_overview',
    });

    // 2. LinkedIn Public Presence Query
    queries.push({
      query: `"${cleanName}" (site:linkedin.com/company OR site:linkedin.com/in)${locSnippet}`,
      purpose: 'linkedin_presence',
    });

    // 3. Leadership & Documented Decision-Makers Query
    queries.push({
      query: `"${cleanName}" ("founder" OR "co-founder" OR "CEO" OR "president" OR "managing partner" OR "partner" OR "director" OR "managing director")${locSnippet}`,
      purpose: 'leadership_decision_makers',
    });

    // 4. Firmographics Query (Employees, Founded Year, Incorporation)
    queries.push({
      query: `"${cleanName}" ("employees" OR "team of" OR "founded in" OR "established in" OR "incorporated in" OR "headcount")`,
      purpose: 'firmographics_metrics',
    });

    const gatheredResults: SearchRetrieverResult[] = [];
    const seenUrls = new Set<string>();

    let usedIntegration = 'Public Web Search';
    let anySearchSucceeded = false;

    for (const q of queries) {
      try {
        const rawResults = await this.ddgProvider.searchWeb(q.query, { maxResults: 6 });
        if (rawResults && rawResults.length > 0) {
          anySearchSucceeded = true;
          for (const item of rawResults) {
            if (!item.url || seenUrls.has(item.url.toLowerCase())) continue;
            seenUrls.add(item.url.toLowerCase());

            const itemDomain = extractCleanDomain(item.url);
            let sourceType = this.classifySourceType(item.url, item.title, item.snippet);

            // Check if this is the company's official domain
            if (cleanDomain && (itemDomain === cleanDomain || itemDomain.endsWith(`.${cleanDomain}`))) {
              sourceType = 'official_site';
            }

            gatheredResults.push({
              title: item.title,
              url: item.url,
              snippet: item.snippet,
              source_type: sourceType,
              query_used: q.query,
            });

            if (gatheredResults.length >= maxResults) break;
          }
        }
      } catch (err: any) {
        console.warn(`[SearchRetriever] DDG query failed: "${q.query}":`, err.message);
      }

      if (gatheredResults.length >= maxResults) break;
    }

    // If DDG was restricted or sparse, check if Google Gemini grounding is available
    if (gatheredResults.length < 3) {
      const settings = getSettings();
      const hasGemini = Boolean(settings.gemini_api_key || process.env.GEMINI_API_KEY);
      if (hasGemini) {
        try {
          const geminiQuery = `Company profile, leadership, employee count and founding year for "${cleanName}" ${cleanDomain}`;
          const gResults = await this.geminiProvider.searchWeb(geminiQuery, { maxResults: 8 });
          if (gResults && gResults.length > 0) {
            anySearchSucceeded = true;
            usedIntegration = 'Google Grounding + Web Search';
            for (const item of gResults) {
              if (!item.url || seenUrls.has(item.url.toLowerCase())) continue;
              seenUrls.add(item.url.toLowerCase());

              const itemDomain = extractCleanDomain(item.url);
              let sourceType = this.classifySourceType(item.url, item.title, item.snippet);
              if (cleanDomain && (itemDomain === cleanDomain || itemDomain.endsWith(`.${cleanDomain}`))) {
                sourceType = 'official_site';
              }

              gatheredResults.push({
                title: item.title,
                url: item.url,
                snippet: item.snippet || item.title,
                source_type: sourceType,
                query_used: geminiQuery,
              });
            }
          }
        } catch (gErr: any) {
          console.warn(`[SearchRetriever] Gemini grounding fallback notice:`, gErr.message);
        }
      }
    }

    return {
      sources: gatheredResults,
      searchIntegration: usedIntegration,
      isAvailable: anySearchSucceeded || gatheredResults.length > 0,
    };
  }
}

export const globalCompanySearchRetriever = new CompanySearchRetriever();
