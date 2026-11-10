import * as cheerio from 'cheerio';
import { WebsiteOperationalStatus } from '../../src/types';

export interface WebsiteCheckResult {
  website_status: WebsiteOperationalStatus;
  website_http_status: number;
  website_last_modified: string; // HTTP Last-Modified header or 'UNKNOWN'
  latest_website_content_date: string; // Most recent content date or 'UNKNOWN'
  website_date_source: string; // 'HTTP Last-Modified' | 'Sitemap' | 'RSS' | 'Schema dateModified' | 'Schema datePublished' | 'Recent article' | 'Other' | 'UNKNOWN'
  website_activity_evidence: string;
  closure_signals_detected: string[];
  redirect_url?: string;
  is_secure_ssl: boolean;
  has_contact_page: boolean;
  has_about_page: boolean;
  has_services_page: boolean;
  meta_title?: string;
  extracted_business_name?: string;
  extracted_phone?: string;
  extracted_email?: string;
  extracted_address?: string;
}

interface DetectedDate {
  date: Date;
  source: 'HTTP Last-Modified' | 'Sitemap' | 'RSS' | 'Schema dateModified' | 'Schema datePublished' | 'Recent article' | 'Other';
}

export class WebsiteActivityChecker {
  /**
   * Performs deep HTTP, structured data, sitemap, RSS feed, and date recency analysis
   */
  public async checkWebsite(rawUrl: string): Promise<WebsiteCheckResult> {
    const result: WebsiteCheckResult = {
      website_status: 'UNKNOWN',
      website_http_status: 0,
      website_last_modified: 'UNKNOWN',
      latest_website_content_date: 'UNKNOWN',
      website_date_source: 'UNKNOWN',
      website_activity_evidence: '',
      closure_signals_detected: [],
      is_secure_ssl: false,
      has_contact_page: false,
      has_about_page: false,
      has_services_page: false,
    };

    let targetUrl = rawUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    result.is_secure_ssl = targetUrl.startsWith('https://');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      result.website_http_status = res.status;
      if (res.url && res.url !== targetUrl) {
        result.redirect_url = res.url;
      }

      // Check HTTP Last-Modified header
      const lastModHeader = res.headers.get('last-modified');
      if (lastModHeader) {
        const parsed = new Date(lastModHeader);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2010 && parsed.getFullYear() <= new Date().getFullYear() + 1) {
          result.website_last_modified = parsed.toISOString().slice(0, 10);
        }
      }

      if (res.status >= 200 && res.status < 300) {
        result.website_status = 'WORKING';
      } else if (res.status >= 300 && res.status < 400) {
        result.website_status = 'PARTIALLY WORKING';
      } else if (res.status >= 400 && res.status < 500) {
        result.website_status = 'OFFLINE';
        result.website_activity_evidence = `HTTP status ${res.status} returned by server.`;
        return result;
      } else {
        result.website_status = 'ERROR';
        result.website_activity_evidence = `Server error HTTP ${res.status}.`;
        return result;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      result.meta_title = $('title').first().text().trim();

      // Check for navigation & sub-pages
      $('a[href]').each((_, el) => {
        const href = ($(el).attr('href') || '').toLowerCase();
        const text = $(el).text().toLowerCase();
        if (href.includes('contact') || text.includes('contact')) result.has_contact_page = true;
        if (href.includes('about') || text.includes('about us') || text.includes('about')) result.has_about_page = true;
        if (href.includes('services') || href.includes('products') || text.includes('services') || text.includes('pricing')) {
          result.has_services_page = true;
        }
      });

      // Extract basic contact info if present on page
      const phoneMatch = html.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) result.extracted_phone = phoneMatch[0];

      const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) result.extracted_email = emailMatch[0];

      // Check for explicit closure phrases in text
      const bodyText = $('body').text().toLowerCase();
      const closurePatterns = [
        'we have permanently closed',
        'closed permanently',
        'store is permanently closed',
        'has ceased operations',
        'is no longer in business',
        'out of business',
        'we are closing down permanently',
        'closed our doors permanently',
        'we are temporarily closed',
        'temporarily closed until further notice',
        'temporarily shut down',
      ];

      for (const pattern of closurePatterns) {
        if (bodyText.includes(pattern)) {
          result.closure_signals_detected.push(pattern);
        }
      }

      // Collect all candidate dates from reliable sources
      const detectedDates: DetectedDate[] = [];

      // 1. If HTTP Last-Modified exists, add it
      if (result.website_last_modified !== 'UNKNOWN') {
        const d = new Date(result.website_last_modified);
        if (!isNaN(d.getTime())) {
          detectedDates.push({ date: d, source: 'HTTP Last-Modified' });
        }
      }

      // 2. Schema.org JSON-LD (dateModified and datePublished)
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const raw = $(el).html();
          if (raw) {
            const data = JSON.parse(raw);
            this.extractDatesFromJsonLd(data, detectedDates);
          }
        } catch {
          // ignore malformed microdata
        }
      });

      // 3. Meta tags for published/modified dates
      const metaDateRules: { selector: string; source: DetectedDate['source'] }[] = [
        { selector: 'meta[property="article:modified_time"]', source: 'Schema dateModified' },
        { selector: 'meta[property="article:published_time"]', source: 'Schema datePublished' },
        { selector: 'meta[name="date"]', source: 'Recent article' },
        { selector: 'meta[name="last-modified"]', source: 'Other' },
        { selector: 'meta[property="og:updated_time"]', source: 'Other' },
      ];

      for (const rule of metaDateRules) {
        const val = $(rule.selector).attr('content');
        if (val) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            detectedDates.push({ date: d, source: rule.source });
          }
        }
      }

      // 4. HTML5 <time> tags with datetime attribute (often blog posts / articles)
      $('time[datetime]').each((_, el) => {
        const dt = $(el).attr('datetime');
        if (dt) {
          const d = new Date(dt);
          if (!isNaN(d.getTime())) {
            detectedDates.push({ date: d, source: 'Recent article' });
          }
        }
      });

      // 5. XML Sitemap check
      const sitemapDate = await this.probeSitemap(targetUrl);
      if (sitemapDate) {
        detectedDates.push({ date: sitemapDate, source: 'Sitemap' });
      }

      // 6. RSS / Atom Feed check
      const rssDate = await this.probeRssFeed(targetUrl, $);
      if (rssDate) {
        detectedDates.push({ date: rssDate, source: 'RSS' });
      }

      // Filter and prioritize dates:
      // Must be between 2012 and (now + 1 day), explicitly excluding copyright strings or crazy future dates
      const maxAllowed = new Date();
      maxAllowed.setDate(maxAllowed.getDate() + 1);

      const validDetected = detectedDates
        .filter((item) => item.date.getTime() <= maxAllowed.getTime() && item.date.getFullYear() >= 2012)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      if (validDetected.length > 0) {
        const latest = validDetected[0];
        result.latest_website_content_date = latest.date.toISOString().slice(0, 10);
        result.website_date_source = latest.source;
      } else {
        result.latest_website_content_date = 'UNKNOWN';
        result.website_date_source = 'UNKNOWN';
      }

      // Build evidence string
      const evidenceParts: string[] = [];
      evidenceParts.push(`Website HTTP ${result.website_http_status} OK`);
      if (result.is_secure_ssl) evidenceParts.push('SSL Active');
      if (result.website_last_modified !== 'UNKNOWN') {
        evidenceParts.push(`Server Header: ${result.website_last_modified}`);
      }
      if (result.latest_website_content_date !== 'UNKNOWN') {
        evidenceParts.push(`Latest Content: ${result.latest_website_content_date} (${result.website_date_source})`);
      } else {
        evidenceParts.push('No reliable content date found');
      }
      if (result.closure_signals_detected.length > 0) {
        evidenceParts.push(`⚠️ Closure signals found on page: "${result.closure_signals_detected.join(', ')}"`);
      }

      result.website_activity_evidence = evidenceParts.join('; ');
    } catch (err: any) {
      result.website_status = 'OFFLINE';
      result.website_http_status = 0;
      result.website_activity_evidence = `Connection failed: ${err.message || 'DNS/Network unreachable'}`;
    }

    return result;
  }

  private extractDatesFromJsonLd(node: any, detectedDates: DetectedDate[]) {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) this.extractDatesFromJsonLd(item, detectedDates);
      return;
    }

    if (node['dateModified']) {
      const d = new Date(node['dateModified']);
      if (!isNaN(d.getTime())) detectedDates.push({ date: d, source: 'Schema dateModified' });
    }
    if (node['datePublished']) {
      const d = new Date(node['datePublished']);
      if (!isNaN(d.getTime())) detectedDates.push({ date: d, source: 'Schema datePublished' });
    }
    if (node['uploadDate'] || node['lastReviewed']) {
      const d = new Date(node['uploadDate'] || node['lastReviewed']);
      if (!isNaN(d.getTime())) detectedDates.push({ date: d, source: 'Other' });
    }

    for (const val of Object.values(node)) {
      if (typeof val === 'object') {
        this.extractDatesFromJsonLd(val, detectedDates);
      }
    }
  }

  private async probeSitemap(baseUrl: string): Promise<Date | null> {
    try {
      const urlObj = new URL(baseUrl);
      const sitemapUrl = `${urlObj.origin}/sitemap.xml`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(sitemapUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;

      const xmlText = await res.text();
      const matches = xmlText.matchAll(/<lastmod>(.*?)<\/lastmod>/gi);
      const sitemapDates: Date[] = [];

      for (const m of matches) {
        if (m[1]) {
          const d = new Date(m[1].trim());
          if (!isNaN(d.getTime()) && d.getFullYear() >= 2015) {
            sitemapDates.push(d);
          }
        }
      }

      if (sitemapDates.length > 0) {
        sitemapDates.sort((a, b) => b.getTime() - a.getTime());
        return sitemapDates[0];
      }
    } catch {
      // sitemap probe handled safely
    }
    return null;
  }

  private async probeRssFeed(baseUrl: string, $: cheerio.CheerioAPI): Promise<Date | null> {
    try {
      const urlObj = new URL(baseUrl);
      // Look for RSS link in HTML first
      let rssUrl: string | undefined = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').attr('href');
      if (rssUrl && !rssUrl.startsWith('http')) {
        rssUrl = `${urlObj.origin}${rssUrl.startsWith('/') ? '' : '/'}${rssUrl}`;
      }
      if (!rssUrl) {
        rssUrl = `${urlObj.origin}/feed`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;

      const feedText = await res.text();
      const dateMatches = feedText.matchAll(/<(?:pubDate|updated|dc:date)>(.*?)<\/(?:pubDate|updated|dc:date)>/gi);
      const feedDates: Date[] = [];

      for (const m of dateMatches) {
        if (m[1]) {
          const d = new Date(m[1].trim());
          if (!isNaN(d.getTime()) && d.getFullYear() >= 2015) {
            feedDates.push(d);
          }
        }
      }

      if (feedDates.length > 0) {
        feedDates.sort((a, b) => b.getTime() - a.getTime());
        return feedDates[0];
      }
    } catch {
      // rss probe handled safely
    }
    return null;
  }
}

export const globalWebsiteChecker = new WebsiteActivityChecker();
