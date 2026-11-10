import * as cheerio from 'cheerio';

export interface GoogleMapsCheckResult {
  google_maps_found: boolean;
  status: 'OPEN' | 'TEMPORARILY CLOSED' | 'PERMANENTLY CLOSED' | 'UNKNOWN';
  match_confidence: 'Exact match' | 'High confidence' | 'Partial match' | 'None';
  place_id?: string;
  business_name?: string;
  formatted_address?: string;
  phone?: string;
  website?: string;
  maps_url?: string;
  user_ratings_total?: number;
  rating?: number;
  evidence: string;
  lookup_status: 'CHECKED' | 'FOUND' | 'NOT_FOUND' | 'ERROR' | 'SKIPPED';
  error_type?: string;
  provider_used: 'Google Places API' | 'Google Maps Web Lookup' | 'None';
  fallback_occurred: boolean;
}

export class GoogleMapsVerifier {
  /**
   * Verifies business status via Google Places API or live Google Maps Places Web Search
   */
  public async verifyBusiness(
    businessName: string,
    domain: string,
    address?: string,
    phone?: string,
    city?: string,
    state?: string,
    zip?: string,
    configuredApiKey?: string
  ): Promise<GoogleMapsCheckResult> {
    const apiKey = (configuredApiKey || process.env.GOOGLE_MAPS_API_KEY || '').trim();

    // Try Google Places API first if API key is provided
    if (apiKey && apiKey.length > 5) {
      try {
        const apiResult = await this.queryPlacesApi(businessName, domain, address, phone, city, state, zip, apiKey);
        if (apiResult.lookup_status !== 'ERROR') {
          return apiResult;
        }
        // If API errored (e.g. quota/key invalid), smoothly fallback to Web Search
        const fallbackResult = await this.queryMapsWebFallback(businessName, domain, address, phone, city, state, zip);
        return {
          ...fallbackResult,
          fallback_occurred: true,
          error_type: apiResult.error_type || 'PLACES_API_FALLBACK',
        };
      } catch (err: any) {
        // Fallback on unexpected exception
        const fallbackResult = await this.queryMapsWebFallback(businessName, domain, address, phone, city, state, zip);
        return {
          ...fallbackResult,
          fallback_occurred: true,
          error_type: err.message || 'API_EXCEPTION',
        };
      }
    }

    // Direct Google Maps Web / Place Search when no API key is provided
    return await this.queryMapsWebFallback(businessName, domain, address, phone, city, state, zip);
  }

  /**
   * Official Google Places API Query
   */
  private async queryPlacesApi(
    businessName: string,
    domain: string,
    address?: string,
    phone?: string,
    city?: string,
    state?: string,
    zip?: string,
    apiKey?: string
  ): Promise<GoogleMapsCheckResult> {
    try {
      const queryParts = [businessName];
      if (address) queryParts.push(address);
      else {
        if (city) queryParts.push(city);
        if (state) queryParts.push(state);
        if (zip) queryParts.push(zip);
      }
      if (phone && queryParts.length === 1) queryParts.push(phone);

      const query = queryParts.join(' ');
      const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
        query
      )}&inputtype=textquery&fields=place_id,name,formatted_address,business_status,website,formatted_phone_number,url,rating,user_ratings_total&key=${apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          google_maps_found: false,
          status: 'UNKNOWN',
          match_confidence: 'None',
          evidence: `Google Places API returned HTTP ${res.status}`,
          lookup_status: 'ERROR',
          error_type: `HTTP_${res.status}`,
          provider_used: 'Google Places API',
          fallback_occurred: false,
        };
      }

      const data = await res.json();
      if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
        return {
          google_maps_found: false,
          status: 'UNKNOWN',
          match_confidence: 'None',
          evidence: `Google Places API error: ${data.error_message || data.status}`,
          lookup_status: 'ERROR',
          error_type: data.status,
          provider_used: 'Google Places API',
          fallback_occurred: false,
        };
      }

      const candidate = data.candidates?.[0];
      if (!candidate) {
        return {
          google_maps_found: false,
          status: 'UNKNOWN',
          match_confidence: 'None',
          evidence: `No matching Google Maps listing found for "${businessName}".`,
          lookup_status: 'NOT_FOUND',
          provider_used: 'Google Places API',
          fallback_occurred: false,
        };
      }

      const matchConfidence = this.calculateMatchConfidence(
        businessName,
        domain,
        candidate.name,
        candidate.website,
        candidate.formatted_address,
        candidate.formatted_phone_number,
        address,
        city,
        state,
        phone
      );

      let opStatus: 'OPEN' | 'TEMPORARILY CLOSED' | 'PERMANENTLY CLOSED' | 'UNKNOWN' = 'OPEN';
      if (candidate.business_status === 'CLOSED_PERMANENTLY') {
        opStatus = 'PERMANENTLY CLOSED';
      } else if (candidate.business_status === 'CLOSED_TEMPORARILY') {
        opStatus = 'TEMPORARILY CLOSED';
      } else if (candidate.business_status === 'OPERATIONAL') {
        opStatus = 'OPEN';
      }

      const mapsUrl = candidate.url || (candidate.place_id ? `https://www.google.com/maps/place/?q=place_id:${candidate.place_id}` : undefined);

      return {
        google_maps_found: true,
        status: opStatus,
        match_confidence: matchConfidence,
        place_id: candidate.place_id,
        business_name: candidate.name,
        formatted_address: candidate.formatted_address,
        phone: candidate.formatted_phone_number,
        website: candidate.website,
        maps_url: mapsUrl,
        user_ratings_total: candidate.user_ratings_total,
        rating: candidate.rating,
        evidence: `Google Maps verified: ${candidate.name} [Status: ${opStatus}, Match: ${matchConfidence}, Address: ${candidate.formatted_address || 'N/A'}]`,
        lookup_status: 'FOUND',
        provider_used: 'Google Places API',
        fallback_occurred: false,
      };
    } catch (err: any) {
      return {
        google_maps_found: false,
        status: 'UNKNOWN',
        match_confidence: 'None',
        evidence: `Google Places API request failed: ${err.message}`,
        lookup_status: 'ERROR',
        error_type: 'NETWORK_ERROR',
        provider_used: 'Google Places API',
        fallback_occurred: false,
      };
    }
  }

  /**
   * Live Google Maps / Places Web Lookup Fallback
   * Queries web search to locate the genuine Google Maps listing and extract status
   */
  private async queryMapsWebFallback(
    businessName: string,
    domain: string,
    address?: string,
    phone?: string,
    city?: string,
    state?: string,
    zip?: string
  ): Promise<GoogleMapsCheckResult> {
    try {
      const queryTerms = [businessName];
      if (address) queryTerms.push(address);
      else {
        if (city) queryTerms.push(city);
        if (state) queryTerms.push(state);
      }
      queryTerms.push('site:google.com/maps');

      const searchQuery = queryTerms.join(' ');
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          google_maps_found: false,
          status: 'UNKNOWN',
          match_confidence: 'None',
          evidence: `Google Maps web lookup service returned HTTP ${res.status}`,
          lookup_status: 'ERROR',
          error_type: `HTTP_${res.status}`,
          provider_used: 'Google Maps Web Lookup',
          fallback_occurred: false,
        };
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      let mapsUrl: string | undefined;
      let snippetText = '';
      let placeTitle = '';

      $('.result').each((_, el) => {
        if (mapsUrl) return;
        const link = $(el).find('.result__url').text() || $(el).find('.result__snippet').attr('href') || '';
        const rawHref = $(el).find('a.result__url, a.result__snippet, a.result__title').attr('href') || '';
        const title = $(el).find('.result__title').text().trim();
        const snippet = $(el).find('.result__snippet').text().trim();

        if (link.includes('google.com/maps') || rawHref.includes('google.com/maps')) {
          // Extract decoded URL if redirected through duckduckgo
          const uddgMatch = rawHref.match(/uddg=([^&]+)/);
          mapsUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawHref;
          placeTitle = title.replace(/\s*-\s*Google Maps$/i, '').trim();
          snippetText = snippet;
        }
      });

      if (!mapsUrl) {
        // Construct canonical search URL as reference
        const refUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${businessName} ${address || city || domain}`)}`;
        return {
          google_maps_found: false,
          status: 'UNKNOWN',
          match_confidence: 'None',
          maps_url: refUrl,
          evidence: `No verified Google Maps listing found for "${businessName}".`,
          lookup_status: 'NOT_FOUND',
          provider_used: 'Google Maps Web Lookup',
          fallback_occurred: false,
        };
      }

      const combinedText = `${placeTitle} ${snippetText}`.toLowerCase();
      let opStatus: 'OPEN' | 'TEMPORARILY CLOSED' | 'PERMANENTLY CLOSED' | 'UNKNOWN' = 'OPEN';

      if (combinedText.includes('permanently closed') || combinedText.includes('closed permanently')) {
        opStatus = 'PERMANENTLY CLOSED';
      } else if (combinedText.includes('temporarily closed') || combinedText.includes('closed temporarily')) {
        opStatus = 'TEMPORARILY CLOSED';
      }

      // Calculate confidence
      const matchConfidence = this.calculateMatchConfidence(
        businessName,
        domain,
        placeTitle,
        undefined,
        snippetText,
        undefined,
        address,
        city,
        state,
        phone
      );

      return {
        google_maps_found: true,
        status: opStatus,
        match_confidence: matchConfidence,
        business_name: placeTitle || businessName,
        formatted_address: snippetText.slice(0, 120),
        maps_url: mapsUrl,
        evidence: `Google Maps listing found: "${placeTitle}" [Status: ${opStatus}, Match: ${matchConfidence}]`,
        lookup_status: 'FOUND',
        provider_used: 'Google Maps Web Lookup',
        fallback_occurred: false,
      };
    } catch (err: any) {
      return {
        google_maps_found: false,
        status: 'UNKNOWN',
        match_confidence: 'None',
        evidence: `Google Maps web lookup error: ${err.message || 'Timeout'}`,
        lookup_status: 'ERROR',
        error_type: 'NETWORK_ERROR',
        provider_used: 'Google Maps Web Lookup',
        fallback_occurred: false,
      };
    }
  }

  /**
   * Entity matching to prevent misidentification
   */
  public calculateMatchConfidence(
    targetName: string,
    targetDomain: string,
    candidateName?: string,
    candidateWebsite?: string,
    candidateAddress?: string,
    candidatePhone?: string,
    targetAddress?: string,
    targetCity?: string,
    targetState?: string,
    targetPhone?: string
  ): 'Exact match' | 'High confidence' | 'Partial match' | 'None' {
    if (!candidateName) return 'None';

    const normTarget = this.normalizeName(targetName);
    const normCand = this.normalizeName(candidateName);

    const nameSim = this.calculateSimilarity(normTarget, normCand);

    // Domain match
    const cleanTargetDomain = (targetDomain || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const cleanCandDomain = (candidateWebsite || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    const domainMatches = Boolean(cleanTargetDomain && cleanCandDomain && (cleanTargetDomain.includes(cleanCandDomain) || cleanCandDomain.includes(cleanTargetDomain)));

    // Phone match
    const cleanTargetPhone = (targetPhone || '').replace(/\D/g, '');
    const cleanCandPhone = (candidatePhone || '').replace(/\D/g, '');
    const phoneMatches = Boolean(cleanTargetPhone.length >= 7 && cleanCandPhone.length >= 7 && cleanTargetPhone.slice(-7) === cleanCandPhone.slice(-7));

    // Address / City / State match
    const candAddrLower = (candidateAddress || '').toLowerCase();
    const cityMatches = Boolean(targetCity && candAddrLower.includes(targetCity.toLowerCase()));
    const stateMatches = Boolean(targetState && candAddrLower.includes(targetState.toLowerCase()));
    const addrMatches = Boolean(targetAddress && candAddrLower.includes(targetAddress.toLowerCase().slice(0, 15)));

    if (nameSim > 0.85 && (domainMatches || phoneMatches || (cityMatches && stateMatches) || addrMatches)) {
      return 'Exact match';
    }

    if ((nameSim > 0.80 && (cityMatches || stateMatches || domainMatches)) || (domainMatches && nameSim > 0.60)) {
      return 'High confidence';
    }

    if (nameSim > 0.55 || normCand.includes(normTarget) || normTarget.includes(normCand)) {
      return 'Partial match';
    }

    return 'None';
  }

  private normalizeName(name?: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/^(the\s+)/i, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+(llc|inc|corp|co|ltd|pllc|group|holdings|services|company|enterprises)$/i, '')
      .trim();
  }

  private calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;

    // Token Jaccard overlap
    const tokens1 = new Set(s1.split(/\s+/));
    const tokens2 = new Set(s2.split(/\s+/));
    let intersection = 0;
    for (const t of tokens1) {
      if (tokens2.has(t)) intersection++;
    }
    const union = new Set([...tokens1, ...tokens2]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    // Levenshtein
    const editDist = this.levenshteinDistance(longer, shorter);
    const levSim = (longer.length - editDist) / longer.length;

    return Math.max(jaccard, levSim);
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}

export const globalGoogleMapsVerifier = new GoogleMapsVerifier();
