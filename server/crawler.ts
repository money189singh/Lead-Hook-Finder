import * as cheerio from 'cheerio';
import { Contact, ActivityLog, WebsiteResult, ScrapeJob, ScrapeSettings, SocialProfiles, CompanyFirmographics, GenericEmailItem } from '../src/types';
import { extractContactsWithGemini } from './gemini';
import { getSettings, saveHistoryItem, saveJob, getHistory, getJobById } from './storage';
import { globalAiRouter } from './ai/router';
import { globalProxyPool } from './network/proxyPool';
import { globalAntiBotEngine } from './network/antiBot';
import { globalContentPruner } from './ai/contentPruner';
import { globalSocialDiscovery } from './enrichment/socialDiscovery';
import { globalIcpScorer } from './enrichment/icpScorer';
import { globalEmailClassifier } from './enrichment/emailClassifier';
import { globalDecisionMakerFinder } from './enrichment/decisionMakerFinder';
import { globalIcpFilterEngine } from './enrichment/icpFilterEngine';
import { normalizeAiExtraction } from './ai/jsonNormalizer';
import { TaskQueue } from './queue/taskQueue';
import { globalJobCoordinator } from './coordination/jobCoordinator';
import { globalCompanyResearchService } from './research/researchService';
import { globalOpenRouterClient } from './research/openRouterClient';
import { globalCrmService } from './crm/crmService';
import { globalTechDetector } from './techDetector/techDetectorEngine';
import { VerificationEngine } from './emailVerifier/verificationEngine';

export class CrawlerEngine {
  private currentJob: ScrapeJob | null = null;
  private isPaused: boolean = false;
  private isStopped: boolean = false;
  private activeWorkers: number = 0;
  private taskQueue: TaskQueue | null = null;

  public getCurrentJob(): ScrapeJob | null {
    if (!this.currentJob) {
      try {
        const history = getHistory();
        if (history && history.length > 0) {
          const latest = getJobById(history[0].id);
          if (latest) {
            this.currentJob = latest;
          }
        }
      } catch (err) {
        console.error('Error recovering latest job in crawlerEngine:', err);
      }
    }
    return this.currentJob;
  }

  public setCurrentJob(job: ScrapeJob | null): void {
    this.currentJob = job;
    if (job) {
      saveJob(job);
    }
  }

  public importBusinesses(
    businesses: Array<{
      url?: string;
      website?: string;
      domain?: string;
      company_name?: string;
      name?: string;
      company?: string;
      address?: string;
      location?: string;
      phone?: string;
    }>
  ): ScrapeJob {
    if (!this.currentJob) {
      const jobId = `job_${Date.now()}`;
      this.currentJob = {
        id: jobId,
        created_at: new Date().toISOString(),
        status: 'idle',
        total_websites: 0,
        completed_websites: 0,
        processing_websites: 0,
        failed_websites: 0,
        contacts_found: 0,
        emails_found: 0,
        pages_discovered: 0,
        pages_crawled: 0,
        current_status_text: 'Imported businesses ready for verification.',
        websites: [],
        contacts: [],
        logs: [],
      };
    }

    const seenUrls = new Set(this.currentJob.websites.map((w) => w.url.toLowerCase()));

    for (const b of businesses) {
      let rawUrl = (b.url || b.website || b.domain || '').trim();
      const compName = (b.company_name || b.name || b.company || '').trim();
      const addr = (b.address || b.location || '').trim();

      if (!rawUrl && compName) {
        rawUrl = compName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
      }
      if (!rawUrl) continue;

      const normalized = this.normalizeUrl(rawUrl);
      if (!normalized) continue;

      const cleanNorm = normalized.toLowerCase();
      if (!seenUrls.has(cleanNorm)) {
        seenUrls.add(cleanNorm);
        this.currentJob.websites.push({
          url: normalized,
          normalized_url: this.getDomainOnly(normalized),
          company_name: compName || this.getDomainOnly(normalized),
          status: 'Pending',
          pages_discovered: 0,
          pages_crawled: 0,
          contacts_found: 0,
          emails_found: 0,
          contacts: [],
          firmographics: addr ? { headquarters: addr } : undefined,
        });
      }
    }

    this.currentJob.total_websites = this.currentJob.websites.length;
    this.currentJob.current_status_text = `Workspace loaded with ${this.currentJob.websites.length} business(es) ready for verification.`;

    saveJob(this.currentJob);
    return this.currentJob;
  }

  /**
   * Enriches a single company domain through the existing crawler and extraction engine
   */
  public async enrichSingleDomain(url: string, maxPages = 3): Promise<WebsiteResult> {
    const normalized = this.normalizeUrl(url) || url;
    const domain = this.getDomainOnly(normalized);
    const site: WebsiteResult = {
      url: normalized,
      normalized_url: domain,
      company_name: '',
      status: 'Pending',
      pages_discovered: 0,
      pages_crawled: 0,
      contacts_found: 0,
      emails_found: 0,
      contacts: [],
    };
    const settings = {
      ...getSettings(),
      max_pages: maxPages,
      retry_count: 1,
      timeout_ms: 12000,
    };
    try {
      await this.processWebsite(site, settings);
    } catch (e: any) {
      site.status = 'Crawl failed';
    }
    return site;
  }

  public pause(): void {
    this.isPaused = true;
    if (this.taskQueue) {
      this.taskQueue.pause();
    }
    if (this.currentJob) {
      this.currentJob.status = 'paused';
      this.addLog('Scraping batch paused by user.', 'warning');
    }
  }

  public resume(): void {
    this.isPaused = false;
    if (this.taskQueue) {
      this.taskQueue.resume();
    }
    if (this.currentJob && this.currentJob.status === 'paused') {
      this.currentJob.status = 'running';
      this.addLog('Scraping batch resumed.', 'info');
    }
  }

  public stop(): void {
    this.isStopped = true;
    this.isPaused = false;
    if (this.taskQueue) {
      this.taskQueue.stop();
    }
    if (this.currentJob) {
      this.currentJob.status = 'stopped';
      this.currentJob.processing_websites = 0;
      this.currentJob.current_page = '';
      this.currentJob.current_website = '';
      this.addLog('Scraping batch stopped by user.', 'error');
      this.finalizeJob();
    }
  }

  public clearJob(): void {
    this.stop();
    this.currentJob = null;
    if (this.taskQueue) {
      this.taskQueue.clear();
    }
  }

  public startJob(urls: string[], customSettings?: Partial<ScrapeSettings>): ScrapeJob {
    const settings = { ...getSettings(), ...(customSettings || {}) };
    const suppressedDomainsSet = new Set(
      (settings.suppressed_domains || []).map((d) => d.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
    );

    // Normalize & deduplicate URLs
    const normalizedList: string[] = [];
    const seen = new Set<string>();
    let suppressedSkippedCount = 0;

    for (const raw of urls) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const normalized = this.normalizeUrl(trimmed);
      if (normalized && !seen.has(normalized)) {
        const domainOnly = this.getDomainOnly(normalized).toLowerCase();
        if (suppressedDomainsSet.has(domainOnly)) {
          suppressedSkippedCount++;
          continue;
        }
        seen.add(normalized);
        normalizedList.push(normalized);
      }
    }

    const initialWebsites: WebsiteResult[] = normalizedList.map((url) => ({
      url,
      normalized_url: this.getDomainOnly(url),
      company_name: '',
      status: 'Pending',
      pages_discovered: 0,
      pages_crawled: 0,
      contacts_found: 0,
      emails_found: 0,
      contacts: [],
    }));

    const activeProxies = globalProxyPool.getProxies().filter((p) => p.enabled && p.status !== 'failed');
    const proxyMode = globalProxyPool.getConfig().rotationMode;

    const jobId = `job_${Date.now()}`;
    const newJob: ScrapeJob = {
      id: jobId,
      created_at: new Date().toISOString(),
      status: 'running',
      total_websites: normalizedList.length,
      completed_websites: 0,
      processing_websites: 0,
      failed_websites: 0,
      contacts_found: 0,
      emails_found: 0,
      pages_discovered: 0,
      pages_crawled: 0,
      current_status_text: 'Starting high-throughput crawling engine...',
      websites: initialWebsites,
      contacts: [],
      logs: [],
      queue_metrics: {
        pendingTasks: normalizedList.length,
        activeWorkers: 0,
        completedTasks: 0,
        failedTasks: 0,
        throughputPerMinute: 0,
        avgDomainCrawlMs: 0,
        estimatedTimeRemainingSec: 0,
      },
      pruning_stats: {
        rawBytesTotal: 0,
        prunedBytesTotal: 0,
        tokensEstimatedSaved: 0,
        percentSaved: 0,
        schemaEntitiesExtracted: 0,
      },
      proxy_status_summary: {
        totalProxies: globalProxyPool.getProxies().length,
        activeProxies: activeProxies.length,
        mode: proxyMode,
      },
    };

    this.currentJob = newJob;
    this.isPaused = false;
    this.isStopped = false;

    const proxyMsg = globalProxyPool.getConfig().enabled
      ? ` [Rotating Proxy: ${activeProxies.length} active node(s), mode: ${proxyMode}]`
      : ' [Direct IP]';
    this.addLog(`Initialized batch with ${normalizedList.length} unique website(s).${proxyMsg}`, 'info');
    if (suppressedSkippedCount > 0) {
      this.addLog(`Skipped ${suppressedSkippedCount} domain(s) matching Do-Not-Contact suppression list.`, 'warning');
    }

    // Run in background with task queue
    this.runBatch(settings).catch((err) => {
      console.error('Fatal batch crawl error:', err);
      if (this.currentJob) {
        this.currentJob.status = 'failed';
        this.addLog(`Fatal error: ${err.message}`, 'error');
      }
    });

    return newJob;
  }

  private async runBatch(settings: ScrapeSettings): Promise<void> {
    if (!this.currentJob) return;

    const concurrency = Math.max(1, Math.min(settings.concurrency || 3, 20));
    const politeDelay = Math.max(200, settings.request_delay_ms || 1000);

    this.taskQueue = new TaskQueue({
      concurrency,
      domainDelayMs: politeDelay,
    });

    this.addLog(`Work queue worker pool spawned with ${concurrency} concurrent worker(s) (polite domain delay: ${politeDelay}ms).`, 'info');

    // Enqueue all websites
    for (const target of this.currentJob.websites) {
      this.taskQueue.enqueue({
        id: target.url,
        domainKey: target.normalized_url,
        data: target,
        execute: async (site) => {
          if (this.isStopped) return;
          if (this.currentJob) {
            this.currentJob.processing_websites = this.taskQueue?.getActiveCount() || 1;
            this.currentJob.current_website = site.url;
            this.currentJob.queue_metrics = this.taskQueue?.getMetrics();
          }

          try {
            await this.processWebsite(site, settings);
          } catch (err: any) {
            console.error(`Error crawling ${site.url}:`, err);
            site.status = 'Crawl failed';
            site.error = err.message || 'Unknown crawl error';
          } finally {
            if (this.currentJob) {
              if (
                site.status === 'Completed' ||
                site.status === 'Generic email found' ||
                site.status === 'No email found' ||
                site.status === 'No contacts found'
              ) {
                this.currentJob.completed_websites += 1;
              } else if (site.status !== 'Pending' && site.status !== 'Processing') {
                this.currentJob.failed_websites += 1;
              }
              this.currentJob.processing_websites = this.taskQueue?.getActiveCount() || 0;
              this.currentJob.queue_metrics = this.taskQueue?.getMetrics();
            }
          }
        },
      });
    }

    // Monitor queue loop
    while (this.taskQueue.isBusy() && !this.isStopped) {
      while (this.isPaused && !this.isStopped) {
        this.taskQueue.pause();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!this.isPaused && !this.isStopped) {
        this.taskQueue.resume();
      }
      if (this.currentJob) {
        this.currentJob.queue_metrics = this.taskQueue.getMetrics();
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (this.currentJob && !this.isStopped) {
      this.currentJob.status = 'completed';
      this.currentJob.processing_websites = 0;
      this.currentJob.current_page = '';
      this.currentJob.current_website = '';
      this.currentJob.current_status_text = 'Batch scraping completed.';
      this.currentJob.queue_metrics = this.taskQueue.getMetrics();
      const pruningNote = this.currentJob.pruning_stats?.percentSaved
        ? ` (Smart Pruning saved ${this.currentJob.pruning_stats.percentSaved}% payload, ~${this.currentJob.pruning_stats.tokensEstimatedSaved} tokens)`
        : '';
      this.addLog(`All ${this.currentJob.total_websites} websites processed.${pruningNote}`, 'success');
      this.finalizeJob();
    }
  }

  public syncJobAggregates(): void {
    if (!this.currentJob) return;

    const currentSettings = getSettings();
    const suppressedDomains = new Set(
      (currentSettings.suppressed_domains || []).map((d) => d.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
    );
    const suppressedEmails = new Set(
      (currentSettings.suppressed_emails || []).map((e) => e.toLowerCase().trim())
    );

    const contactsMap = new Map<string, Contact>();
    const genericEmailsMap = new Map<string, GenericEmailItem>();
    const allEmails = new Set<string>();

    for (const site of this.currentJob.websites) {
      const siteDom = (site.normalized_url || this.getDomainOnly(site.url)).toLowerCase();
      if (suppressedDomains.has(siteDom)) continue;

      if (site.contacts && Array.isArray(site.contacts)) {
        for (const c of site.contacts) {
          const profEm = (c.professional_email || '').toLowerCase().trim();
          const primEm = (c.email || '').toLowerCase().trim();
          if ((profEm && suppressedEmails.has(profEm)) || (primEm && suppressedEmails.has(primEm))) {
            continue;
          }
          const key = c.id || `${c.website || site.url}_${(c.professional_email || c.email || c.full_name || '').toLowerCase().trim()}`;
          if (key && !contactsMap.has(key)) {
            contactsMap.set(key, c);
          }
          if (c.email && !suppressedEmails.has(c.email.toLowerCase().trim())) allEmails.add(c.email.toLowerCase().trim());
          if (c.professional_email && !suppressedEmails.has(c.professional_email.toLowerCase().trim())) allEmails.add(c.professional_email.toLowerCase().trim());
          if (c.company_generic_emails) {
            for (const ge of c.company_generic_emails) {
              if (!suppressedEmails.has(ge.toLowerCase().trim())) allEmails.add(ge.toLowerCase().trim());
            }
          }
        }
      }

      if (site.generic_email_items && Array.isArray(site.generic_email_items)) {
        for (const ge of site.generic_email_items) {
          const emailLower = ge.email.toLowerCase().trim();
          if (suppressedEmails.has(emailLower)) continue;
          if (!genericEmailsMap.has(emailLower)) {
            genericEmailsMap.set(emailLower, ge);
          }
          allEmails.add(emailLower);
        }
      }

      if (site.generic_emails && Array.isArray(site.generic_emails)) {
        for (const ge of site.generic_emails) {
          const emailLower = ge.toLowerCase().trim();
          if (suppressedEmails.has(emailLower)) continue;
          allEmails.add(emailLower);
          if (!genericEmailsMap.has(emailLower)) {
            const localPart = emailLower.split('@')[0];
            let department = 'General Inquiries';
            if (/careers|jobs|recruiting|hr|talent/i.test(localPart)) department = 'Careers & Hiring';
            else if (/press|media|news|pr/i.test(localPart)) department = 'Media & Press';
            else if (/marketing/i.test(localPart)) department = 'Marketing';
            else if (/sales|bizdev|partnerships/i.test(localPart)) department = 'Sales & Business';
            else if (/support|help|service/i.test(localPart)) department = 'Customer Support';
            else if (/billing|finance|invoices|accounting/i.test(localPart)) department = 'Billing & Finance';
            else if (/legal|compliance/i.test(localPart)) department = 'Legal & Compliance';
            else if (/admin|office/i.test(localPart)) department = 'Office & Administration';

            genericEmailsMap.set(emailLower, {
              id: `${site.url}_gen_${emailLower}`,
              company_name: site.company_name || site.normalized_url,
              website: site.url,
              email: ge,
              email_type: 'Generic Business Email',
              department,
              source_url: site.url,
              status: 'Verified',
            });
          }
        }
      }
    }

    this.currentJob.contacts = Array.from(contactsMap.values());
    this.currentJob.contacts_found = this.currentJob.contacts.length;
    this.currentJob.generic_emails = Array.from(genericEmailsMap.values());
    this.currentJob.emails_found = allEmails.size;
  }

  private finalizeJob(): void {
    if (!this.currentJob) return;

    // Ensure all aggregates are fully synchronized across all crawled websites
    this.syncJobAggregates();

    const summary = {
      id: this.currentJob.id,
      date: new Date().toLocaleString(),
      total_websites: this.currentJob.total_websites,
      completed_websites: this.currentJob.completed_websites,
      failed_websites: this.currentJob.failed_websites,
      contacts_found: this.currentJob.contacts_found,
      emails_found: this.currentJob.emails_found,
      websites_summary: this.currentJob.websites.map((w) => ({
        domain: w.normalized_url,
        company: w.company_name,
        status: w.status,
        contacts: w.contacts_found,
      })),
    };

    saveHistoryItem(summary, this.currentJob);

    // Outbound Webhook Auto-Dispatch
    const currentSettings = getSettings();
    const webhookCfg = currentSettings.outbound_webhook;
    if (webhookCfg?.enabled && webhookCfg.url && webhookCfg.url.trim().startsWith('http')) {
      const allContacts = this.currentJob.contacts || [];
      const contactsToSend =
        webhookCfg.filter_mode === 'high_icp_only'
          ? allContacts.filter((c) => (c.icp_score || 0) >= 80)
          : allContacts;

      const payload = {
        event: 'job.completed',
        timestamp: new Date().toISOString(),
        job_id: this.currentJob.id,
        filter_mode: webhookCfg.filter_mode || 'all_leads',
        summary,
        contacts_count: contactsToSend.length,
        contacts: contactsToSend,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'LeadHook-Webhook-Dispatcher/1.0',
      };
      if (webhookCfg.secret_header && webhookCfg.secret_header.trim()) {
        headers['X-Webhook-Secret'] = webhookCfg.secret_header.trim();
      }

      fetch(webhookCfg.url.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
        .then((res) => {
          this.addLog(
            `Outbound webhook dispatched ${contactsToSend.length} lead(s) to ${webhookCfg.url} (HTTP ${res.status})`,
            res.ok ? 'success' : 'warning'
          );
        })
        .catch((err) => {
          this.addLog(`Outbound webhook dispatch failed: ${err.message}`, 'error');
        });
    }

    // Direct CRM Auto-Sync (Apollo, HubSpot, Salesforce, Pipedrive, or In-House Custom CRM)
    const crmConfig = globalCrmService.getConfig();
    if (crmConfig.auto_sync_enabled && this.currentJob.contacts && this.currentJob.contacts.length > 0) {
      const contactsForCrm = [...this.currentJob.contacts];
      globalCrmService
        .syncContacts(contactsForCrm, 'LeadHook Website Scraper')
        .then((res) => {
          this.addLog(
            `CRM Auto-Sync (${crmConfig.active_provider}): ${res.successful}/${res.total} lead(s) dispatched automatically.`,
            res.successful > 0 ? 'success' : 'warning'
          );
        })
        .catch((err) => {
          this.addLog(`CRM Auto-Sync error: ${err.message}`, 'error');
        });
    }
  }

  private async processWebsite(site: WebsiteResult, settings: ScrapeSettings): Promise<void> {
    site.status = 'Processing';
    this.addLog(`Started company: ${site.url}`, 'info', site.url);

    if (this.currentJob) {
      this.currentJob.current_website = site.url;
      this.currentJob.current_page = site.url;
      this.currentJob.current_status_text = `Crawling ${site.url}...`;
    }

    const domain = site.normalized_url || this.getDomainOnly(site.url);
    const maxPages = settings.max_pages || 15;
    const smartDiscovery = settings.smart_discovery !== false;

    // Pages tracking & deduplication sets
    const discoveredUrls = new Map<string, number>();
    const attemptedUrls = new Set<string>();
    const queuedUrls = new Set<string>();
    const crawledContentHashes = new Set<string>();

    const canonicalStartUrl = this.canonicalizeUrl(site.url);
    discoveredUrls.set(canonicalStartUrl, 500);
    queuedUrls.add(canonicalStartUrl);

    // Seed comprehensive set of corporate, staff, legal, and contact fallback paths
    try {
      const origin = new URL(canonicalStartUrl).origin;
      const commonFallbackPaths = [
        '/about-us',
        '/about',
        '/company',
        '/who-we-are',
        '/our-team',
        '/team',
        '/leadership',
        '/executives',
        '/founders',
        '/management',
        '/board-of-directors',
        '/our-attorneys',
        '/attorneys',
        '/our-lawyers',
        '/lawyers',
        '/people',
        '/staff',
        '/directory',
        '/contact-us',
        '/contact',
        '/press',
        '/investors',
        '/careers',
        '/newsroom',
        '/privacy-policy',
        '/terms-and-conditions',
      ];
      for (const p of commonFallbackPaths) {
        const canonical = this.canonicalizeUrl(`${origin}${p}`);
        if (canonical && !discoveredUrls.has(canonical)) {
          discoveredUrls.set(canonical, 80);
          queuedUrls.add(canonical);
        }
      }
    } catch {}

    // Deep discovery: fetch sitemaps to seed all internal links
    try {
      const sitemapUrls = await this.discoverSitemapUrls(site.url, domain);
      let sitemapAdded = 0;
      for (const sUrl of sitemapUrls) {
        if (sitemapAdded >= 100) break;
        const canonical = this.canonicalizeUrl(sUrl);
        if (canonical && !discoveredUrls.has(canonical) && !attemptedUrls.has(canonical)) {
          const score = this.scoreUrlRelevance(new URL(canonical).pathname, '');
          if (score >= 20) {
            discoveredUrls.set(canonical, score);
            queuedUrls.add(canonical);
            sitemapAdded++;
          }
        }
      }
      if (sitemapAdded > 0) {
        this.addLog(`Discovered ${sitemapAdded} prioritized page(s) via sitemap.xml for ${site.url}`, 'info', site.url);
      }
    } catch {}

    const crawledPages: { url: string; html: string; text: string; title: string }[] = [];
    const allFoundEmails = new Set<string>();
    const allFoundPhones = new Set<string>();
    const harvestedSchemaContacts: Contact[] = [];
    const harvestedDomContacts: Contact[] = [];
    let pagesFailedCount = 0;
    let locationPagesCrawled = 0;
    const maxLocationPages = 25; // Generous ceiling so multi-office firm directories are thoroughly checked
    const companySocialsAcc: SocialProfiles = {};
    const discoveredPersonalProfiles: {
      fullName?: string;
      linkedin?: string;
      twitter?: string;
      contextText?: string;
    }[] = [];
    let firmographicsCandidate: CompanyFirmographics | undefined = undefined;

    let companyNameCandidate = '';

    // Queue of URLs to crawl for this site, ordered by initial relevance score
    const pageQueue: string[] = Array.from(discoveredUrls.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([u]) => u);

    while (pageQueue.length > 0 && crawledPages.length < maxPages && !this.isStopped) {
      while (this.isPaused && !this.isStopped) {
        await new Promise((r) => setTimeout(r, 400));
      }
      if (this.isStopped) break;

      const currentUrl = pageQueue.shift()!;
      const canonicalCurrent = this.canonicalizeUrl(currentUrl);
      queuedUrls.delete(canonicalCurrent);

      // Prevent re-crawling or checking the same page again (regardless of 404, redirects, or trailing slashes)
      if (!canonicalCurrent || attemptedUrls.has(canonicalCurrent)) {
        continue;
      }
      attemptedUrls.add(canonicalCurrent);

      // Cap repetitive SEO location sub-pages
      try {
        const pathLower = new URL(canonicalCurrent).pathname.toLowerCase();
        if (pathLower.includes('/location') || pathLower.includes('/offices')) {
          if (locationPagesCrawled >= maxLocationPages) {
            continue;
          }
          locationPagesCrawled++;
        }
      } catch {}

      if (this.currentJob) {
        this.currentJob.current_page = currentUrl;
      }

      // Fetch page (1 retry max for fast, non-blocking throughput)
      const pageData = await this.fetchWithRetry(currentUrl, 1, Math.min(settings.timeout_ms || 10000, 10000));
      if (!pageData) {
        pagesFailedCount++;
        // If the start page (homepage) itself cannot be loaded, the site is offline or unreachable.
        if (canonicalCurrent === canonicalStartUrl) {
          this.addLog(`Base domain ${site.url} is unreachable. Skipping subpages.`, 'info', site.url);
          break;
        }
        continue;
      }

      const { html, status, proxyUsed, finalUrl } = pageData;
      if (proxyUsed) {
        site.proxy_used = proxyUsed;
      }

      // Record final redirected URL to prevent following redirects back to same page
      if (finalUrl) {
        const canonicalFinal = this.canonicalizeUrl(finalUrl);
        attemptedUrls.add(canonicalFinal);
        queuedUrls.delete(canonicalFinal);

        // Check if redirected to the homepage or already crawled page
        if (canonicalFinal !== canonicalCurrent) {
          if (canonicalFinal === canonicalStartUrl && canonicalCurrent !== canonicalStartUrl) {
            // Missing/404 page redirected to home page, skip re-processing home page
            continue;
          }
          if (crawledPages.some((p) => this.canonicalizeUrl(p.url) === canonicalFinal)) {
            // Redirected to a page that was already crawled
            continue;
          }
        }
      }

      if (status === 401 || status === 403) {
        site.status = 'Access restricted';
        this.addLog(`Access restricted (HTTP ${status}) on ${currentUrl} via ${proxyUsed || 'Direct'}`, 'warning', site.url);
        if (crawledPages.length === 0) return;
        break;
      }

      // Smart DOM Pruning: strip boilerplates (nav, footer, ads, cookies) and extract semantic blocks
      const prunedResult = globalContentPruner.prunePage(html, currentUrl);

      // Explicit 404 / Missing page detection
      const $page = cheerio.load(html);
      const pageTitleCandidate = $page('title').text().trim() || '';
      const isShort404Page =
        (pageTitleCandidate.toLowerCase().includes('404') ||
          pageTitleCandidate.toLowerCase().includes('page not found') ||
          prunedResult.prunedText.toLowerCase().includes('404 not found')) &&
        (prunedResult.prunedText || '').length < 600;
      if (isShort404Page) {
        continue;
      }

      // Track token/bandwidth savings
      if (this.currentJob?.pruning_stats) {
        this.currentJob.pruning_stats.rawBytesTotal += prunedResult.rawBytes;
        this.currentJob.pruning_stats.prunedBytesTotal += prunedResult.prunedBytes;
        this.currentJob.pruning_stats.tokensEstimatedSaved += prunedResult.tokensSavedEstimate;
        this.currentJob.pruning_stats.schemaEntitiesExtracted += prunedResult.schemaContacts.length;
        if (this.currentJob.pruning_stats.rawBytesTotal > 0) {
          this.currentJob.pruning_stats.percentSaved = Math.round(
            ((this.currentJob.pruning_stats.rawBytesTotal - this.currentJob.pruning_stats.prunedBytesTotal) /
              this.currentJob.pruning_stats.rawBytesTotal) *
              100
          );
        }
      }
      // Harvest Schema.org microdata contacts directly with zero hallucination
      for (const sc of prunedResult.schemaContacts) {
        if (sc.name && (sc.email || sc.phone)) {
          const parts = sc.name.trim().split(/\s+/);
          const classification = globalEmailClassifier.classify(sc.email || '', {
            fullName: sc.name,
            role: sc.role,
            sourceUrl: sc.source,
          });

          harvestedSchemaContacts.push({
            id: `${site.url}_schema_${Math.random().toString(36).substring(2, 8)}`,
            company_name: site.company_name || domain,
            website: site.url,
            first_name: parts[0] || '',
            last_name: parts.slice(1).join(' ') || '',
            full_name: sc.name,
            role: sc.role || 'Organization Member',
            email: sc.email || '',
            email_type: classification.classification,
            email_classification_reason: classification.reason,
            identity_verified: classification.identityVerified,
            phone: sc.phone || '',
            source_url: sc.source,
            status: 'Verified (Schema.org)',
          });
        }
      }

      const $ = cheerio.load(html);

      // Extract title/company name candidate
      const pageTitle = $('title').text().trim() || $('meta[property="og:site_name"]').attr('content') || '';
      if (!companyNameCandidate && pageTitle) {
        companyNameCandidate = this.cleanCompanyName(pageTitle, domain);
        site.company_name = companyNameCandidate;
      }

      // Discover social profiles (LinkedIn company/personal, Twitter, Facebook, YouTube, etc.)
      const pageSocials = globalSocialDiscovery.discoverFromHtml(html, currentUrl);
      if (pageSocials.companySocials.linkedin && !companySocialsAcc.linkedin) companySocialsAcc.linkedin = pageSocials.companySocials.linkedin;
      if (pageSocials.companySocials.twitter && !companySocialsAcc.twitter) companySocialsAcc.twitter = pageSocials.companySocials.twitter;
      if (pageSocials.companySocials.facebook && !companySocialsAcc.facebook) companySocialsAcc.facebook = pageSocials.companySocials.facebook;
      if (pageSocials.companySocials.youtube && !companySocialsAcc.youtube) companySocialsAcc.youtube = pageSocials.companySocials.youtube;
      if (pageSocials.companySocials.instagram && !companySocialsAcc.instagram) companySocialsAcc.instagram = pageSocials.companySocials.instagram;
      if (pageSocials.companySocials.github && !companySocialsAcc.github) companySocialsAcc.github = pageSocials.companySocials.github;

      if (pageSocials.personalProfiles.length > 0) {
        discoveredPersonalProfiles.push(...pageSocials.personalProfiles);
      }

      // Extract firmographics evidence (founded year, employee count, location) from actual page text and Schema.org
      const pageText = prunedResult.prunedText || '';
      const fullBodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const combinedEvidenceText = `${pageText} ${fullBodyText}`;

      if (!firmographicsCandidate) {
        firmographicsCandidate = {};
      }

      // 1. Schema.org authoritative firmographics
      if (prunedResult.schemaFirmographics) {
        if (prunedResult.schemaFirmographics.employee_count && !firmographicsCandidate.employee_count) {
          firmographicsCandidate.employee_count = prunedResult.schemaFirmographics.employee_count;
          firmographicsCandidate.employee_count_source_url = prunedResult.schemaFirmographics.employee_count_source_url || currentUrl;
          firmographicsCandidate.employee_count_confidence = 'verified';
          firmographicsCandidate.confidence = 'verified';
          site.employee_count = prunedResult.schemaFirmographics.employee_count;
        }
        if (prunedResult.schemaFirmographics.founded_year && !firmographicsCandidate.founded_year) {
          firmographicsCandidate.founded_year = prunedResult.schemaFirmographics.founded_year;
          firmographicsCandidate.founded_year_source_url = prunedResult.schemaFirmographics.founded_year_source_url || currentUrl;
          firmographicsCandidate.founded_year_confidence = 'verified';
          firmographicsCandidate.confidence = 'verified';
          site.founded_year = prunedResult.schemaFirmographics.founded_year;
        }
        if (prunedResult.schemaFirmographics.location && !firmographicsCandidate.location) {
          firmographicsCandidate.location = prunedResult.schemaFirmographics.location;
          site.location = prunedResult.schemaFirmographics.location;
        }
      }

      if (!firmographicsCandidate.offering_summary) {
        const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
        if (metaDesc && metaDesc.trim().length > 10) {
          firmographicsCandidate.offering_summary = metaDesc.trim().slice(0, 300);
        }
      }

      // 2. Founded year patterns (explicit evidence only - do NOT infer from copyright date)
      if (!firmographicsCandidate.founded_year) {
        const foundedMatch = combinedEvidenceText.match(/\b(?:founded|established|est\.?)\s*(?:in\s*)?(\d{4})\b/i) ||
                             combinedEvidenceText.match(/\b(?:in business|serving clients|operating|established firm)\s*(?:since\s*)(\d{4})\b/i) ||
                             combinedEvidenceText.match(/\b(?:founding|founded)\s*year\s*(?::|is)?\s*(\d{4})\b/i) ||
                             combinedEvidenceText.match(/\byear founded\s*(?::|is)?\s*(\d{4})\b/i) ||
                             combinedEvidenceText.match(/\bhistory(?:\s*:|\s*started in|\s*began in)\s*(\d{4})\b/i);
        if (foundedMatch && foundedMatch[1]) {
          const yr = parseInt(foundedMatch[1], 10);
          if (yr >= 1700 && yr <= 2026) {
            firmographicsCandidate.founded_year = String(yr);
            firmographicsCandidate.founded_year_source_url = currentUrl;
            firmographicsCandidate.founded_year_confidence = 'verified';
            firmographicsCandidate.confidence = 'verified';
            firmographicsCandidate.last_checked_date = new Date().toISOString();
            site.founded_year = String(yr);
            site.founded_year_source_url = currentUrl;
            site.founded_year_confidence = 'verified';
          }
        }
      }

      // 3. Employee count patterns (exact count supported by actual page evidence)
      if (!firmographicsCandidate.employee_count) {
        const empMatch = combinedEvidenceText.match(/\b(?:team of|we are|have|with|over|more than|approximately|about|around|nearly|staff of|employing)\s*(\d{1,6})\s*(?:\+|\s*plus)?\s*(?:full-time\s+|dedicated\s+|talented\s+)?(?:employees|attorneys|lawyers|professionals|people|staff|team members|members|workers|consultants)\b/i) ||
                         combinedEvidenceText.match(/\b(\d{1,6})\s*(?:\+|\s*plus)?\s*(?:full-time\s+|dedicated\s+|talented\s+)?(?:employees|attorneys|lawyers|professionals|staff|team members|workers|consultants)\b/i) ||
                         combinedEvidenceText.match(/\bheadcount(?:\s*of|\s*:|\s*is)?\s*(\d{1,6})\b/i) ||
                         combinedEvidenceText.match(/\bemployee count(?:\s*:|\s*is)?\s*(\d{1,6})\b/i) ||
                         combinedEvidenceText.match(/\bnumber of employees(?:\s*:|\s*is)?\s*(\d{1,6})\b/i);
        if (empMatch && empMatch[1]) {
          const count = parseInt(empMatch[1], 10);
          if (count > 0 && count < 500000) {
            firmographicsCandidate.employee_count = String(count);
            firmographicsCandidate.employee_count_source_url = currentUrl;
            firmographicsCandidate.employee_count_confidence = 'verified';
            firmographicsCandidate.confidence = 'verified';
            firmographicsCandidate.last_checked_date = new Date().toISOString();
            site.employee_count = String(count);
            site.employee_count_source_url = currentUrl;
            site.employee_count_confidence = 'verified';
            if (count <= 10) firmographicsCandidate.employee_tier = '1-10';
            else if (count <= 50) firmographicsCandidate.employee_tier = '11-50';
            else if (count <= 200) firmographicsCandidate.employee_tier = '51-200';
            else if (count <= 500) firmographicsCandidate.employee_tier = '201-500';
            else if (count <= 1000) firmographicsCandidate.employee_tier = '501-1000';
            else firmographicsCandidate.employee_tier = '1000+';
          }
        }
      }

      // 4. Employee range patterns (when source gives a range)
      if (!firmographicsCandidate.employee_count && !firmographicsCandidate.employee_range) {
        const rangeMatch = combinedEvidenceText.match(/\b(\d{1,6})\s*(?:-|–|—|to)\s*(\d{1,6})\s*(?:employees|attorneys|lawyers|professionals|people|staff|team members|workers)\b/i) ||
                           combinedEvidenceText.match(/\b(?:company size|employee range)(?:\s*:|\s*is)?\s*([0-9,\s\-–—+to]+(?:employees|people)?)\b/i);
        if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
          const min = parseInt(rangeMatch[1], 10);
          const max = parseInt(rangeMatch[2], 10);
          if (min > 0 && max > min && max < 500000) {
            firmographicsCandidate.employee_range = `${min}–${max}`;
            firmographicsCandidate.employee_count_source_url = currentUrl;
            firmographicsCandidate.employee_count_confidence = 'range';
            firmographicsCandidate.last_checked_date = new Date().toISOString();
            site.employee_range = firmographicsCandidate.employee_range;
            if (max <= 10) firmographicsCandidate.employee_tier = '1-10';
            else if (max <= 50) firmographicsCandidate.employee_tier = '11-50';
            else if (max <= 200) firmographicsCandidate.employee_tier = '51-200';
            else if (max <= 500) firmographicsCandidate.employee_tier = '201-500';
            else if (max <= 1000) firmographicsCandidate.employee_tier = '501-1000';
            else firmographicsCandidate.employee_tier = '1000+';
          }
        }
      }

      if (!firmographicsCandidate.location) {
        const locMatch = combinedEvidenceText.match(/\b([A-Z][a-zA-Z\s.-]+,\s*[A-Z]{2}(?:\s+\d{5})?)\b/);
        if (locMatch && locMatch[1] && locMatch[1].length < 60) {
          firmographicsCandidate.location = locMatch[1].trim();
          site.location = locMatch[1].trim();
        }
      }

      crawledPages.push({
        url: currentUrl,
        html,
        text: prunedResult.prunedText,
        title: pageTitle,
      });

      site.pages_crawled = crawledPages.length;
      if (this.currentJob) {
        this.currentJob.pages_crawled += 1;
      }

      // Extract emails
      const emailsOnPage = this.extractEmailsFromHtml(html, prunedResult.prunedText);
      for (const e of emailsOnPage) {
        allFoundEmails.add(e);
      }

      // Extract phones
      const phonesOnPage = this.extractPhonesFromHtml(html, prunedResult.prunedText);
      for (const p of phonesOnPage) {
        allFoundPhones.add(p);
      }

      // Extract profile card contacts from page structure (team cards, attorney blocks)
      const domContacts = this.harvestDomProfileContacts(html, currentUrl, site.company_name || domain, domain);
      for (const dc of domContacts) {
        harvestedDomContacts.push(dc);
        if (dc.email) allFoundEmails.add(dc.email.toLowerCase());
        if (dc.phone) allFoundPhones.add(dc.phone);
      }

      // Run proven deterministic normalizer on pruned page text to capture firmographics, generic emails, and text contacts
      try {
        const textNorm = normalizeAiExtraction(prunedResult.prunedText, site.company_name || domain, currentUrl);
        if (textNorm.firmographics) {
          if (textNorm.firmographics.employee_count && !site.employee_count) {
            site.employee_count = textNorm.firmographics.employee_count;
            if (firmographicsCandidate) firmographicsCandidate.employee_count = textNorm.firmographics.employee_count;
          }
          if (textNorm.firmographics.founded_year && !site.founded_year) {
            site.founded_year = textNorm.firmographics.founded_year;
            if (firmographicsCandidate) firmographicsCandidate.founded_year = textNorm.firmographics.founded_year;
          }
          if (textNorm.firmographics.location && !site.location) {
            site.location = textNorm.firmographics.location;
            if (firmographicsCandidate) firmographicsCandidate.location = textNorm.firmographics.location;
          }
        }
        if (textNorm.generic_emails && textNorm.generic_emails.length > 0) {
          for (const ge of textNorm.generic_emails) {
            allFoundEmails.add(ge.toLowerCase());
          }
        }
        if (textNorm.contacts && textNorm.contacts.length > 0) {
          for (const tc of textNorm.contacts) {
            if (tc.full_name && (tc.email || tc.professional_email)) {
              harvestedDomContacts.push({
                id: `${domain}_txt_${Math.random().toString(36).substring(2, 8)}`,
                company_name: site.company_name || domain,
                website: currentUrl,
                first_name: tc.first_name,
                last_name: tc.last_name,
                full_name: tc.full_name,
                role: tc.role || 'Professional',
                role_tier: tc.role_tier,
                email: tc.email || tc.professional_email || '',
                professional_email: tc.professional_email || tc.email,
                association_status: 'explicit',
                confidence_score: 85,
                email_type: tc.email_type,
                email_classification_reason: tc.email_classification_reason,
                identity_verified: tc.identity_verified,
                phone: tc.phone || '',
                source_url: currentUrl,
                status: 'Verified',
              });
            }
          }
        }
      } catch {}

      // Smart page discovery: find internal links
      if (smartDiscovery && crawledPages.length < maxPages) {
        const links = this.extractInternalLinks(html, currentUrl, domain);
        let newLinksAdded = false;
        for (const link of links) {
          const canonicalLink = this.canonicalizeUrl(link.url);
          if (!canonicalLink || attemptedUrls.has(canonicalLink) || queuedUrls.has(canonicalLink)) {
            continue;
          }

          // Cap repetitive location sub-pages
          const isLoc = canonicalLink.includes('/location') || canonicalLink.includes('/offices');
          if (isLoc && locationPagesCrawled >= maxLocationPages) {
            continue;
          }

          discoveredUrls.set(canonicalLink, link.score);
          queuedUrls.add(canonicalLink);
          pageQueue.push(canonicalLink);
          newLinksAdded = true;
        }

        if (newLinksAdded) {
          // Re-sort pending pageQueue by score descending without purging unvisited items
          pageQueue.sort((a, b) => (discoveredUrls.get(b) || 0) - (discoveredUrls.get(a) || 0));
        }
      }

      // Update real-time live metrics and distinct contacts on each page
      const liveContactsMap = new Map<string, Contact>();
      for (const dc of [...harvestedDomContacts, ...harvestedSchemaContacts]) {
        const key = dc.id || (dc.professional_email || dc.email || dc.full_name).toLowerCase().trim();
        if (key && !liveContactsMap.has(key)) {
          liveContactsMap.set(key, dc);
        }
      }
      site.pages_discovered = discoveredUrls.size;
      site.contacts_found = liveContactsMap.size;
      site.emails_found = allFoundEmails.size;
      site.contacts = Array.from(liveContactsMap.values());

      if (this.currentJob) {
        this.currentJob.pages_discovered = Math.max(this.currentJob.pages_discovered, discoveredUrls.size);
        this.syncJobAggregates();
      }

      this.addLog(
        `Crawled [${crawledPages.length}/${maxPages}]: ${currentUrl} (${emailsOnPage.length} email(s) found)`,
        'info',
        site.url
      );
    }

    site.crawled_urls = crawledPages.map((p) => p.url);

    if (crawledPages.length === 0) {
      site.status = 'Crawl failed';
      this.addLog(`Failed to load any public pages from ${site.url}`, 'error', site.url);
      return;
    }

    if (this.currentJob) {
      this.currentJob.current_status_text = `Extracting contacts with AI for ${site.company_name || domain}...`;
    }
    this.addLog(`Analyzing content & routing AI extraction for ${site.url}...`, 'info', site.url);

    // Call Unified AI Router (supports Alibaba Qwen, DeepSeek, Kimi, GLM, MiniMax, Gemini, Claude, OpenAI)
    let contactsList: Contact[] = [];
    const settingsObj = getSettings();
    const activeCandidates = globalAiRouter.getCredentials().filter(
      (c) => c.enabled && Boolean(c.apiKey && c.apiKey.trim().length > 5)
    );

    if (activeCandidates.length > 0) {
      try {
        // Prioritize internal pages: leadership, attorneys, team, about, contact pages first
        const prioritizedPages = [...crawledPages].sort((a, b) => {
          const scorePage = (url: string) => {
            const u = url.toLowerCase();
            if (u.includes('attorney') || u.includes('lawyer') || u.includes('partner') || u.includes('team') || u.includes('leadership') || u.includes('people') || u.includes('staff')) return 100;
            if (u.includes('about') || u.includes('founder') || u.includes('management') || u.includes('executive') || u.includes('contact')) return 80;
            if (u.includes('history') || u.includes('location') || u.includes('office')) return 60;
            return 10;
          };
          return scorePage(b.url) - scorePage(a.url);
        });

        const extractionResponse = await globalAiRouter.extractContacts({
          companyName: site.company_name || companyNameCandidate || domain,
          sourceUrl: site.url,
          pageContents: prioritizedPages.map((p) => ({
            url: p.url,
            title: p.title,
            text: p.text,
          })),
          maxContacts: settings.max_contacts || 10,
          priorityRoles: settings.priority_roles || [],
          customRules: settings.custom_rules,
          strictIcpConfig: settings.icp_config,
        });

        const { result: aiResult, metadata } = extractionResponse;
        site.extraction_metadata = metadata;
        if (aiResult.rule_evaluations && aiResult.rule_evaluations.length > 0) {
          site.rule_evaluations = aiResult.rule_evaluations;
        }

        if (this.currentJob) {
          this.currentJob.active_provider = metadata.providerName;
          this.currentJob.active_model = metadata.model;
        }

        if (aiResult.company_name) {
          site.company_name = aiResult.company_name;
        }

        if (aiResult.firmographics) {
          const mergedFirmo: CompanyFirmographics = {
            ...firmographicsCandidate,
          };
          if (aiResult.firmographics.industry) mergedFirmo.industry = aiResult.firmographics.industry;
          if (aiResult.firmographics.employee_tier) mergedFirmo.employee_tier = aiResult.firmographics.employee_tier;
          if (aiResult.firmographics.employee_range) mergedFirmo.employee_range = aiResult.firmographics.employee_range;
          if (aiResult.firmographics.employee_count && aiResult.firmographics.employee_count !== '0' && !/^(unknown|none|not found|n\/a)$/i.test(aiResult.firmographics.employee_count)) {
            mergedFirmo.employee_count = aiResult.firmographics.employee_count;
            mergedFirmo.employee_count_source_url = aiResult.firmographics.employee_count_source_url || site.url;
            mergedFirmo.employee_count_confidence = 'verified';
          }
          if (aiResult.firmographics.founded_year && aiResult.firmographics.founded_year !== '0' && !/^(unknown|none|not found|n\/a)$/i.test(aiResult.firmographics.founded_year)) {
            mergedFirmo.founded_year = aiResult.firmographics.founded_year;
            mergedFirmo.founded_year_source_url = aiResult.firmographics.founded_year_source_url || site.url;
            mergedFirmo.founded_year_confidence = 'verified';
          }
          if (aiResult.firmographics.location) mergedFirmo.location = aiResult.firmographics.location;
          if (aiResult.firmographics.headquarters) mergedFirmo.headquarters = aiResult.firmographics.headquarters;
          if (aiResult.firmographics.country_code) mergedFirmo.country_code = aiResult.firmographics.country_code;
          if (aiResult.firmographics.offering_summary) mergedFirmo.offering_summary = aiResult.firmographics.offering_summary;

          site.firmographics = mergedFirmo;
          if (mergedFirmo.employee_count) site.employee_count = mergedFirmo.employee_count;
          if (mergedFirmo.employee_range) site.employee_range = mergedFirmo.employee_range;
          if (mergedFirmo.founded_year) site.founded_year = mergedFirmo.founded_year;
          if (mergedFirmo.location || mergedFirmo.headquarters) {
            site.location = mergedFirmo.location || mergedFirmo.headquarters;
          }
        } else if (firmographicsCandidate) {
          site.firmographics = firmographicsCandidate;
        }

        // Add generic and departmental emails from AI
        if (aiResult.generic_emails && aiResult.generic_emails.length > 0) {
          for (const ge of aiResult.generic_emails) {
            allFoundEmails.add(ge.toLowerCase());
          }
        }
        if (aiResult.departmental_emails && aiResult.departmental_emails.length > 0) {
          site.departmental_emails = aiResult.departmental_emails;
          for (const de of aiResult.departmental_emails) {
            allFoundEmails.add(de.toLowerCase());
          }
        }

        contactsList = (aiResult.contacts || []).map((c, idx) => {
          const email = String(c.email || c.professional_email || '').trim().toLowerCase();
          const fullName = c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
          const role = c.role || 'Unspecified';
          const sourceUrl = c.source_url || site.url;

          // Deterministic exact classification
          const classification = globalEmailClassifier.classify(
            email,
            {
              fullName,
              firstName: c.first_name,
              lastName: c.last_name,
              role,
              sourceUrl,
            },
            settings.generic_email_patterns
          );

          const isGeneric = classification.isGeneric;
          const profEmail = c.professional_email || (!isGeneric && email ? email : undefined);

          return {
            id: `${site.url}_${idx}_${Date.now()}`,
            company_name: site.company_name || domain,
            website: site.url,
            first_name: c.first_name,
            last_name: c.last_name,
            full_name: fullName,
            role,
            role_tier: c.role_tier || globalIcpScorer.categorizeRole(role),
            email: isGeneric ? '' : (profEmail || email),
            professional_email: profEmail,
            association_status: c.association_status || (profEmail ? 'explicit' : 'none'),
            confidence_score: c.confidence_score || (profEmail ? 90 : (fullName ? 75 : 50)),
            departmental_emails: aiResult.departmental_emails,
            email_type: classification.classification,
            email_classification_reason: classification.reason,
            identity_verified: classification.identityVerified,
            identity_verification_evidence: classification.reason,
            rule_evaluations: aiResult.rule_evaluations,
            phone: c.phone || (allFoundPhones.size > 0 ? Array.from(allFoundPhones)[0] : ''),
            source_url: sourceUrl,
            linkedin_url: c.linkedin_url,
            social_profiles: c.linkedin_url ? { linkedin: c.linkedin_url } : undefined,
            status: 'Verified',
            provider: metadata.providerName,
            model: metadata.model,
            attempts: metadata.attempts,
            latency_ms: metadata.latencyMs,
            extraction_time: metadata.timestamp,
          };
        });

        if (metadata.status === 'fallback_success') {
          this.addLog(
            `AI failover extraction succeeded via ${metadata.providerName} (${metadata.model}) for ${site.url} in ${metadata.latencyMs}ms (${contactsList.length} contacts)`,
            'success',
            site.url
          );
        } else if (metadata.status === 'success') {
          this.addLog(
            `AI extraction completed via ${metadata.providerName} (${metadata.model}) in ${metadata.latencyMs}ms for ${site.url}`,
            'success',
            site.url
          );
        } else {
          // AI extraction failed all provider candidates - fallback to deterministic extraction
          this.addLog(
            `All AI provider attempts exhausted (${metadata.errorCodes?.join(', ') || 'failed'}). Applied rule extraction fallback.`,
            'warning',
            site.url
          );
          contactsList = this.ruleBasedExtractionFallback(site, crawledPages, allFoundEmails, allFoundPhones, harvestedDomContacts, harvestedSchemaContacts, settings);
        }
      } catch (routerErr: any) {
        console.warn(`AI router extraction failed for ${site.url}, using rule-based fallback:`, routerErr);
        this.addLog(`AI extraction notice: ${routerErr.message}. Applied rule extraction fallback.`, 'warning', site.url);
        contactsList = this.ruleBasedExtractionFallback(site, crawledPages, allFoundEmails, allFoundPhones, harvestedDomContacts, harvestedSchemaContacts, settings);
      }
    } else {
      this.addLog(`No AI provider credentials active; using deterministic contact extraction engine.`, 'info', site.url);
      contactsList = this.ruleBasedExtractionFallback(site, crawledPages, allFoundEmails, allFoundPhones, harvestedDomContacts, harvestedSchemaContacts, settings);
    }

    // Assign company-level social profiles
    if (Object.keys(companySocialsAcc).length > 0) {
      site.social_profiles = companySocialsAcc;
    }

    // If firmographics were not populated by AI, use fallback candidate
    if (!site.firmographics && firmographicsCandidate) {
      site.firmographics = firmographicsCandidate;
    }
    if (!site.firmographics) {
      site.firmographics = {};
    }
    if (firmographicsCandidate?.employee_count && !site.firmographics.employee_count) {
      site.firmographics.employee_count = firmographicsCandidate.employee_count;
      site.firmographics.employee_count_source_url = firmographicsCandidate.employee_count_source_url;
      site.firmographics.employee_count_confidence = firmographicsCandidate.employee_count_confidence || 'verified';
    }
    if (firmographicsCandidate?.employee_range && !site.firmographics.employee_range) {
      site.firmographics.employee_range = firmographicsCandidate.employee_range;
      site.firmographics.employee_tier = firmographicsCandidate.employee_tier;
    }
    if (firmographicsCandidate?.founded_year && !site.firmographics.founded_year) {
      site.firmographics.founded_year = firmographicsCandidate.founded_year;
      site.firmographics.founded_year_source_url = firmographicsCandidate.founded_year_source_url;
      site.firmographics.founded_year_confidence = firmographicsCandidate.founded_year_confidence || 'verified';
    }
    if (firmographicsCandidate?.location && !site.firmographics.location) {
      site.firmographics.location = firmographicsCandidate.location;
    }

    if (site.firmographics.employee_count) {
      site.employee_count = site.firmographics.employee_count;
      site.employee_count_source_url = site.firmographics.employee_count_source_url;
      site.employee_count_confidence = site.firmographics.employee_count_confidence;
    }
    if (site.firmographics.employee_range) {
      site.employee_range = site.firmographics.employee_range;
    }
    if (site.firmographics.founded_year) {
      site.founded_year = site.firmographics.founded_year;
      site.founded_year_source_url = site.firmographics.founded_year_source_url;
      site.founded_year_confidence = site.firmographics.founded_year_confidence;
    }
    if (site.firmographics.location) {
      site.location = site.firmographics.location;
    }
    if (!site.firmographics.last_checked_date) {
      site.firmographics.last_checked_date = new Date().toISOString();
    }
    site.last_checked_date = site.firmographics.last_checked_date;

    // Enrich with OpenRouter Google Search if configured (for employee count, LinkedIn, founded year, and leadership)
    const storedSettings = getSettings();
    const openrouterKey = (
      settings.research_config?.openrouter_api_key ||
      storedSettings.research_config?.openrouter_api_key ||
      process.env.OPENROUTER_API_KEY ||
      ''
    ).trim();
    if (openrouterKey && (!site.employee_count || !site.founded_year || !site.linkedin_url)) {
      try {
        const compName = site.company_name || this.getDomainOnly(site.url);
        this.addLog(`Searching Google & web via OpenRouter for ${compName} firmographics...`, 'info', site.url);
        const orDetails = await globalOpenRouterClient.fetchCompanyGoogleSearchDetails(
          openrouterKey,
          compName,
          domain,
          site.url,
          settings.research_config?.model
        );
        if (orDetails) {
          if (orDetails.employee_count && !site.employee_count) {
            site.employee_count = orDetails.employee_count;
            site.employee_count_confidence = 'verified (OpenRouter Search)';
            site.employee_count_source_url = orDetails.linkedin_url || site.url;
            site.firmographics.employee_count = orDetails.employee_count;
            site.firmographics.employee_count_confidence = 'verified (OpenRouter Search)';
          }
          if (orDetails.employee_range && !site.employee_range) {
            site.employee_range = orDetails.employee_range;
            site.employee_tier = orDetails.employee_tier;
            site.firmographics.employee_range = orDetails.employee_range;
            site.firmographics.employee_tier = orDetails.employee_tier;
          }
          if (orDetails.founded_year && !site.founded_year) {
            site.founded_year = orDetails.founded_year;
            site.founded_year_confidence = 'verified (OpenRouter Search)';
            site.founded_year_source_url = orDetails.linkedin_url || site.url;
            site.firmographics.founded_year = orDetails.founded_year;
            site.firmographics.founded_year_confidence = 'verified (OpenRouter Search)';
          }
          if (orDetails.linkedin_url && !site.linkedin_url) {
            site.linkedin_url = orDetails.linkedin_url;
            site.social_profiles = {
              ...site.social_profiles,
              linkedin: orDetails.linkedin_url,
            };
          }
          if (orDetails.headquarters && !site.location) {
            site.location = orDetails.headquarters;
            site.firmographics.location = orDetails.headquarters;
            site.firmographics.headquarters = orDetails.headquarters;
          }
          if (orDetails.company_name && (!site.company_name || site.company_name === domain)) {
            site.company_name = orDetails.company_name;
          }

          // If decision makers were discovered by OpenRouter, add to contacts
          if (orDetails.decision_makers && orDetails.decision_makers.length > 0) {
            for (const dm of orDetails.decision_makers) {
              const dmName = dm.full_name?.trim();
              if (!dmName) continue;
              const alreadyExists = contactsList.some(
                (c) => c.full_name.toLowerCase().trim() === dmName.toLowerCase()
              );
              if (!alreadyExists) {
                const names = dmName.split(' ');
                const firstName = names[0] || '';
                const lastName = names.slice(1).join(' ') || '';
                contactsList.push({
                  id: `${site.url}_or_dm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  company_name: site.company_name || domain,
                  website: site.url,
                  first_name: firstName,
                  last_name: lastName,
                  full_name: dmName,
                  role: dm.role || 'Executive',
                  role_tier: globalIcpScorer.categorizeRole(dm.role || 'Executive'),
                  email: '',
                  professional_email: '',
                  company_generic_emails: [],
                  email_type: 'Unknown',
                  email_classification_reason: 'Identified via OpenRouter Google Search corporate leadership profiling (no direct public email found)',
                  identity_verified: true,
                  identity_verification_evidence: `Verified corporate leadership for ${site.url}`,
                  phone: allFoundPhones.size > 0 ? Array.from(allFoundPhones)[0] : '',
                  source_url: dm.linkedin_url || orDetails.linkedin_url || site.url,
                  linkedin_url: dm.linkedin_url,
                  social_profiles: dm.linkedin_url ? { linkedin: dm.linkedin_url } : undefined,
                  status: 'Verified',
                });
              }
            }
          }

          this.addLog(
            `OpenRouter Google Search enriched ${site.company_name || domain}: ${site.employee_count || site.employee_range || 'N/A'} employees, founded ${site.founded_year || 'N/A'}, LinkedIn: ${site.linkedin_url || 'N/A'}`,
            'success',
            site.url
          );
        }
      } catch (orErr: any) {
        console.warn(`[Crawler] OpenRouter enrichment notice for ${site.url}:`, orErr.message);
      }
    }

    // Merge verified Schema.org contacts
    if (harvestedSchemaContacts.length > 0) {
      const existingEmails = new Set(contactsList.map((c) => c.email.toLowerCase()).filter(Boolean));
      for (const sc of harvestedSchemaContacts) {
        if (!sc.email || !existingEmails.has(sc.email.toLowerCase())) {
          contactsList.unshift(sc);
          if (sc.email) existingEmails.add(sc.email.toLowerCase());
        }
      }
    }

    // Merge verified DOM profile card contacts (team members, attorneys, leadership cards)
    if (harvestedDomContacts.length > 0) {
      const existingEmails = new Set(contactsList.map((c) => (c.professional_email || c.email).toLowerCase()).filter(Boolean));
      const existingNames = new Set(contactsList.map((c) => c.full_name.toLowerCase().trim()).filter(Boolean));

      for (const dc of harvestedDomContacts) {
        const cleanName = dc.full_name.toLowerCase().trim();
        const cleanEmail = (dc.professional_email || dc.email).toLowerCase().trim();
        const existingByName = cleanName ? contactsList.find((c) => c.full_name.toLowerCase().trim() === cleanName) : undefined;
        const existingByEmail = cleanEmail ? contactsList.find((c) => (c.professional_email || c.email).toLowerCase().trim() === cleanEmail) : undefined;

        if (existingByName) {
          if (!existingByName.professional_email && cleanEmail) {
            existingByName.professional_email = cleanEmail;
            existingByName.email = cleanEmail;
            existingByName.association_status = 'explicit';
            existingByName.confidence_score = 95;
            existingEmails.add(cleanEmail);
          }
          if ((!existingByName.role || existingByName.role === 'Unspecified') && dc.role) {
            existingByName.role = dc.role;
            existingByName.role_tier = dc.role_tier;
          }
          if (!existingByName.linkedin_url && dc.linkedin_url) {
            existingByName.linkedin_url = dc.linkedin_url;
          }
        } else if (existingByEmail) {
          if (!existingByEmail.full_name && cleanName) {
            existingByEmail.full_name = dc.full_name;
            existingByEmail.first_name = dc.first_name;
            existingByEmail.last_name = dc.last_name;
            existingNames.add(cleanName);
          }
          if ((!existingByEmail.role || existingByEmail.role === 'Unspecified') && dc.role) {
            existingByEmail.role = dc.role;
          }
        } else if (!(cleanName && existingNames.has(cleanName)) && (!cleanEmail || !existingEmails.has(cleanEmail))) {
          contactsList.push(dc);
          if (cleanEmail) existingEmails.add(cleanEmail);
          if (cleanName) existingNames.add(cleanName);
        }
      }
    }

    // Separate all found website emails into generic vs professional
    const genericEmails = new Set<string>();
    const professionalEmails = new Set<string>();

    for (const em of allFoundEmails) {
      const classification = globalEmailClassifier.classify(em, undefined, settings.generic_email_patterns);
      if (classification.isGeneric) {
        genericEmails.add(em);
      } else {
        professionalEmails.add(em);
      }
    }

    // Add any unassociated professional emails to contactsList so NO personal email is lost
    for (const profEm of professionalEmails) {
      const alreadyHas = contactsList.some(
        (c) => (c.professional_email || c.email).toLowerCase().trim() === profEm.toLowerCase().trim()
      );
      if (!alreadyHas) {
        const sourcePage = crawledPages.find((p) => p.html.toLowerCase().includes(profEm.toLowerCase()))?.url || site.url;
        contactsList.push({
          id: `${site.url}_prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          company_name: site.company_name || domain,
          website: site.url,
          first_name: '',
          last_name: '',
          full_name: '',
          role: 'Business Contact',
          role_tier: 'Other Staff',
          email: profEm,
          professional_email: profEm,
          company_generic_emails: Array.from(genericEmails),
          email_type: 'Professional Personal Email',
          email_classification_reason: 'Direct professional mailbox found on domain',
          identity_verified: true,
          identity_verification_evidence: `Direct professional mailbox verified on ${sourcePage}`,
          phone: allFoundPhones.size > 0 ? Array.from(allFoundPhones)[0] : '',
          source_url: sourcePage,
          status: 'Verified',
        });
      }
    }

    // Assign company_generic_emails and identify professional personal emails
    for (const c of contactsList) {
      c.company_generic_emails = Array.from(genericEmails);
      const isGeneric = c.email_type === 'Generic Business Email' || c.email_type === 'Generic';
      if (!isGeneric && c.email) {
        c.professional_email = c.email;
      }
      if (!c.email && !c.professional_email && (c.email_type === 'Professional Personal Email' || c.email_type === 'Personal')) {
        c.email_type = 'Unknown';
        c.email_classification_reason = 'Profile identified without published direct email';
      }
    }

    // Build structured GenericEmailItem list so generic emails are never lost
    const genericEmailItems: GenericEmailItem[] = [];
    let genIdx = 0;
    for (const genEm of genericEmails) {
      const sourcePage = crawledPages.find((p) => p.html.toLowerCase().includes(genEm.toLowerCase()))?.url || site.url;
      const localPart = genEm.split('@')[0].toLowerCase();
      let department = 'General Inquiries';
      if (/careers|jobs|recruiting|hr|talent/i.test(localPart)) department = 'Careers & Hiring';
      else if (/press|media|news|pr/i.test(localPart)) department = 'Media & Press';
      else if (/marketing/i.test(localPart)) department = 'Marketing';
      else if (/sales|bizdev|partnerships/i.test(localPart)) department = 'Sales & Business';
      else if (/support|help|service/i.test(localPart)) department = 'Customer Support';
      else if (/billing|finance|invoices|accounting/i.test(localPart)) department = 'Billing & Finance';
      else if (/legal|compliance/i.test(localPart)) department = 'Legal & Compliance';
      else if (/admin|office/i.test(localPart)) department = 'Office & Administration';

      genericEmailItems.push({
        id: `${site.url}_gen_${genIdx++}_${Date.now()}`,
        company_name: site.company_name || domain,
        website: site.url,
        email: genEm,
        email_type: 'Generic Business Email',
        department,
        phone: allFoundPhones.size > 0 ? Array.from(allFoundPhones)[0] : '',
        source_url: sourcePage,
        status: 'Verified',
      });
    }

    // Match discovered personal social links (e.g. LinkedIn / Twitter) to contacts
    if (discoveredPersonalProfiles.length > 0) {
      globalSocialDiscovery.matchProfilesToContacts(contactsList, discoveredPersonalProfiles);
    }

    // Enrich contacts with standardized role tier and Ideal Customer Profile (ICP) scoring
    contactsList = globalIcpScorer.enrichContacts(contactsList, site.firmographics, settings.icp_config);

    // Decision Maker Engine: evaluate, score, and prioritize leadership & owners
    contactsList = contactsList.map((c) => globalDecisionMakerFinder.evaluateAndEnrich(c));
    site.decision_maker = globalDecisionMakerFinder.findTopDecisionMaker(contactsList);

    if (site.decision_maker?.is_decision_maker) {
      this.addLog(
        `Decision maker identified: ${site.decision_maker.full_name || 'Owner'} (${site.decision_maker.role || 'Leader'}) [${site.decision_maker.decision_maker_tier}]`,
        'success',
        site.url
      );
    }

    // Prioritize contacts by Decision Maker hierarchy and configured priority roles
    contactsList = globalDecisionMakerFinder.prioritizeDecisionMakers(
      contactsList,
      settings.priority_roles || []
    );

    // Strict ICP Filtering Engine
    if (settings.icp_config?.enabled) {
      const companyEval = globalIcpFilterEngine.evaluateCompany(site.firmographics, settings.icp_config);
      site.icp_filter_status = companyEval.status;
      site.icp_filter_reasons = companyEval.passed ? companyEval.inclusionReasons : companyEval.exclusionReasons;

      const filtered = globalIcpFilterEngine.filterContacts(
        contactsList,
        site.firmographics,
        settings.icp_config
      );

      // Preserve all processed contacts with their strict evaluation metadata intact
      contactsList = filtered.allContacts;
    }

    // ---------------------------------------------------------------------------
    // ADVANCED ACCURACY STAGE A: Automatic Tech Stack Detection from Crawled HTML
    // ---------------------------------------------------------------------------
    let detectedTechStack: string[] = [];
    try {
      const combinedSampleHtml = crawledPages.slice(0, 3).map((p) => p.html).join('\n');
      const techObjs = globalTechDetector.detectFromHtml(combinedSampleHtml);
      detectedTechStack = Array.from(new Set(techObjs.map((t) => t.name)));
    } catch {}

    // ---------------------------------------------------------------------------
    // ADVANCED ACCURACY STAGE B: Corporate Email Pattern Inference Engine
    // Learn the domain's naming convention (e.g., first.last@domain, first@domain, flast@domain)
    // and infer verified corporate emails for named decision-makers who lack a direct email.
    // ---------------------------------------------------------------------------
    const cleanDom = domain.toLowerCase().replace(/^www\./, '');
    let learnedPattern: 'first.last' | 'first' | 'flast' | 'first_last' = 'first.last';
    for (const c of contactsList) {
      const em = (c.professional_email || c.email || '').toLowerCase().trim();
      const fn = (c.first_name || '').toLowerCase().replace(/[^a-z]/g, '');
      const ln = (c.last_name || '').toLowerCase().replace(/[^a-z]/g, '');
      if (em.endsWith(`@${cleanDom}`) && fn.length >= 2) {
        const local = em.split('@')[0];
        if (ln && local === `${fn}.${ln}`) {
          learnedPattern = 'first.last';
          break;
        } else if (local === fn) {
          learnedPattern = 'first';
          break;
        } else if (ln && local === `${fn[0]}${ln}`) {
          learnedPattern = 'flast';
          break;
        } else if (ln && local === `${fn}_${ln}`) {
          learnedPattern = 'first_last';
          break;
        }
      }
    }

    for (const c of contactsList) {
      if (detectedTechStack.length > 0 && (!c.tech_stack || c.tech_stack.length === 0)) {
        c.tech_stack = detectedTechStack;
      }

      const hasDirectProf = Boolean(c.professional_email || (c.email && c.email_type !== 'Generic Business Email' && c.email_type !== 'Generic'));
      if (!hasDirectProf && c.full_name && cleanDom && !cleanDom.includes('linkedin.com')) {
        const parts = c.full_name.trim().split(/\s+/);
        const fn = (c.first_name || parts[0] || '').toLowerCase().replace(/[^a-z]/g, '');
        const ln = (c.last_name || parts.slice(1).join('') || '').toLowerCase().replace(/[^a-z]/g, '');
        if (fn.length >= 2) {
          let inferredEmail = '';
          if (learnedPattern === 'first' || !ln) {
            inferredEmail = `${fn}@${cleanDom}`;
          } else if (learnedPattern === 'flast') {
            inferredEmail = `${fn[0]}${ln}@${cleanDom}`;
          } else if (learnedPattern === 'first_last') {
            inferredEmail = `${fn}_${ln}@${cleanDom}`;
          } else {
            inferredEmail = `${fn}.${ln}@${cleanDom}`;
          }

          c.email = inferredEmail;
          c.professional_email = inferredEmail;
          c.association_status = 'inferred';
          c.email_type = 'Professional Personal Email';
          c.email_classification_reason = `Inferred via corporate domain pattern (${learnedPattern}@${cleanDom})`;
          c.confidence_score = Math.max(c.confidence_score || 0, 86);
          allFoundEmails.add(inferredEmail);
        }
      }
    }

    // ---------------------------------------------------------------------------
    // ADVANCED ACCURACY STAGE C: Real-Time DNS/MX Deliverability & Confidence Calibration
    // ---------------------------------------------------------------------------
    await Promise.all(
      contactsList.slice(0, 25).map(async (c) => {
        const targetEmail = (c.professional_email || c.email || c.company_generic_emails?.[0] || '').trim().toLowerCase();
        if (targetEmail && targetEmail.includes('@')) {
          try {
            const verResult = await VerificationEngine.verifyEmail(
              targetEmail,
              {
                company_id: site.url,
                company_name: site.company_name || domain,
                source_url: c.source_url || site.url,
                email_category:
                  c.email_type === 'Generic Business Email' || c.email_type === 'Generic'
                    ? 'generic_business'
                    : 'professional_personal',
              },
              { checkSmtp: false }
            );
            c.email_verification = verResult;

            // Calibrate multi-signal confidence score (0-99%)
            let calibrated = c.association_status === 'explicit' ? 90 : c.association_status === 'inferred' ? 84 : 75;
            if (verResult.mx_status === 'valid') calibrated += 5;
            if (c.is_decision_maker) calibrated += 2;
            if (c.linkedin_url || c.social_profiles?.linkedin) calibrated += 2;
            if (verResult.verification_status === 'Invalid') calibrated = Math.min(calibrated, 35);
            c.confidence_score = Math.min(99, Math.max(25, calibrated));
          } catch {}
        }
      })
    );

    // Apply max contacts limit after decision maker prioritization and filtering
    if (settings.max_contacts && settings.max_contacts > 0 && contactsList.length > settings.max_contacts) {
      contactsList = contactsList.slice(0, settings.max_contacts);
    }

    // If company has generic emails but NO named contacts in contactsList, create a company-level row
    if (contactsList.length === 0 && genericEmails.size > 0) {
      contactsList.push({
        id: `${site.url}_company_generic`,
        company_name: site.company_name || domain,
        website: site.url,
        first_name: '',
        last_name: '',
        full_name: '',
        role: 'Company General Inboxes',
        role_tier: 'Other Staff',
        email: '',
        professional_email: '',
        company_generic_emails: Array.from(genericEmails),
        email_type: 'Generic Business Email',
        email_classification_reason: 'Company-level generic inboxes',
        identity_verified: true,
        identity_verification_evidence: `Public generic emails found on ${site.url}`,
        phone: allFoundPhones.size > 0 ? Array.from(allFoundPhones)[0] : '',
        source_url: site.url,
        status: 'Verified',
      });
    }

    // Calculate company-level ICP aggregate metrics
    if (contactsList.length > 0) {
      site.avg_icp_score = Math.round(
        contactsList.reduce((acc, c) => acc + (c.icp_score || 0), 0) / contactsList.length
      );
      site.high_icp_contacts_count = contactsList.filter((c) => (c.icp_score || 0) >= 80).length;
    }

    site.generic_emails = Array.from(genericEmails);
    site.generic_email_items = genericEmailItems;
    site.pages_discovered = discoveredUrls.size;
    site.pages_crawled = crawledPages.length;
    site.pages_remaining = Math.max(0, discoveredUrls.size - crawledPages.length);
    site.pages_failed = pagesFailedCount;
    site.crawl_limit_reached = crawledPages.length >= maxPages && discoveredUrls.size > crawledPages.length;
    site.crawl_coverage_summary = `${crawledPages.length} pages processed out of ${maxPages}-page limit (${site.pages_remaining} additional pages discovered, ${pagesFailedCount} failed to load)`;

    site.contacts = contactsList;
    site.contacts_found = contactsList.filter((c) => Boolean(c.full_name || c.email || c.professional_email)).length;

    const totalSiteEmails = new Set<string>();
    for (const em of allFoundEmails) totalSiteEmails.add(em.toLowerCase());
    for (const c of contactsList) {
      if (c.email) totalSiteEmails.add(c.email.toLowerCase());
      if (c.professional_email) totalSiteEmails.add(c.professional_email.toLowerCase());
      if (c.company_generic_emails) {
        for (const ge of c.company_generic_emails) totalSiteEmails.add(ge.toLowerCase());
      }
    }
    for (const ge of genericEmailItems) totalSiteEmails.add(ge.email.toLowerCase());
    site.emails_found = totalSiteEmails.size;

    // Determine final status
    if (contactsList.length === 0) {
      if (totalSiteEmails.size === 0) {
        site.status = 'No email found';
      } else {
        site.status = 'Generic email found';
      }
    } else {
      site.status = 'Completed';
    }

    // Update job totals across all websites
    if (this.currentJob) {
      this.syncJobAggregates();
    }

    this.addLog(
      `Company completed: ${site.url} -> ${site.contacts_found} contact(s), ${genericEmailItems.length} generic inbox(es) (Total: ${site.emails_found} distinct email(s)).`,
      'success',
      site.url
    );

    // Sync extracted company details & contacts into shared company identity model in Firebase
    try {
      globalJobCoordinator
        .saveCompanyRecord({
          domain: site.normalized_url || this.getDomainOnly(site.url),
          company_name: site.company_name || this.getDomainOnly(site.url),
          url: site.url,
          location: site.firmographics?.headquarters || site.firmographics?.location || site.location,
          industry: site.firmographics?.industry,
          employee_count: site.firmographics?.employee_count || site.employee_count,
          employee_range: site.firmographics?.employee_range || site.employee_range,
          employee_count_source_url:
            site.firmographics?.employee_count_source_url || site.employee_count_source_url,
          founded_year: site.firmographics?.founded_year || site.founded_year,
          founded_year_source_url:
            site.firmographics?.founded_year_source_url || site.founded_year_source_url,
          contacts: site.contacts,
          contacts_count: site.contacts_found,
          generic_emails: site.generic_emails,
          departmental_emails: site.departmental_emails,
          emails_count: site.emails_found,
          enrichment_status: 'completed',
          last_enrichment_date: new Date().toISOString(),
        })
        .catch(() => {});
    } catch {}
  }

  private prioritizeContacts(contacts: Contact[], priorityRoles: string[], limit: number): Contact[] {
    const scored = contacts.map((c) => {
      let score = 0;
      const roleLower = c.role.toLowerCase();
      for (let i = 0; i < priorityRoles.length; i++) {
        if (roleLower.includes(priorityRoles[i].toLowerCase())) {
          score = 100 - i;
          break;
        }
      }
      if (c.email_type === 'Personal') score += 20;
      if (c.email_type === 'Role-based') score += 10;
      return { contact: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.contact);
  }

  private ruleBasedExtractionFallback(
    site: WebsiteResult,
    pages: { url: string; html: string; text: string; title: string }[],
    emails: Set<string>,
    phones: Set<string>,
    harvestedDomContacts: Contact[],
    harvestedSchemaContacts: Contact[],
    settings: ScrapeSettings
  ): Contact[] {
    const list: Contact[] = [];
    const genericPatterns = settings.generic_email_patterns || [];
    const primaryPhone = phones.size > 0 ? Array.from(phones)[0] : '';
    const compName = site.company_name || this.getDomainOnly(site.url);

    const existingEmails = new Set<string>();
    const existingNames = new Set<string>();

    // 1. Add authentic DOM profile card contacts (real people, job titles, and emails)
    for (const dc of harvestedDomContacts) {
      const cleanName = dc.full_name?.trim() || '';
      const cleanEmail = (dc.professional_email || dc.email)?.toLowerCase().trim() || '';
      if (!cleanName && !cleanEmail) continue;

      list.push(dc);
      if (cleanEmail) existingEmails.add(cleanEmail);
      if (cleanName) existingNames.add(cleanName.toLowerCase());
    }

    // 2. Add Schema.org structured contacts
    for (const sc of harvestedSchemaContacts) {
      const cleanEmail = (sc.professional_email || sc.email)?.toLowerCase().trim() || '';
      const cleanName = sc.full_name?.trim() || '';
      if (cleanEmail && existingEmails.has(cleanEmail)) continue;
      if (cleanName && existingNames.has(cleanName.toLowerCase())) continue;

      list.push(sc);
      if (cleanEmail) existingEmails.add(cleanEmail);
      if (cleanName) existingNames.add(cleanName.toLowerCase());
    }

    // 3. For any remaining emails discovered on site that haven't been associated with a person yet
    let contactIdx = 0;
    for (const email of emails) {
      const emailLower = email.toLowerCase().trim();
      if (!emailLower || existingEmails.has(emailLower)) continue;

      const classification = globalEmailClassifier.classify(emailLower, undefined, genericPatterns);

      // Guess source page where email appeared
      const sourcePage = pages.find((p) => p.html.toLowerCase().includes(emailLower))?.url || site.url;

      list.push({
        id: `${site.url}_c_${contactIdx++}_${Date.now()}`,
        company_name: compName,
        website: site.url,
        first_name: '',
        last_name: '',
        full_name: '',
        role: classification.isGeneric ? 'Company General' : 'Business Contact',
        email: emailLower,
        professional_email: !classification.isGeneric ? emailLower : undefined,
        email_type: classification.classification,
        email_classification_reason: classification.reason,
        identity_verified: classification.identityVerified,
        identity_verification_evidence: classification.reason,
        phone: primaryPhone,
        source_url: sourcePage,
        status: 'Verified',
      });
      existingEmails.add(emailLower);
    }

    return list;
  }

  private async fetchWithRetry(
    url: string,
    maxRetries: number,
    timeoutMs: number
  ): Promise<{ html: string; status: number; proxyUsed?: string; finalUrl?: string } | null> {
    let attempt = 0;
    while (attempt <= maxRetries && !this.isStopped) {
      const proxy = globalProxyPool.selectProxy();
      const agent = proxy ? globalProxyPool.getAgentForProxy(proxy) : undefined;
      const headers = globalAntiBotEngine.generateHeaders(url);
      const startReq = Date.now();
      const proxyDesc = proxy ? `${proxy.protocol.toUpperCase()}://${proxy.host}:${proxy.port}` : 'Direct IP';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Apply humanized jitter delay if anti-bot jitter is enabled
        const jitter = globalAntiBotEngine.calculateJitterDelay();
        if (jitter > 0) {
          await new Promise((r) => setTimeout(r, jitter));
        }

        const fetchOptions: any = {
          signal: controller.signal,
          headers,
          redirect: 'follow',
        };
        if (agent) {
          fetchOptions.agent = agent;
        }

        const res = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        const elapsed = Date.now() - startReq;
        if (proxy) {
          globalProxyPool.recordSuccess(proxy.id, elapsed);
        }

        if (res.status === 401 || res.status === 403) {
          return { html: '', status: res.status, proxyUsed: proxyDesc, finalUrl: res.url || url };
        }

        if (res.ok) {
          const html = await res.text();
          return { html, status: res.status, proxyUsed: proxyDesc, finalUrl: res.url || url };
        }

        // Only retry on 5xx or connection error
        if (res.status < 500) {
          return null;
        }
      } catch (err: any) {
        if (proxy) {
          globalProxyPool.recordFailure(proxy.id, err.message || 'Request failed');
        }
        if (attempt === maxRetries) {
          return null;
        }
      }
      attempt++;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return null;
  }

  public decodeCloudflareEmail(cfemail: string): string {
    try {
      const k = parseInt(cfemail.substring(0, 2), 16);
      let email = '';
      for (let i = 2; i < cfemail.length; i += 2) {
        email += String.fromCharCode(parseInt(cfemail.substring(i, i + 2), 16) ^ k);
      }
      return email.trim();
    } catch {
      return '';
    }
  }

  public isValidEmail(email: string): boolean {
    if (!email || email.length < 5 || email.length > 100) return false;
    if (!email.includes('@') || !email.includes('.')) return false;
    const lower = email.toLowerCase().trim();

    // Filter file extensions
    if (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.svg') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.css') ||
      lower.endsWith('.js')
    ) {
      return false;
    }

    const atIdx = lower.lastIndexOf('@');
    if (atIdx <= 0 || atIdx === lower.length - 1) return false;

    const domainPart = lower.substring(atIdx + 1);
    const localPart = lower.substring(0, atIdx);

    // Filter placeholder / fake domains
    const dummyDomains = [
      'example.com',
      'example.org',
      'domain.com',
      'company.com',
      'yoursite.com',
      'email.com',
      'test.com',
      'sentry.io',
      'wixpress.com',
      'wix.com',
      'squarespace.com',
      'wordpress.org',
      'gravatar.com',
      'cloudflare.com',
    ];
    if (dummyDomains.includes(domainPart)) return false;

    // Filter placeholder usernames
    if (['user', 'username', 'email', 'name', 'test', 'someone', 'sample', 'placeholder'].includes(localPart)) {
      return false;
    }

    return true;
  }

  private isRelevantPath(path: string): boolean {
    const p = path.toLowerCase();
    if (
      p.includes('/blog') ||
      p.includes('/post') ||
      p.includes('/article') ||
      p.includes('/tag/') ||
      p.includes('/category/') ||
      p.includes('/archive') ||
      p.includes('/page/') ||
      p.includes('/feed') ||
      p.includes('/comments') ||
      p.includes('/testimonials') ||
      p.includes('/reviews') ||
      p.includes('/disclaimer') ||
      p.includes('/faq') ||
      p.includes('/case-results') ||
      /\/\d{4}\/\d{2}/.test(p)
    ) {
      return false;
    }

    // Reject deep nested paths (>3 segments) unless they explicitly contain person/contact terms
    const segments = p.split('/').filter(Boolean);
    if (segments.length > 2 && (p.includes('location') || p.includes('practice'))) {
      const hasPersonTerm = ['attorney', 'lawyer', 'team', 'staff', 'partner', 'contact', 'bio'].some(k => p.includes(k));
      if (!hasPersonTerm) return false;
    }

    const keywords = [
      'attorney', 'attorneys', 'lawyer', 'lawyers', 'partner', 'partners',
      'team', 'leadership', 'management', 'founders', 'founder', 'owner',
      'executives', 'director', 'people', 'staff', 'bio', 'profile', 'contact',
      'about', 'who-we-are', 'our-story'
    ];
    return keywords.some((k) => p.includes(k));
  }

  private async discoverSitemapUrls(siteUrl: string, domain: string): Promise<string[]> {
    const discovered: string[] = [];
    try {
      const origin = new URL(siteUrl).origin;
      const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
      for (const sitemapUrl of candidates) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(sitemapUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          clearTimeout(timeout);
          if (res.ok) {
            const xml = await res.text();
            const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
            let m;
            while ((m = locRegex.exec(xml)) !== null) {
              const locUrl = m[1].trim();
              if (this.getDomainOnly(locUrl) === domain) {
                const pathname = new URL(locUrl).pathname.toLowerCase();
                if (this.isRelevantPath(pathname)) {
                  discovered.push(locUrl);
                }
              }
            }
            if (discovered.length > 0) break;
          }
        } catch {}
      }
    } catch {}
    return discovered;
  }

  private harvestDomProfileContacts(html: string, currentUrl: string, companyName: string, domain: string): Contact[] {
    const $ = cheerio.load(html);
    const contacts: Contact[] = [];

    const cardSelectors = [
      '.attorney-card', '.lawyer-card', '.team-member', '.team-card', '.member-card',
      '.bio-card', '.person-card', '.staff-card', '.profile-card', '.vcard',
      '[class*="attorney-item"]', '[class*="team-item"]', '[class*="member-item"]',
      '[class*="leadership-item"]', '[class*="staff-item"]', '[class*="person-item"]',
      '.itemPreview', '[class*="itemPreview"]', '.item.hasImg', '.itemContent',
      '.blockContent', 'article', '.card', '.elementor-person', '.et_pb_team_member'
    ];

    const seenCardNames = new Set<string>();

    $(cardSelectors.join(', ')).each((_, el) => {
      const $el = $(el);
      const nameEl = $el.find('h1, h2, h3, h4, h5, strong, .name, [class*="name"], .contentTitle, [class*="title"]').first();
      const rawName = nameEl.text().trim();
      if (!rawName || rawName.length < 3 || rawName.length > 60) return;

      const cleanName = rawName
        .replace(/,\s*(Esq\.?|J\.?D\.?|LLC|P\.?C\.?|Attorney\s+at\s+Law|Managing\s+Partner|Partner|Director|Founder|Owner).*$/i, '')
        .replace(/\s*[-–—|]\s*(Attorney|Lawyer|Partner|Family\s+Law|Legal|Director).*$/i, '')
        .trim();

      if (/^(our\s+team|meet\s+the|leadership|attorneys|lawyers|contact\s+us|about\s+us|practice\s+areas|family\s+law|domestic\s+violence|child\s+custody|reviews|blog|frequently\s+asked|questions)$/i.test(cleanName)) return;

      // Reject service headings, marketing banners, and non-person phrases
      if (/^(domestic|violence|family\s+law|child\s+custody|fill\s+out|wait\s+for|forms|process|practice|service|overview|testimonial|schedule|contact|review|areas|court|divorce|custody|support|orders|rights|legal\s+services)/i.test(cleanName)) return;

      const parts = cleanName.split(/\s+/);
      if (parts.length < 2 || parts.length > 5) return;
      if (parts.some((p) => /^(help|experience|easy|smooth|cases|services|reviews|contact|why|choose|overview|mission|practice|areas|court|divorce|custody|support|orders|rights|future|client|about|blog|questions|post|years|more|here|start|read|call|phone|email|domestic|violence|family|law|forms|form|wait|fill|step|process)$/i.test(p))) return;
      if (!parts.every((p) => /^[A-Za-z][a-zA-Z.'-]*$/.test(p))) return;

      if (seenCardNames.has(cleanName.toLowerCase())) return;

      const roleEl = $el.find('.role, .title, [class*="role"], [class*="title"], [class*="position"], .itemInnerContent p, p').first();
      let roleText = roleEl.text().trim() || 'Professional';
      if (roleText === rawName || roleText === cleanName || roleText.length > 120) {
        const altRole = $el.find('.itemInnerContent p, p').not(nameEl).first().text().trim();
        if (altRole && altRole !== cleanName && altRole.length <= 120) {
          roleText = altRole;
        } else {
          roleText = 'Professional';
        }
      }

      let email = '';
      const mailto = $el.find('a[href^="mailto:"]').first().attr('href');
      if (mailto) {
        email = mailto.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      } else {
        const cf = $el.find('[data-cfemail]').first().attr('data-cfemail');
        if (cf) {
          email = this.decodeCloudflareEmail(cf).toLowerCase();
        } else {
          const cardText = $el.text();
          const emMatch = cardText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emMatch) {
            email = emMatch[0].toLowerCase();
          }
        }
      }

      let phone = '';
      const tel = $el.find('a[href^="tel:"]').first().attr('href');
      if (tel) {
        phone = tel.replace(/^tel:/i, '').trim();
      }

      let linkedin = '';
      const liLink = $el.find('a[href*="linkedin.com/in/"]').first().attr('href');
      if (liLink) {
        linkedin = liLink;
      }

      const cleanEm = (email && this.isValidEmail(email)) ? email : '';
      const hasDirectContact = Boolean(cleanEm || phone || linkedin);
      const isAuthenticRole = /\b(attorney|lawyer|partner|director|founder|co-founder|owner|ceo|cto|cfo|coo|cmo|cro|president|counsel|manager|principal|executive|vp|vice\s+president|head\s+of|chair|chairman|board\s+member|managing\s+director|associate|paralegal)\b/i.test(roleText);

      // Must have direct contact information or an explicit professional role
      if (!hasDirectContact && !isAuthenticRole) {
        return;
      }

      // If name is entirely uppercase without direct email, it is likely a banner/heading
      if (cleanName === cleanName.toUpperCase() && !cleanEm) {
        return;
      }

      seenCardNames.add(cleanName.toLowerCase());

      const classification = cleanEm
        ? globalEmailClassifier.classify(cleanEm, { fullName: cleanName, role: roleText, sourceUrl: currentUrl })
        : { classification: 'Unknown' as any, reason: 'No direct email found in profile card', identityVerified: false, isGeneric: false };

      contacts.push({
        id: `${domain}_card_${Math.random().toString(36).substring(2, 8)}`,
        company_name: companyName,
        website: currentUrl,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
        full_name: cleanName,
        role: roleText,
        email: cleanEm,
        professional_email: (!classification.isGeneric && cleanEm) ? cleanEm : undefined,
        association_status: cleanEm ? 'explicit' : 'none',
        confidence_score: cleanEm ? 96 : 82,
        email_type: classification.classification,
        email_classification_reason: classification.reason,
        identity_verified: classification.identityVerified || Boolean(linkedin),
        identity_verification_evidence: `Direct profile card layout evidence on ${currentUrl}`,
        phone: phone,
        source_url: currentUrl,
        linkedin_url: linkedin,
        social_profiles: linkedin ? { linkedin } : undefined,
        status: 'Verified (DOM Profile)',
      });
    });

    // Also harvest structured JSON-LD (Person / Organization.founder / employee / member) and Next.js __NEXT_DATA__
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawJson = $(el).html();
        if (!rawJson) return;
        const parsed = JSON.parse(rawJson);
        const visitNode = (node: any) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            node.forEach(visitNode);
            return;
          }
          const nodeType = String(node['@type'] || '');
          if (/Person/i.test(nodeType) && typeof node.name === 'string') {
            const pName = node.name.trim();
            const parts = pName.split(/\s+/);
            if (parts.length >= 2 && parts.length <= 4 && !seenCardNames.has(pName.toLowerCase())) {
              seenCardNames.add(pName.toLowerCase());
              const pRole = String(node.jobTitle || node.roleName || node.description || 'Executive').slice(0, 100);
              const rawEm = String(node.email || '').replace(/^mailto:/i, '').trim().toLowerCase();
              const cleanEm = this.isValidEmail(rawEm) ? rawEm : '';
              const pPhone = String(node.telephone || '').trim();
              let linkedin = '';
              if (Array.isArray(node.sameAs)) {
                linkedin = node.sameAs.find((u: any) => typeof u === 'string' && u.includes('linkedin.com/in/')) || '';
              }
              const classification = cleanEm
                ? globalEmailClassifier.classify(cleanEm, { fullName: pName, role: pRole, sourceUrl: currentUrl })
                : { classification: 'Unknown' as any, reason: 'JSON-LD Person schema entity', identityVerified: true, isGeneric: false };

              contacts.push({
                id: `${domain}_jsonld_${Math.random().toString(36).substring(2, 8)}`,
                company_name: companyName,
                website: currentUrl,
                first_name: parts[0] || '',
                last_name: parts.slice(1).join(' ') || '',
                full_name: pName,
                role: pRole,
                email: cleanEm,
                professional_email: (!classification.isGeneric && cleanEm) ? cleanEm : undefined,
                association_status: cleanEm ? 'explicit' : 'none',
                confidence_score: cleanEm ? 98 : 88,
                email_type: classification.classification,
                email_classification_reason: classification.reason,
                identity_verified: true,
                identity_verification_evidence: `Structured JSON-LD Person entity on ${currentUrl}`,
                phone: pPhone,
                source_url: currentUrl,
                linkedin_url: linkedin,
                social_profiles: linkedin ? { linkedin } : undefined,
                status: 'Verified (Schema.org)',
              });
            }
          }
          for (const key of ['founder', 'founders', 'employee', 'employees', 'member', 'members', '@graph']) {
            if (node[key]) visitNode(node[key]);
          }
        };
        visitNode(parsed);
      } catch {}
    });

    return contacts;
  }

  private extractEmailsFromHtml(html: string, bodyText: string): string[] {
    const emails = new Set<string>();

    // 1. Cloudflare protected emails [data-cfemail]
    const cfRegex = /data-cfemail=["']([0-9a-fA-F]+)["']/gi;
    let cfMatch;
    while ((cfMatch = cfRegex.exec(html)) !== null) {
      const decoded = this.decodeCloudflareEmail(cfMatch[1]);
      if (this.isValidEmail(decoded)) {
        emails.add(decoded.toLowerCase());
      }
    }

    // 2. Mailto links (decode entities and url-encoding, strip query params)
    const mailtoRegex = /href=["']mailto:([^"'?#\s]+)(?:\?[^"']*)?["']/gi;
    let match;
    while ((match = mailtoRegex.exec(html)) !== null) {
      try {
        const decoded = decodeURIComponent(match[1]).trim().toLowerCase();
        if (this.isValidEmail(decoded)) {
          emails.add(decoded);
        }
      } catch {
        const raw = match[1].trim().toLowerCase();
        if (this.isValidEmail(raw)) {
          emails.add(raw);
        }
      }
    }

    // 3. HTML entity & unicode decode on html string and tag stripping with spacing
    const cleanHtml = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#64;|&commat;|&#x40;|\\u0040|%40/gi, '@')
      .replace(/&#46;|&period;|&#x2e;|\\u002e/gi, '.');

    // 4. Standard email pattern in text and html
    const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const directMatches = (bodyText + ' ' + cleanHtml).match(emailPattern) || [];
    for (const em of directMatches) {
      const lower = em.toLowerCase();
      if (this.isValidEmail(lower)) {
        emails.add(lower);
      }
    }

    // 5. Obfuscation detection: "name [at] domain [dot] com", "name(at)domain(dot)com", "name at domain dot com"
    const obfuscatedPattern = /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|@|\bat\b)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.|\bdot\b)\s*([a-zA-Z]{2,6})/gi;
    let obfMatch;
    while ((obfMatch = obfuscatedPattern.exec(bodyText)) !== null) {
      const local = obfMatch[1].trim();
      const dom = obfMatch[2].trim();
      const tld = obfMatch[3].trim();
      if (local && dom && tld && !local.includes(' ') && !dom.includes(' ')) {
        const decoded = `${local}@${dom}.${tld}`.toLowerCase();
        if (this.isValidEmail(decoded)) {
          emails.add(decoded);
        }
      }
    }

    return Array.from(emails);
  }

  private extractPhonesFromHtml(html: string, bodyText: string): string[] {
    const phones = new Set<string>();

    // 1. Tel links
    const telRegex = /href=["']tel:([+0-9\s().-]{7,25})["']/gi;
    let match;
    while ((match = telRegex.exec(html)) !== null) {
      const cleaned = match[1].trim();
      if (cleaned.length >= 7) {
        phones.add(cleaned);
      }
    }

    // 2. Common international & local formats
    const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
    const textMatches = bodyText.match(phonePattern) || [];
    for (const ph of textMatches) {
      const digitsOnly = ph.replace(/\D/g, '');
      if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
        if (!digitsOnly.startsWith('2024') && !digitsOnly.startsWith('2025') && !digitsOnly.startsWith('2026')) {
          phones.add(ph.trim());
          if (phones.size >= 3) break;
        }
      }
    }

    return Array.from(phones);
  }

  private extractInternalLinks(html: string, currentUrl: string, domain: string): { url: string; score: number }[] {
    const $ = cheerio.load(html);
    const results: { url: string; score: number }[] = [];
    const seen = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href) return;

      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
        return;
      }

      try {
        const resolved = new URL(href, currentUrl);
        const resolvedDomain = this.getDomainOnly(resolved.href);

        // Stay strictly within same domain
        if (resolvedDomain !== domain) return;

        // Skip static assets
        const pathname = resolved.pathname.toLowerCase();
        if (
          pathname.endsWith('.pdf') ||
          pathname.endsWith('.jpg') ||
          pathname.endsWith('.jpeg') ||
          pathname.endsWith('.png') ||
          pathname.endsWith('.gif') ||
          pathname.endsWith('.webp') ||
          pathname.endsWith('.svg') ||
          pathname.endsWith('.css') ||
          pathname.endsWith('.js') ||
          pathname.endsWith('.zip') ||
          pathname.endsWith('.xml') ||
          pathname.endsWith('.mp4') ||
          pathname.endsWith('.ico')
        ) {
          return;
        }

        // Ignore bad / irrelevant paths and calendar / pagination loops
        const ignoredPaths = [
          '/cart',
          '/checkout',
          '/login',
          '/signin',
          '/signup',
          '/register',
          '/wp-admin',
          '/wp-login',
          '/my-account',
          '/feed',
          '/rss',
        ];
        if (ignoredPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
          return;
        }

        // Avoid date loops like /2025/11/
        if (/\/\d{4}\/\d{2}\//.test(pathname)) {
          return;
        }

        const cleanUrl = this.canonicalizeUrl(resolved.href);
        if (!cleanUrl || seen.has(cleanUrl)) return;
        seen.add(cleanUrl);

        const anchorText = $(el).text().toLowerCase();
        const score = this.scoreUrlRelevance(pathname, anchorText);

        results.push({ url: cleanUrl, score });
      } catch {
        // invalid URL
      }
    });

    return results;
  }

  private scoreUrlRelevance(path: string, text: string): number {
    const p = path.toLowerCase();
    const t = text.toLowerCase();

    // Blog, article, and date archive penalty (never let articles displace staff pages)
    if (
      p.includes('/blog') ||
      p.includes('/post') ||
      p.includes('/article') ||
      p.includes('/tag/') ||
      p.includes('/category/') ||
      p.includes('/archive') ||
      /\/\d{4}\/\d{2}/.test(p)
    ) {
      return 15;
    }

    // Tier 0: Direct Core Endpoints (Score 350)
    const tier0 = [
      '/about-us',
      '/about',
      '/company',
      '/our-history',
      '/history',
      '/company-facts',
      '/facts',
      '/fast-facts',
      '/reports',
      '/annual-report',
      '/official-reports',
      '/overview',
      '/company-overview',
      '/who-we-are',
      '/our-story',
      '/team',
      '/our-team',
      '/attorneys',
      '/our-attorneys',
      '/lawyers',
      '/our-lawyers',
      '/leadership',
      '/founders',
      '/management',
      '/contact-us',
      '/contact',
      '/people',
      '/our-people',
      '/professionals',
    ];
    for (const core of tier0) {
      if (p === core || p === `${core}/`) return 350;
    }

    // Tier 1: Highest Priority (Score 220) - Attorneys, Lawyers, Managing Partners, Leadership, Founders, Owners, History, Facts
    const tier1 = [
      'history',
      'our-history',
      'company-facts',
      'facts',
      'fast-facts',
      'company-profile',
      'corporate-overview',
      'attorney',
      'attorneys',
      'our-attorneys',
      'lawyer',
      'lawyers',
      'our-lawyers',
      'managing-partner',
      'managing-partners',
      'equity-partner',
      'legal-professionals',
      'legal-team',
      'counsel',
      'general-counsel',
      'leadership',
      'founders',
      'founder',
      'owner',
      'owners',
      'executives',
      'executive-team',
      'board-of-directors',
      'directors',
      'meet-the-team',
      'meet-our-team',
      'our-team',
      'team',
      'management',
    ];

    // Tier 2: High Priority (Score 160) - People, Staff, Bios, Profiles, Corporate Directory, Contact
    const tier2 = [
      'people',
      'our-people',
      'staff',
      'our-staff',
      'professionals',
      'our-professionals',
      'directory',
      'corporate-directory',
      'contact',
      'contact-us',
      'contactus',
      'locations',
      'offices',
      'office-locations',
      'get-in-touch',
      'who-we-are',
      'our-story',
      'about-us',
      'aboutus',
    ];

    // Tier 3: Medium Priority (Score 90) - Practice areas, Services, Company Overview
    const tier3 = [
      'practice-areas',
      'practices',
      'practice',
      'services',
      'company',
      'overview',
      'careers',
      'join-us',
      'press',
      'news',
    ];

    for (const k of tier1) {
      if (p.includes(k) || t.includes(k)) return 220;
    }
    for (const k of tier2) {
      if (p.includes(k) || t.includes(k)) return 160;
    }
    for (const k of tier3) {
      if (p.includes(k) || t.includes(k)) return 90;
    }
    return 30;
  }

  private cleanCompanyName(title: string, domain: string): string {
    const parts = title.split(/[-|–—:]/);
    if (parts.length > 0 && parts[0].trim().length > 2) {
      const candidate = parts[0].trim();
      if (!candidate.toLowerCase().includes('home') && !candidate.toLowerCase().includes('welcome')) {
        return candidate;
      }
    }
    return domain.replace(/^www\./, '').split('.')[0].toUpperCase();
  }

  public canonicalizeUrl(url: string): string {
    if (!url) return '';
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    try {
      const parsed = new URL(clean);
      parsed.hash = '';

      // Normalize parameters: preserve identifiers, directories, pagination, and location filters
      const allowedIdParams = [
        'p', 'page_id', 'id', 'post', 'locale', 'location', 'city', 'state',
        'team', 'department', 'dept', 'office', 'attorney', 'lawyer', 'staff',
        'person', 'view', 'page', 'paged', 'offset', 'category', 'cat', 'type',
        'branch', 'tab', 'filter', 'sub', 'area'
      ];
      const params = new URLSearchParams();
      for (const [k, v] of parsed.searchParams.entries()) {
        const kl = k.toLowerCase();
        if (allowedIdParams.includes(kl) && /^\d+$/.test(v)) {
          params.set(k, v);
        }
      }
      const qs = params.toString();

      // Normalize path: collapse multi-slashes and strip trailing slash (except root '/')
      let pathname = parsed.pathname.replace(/\/+/g, '/').toLowerCase();
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      if (!pathname) pathname = '/';

      const host = parsed.host.toLowerCase().replace(/^www\./, '');
      const protocol = parsed.protocol.toLowerCase();
      return `${protocol}//${host}${pathname}${qs ? `?${qs}` : ''}`;
    } catch {
      return clean.toLowerCase().replace(/\/+$/, '');
    }
  }

  private normalizeUrl(url: string): string {
    return this.canonicalizeUrl(url);
  }

  private getDomainOnly(url: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }
  }

  private addLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', website?: string): void {
    if (!this.currentJob) return;
    const now = new Date();
    const timeStr = `[${now.toTimeString().split(' ')[0]}]`;
    const logItem: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      message,
      type,
      website,
    };
    this.currentJob.logs.unshift(logItem);
    if (this.currentJob.logs.length > 300) {
      this.currentJob.logs.pop();
    }
  }
}

export const crawlerEngine = new CrawlerEngine();
