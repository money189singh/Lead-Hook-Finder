export interface SearchVerificationResult {
  status: 'VERIFIED_ACTIVE' | 'CLOSURE_INDICATOR_FOUND' | 'INCONCLUSIVE' | 'SKIPPED';
  evidence_summary: string;
  queries_executed: string[];
  closure_mentions: string[];
  activity_mentions: string[];
  provider_used: string;
}

export class SearchVerifier {
  /**
   * Intelligently executes targeted search queries to detect closure indicators or recent operational activity
   */
  public async verifyBusiness(
    businessName: string,
    domain: string,
    location?: string,
    level: 'MEDIUM' | 'HIGH' = 'MEDIUM',
    apiConfig?: { search1Key?: string; search2Key?: string }
  ): Promise<SearchVerificationResult> {
    const cleanName = (businessName || domain || '').replace(/[^\w\s-]/g, '').trim();
    const cleanDomain = (domain || '').replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

    const queries: string[] = [];
    // Primary closure query
    queries.push(`"${cleanName}" permanently closed`);

    // Level HIGH runs additional queries
    if (level === 'HIGH') {
      queries.push(`"${cleanName}" closed OR "out of business"`);
      queries.push(`"${cleanName}" reviews 2025 OR 2026`);
      if (location) {
        queries.push(`"${cleanName}" "${location}"`);
      }
    } else {
      queries.push(`"${cleanName}" reviews`);
    }

    const closureMentions: string[] = [];
    const activityMentions: string[] = [];
    const queriesExecuted: string[] = [];
    let providerUsed = 'Search API #1';

    try {
      // Execute the primary closure query
      for (const q of queries) {
        queriesExecuted.push(q);
        const searchResults = await this.executeSearchQuery(q, apiConfig);
        providerUsed = searchResults.provider;

        for (const item of searchResults.items) {
          const text = `${item.title} ${item.snippet}`.toLowerCase();

          // Check for closure keywords
          if (
            text.includes('permanently closed') ||
            text.includes('closed permanently') ||
            text.includes('has closed down') ||
            text.includes('is no longer open') ||
            text.includes('has ceased trading')
          ) {
            closureMentions.push(item.snippet);
          }

          // Check for recent activity indicators
          if (
            text.includes('2026') ||
            text.includes('2025') ||
            text.includes('hours today') ||
            text.includes('updated their') ||
            text.includes('recent review')
          ) {
            activityMentions.push(item.snippet);
          }
        }

        // If strong closure mention found on primary query, stop early (Requirement #16)
        if (closureMentions.length > 0) {
          break;
        }
      }

      if (closureMentions.length > 0) {
        return {
          status: 'CLOSURE_INDICATOR_FOUND',
          evidence_summary: `Search signals indicate closure: "${closureMentions[0].slice(0, 140)}..."`,
          queries_executed: queriesExecuted,
          closure_mentions: closureMentions,
          activity_mentions: activityMentions,
          provider_used: providerUsed,
        };
      }

      if (activityMentions.length > 0) {
        return {
          status: 'VERIFIED_ACTIVE',
          evidence_summary: `Recent business mentions located across search index without closure indicators.`,
          queries_executed: queriesExecuted,
          closure_mentions: closureMentions,
          activity_mentions: activityMentions,
          provider_used: providerUsed,
        };
      }

      return {
        status: 'INCONCLUSIVE',
        evidence_summary: `No decisive closure or recent operating notices discovered across ${queriesExecuted.length} search queries.`,
        queries_executed: queriesExecuted,
        closure_mentions: [],
        activity_mentions: [],
        provider_used: providerUsed,
      };
    } catch (err: any) {
      return {
        status: 'INCONCLUSIVE',
        evidence_summary: `Search verification error: ${err.message}`,
        queries_executed: queriesExecuted,
        closure_mentions: [],
        activity_mentions: [],
        provider_used: 'Failed',
      };
    }
  }

  /**
   * Executes search via configured provider with automatic fallback (Requirement #15)
   */
  private async executeSearchQuery(
    query: string,
    apiConfig?: { search1Key?: string; search2Key?: string }
  ): Promise<{ items: { title: string; snippet: string; link?: string }[]; provider: string }> {
    const serpApiKey = apiConfig?.search1Key || process.env.SERPAPI_API_KEY || '';

    // 1. Try SerpApi / Google Search if configured
    if (serpApiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}&num=5`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const items = (data.organic_results || []).map((r: any) => ({
            title: r.title || '',
            snippet: r.snippet || '',
            link: r.link || '',
          }));
          return { items, provider: 'SerpApi' };
        }
      } catch (err) {
        // Fallback to secondary provider
      }
    }

    // 2. Fallback to DuckDuckGo Instant Answer / HTML Search API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(ddgUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const items: { title: string; snippet: string }[] = [];
        if (data.AbstractText) {
          items.push({ title: data.Heading || query, snippet: data.AbstractText });
        }
        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 4)) {
            if (topic.Text) items.push({ title: topic.FirstURL || query, snippet: topic.Text });
          }
        }
        return { items, provider: 'DuckDuckGo API' };
      }
    } catch {
      // Fallback
    }

    return { items: [], provider: 'Fallback (No results)' };
  }
}

export const globalSearchVerifier = new SearchVerifier();
