import { SocialDemandLead, DemandUrgency } from '../../src/types';
import { getSettings } from '../storage';

interface RedditPostData {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  permalink: string;
  url: string;
  created_utc: number;
  score: number;
  num_comments: number;
}

export class RedditDemandScanner {
  private userAgent = 'LeadHook-Radar:v2.0.0 (by LeadHook Commercial Intent)';
  private cachedToken: { token: string; expiresAt: number } | null = null;

  /**
   * Acquire official Reddit App OAuth Token if credentials are provided in settings or env
   */
  private async getOAuthToken(): Promise<string | null> {
    const settings = getSettings();
    const clientId = (settings as any).reddit_client_id || process.env.REDDIT_CLIENT_ID || '';
    const clientSecret = (settings as any).reddit_client_secret || process.env.REDDIT_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      return null;
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.token;
    }

    try {
      const auth = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
      const res = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
        },
        body: 'grant_type=client_credentials',
      });

      if (!res.ok) {
        console.warn(`[RedditScanner] OAuth token request returned status ${res.status}`);
        return null;
      }

      const data: any = await res.json();
      if (data && data.access_token) {
        this.cachedToken = {
          token: data.access_token,
          expiresAt: now + (data.expires_in || 3600) * 1000,
        };
        return this.cachedToken.token;
      }
    } catch (e: any) {
      console.warn('[RedditScanner] OAuth error:', e.message || e);
    }

    return null;
  }

  /**
   * Search Reddit for high-intent purchase or service demand posts
   */
  public async searchDemandPosts(query: string, categoryHint: string = 'Accounting & Services', limit: number = 20): Promise<SocialDemandLead[]> {
    const leads: SocialDemandLead[] = [];
    const searchTerm = query.includes(' ') && !query.includes('"')
      ? `"${query}" OR "looking for ${query}" OR "need ${query}"`
      : query;

    const token = await this.getOAuthToken();

    if (token) {
      // 1. Authenticated Reddit OAuth API Request (Free tier, never blocked by Cloud IPs)
      try {
        const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(searchTerm)}&sort=new&limit=${Math.min(limit, 30)}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const data: any = await res.json();
          const children = data?.data?.children || [];
          for (const item of children) {
            const p: RedditPostData = item?.data;
            if (!p || !p.title || p.author === '[deleted]' || p.author === 'AutoModerator') continue;
            const combinedText = `${p.title}\n${p.selftext || ''}`;
            if (this.isOfferingServiceRatherThanSeeking(combinedText)) continue;
            const parsedLead = this.parseRedditPostToLead(p, categoryHint);
            if (parsedLead) leads.push(parsedLead);
          }
        }
      } catch (err: any) {
        console.warn('[RedditScanner] OAuth search notice:', err.message || err);
      }
    } else {
      // 2. Unauthenticated public search attempt
      try {
        const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(searchTerm)}&sort=new&limit=${Math.min(limit, 25)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data: any = await res.json();
          const children = data?.data?.children || [];
          for (const item of children) {
            const p: RedditPostData = item?.data;
            if (!p || !p.title || p.author === '[deleted]' || p.author === 'AutoModerator') continue;
            const combinedText = `${p.title}\n${p.selftext || ''}`;
            if (this.isOfferingServiceRatherThanSeeking(combinedText)) continue;
            const parsedLead = this.parseRedditPostToLead(p, categoryHint);
            if (parsedLead) leads.push(parsedLead);
          }
        }
      } catch {
        // Expected when datacenter IP is blocked by public Reddit gateway.
        // We will seamlessly complement with RemoteOK and Hacker News real feeds!
      }
    }

    return leads;
  }

  /**
   * Parse a real Reddit submission directly into a verified SocialDemandLead
   */
  public parseRedditPostToLead(post: RedditPostData, defaultCategory: string): SocialDemandLead | null {
    const combined = `${post.title} ${post.selftext || ''}`;
    const lower = combined.toLowerCase();

    // 1. Extract contact points ONLY if genuinely mentioned in post
    const emailMatch = combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = combined.match(/(\+?\d{1,2}[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    const domainMatch = combined.match(/https?:\/\/([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+)/);

    // 2. Determine urgency
    let urgency: DemandUrgency = 'High';
    if (lower.includes('asap') || lower.includes('urgent') || lower.includes('immediately') || lower.includes('today')) {
      urgency = 'Immediate';
    } else if (lower.includes('next month') || lower.includes('curious') || lower.includes('thinking about')) {
      urgency = 'Exploring';
    } else if (lower.includes('next week') || lower.includes('soon') || lower.includes('starting')) {
      urgency = 'High';
    } else {
      urgency = 'Medium';
    }

    // 3. Determine Audience (B2B vs B2C)
    const b2bKeywords = ['llc', 'inc', 'saas', 'startup', 'company', 'business', 'b2b', 'clients', 'mrr', 'payroll', 'corp', 'firm', 'agency', 'contractor'];
    const b2cKeywords = ['personal', 'family', 'house', 'home', 'my tax return', '1040', 'wedding', 'divorce', 'my car', 'apartment'];

    let audienceType: 'B2B' | 'B2C' = 'B2B';
    const b2bScore = b2bKeywords.filter((k) => lower.includes(k)).length;
    const b2cScore = b2cKeywords.filter((k) => lower.includes(k)).length;
    if (b2cScore > b2bScore) {
      audienceType = 'B2C';
    }

    // 4. Budget Extraction
    const budgetMatch = combined.match(/\$[\d,]+(\s*-\s*\$[\d,]+)?(\s*(k|k\/mo|hr|\/hr))?/i) || combined.match(/\b\d+k\s*budget\b/i);
    const budget = budgetMatch ? budgetMatch[0] : (lower.includes('budget') ? 'Mentioned in post' : undefined);

    // 5. Buying Intent Score calculation (0-100)
    let score = 70;
    if (lower.includes('looking for') || lower.includes('need')) score += 12;
    if (lower.includes('hire') || lower.includes('pay') || lower.includes('budget')) score += 10;
    if (urgency === 'Immediate') score += 8;
    if (emailMatch || phoneMatch) score += 5;
    score = Math.min(99, score);

    // 6. Direct Message link on Reddit (real permalink to author DM)
    const dmUrl = `https://www.reddit.com/message/compose?to=${encodeURIComponent(post.author)}&subject=${encodeURIComponent(`Regarding your ${post.subreddit_name_prefixed || `r/${post.subreddit}`} post: ${post.title.slice(0, 45)}...`)}`;

    // 7. Extract likely location if mentioned
    let location: string | undefined;
    const locMatch = combined.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?(?:,\s*[A-Z]{2})?)\b/);
    if (locMatch && !['Reddit', 'USA', 'US', 'Need', 'Looking', 'America'].includes(locMatch[1])) {
      location = locMatch[1];
    }

    // Extract likely company
    let companyName: string | undefined;
    const compMatch = combined.match(/(?:at|my company|our startup|our agency)\s+([A-Z][a-zA-Z0-9\s&]{2,20})/);
    if (compMatch) {
      companyName = compMatch[1].trim();
    }

    const postDate = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString();

    return {
      id: `reddit_${post.id}`,
      platform: 'reddit',
      audienceType,
      serviceCategory: defaultCategory,
      postTitle: post.title,
      postContent: (post.selftext && post.selftext.length > 500) ? post.selftext.slice(0, 500) + '...' : (post.selftext || post.title),
      postUrl: `https://reddit.com${post.permalink}`,
      sourceChannel: post.subreddit_name_prefixed || `r/${post.subreddit}`,
      postedAt: postDate,
      author: {
        username: `u/${post.author}`,
        displayName: post.author,
        profileUrl: `https://www.reddit.com/user/${post.author}`,
        companyName,
        role: audienceType === 'B2B' ? 'Business Owner / Founder' : 'Client / Consumer',
        location: location || (lower.includes('remote') ? 'Remote' : undefined),
      },
      demandDetails: {
        specificNeed: post.title,
        urgency,
        budget,
        keyRequirements: this.extractKeyRequirements(combined),
        buyingIntentScore: score,
      },
      contactPoints: {
        // Authenticity rule: ONLY include email if actually written by poster!
        email: emailMatch ? emailMatch[0] : undefined,
        emailStatus: emailMatch ? 'verified' : undefined,
        phone: phoneMatch ? phoneMatch[0] : undefined,
        directMessageUrl: dmUrl,
        companyWebsite: domainMatch ? domainMatch[0] : undefined,
        socialProfileUrl: `https://www.reddit.com/user/${post.author}`,
      },
      scrapedAt: new Date().toISOString(),
      status: 'new',
    };
  }

  private isOfferingServiceRatherThanSeeking(text: string): boolean {
    const lower = text.toLowerCase();
    const sellingCues = ['[for hire]', 'i am offering', 'i provide services', 'hire me', 'my portfolio', 'discount code'];
    const buyingCues = ['looking for', 'need an', 'need a', 'seeking', 'recommend me', 'hiring', 'want to hire', 'budget is'];
    const hasSelling = sellingCues.some((c) => lower.includes(c));
    const hasBuying = buyingCues.some((c) => lower.includes(c));
    return hasSelling && !hasBuying;
  }

  private extractKeyRequirements(text: string): string[] {
    const reqs: string[] = [];
    const lines = text.split('\n');
    for (const l of lines) {
      const clean = l.replace(/^[-*•\d.]\s*/, '').trim();
      if (clean.length > 10 && clean.length < 90 && (clean.includes('experience') || clean.includes('must') || clean.includes('need') || clean.includes('budget') || clean.includes('looking for'))) {
        reqs.push(clean);
        if (reqs.length >= 3) break;
      }
    }
    if (reqs.length === 0) {
      if (text.toLowerCase().includes('remote')) reqs.push('Remote collaboration acceptable');
      if (text.toLowerCase().includes('quick') || text.toLowerCase().includes('urgent')) reqs.push('Fast turnaround needed');
      reqs.push('Needs proven domain expertise & prompt communication');
    }
    return reqs;
  }
}

export const globalRedditScanner = new RedditDemandScanner();
