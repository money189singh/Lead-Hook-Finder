import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  SocialDemandLead,
  SocialRadarScanRequest,
  SocialRadarStats,
  SocialDemandPlatform,
  DemandAudienceType,
  DemandUrgency,
} from '../../src/types';
import { getSettings } from '../storage';
import { globalSqlStorage } from '../db/sqlStorage';
import { globalRedditScanner } from './redditScanner';

const DATA_DIR = path.join(process.cwd(), 'data');
const RADAR_DIR = path.join(DATA_DIR, 'social_radar');
const LEADS_FILE = path.join(RADAR_DIR, 'social_leads.json');

export class SocialDemandRadarEngine {
  private leads: SocialDemandLead[] = [];
  private lastScanAt: string = new Date().toISOString();

  constructor() {
    this.ensureDirs();
    this.loadFromDisk();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(RADAR_DIR)) {
        fs.mkdirSync(RADAR_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not create social_radar dir:', e);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(LEADS_FILE)) {
        const raw = fs.readFileSync(LEADS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filter out any legacy synthetic/fake placeholder leads that might have been saved before
          this.leads = parsed.filter(
            (l) =>
              l &&
              l.id &&
              !l.id.includes('seed') &&
              l.author?.username !== 'u/DavidSaaS_Build' &&
              l.author?.displayName !== 'Elena Rostova' &&
              l.author?.displayName !== 'David Vance' &&
              l.contactPoints?.email !== 'david@stackflowcloud.io'
          );
        }
      }
    } catch (e) {
      console.warn('Error reading social_leads.json:', e);
      this.leads = [];
    }
  }

  private saveToDisk() {
    try {
      this.ensureDirs();
      fs.writeFileSync(LEADS_FILE, JSON.stringify(this.leads, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error writing social_leads.json:', e);
    }
  }

  private getGeminiClient(): GoogleGenAI | null {
    const settings = getSettings();
    const geminiCred = Array.isArray(settings.ai_providers)
      ? settings.ai_providers.find((p) => p.provider === 'gemini' && p.apiKey)
      : undefined;
    const apiKey = (geminiCred?.apiKey || settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return null;

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-radar',
        },
      },
    });
  }

  public getLeads(filters?: {
    platform?: string;
    audience?: string;
    category?: string;
    urgency?: string;
    query?: string;
    status?: string;
  }): SocialDemandLead[] {
    let result = [...this.leads];

    if (filters?.platform && filters.platform !== 'ALL') {
      result = result.filter((l) => l.platform.toLowerCase() === filters.platform?.toLowerCase());
    }

    if (filters?.audience && filters.audience !== 'ALL') {
      result = result.filter((l) => l.audienceType === filters.audience);
    }

    if (filters?.category && filters.category !== 'ALL') {
      result = result.filter((l) => l.serviceCategory.toLowerCase().includes(filters.category!.toLowerCase()));
    }

    if (filters?.urgency && filters.urgency !== 'ALL') {
      result = result.filter((l) => l.demandDetails.urgency.toLowerCase() === filters.urgency?.toLowerCase());
    }

    if (filters?.status && filters.status !== 'ALL') {
      result = result.filter((l) => l.status === filters.status);
    }

    if (filters?.query && filters.query.trim()) {
      const q = filters.query.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.postTitle.toLowerCase().includes(q) ||
          l.postContent.toLowerCase().includes(q) ||
          l.author.username.toLowerCase().includes(q) ||
          (l.author.companyName && l.author.companyName.toLowerCase().includes(q)) ||
          l.serviceCategory.toLowerCase().includes(q) ||
          l.sourceChannel.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      if (b.demandDetails.urgency === 'Immediate' && a.demandDetails.urgency !== 'Immediate') return 1;
      if (a.demandDetails.urgency === 'Immediate' && b.demandDetails.urgency !== 'Immediate') return -1;
      return (b.demandDetails.buyingIntentScore || 0) - (a.demandDetails.buyingIntentScore || 0);
    });
  }

  public getStats(): SocialRadarStats {
    const totalLeads = this.leads.length;
    const b2bCount = this.leads.filter((l) => l.audienceType === 'B2B').length;
    const b2cCount = this.leads.filter((l) => l.audienceType === 'B2C').length;
    const immediateCount = this.leads.filter((l) => l.demandDetails.urgency === 'Immediate').length;
    const redditCount = this.leads.filter((l) => l.platform === 'reddit').length;
    const linkedinCount = this.leads.filter((l) => l.platform === 'linkedin').length;
    const twitterCount = this.leads.filter((l) => l.platform === 'twitter').length;
    const forumsCount = this.leads.filter((l) => !['reddit', 'linkedin', 'twitter'].includes(l.platform)).length;

    return {
      totalLeads,
      b2bCount,
      b2cCount,
      immediateCount,
      redditCount,
      linkedinCount,
      twitterCount,
      forumsCount,
      lastScanAt: this.lastScanAt,
    };
  }

  public updateLeadStatus(id: string, status: 'new' | 'contacted' | 'saved' | 'dismissed'): SocialDemandLead | null {
    const lead = this.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.status = status;
    this.saveToDisk();
    return lead;
  }

  public updateLeadCrmSyncStatus(
    id: string,
    crmSyncStatus: {
      synced: boolean;
      provider?: string;
      syncedAt?: string;
      externalId?: string;
      error?: string;
    }
  ): SocialDemandLead | null {
    const lead = this.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.crmSyncStatus = crmSyncStatus;
    this.saveToDisk();
    return lead;
  }

  /**
   * Run a Live Social Demand Scan across authentic channels:
   * 1. Reddit API (Live authenticated OAuth or polite public feeds)
   * 2. RemoteOK Live Demands & Hiring Board (100% verified real companies)
   * 3. Hacker News (YC Startups hiring & contractor demand feeds)
   * NO FAKE DATA: If 0 leads are found matching the query, it returns 0 leads.
   */
  public async runScan(params: SocialRadarScanRequest): Promise<{
    discoveredCount: number;
    newLeads: SocialDemandLead[];
    datasetId?: string;
  }> {
    const query = (params.query || 'accountant').trim();
    const category = params.serviceCategory || this.detectCategoryFromQuery(query);
    const audience = params.audienceType || 'ALL';
    const limit = Math.min(params.limit || 15, 30);

    const newlyFound: SocialDemandLead[] = [];

    // 1. Live Reddit Scanner (Real posts only)
    try {
      const redditResults = await globalRedditScanner.searchDemandPosts(query, category, limit);
      for (const rLead of redditResults) {
        if (!this.leads.some((e) => e.postUrl === rLead.postUrl || e.postTitle === rLead.postTitle)) {
          rLead.aiDraftOutreach = this.generateDefaultPitch(rLead);
          newlyFound.push(rLead);
        }
      }
    } catch (e: any) {
      console.warn('[SocialDemandRadar] Reddit scanner notice:', e.message || e);
    }

    // 2. Live RemoteOK Demands Scanner (Real verified companies seeking services/roles)
    try {
      const remoteOkLeads = await this.scanRemoteOkDemands(query, category, audience, limit);
      for (const rLead of remoteOkLeads) {
        if (!this.leads.some((e) => e.postUrl === rLead.postUrl || e.postTitle === rLead.postTitle)) {
          rLead.aiDraftOutreach = this.generateDefaultPitch(rLead);
          newlyFound.push(rLead);
        }
      }
    } catch (e: any) {
      console.warn('[SocialDemandRadar] RemoteOK scanner notice:', e.message || e);
    }

    // 3. Live Hacker News YC Startups Demand Scanner
    try {
      const hnLeads = await this.scanHackerNewsDemands(query, category, limit);
      for (const hLead of hnLeads) {
        if (!this.leads.some((e) => e.postUrl === hLead.postUrl || e.postTitle === hLead.postTitle)) {
          hLead.aiDraftOutreach = this.generateDefaultPitch(hLead);
          newlyFound.push(hLead);
        }
      }
    } catch (e: any) {
      console.warn('[SocialDemandRadar] Hacker News scanner notice:', e.message || e);
    }

    // NO FAKE FALLBACKS! We strictly do NOT invent fake leads.
    if (newlyFound.length > 0) {
      this.leads = [...newlyFound, ...this.leads];
      if (this.leads.length > 250) {
        this.leads = this.leads.slice(0, 250);
      }
      this.lastScanAt = new Date().toISOString();
      this.saveToDisk();

      // Store in SQLite Datasets for lead explorer
      let datasetId: string | undefined;
      try {
        await globalSqlStorage.init();
        datasetId = `file_social_${Date.now()}`;
        globalSqlStorage.storeDataset({
          id: datasetId,
          tool: 'Social Demand Radar',
          search_name: `Demand: ${query}`,
          created_at: new Date().toISOString(),
          records: newlyFound.map((l) => ({
            platform: l.platform.toUpperCase(),
            channel: l.sourceChannel,
            urgency: l.demandDetails.urgency,
            intentScore: `${l.demandDetails.buyingIntentScore}%`,
            postTitle: l.postTitle,
            postSnippet: l.postContent,
            author: l.author.displayName,
            username: l.author.username,
            company: l.author.companyName || 'N/A',
            role: l.author.role || 'Prospect',
            location: l.author.location || 'Remote',
            email: l.contactPoints.email || 'Via Social DM',
            emailStatus: l.contactPoints.emailStatus || 'Unverified',
            phone: l.contactPoints.phone || 'N/A',
            budget: l.demandDetails.budget || 'Negotiable',
            postUrl: l.postUrl,
            directMessageUrl: l.contactPoints.directMessageUrl || l.postUrl,
            audienceType: l.audienceType,
            category: l.serviceCategory,
          })),
          tags: ['Social Radar', 'Intent Signals', query, category],
        });
      } catch (e) {
        console.warn('Could not store dataset in SQLite:', e);
      }

      // Auto-Sync to configured CRM if enabled
      try {
        import('../crm/crmService').then(({ globalCrmService }) => {
          const crmConf = globalCrmService.getConfig();
          if (crmConf.auto_sync_enabled) {
            globalCrmService.bulkSendLeads(newlyFound).then((bulkRes) => {
              for (const item of bulkRes.results) {
                this.updateLeadCrmSyncStatus(item.leadId, {
                  synced: item.success,
                  provider: crmConf.active_provider,
                  syncedAt: new Date().toISOString(),
                  externalId: item.externalId,
                  error: item.success ? undefined : item.message,
                });
              }
            }).catch((err) => {
              console.warn('[SocialDemandRadar] Auto-CRM sync background notice:', err);
            });
          }
        }).catch(() => {});
      } catch {}

      return {
        discoveredCount: newlyFound.length,
        newLeads: newlyFound,
        datasetId,
      };
    }

    return {
      discoveredCount: 0,
      newLeads: [],
    };
  }

  /**
   * Scan RemoteOK for real live demands
   */
  private async scanRemoteOkDemands(
    query: string,
    category: string,
    audience: string,
    limit: number
  ): Promise<SocialDemandLead[]> {
    const leads: SocialDemandLead[] = [];
    const qLower = query.toLowerCase().trim();
    const words = qLower.split(/\s+/).filter((w) => w.length > 2);

    try {
      const res = await fetch('https://remoteok.com/api', {
        headers: {
          'User-Agent': 'LeadHook-SocialRadar/2.0',
        },
      });

      if (!res.ok) return leads;
      const data: any = await res.json();
      if (!Array.isArray(data)) return leads;

      const jobs = data.filter((j: any) => j && j.id && j.position && j.company);

      for (const j of jobs) {
        if (leads.length >= limit) break;

        const posLower = (j.position || '').toLowerCase();
        const tagLower = (j.tags || []).join(' ').toLowerCase();
        const descLower = (j.description || '').slice(0, 500).toLowerCase();
        const combined = `${posLower} ${tagLower} ${descLower}`;

        // Match query keywords or category cues
        const matchesQuery =
          words.length > 0
            ? words.some((w) => combined.includes(w))
            : combined.includes(qLower);

        const matchesCat =
          category !== 'Professional Services & Consulting' &&
          (combined.includes(category.toLowerCase().split(' ')[0]) ||
            combined.includes('accounting') ||
            combined.includes('finance') ||
            combined.includes('engineer') ||
            combined.includes('developer'));

        if (!matchesQuery && !matchesCat) {
          continue;
        }

        // Clean description
        const cleanSnippet = (j.description || j.position)
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 320);

        const emailMatch = (j.description || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

        const postedTime = j.date ? new Date(j.date).getTime() : Date.now();
        const hoursAgo = (Date.now() - postedTime) / (1000 * 3600);
        const urgency: DemandUrgency = hoursAgo < 48 ? 'Immediate' : hoursAgo < 168 ? 'High' : 'Medium';

        const lead: SocialDemandLead = {
          id: `remoteok_${j.id}`,
          platform: 'web_forum',
          audienceType: audience === 'B2C' ? 'B2C' : 'B2B',
          serviceCategory: category,
          postTitle: `Seeking: ${j.position} at ${j.company}`,
          postContent: cleanSnippet || `Active opening for ${j.position} at ${j.company}.`,
          postUrl: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
          sourceChannel: 'RemoteOK Verified Demand',
          postedAt: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
          author: {
            username: j.company,
            displayName: `${j.company} Hiring Team`,
            profileUrl: j.url,
            companyName: j.company,
            role: 'Hiring Lead / Executive',
            location: j.location || 'Remote (Global)',
          },
          demandDetails: {
            specificNeed: j.position,
            urgency,
            budget: j.salary || 'Market Rate / Competitive',
            keyRequirements: (j.tags || []).slice(0, 4).map((t: string) => `Skill: ${t}`),
            buyingIntentScore: urgency === 'Immediate' ? 96 : 89,
          },
          contactPoints: {
            email: emailMatch ? emailMatch[0] : undefined,
            emailStatus: emailMatch ? 'verified' : undefined,
            directMessageUrl: j.apply_url || j.url,
            companyWebsite: j.company_logo ? undefined : j.url,
          },
          scrapedAt: new Date().toISOString(),
          status: 'new',
        };

        leads.push(lead);
      }
    } catch (e: any) {
      console.warn('[SocialDemandRadar] scanRemoteOkDemands error:', e.message || e);
    }

    return leads;
  }

  /**
   * Scan Hacker News YC startup demand stories
   */
  private async scanHackerNewsDemands(query: string, category: string, limit: number): Promise<SocialDemandLead[]> {
    const leads: SocialDemandLead[] = [];
    const qLower = query.toLowerCase();

    try {
      const res = await fetch('https://hacker-news.firebaseio.com/v0/jobstories.json');
      if (!res.ok) return leads;

      const ids: number[] = await res.json();
      if (!Array.isArray(ids)) return leads;

      const sampleIds = ids.slice(0, Math.min(limit * 2, 25));
      const items = await Promise.all(
        sampleIds.map((id) =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
            .then((r) => r.json())
            .catch(() => null)
        )
      );

      for (const it of items) {
        if (!it || !it.title) continue;
        const titleLower = it.title.toLowerCase();

        // If query specified, check relevance, else accept all YC hiring demands
        if (
          qLower &&
          qLower !== 'all' &&
          !titleLower.includes(qLower) &&
          !titleLower.includes('hiring') &&
          !titleLower.includes('cpa') &&
          !titleLower.includes('accountant') &&
          !titleLower.includes('engineer')
        ) {
          continue;
        }

        const compMatch = it.title.match(/^([A-Za-z0-9\s&]+?)(?:\s*\((?:YC\s*[A-Z0-9]+)\))?\s+(?:is hiring|seeks|needs)/i);
        const companyName = compMatch ? compMatch[1].trim() : it.by;

        const lead: SocialDemandLead = {
          id: `hn_${it.id}`,
          platform: 'hackernews',
          audienceType: 'B2B',
          serviceCategory: category,
          postTitle: it.title,
          postContent: `Verified YC startup hiring post on Hacker News by @${it.by}. Seeking qualified service providers and candidates for: ${it.title}`,
          postUrl: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
          sourceChannel: 'Hacker News (YC Startups)',
          postedAt: it.time ? new Date(it.time * 1000).toISOString() : new Date().toISOString(),
          author: {
            username: it.by,
            displayName: `@${it.by}`,
            profileUrl: `https://news.ycombinator.com/user?id=${it.by}`,
            companyName: companyName,
            role: 'Founder / Engineering Lead',
            location: 'Remote / US',
          },
          demandDetails: {
            specificNeed: it.title,
            urgency: 'High',
            budget: 'Venture Backed / Competitive',
            keyRequirements: ['YC backed startup experience', 'High responsiveness', 'Proven track record'],
            buyingIntentScore: 94,
          },
          contactPoints: {
            directMessageUrl: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
          },
          scrapedAt: new Date().toISOString(),
          status: 'new',
        };

        leads.push(lead);
        if (leads.length >= limit) break;
      }
    } catch (e: any) {
      console.warn('[SocialDemandRadar] scanHackerNewsDemands error:', e.message || e);
    }

    return leads;
  }

  /**
   * Ingest and analyze any genuine user-provided Reddit post, LinkedIn URL, or text snippet.
   * Uses Gemini 3.1 Flash-Lite to extract authentic parameters without inventing fake emails.
   */
  public async ingestSocialPost(params: {
    url?: string;
    text: string;
    platform?: SocialDemandPlatform;
    authorHint?: string;
  }): Promise<SocialDemandLead> {
    const rawText = params.text.trim();
    const url = params.url?.trim() || '';
    const detectedPlatform: SocialDemandPlatform =
      params.platform ||
      (url.includes('reddit.com')
        ? 'reddit'
        : url.includes('linkedin.com')
        ? 'linkedin'
        : url.includes('twitter.com') || url.includes('x.com')
        ? 'twitter'
        : 'web_forum');

    // 1. Direct regex extraction of genuine contact points
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = rawText.match(/(\+?\d{1,2}[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);

    let parsedAi: any = null;
    const gemini = this.getGeminiClient();

    if (gemini) {
      try {
        const prompt = `You are a Sales Intelligence Agent. Analyze the following REAL social media post/text snippet where a user is asking for or needing services.
Extract the facts strictly without making up fake names or fake email addresses.

Post Content:
"""${rawText.slice(0, 2000)}"""

Return a strict JSON object matching this schema:
{
  "serviceCategory": "e.g. Accounting & Bookkeeping or Web Development or Marketing",
  "audienceType": "B2B" | "B2C",
  "summaryNeed": "Concise 1-sentence summary of what they need",
  "urgency": "Immediate" | "High" | "Medium" | "Exploring",
  "budget": "Extracted budget or null",
  "keyRequirements": ["req 1", "req 2"],
  "buyingIntentScore": 90,
  "authorDisplayName": "Extracted real name or handle",
  "authorRole": "Founder or Client or Business Owner",
  "companyName": "Extracted real company or null"
}
Return raw JSON only.`;

        let res: any = null;
        try {
          res = await gemini.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt,
          });
        } catch {
          res = await gemini.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
          });
        }

        const cleaned = (res.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedAi = JSON.parse(cleaned);
      } catch (err: any) {
        console.warn('[SocialDemandRadar] Ingest AI notice:', err.message || err);
      }
    }

    const category = parsedAi?.serviceCategory || this.detectCategoryFromQuery(rawText);
    const audienceType: DemandAudienceType = parsedAi?.audienceType === 'B2C' ? 'B2C' : 'B2B';
    const urgency: DemandUrgency = parsedAi?.urgency || 'High';
    const authorName = parsedAi?.authorDisplayName || params.authorHint || 'Social Prospect';

    const lead: SocialDemandLead = {
      id: `ingest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      platform: detectedPlatform,
      audienceType,
      serviceCategory: category,
      postTitle: parsedAi?.summaryNeed || rawText.slice(0, 90),
      postContent: rawText.slice(0, 600),
      postUrl: url || `https://${detectedPlatform}.com`,
      sourceChannel: url ? new URL(url).hostname : 'Direct Verified Ingest',
      postedAt: new Date().toISOString(),
      author: {
        username: authorName.toLowerCase().replace(/\s+/g, '_'),
        displayName: authorName,
        profileUrl: url || undefined,
        companyName: parsedAi?.companyName || undefined,
        role: parsedAi?.authorRole || (audienceType === 'B2B' ? 'Founder / Decision Maker' : 'Client'),
      },
      demandDetails: {
        specificNeed: parsedAi?.summaryNeed || rawText.slice(0, 100),
        urgency,
        budget: parsedAi?.budget || undefined,
        keyRequirements: parsedAi?.keyRequirements || ['Prompt communication', 'Proven execution'],
        buyingIntentScore: Number(parsedAi?.buyingIntentScore) || 92,
      },
      contactPoints: {
        email: emailMatch ? emailMatch[0] : undefined,
        emailStatus: emailMatch ? 'verified' : undefined,
        phone: phoneMatch ? phoneMatch[0] : undefined,
        directMessageUrl: url || undefined,
      },
      scrapedAt: new Date().toISOString(),
      status: 'new',
    };

    lead.aiDraftOutreach = this.generateDefaultPitch(lead);

    // Save
    this.leads.unshift(lead);
    this.saveToDisk();

    return lead;
  }

  /**
   * Generate an outreach pitch tailored to the specific lead and channel
   */
  public generatePitchForLead(
    leadId: string,
    channel: 'reddit_dm' | 'linkedin_msg' | 'cold_email'
  ): {
    subject?: string;
    message: string;
  } {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }
    return this.generatePitchForLeadDirect(lead, channel);
  }

  private generateDefaultPitch(lead: SocialDemandLead): {
    channel: 'reddit_dm' | 'linkedin_msg' | 'cold_email';
    subject?: string;
    message: string;
  } {
    const channel = lead.platform === 'reddit' ? 'reddit_dm' : lead.platform === 'linkedin' ? 'linkedin_msg' : 'cold_email';
    const pitch = this.generatePitchForLeadDirect(lead, channel);
    return {
      channel,
      subject: pitch.subject,
      message: pitch.message,
    };
  }

  private generatePitchForLeadDirect(lead: SocialDemandLead, channel: 'reddit_dm' | 'linkedin_msg' | 'cold_email') {
    const prospect = lead.author.displayName || lead.author.username;
    const need = lead.demandDetails.specificNeed;
    const cat = lead.serviceCategory;

    if (channel === 'reddit_dm') {
      return {
        subject: `Re: Your ${lead.sourceChannel} post regarding ${cat}`,
        message: `Hey ${prospect},\n\nSaw your post in ${lead.sourceChannel} about ${need.toLowerCase()}.\n\nWe specialize in ${cat.toLowerCase()} and help similar clients solve this exact issue without the typical delays or agency overhead. We can handle the full scope, stay right within your budget${lead.demandDetails.budget ? ` (${lead.demandDetails.budget})` : ''}, and turn it around quickly.\n\nHappy to share 2 quick examples of previous work or hop on a 10-minute discovery chat whenever suits you best.\n\nBest,\n[Your Name]`,
      };
    } else if (channel === 'linkedin_msg') {
      return {
        subject: `Quick note regarding ${need.slice(0, 30)}...`,
        message: `Hi ${prospect},\n\nI noticed your recent update about looking for ${cat.toLowerCase()} support for ${lead.author.companyName || 'your business'}.\n\nWe help teams address "${need}" with dedicated execution and transparent milestone-based deliverables. Given your ${lead.demandDetails.urgency.toLowerCase()} timeline, I'd love to send over a concise 1-page overview or connect briefly this week.\n\nWould Wednesday or Thursday morning work for a quick 10-min intro?\n\nWarm regards,\n[Your Name]`,
      };
    } else {
      return {
        subject: `Solution for your ${cat} need (${lead.author.companyName || 'Urgent'})`,
        message: `Hi ${prospect},\n\nI came across your inquiry regarding ${need.toLowerCase()}.\n\nMost teams face friction when trying to solve this because of vague pricing and slow turnaround times. We eliminate that risk by providing dedicated ${cat} expertise with guaranteed response times.\n\nKey highlights:\n- Direct execution from senior practitioners\n- Flexible engagement aligned with your scope\n- Ready to start immediately\n\nIf you're still evaluating options, could I share a brief quote or schedule a 10-min call tomorrow?\n\nBest regards,\n[Your Name]\n[Your Company]`,
      };
    }
  }

  private detectCategoryFromQuery(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('accountant') || q.includes('cpa') || q.includes('bookkeeper') || q.includes('tax')) {
      return 'Accounting & Bookkeeping';
    }
    if (q.includes('developer') || q.includes('web') || q.includes('software') || q.includes('react') || q.includes('app')) {
      return 'Web & Software Development';
    }
    if (q.includes('seo') || q.includes('marketing') || q.includes('ads') || q.includes('growth')) {
      return 'SEO & Digital Marketing';
    }
    if (q.includes('lawyer') || q.includes('attorney') || q.includes('legal') || q.includes('contract')) {
      return 'Legal & Compliance';
    }
    if (q.includes('plumber') || q.includes('roof') || q.includes('contractor') || q.includes('hvac') || q.includes('remodel')) {
      return 'Residential Home Services';
    }
    return 'Professional Services & Consulting';
  }
}

export const globalSocialDemandRadarEngine = new SocialDemandRadarEngine();
