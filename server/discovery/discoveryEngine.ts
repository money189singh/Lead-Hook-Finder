import fs from 'fs';
import path from 'path';
import { DiscoveryCriteria, DiscoveryJob, DiscoveredProspect, DiscoverySource } from './types';
import { generateSearchQueries } from './queryGenerator';
import { globalDiscoveryProvider } from './provider';
import {
  extractCleanDomain,
  cleanCompanyName,
  isInvalidCompanyName,
  isArticleOrListicleTitle,
} from './domainDetector';
import { classifySearchResult } from './sourceClassifier';
import { extractCompaniesFromDirectory } from './directoryExtractor';
import { verifyCompanyOfficialWebsite } from './websiteVerifier';
import { enrichCandidateProspect } from './prospectEnricher';
import { extractActivitiesFromSearchResults } from './activityDetector';
import { globalJobCoordinator } from '../coordination/jobCoordinator';
import { globalDiscoveryLedger } from './ledger';
import { ActivityLog } from '../../src/types';
import { globalSqlStorage } from '../db/sqlStorage';
import { isMegaCapCompany, evaluateProspectCriteria, extractStructuredSignals } from './signalEngine';

const JOBS_DIR = path.join(process.cwd(), 'data', 'discovery_jobs');

export class DiscoveryEngine {
  private activeJobs: Map<string, DiscoveryJob> = new Map();
  private pausedJobs: Set<string> = new Set();
  private stoppedJobs: Set<string> = new Set();

  constructor() {
    this.ensureDirs();
    this.loadJobs();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(JOBS_DIR)) {
        fs.mkdirSync(JOBS_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not create discovery jobs dir:', e);
    }
  }

  private loadJobs() {
    try {
      if (fs.existsSync(JOBS_DIR)) {
        const files = fs.readdirSync(JOBS_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const raw = fs.readFileSync(path.join(JOBS_DIR, file), 'utf-8');
            const job: DiscoveryJob = JSON.parse(raw);
            if (job.status === 'running') {
              job.status = 'stopped';
            }
            if (!job.sources) {
              job.sources = [];
            }
            this.activeJobs.set(job.id, job);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load discovery jobs from disk:', e);
    }
  }

  public saveJob(job: DiscoveryJob) {
    this.activeJobs.set(job.id, job);
    try {
      this.ensureDirs();
      const filePath = path.join(JOBS_DIR, `${job.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(job, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`Failed to persist discovery job ${job.id}:`, e);
    }

    // Sync to SQLite and Cloud Files Storage if prospects exist
    if (job.prospects && job.prospects.length > 0) {
      try {
        globalSqlStorage.storeDataset({
          id: `file_disc_${job.id}`,
          tool: 'AI Prospect Discovery',
          search_name: job.searchQuery || job.criteria?.naturalLanguagePrompt || 'B2B Prospect Discovery',
          created_at: job.created_at || job.createdAt || new Date().toISOString(),
          records: job.prospects.map((p: any) => ({
            name: p.companyName,
            company: p.companyName,
            website: p.website,
            domain: p.domain,
            description: p.description,
            industry: p.industry,
            location: p.location,
            city: p.city,
            state: p.state,
            country: p.country,
            employeeCount: p.employeeCount,
            jobTitle: p.jobTitle,
            email: p.decisionMakerEmail || p.email,
            contactName: p.personName || p.contactName,
            verificationStatus: p.verificationStatus,
            confidence: p.confidence,
            fitScore: p.fitScore,
            buyingSignals: p.buyingSignals,
          })),
          tags: ['AI Prospecting', 'B2B Companies', `${job.prospects.length} Prospects`],
        });
      } catch {}
    }
  }

  public getJob(id: string): DiscoveryJob | null {
    try {
      this.ensureDirs();
      const filePath = path.join(JOBS_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const job: DiscoveryJob = JSON.parse(raw);
        this.activeJobs.set(id, job);
        return job;
      }
    } catch {}
    return this.activeJobs.get(id) || null;
  }

  public getAllJobs(): DiscoveryJob[] {
    try {
      this.ensureDirs();
      if (fs.existsSync(JOBS_DIR)) {
        const files = fs.readdirSync(JOBS_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(path.join(JOBS_DIR, file), 'utf-8');
              const job: DiscoveryJob = JSON.parse(raw);
              this.activeJobs.set(job.id, job);
            } catch {}
          }
        }
      }
    } catch {}
    const list = Array.from(this.activeJobs.values());
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }

  public deleteJob(id: string): boolean {
    this.activeJobs.delete(id);
    this.stoppedJobs.add(id);
    try {
      const filePath = path.join(JOBS_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (e) {
      console.warn(`Failed to delete discovery job ${id}:`, e);
      return false;
    }
  }

  public pauseJob(id: string): boolean {
    const job = this.getJob(id);
    if (!job) return false;
    job.status = 'paused';
    job.currentStage = 'paused';
    job.currentTask = 'Discovery paused by user.';
    job.currentStepText = 'Discovery paused at checkpoint.';
    this.pausedJobs.add(id);
    this.addLog(job, 'Discovery process paused by user.', 'warning');
    this.saveJob(job);
    return true;
  }

  public resumeJob(id: string): boolean {
    const job = this.getJob(id);
    if (!job || (job.status !== 'paused' && job.status !== 'stopped')) return false;
    job.status = 'queued';
    job.currentStage = 'queued';
    job.currentTask = 'Resuming job from checkpoint...';
    job.currentStepText = 'Queued to resume from last checkpoint...';
    this.pausedJobs.delete(id);
    this.stoppedJobs.delete(id);
    this.addLog(job, 'Discovery process resumed from checkpoint.', 'info');
    this.saveJob(job);
    return true;
  }

  public stopJob(id: string): boolean {
    const job = this.getJob(id);
    if (!job) return false;
    this.stoppedJobs.add(id);
    this.pausedJobs.delete(id);

    if (job.status === 'queued') {
      job.status = 'stopped';
      job.currentStage = 'stopped';
      job.currentTask = 'Stopped before execution.';
      job.currentStepText = `Discovery stopped — ${job.prospects.length} prospects saved.`;
      this.addLog(job, 'Discovery job stopped by user before execution.', 'info');
      this.saveJob(job);
      return true;
    }

    job.status = 'stopping';
    job.currentStage = 'stopping';
    job.currentTask = 'Stopping worker at current checkpoint...';
    job.currentStepText = 'Stopping worker safely at current checkpoint...';
    this.addLog(job, 'Stop signal sent. Worker will safely finish current atomic task and persist all prospects.', 'info');
    this.saveJob(job);
    return true;
  }

  public retryJob(id: string): boolean {
    const job = this.getJob(id);
    if (!job) return false;
    job.status = 'retrying';
    job.currentStage = 'retrying';
    job.workerId = null;
    job.lockedAt = null;
    job.currentTask = 'Queued for retry from last checkpoint...';
    job.currentStepText = 'Queued for retry from last checkpoint...';
    this.stoppedJobs.delete(id);
    this.pausedJobs.delete(id);
    this.addLog(job, 'Job marked for retry. Worker picking up from last checkpoint.', 'info');
    this.saveJob(job);
    return true;
  }

  /**
   * Initializes a persistent AI Prospect Discovery Job and queues it for the Cloud Worker
   */
  public async createAndStartJob(criteria: DiscoveryCriteria, userId?: string): Promise<DiscoveryJob> {
    const jobId = `DISC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const targetCount = criteria.targetCount || 25;
    const now = new Date().toISOString();

    const searchQueries = generateSearchQueries(criteria);

    const job: DiscoveryJob = {
      id: jobId,
      jobId,
      userId,
      workspaceId: userId || 'default_workspace',
      searchQuery: criteria.naturalLanguagePrompt || criteria.industry || 'AI Prospect Discovery',
      created_at: now,
      createdAt: now,
      updated_at: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      lastHeartbeat: null,
      workerId: null,
      lockedAt: null,
      priority: userId === 'recurring_scheduler' ? 'low' : 'high',
      executionMode: 'cloud',
      status: 'queued',
      criteria,
      targetCount,
      discoveredCount: 0,
      processedCount: 0,
      successfulCount: 0,
      failedCount: 0,
      errorCount: 0,
      retryCount: 0,
      currentStage: 'queued',
      currentTask: 'Queued for Cloud Background Worker',
      checkpoint: {
        queryIndex: 0,
        searchResultIndex: 0,
        seenDomains: [],
        seenCompanyKeys: [],
        lastSavedAt: now,
      },
      failedTasks: [],
      queriesExecuted: 0,
      companiesDiscovered: 0,
      uniqueCompanies: 0,
      verifiedCompanies: 0,
      unverifiedCompanies: 0,
      websitesFound: 0,
      websitesProcessed: 0,
      emailsFound: 0,
      phonesFound: 0,
      peopleFound: 0,
      duplicatesRemoved: 0,
      currentStepText: `Job queued for cloud execution (${targetCount} target prospects)...`,
      prospects: [],
      sources: [],
      logs: [],
      queries: searchQueries,
    };

    this.saveJob(job);
    this.addLog(job, `Initialized persistent discovery job "${jobId}" with ${searchQueries.length} planned targeted queries. Queued for background worker.`, 'info');

    // Immediately wake up the background worker so user is not stuck waiting
    import('../worker/cloudWorker')
      .then((m) => m.globalCloudWorker.pickupNextJob())
      .catch(() => {});

    return job;
  }

  /**
   * The Full 9-Step Discovery Pipeline
   */
  private async runDiscoveryLoop(job: DiscoveryJob): Promise<void> {
    const seenDomains = new Set<string>();
    const seenCompanyNames = new Map<string, DiscoveredProspect>(); // key -> prospect
    const targetCount = Math.max(5, Math.min(job.criteria.targetCount || 25, 500));
    const excludePrev = job.criteria.excludePreviouslyDiscovered !== false && job.criteria.freshnessMode !== 'all';
    const excludeMega = job.criteria.excludeMegaCaps ?? true;
    const ledgerStats = globalDiscoveryLedger.getStats();

    this.addLog(
      job,
      `Starting discovery: Mode: ${excludePrev ? `⚡ Fresh Only (Excluding ${ledgerStats.totalSeen} past discoveries)` : 'Standard'}, Scale: ${excludeMega ? 'Startups & SMBs (Anti-Mega-Cap ON)' : 'All scales'}. Target: ${targetCount} companies.`,
      'info'
    );

    for (let i = 0; i < job.queries.length; i++) {
      if (this.stoppedJobs.has(job.id) || job.status === 'cancelled') {
        break;
      }

      while (this.pausedJobs.has(job.id) || job.status === 'paused') {
        await new Promise((r) => setTimeout(r, 500));
        if (this.stoppedJobs.has(job.id)) break;
      }

      if (job.uniqueCompanies >= targetCount) {
        this.addLog(job, `Target count reached (${job.uniqueCompanies}/${targetCount} unique companies). Finishing up.`, 'success');
        break;
      }

      const query = job.queries[i];
      job.currentStepText = `Searching web [Query ${i + 1}/${job.queries.length}]: "${query}"...`;
      job.queriesExecuted = i + 1;
      this.addLog(job, `Searching web: "${query}"`, 'info');
      this.saveJob(job);

      // Step 1: Search for relevant sources
      const searchResults = await globalDiscoveryProvider.searchWeb(query, { maxResults: 15 });
      job.companiesDiscovered += searchResults.length;

      for (const res of searchResults) {
        if (this.stoppedJobs.has(job.id)) break;
        if (job.uniqueCompanies >= targetCount) break;

        const rawUrl = res.url;
        if (!rawUrl) continue;

        const sourceDomain = extractCleanDomain(rawUrl);

        // Step 2: Classify source
        let classification: 'directory_or_article' | 'official_company_website' | 'irrelevant';
        if (res.source === 'ai_curated_discovery') {
          classification = 'official_company_website';
        } else {
          classification = classifySearchResult(rawUrl, res.title, res.snippet);

          // Extra safeguard: If title is an article/listicle title, it MUST be treated as directory/article
          if (isArticleOrListicleTitle(res.title)) {
            if (classification !== 'irrelevant') {
              classification = 'directory_or_article';
            }
          }
        }

        if (classification === 'irrelevant') {
          job.duplicatesRemoved++;
          continue;
        }

        // Track Source in job.sources
        let sourceRecord = job.sources.find((s) => s.url === rawUrl);
        if (!sourceRecord) {
          sourceRecord = {
            id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            url: rawUrl,
            domain: sourceDomain,
            title: res.title,
            sourceType: classification === 'directory_or_article' ? 'article' : 'search_result',
            companiesFound: 0,
            extractedCompanyNames: [],
            status: 'scraped',
            accessedAt: new Date().toISOString(),
          };
          job.sources.push(sourceRecord);
        }

        // Branch A: Directory / Listicle / Article Page
        if (classification === 'directory_or_article') {
          job.currentStepText = `Analyzing directory/article source: "${res.title.slice(0, 45)}..."`;
          this.saveJob(job);
          this.addLog(job, `Extracting companies from listicle/directory: "${res.title}"`, 'info');

          // Step 3 & 4: Open page & extract individual companies
          const extractedCompanies = await extractCompaniesFromDirectory(rawUrl, res.title);

          if (extractedCompanies.length === 0) {
            sourceRecord.status = 'failed';
          }

          for (const item of extractedCompanies) {
            if (this.stoppedJobs.has(job.id)) break;
            if (job.uniqueCompanies >= targetCount) break;

            const cleanName = cleanCompanyName(item.name);
            if (isInvalidCompanyName(cleanName, sourceDomain)) {
              job.duplicatesRemoved++;
              continue;
            }

            // Scale Filter: Exclude mega-cap household monopolies
            if (excludeMega && isMegaCapCompany(cleanName, item.website)) {
              job.duplicatesRemoved++;
              continue;
            }

            // Freshness Filter: Exclude companies previously discovered across any past job
            if (excludePrev && globalDiscoveryLedger.isCompanySeen(cleanName)) {
              job.duplicatesRemoved++;
              continue;
            }

            const nameKey = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!nameKey || nameKey.length < 2) continue;

            // Track into source record
            if (!sourceRecord.extractedCompanyNames.includes(cleanName)) {
              sourceRecord.extractedCompanyNames.push(cleanName);
              sourceRecord.companiesFound++;
            }

            // Deduplication: Check if already processed in this current job run
            if (seenCompanyNames.has(nameKey)) {
              const existing = seenCompanyNames.get(nameKey);
              if (existing) {
                if (!existing.sourceUrls?.includes(rawUrl)) {
                  existing.sourceUrls = existing.sourceUrls || [existing.sourceUrl];
                  existing.sourceUrls.push(rawUrl);
                }
              }
              job.duplicatesRemoved++;
              continue;
            }

            // Step 5 & 6: Search & verify company official website
            job.currentStepText = `Verifying official website for: "${cleanName}"...`;
            this.saveJob(job);

            const verification = await verifyCompanyOfficialWebsite(
              cleanName,
              item.website,
              job.criteria.industry,
              job.criteria.country,
              sourceDomain
            );

            // Reject non-companies
            if (verification.verificationStatus === 'Rejected: not a company') {
              job.duplicatesRemoved++;
              continue;
            }

            // Deduplicate by domain if verified
            if (verification.domain) {
              if (excludeMega && isMegaCapCompany(cleanName, verification.domain)) {
                job.duplicatesRemoved++;
                continue;
              }
              if (excludePrev && globalDiscoveryLedger.isDomainSeen(verification.domain)) {
                job.duplicatesRemoved++;
                continue;
              }
              if (seenDomains.has(verification.domain)) {
                job.duplicatesRemoved++;
                continue;
              }
              seenDomains.add(verification.domain);
              job.websitesFound++;
            }

            // Extract recent business activity evidence
            const activities = extractActivitiesFromSearchResults(cleanName, [{ title: res.title, snippet: res.snippet, url: rawUrl }]);
            if (activities.length === 0 && verification.verificationStatus === 'Verified company') {
              try {
                const actRes = await globalDiscoveryProvider.searchWeb(`"${cleanName}" announcement OR hiring OR expansion OR partnership OR news`, { maxResults: 3 });
                const extraActs = extractActivitiesFromSearchResults(cleanName, actRes);
                activities.push(...extraActs);
              } catch {}
            }

            // Step 7: Build company prospect with activity evidence (Workflow A, no crawler)
            const candidateProspect = await enrichCandidateProspect(
              {
                companyName: cleanName,
                website: verification.officialWebsite, // strictly empty if unverified
                domain: verification.domain, // strictly empty if unverified
                industry: item.industry || job.criteria.industry,
                description: item.description,
                sourceUrl: rawUrl,
                sourceTitle: res.title,
                sourceType: 'directory',
                sourceUrls: [rawUrl],
                verificationStatus: verification.verificationStatus,
                verificationEvidence: verification.evidence,
                confidence: verification.confidence,
                recentActivity: activities,
              },
              job.criteria,
              job.userId
            );

            // Extract structured buying signals and compute condition explanation
            const signals = extractStructuredSignals(cleanName, activities, [candidateProspect.description || '', verification.evidence || '']);
            candidateProspect.buyingSignals = signals;

            const isNew = verification.domain ? !globalDiscoveryLedger.isDomainSeen(verification.domain) : true;
            const evalResult = evaluateProspectCriteria(candidateProspect, job.criteria, isNew);
            candidateProspect.matchExplanation = evalResult;
            candidateProspect.fitScore = evalResult.matchScore;
            candidateProspect.isNewDiscovery = isNew;

            // Record into cross-job ledger
            if (verification.domain) {
              globalDiscoveryLedger.markDomainSeen(verification.domain, cleanName, job.id, 'ai_discovery');
            }

            seenCompanyNames.set(nameKey, candidateProspect);
            job.uniqueCompanies++;

            if (verification.verificationStatus === 'Verified company') {
              job.verifiedCompanies = (job.verifiedCompanies || 0) + 1;
            } else {
              job.unverifiedCompanies = (job.unverifiedCompanies || 0) + 1;
            }

            if (candidateProspect.crawlStatus === 'completed') {
              job.websitesProcessed++;
            }
            if (candidateProspect.email) {
              job.emailsFound++;
            }
            if (candidateProspect.phone) {
              job.phonesFound++;
            }
            if (candidateProspect.personName) {
              job.peopleFound++;
            }

            job.prospects.push(candidateProspect);
            this.saveJob(job);

            await new Promise((r) => setTimeout(r, 250));
          }
        }

        // Branch B: Direct Official Company Website Candidate
        else if (classification === 'official_company_website') {
          const domain = extractCleanDomain(rawUrl);
          if (!domain || seenDomains.has(domain)) {
            job.duplicatesRemoved++;
            continue;
          }

          // Scale & Historical Filters
          if (excludeMega && isMegaCapCompany('', domain)) {
            job.duplicatesRemoved++;
            continue;
          }
          if (excludePrev && globalDiscoveryLedger.isDomainSeen(domain)) {
            job.duplicatesRemoved++;
            continue;
          }

          const rawCompanyName = cleanCompanyName(res.title, domain);

          // Validation: Check if this name is an article headline or generic phrase
          if (isInvalidCompanyName(rawCompanyName, domain)) {
            job.duplicatesRemoved++;
            continue;
          }

          if (excludeMega && isMegaCapCompany(rawCompanyName, domain)) {
            job.duplicatesRemoved++;
            continue;
          }
          if (excludePrev && globalDiscoveryLedger.isCompanySeen(rawCompanyName)) {
            job.duplicatesRemoved++;
            continue;
          }

          const nameKey = rawCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!nameKey || seenCompanyNames.has(nameKey)) {
            job.duplicatesRemoved++;
            continue;
          }

          // Step 5 & 6: Verify domain ownership
          const verification = await verifyCompanyOfficialWebsite(
            rawCompanyName,
            rawUrl,
            job.criteria.industry,
            job.criteria.country,
            undefined
          );

          // Strict requirement: A direct search result MUST be verified as an actual company
          if (verification.verificationStatus !== 'Verified company') {
            job.duplicatesRemoved++;
            continue;
          }

          if (excludeMega && isMegaCapCompany(rawCompanyName, verification.domain || domain)) {
            job.duplicatesRemoved++;
            continue;
          }
          if (excludePrev && globalDiscoveryLedger.isDomainSeen(verification.domain || domain)) {
            job.duplicatesRemoved++;
            continue;
          }

          seenDomains.add(domain);
          job.websitesFound++;

          // Track into source record
          if (!sourceRecord.extractedCompanyNames.includes(rawCompanyName)) {
            sourceRecord.extractedCompanyNames.push(rawCompanyName);
            sourceRecord.companiesFound++;
          }

          job.currentStepText = `Analyzing verified company website: ${rawCompanyName} (${domain})...`;
          this.saveJob(job);

          // Extract recent business activity evidence
          const activities = extractActivitiesFromSearchResults(rawCompanyName, [{ title: res.title, snippet: res.snippet, url: rawUrl }]);
          if (activities.length === 0) {
            try {
              const actRes = await globalDiscoveryProvider.searchWeb(`"${rawCompanyName}" announcement OR hiring OR expansion OR partnership OR news`, { maxResults: 3 });
              const extraActs = extractActivitiesFromSearchResults(rawCompanyName, actRes);
              activities.push(...extraActs);
            } catch {}
          }

          // Step 7: Build company prospect with activity evidence (Workflow A, no crawler)
          const prospect = await enrichCandidateProspect(
            {
              companyName: rawCompanyName,
              website: verification.officialWebsite || `https://${domain}`,
              domain: verification.domain || domain,
              city: res.city,
              state: res.state,
              country: res.country || job.criteria.country,
              location: res.city && res.state ? `${res.city}, ${res.state}` : (res.city || res.country),
              foundedYear: res.foundedYear,
              employeeCount: res.employeeCount,
              personName: res.personName,
              jobTitle: res.jobTitle,
              decisionMakerEmail: res.decisionMakerEmail,
              email: res.decisionMakerEmail,
              industry: job.criteria.industry,
              description: res.snippet,
              sourceUrl: rawUrl,
              sourceTitle: res.title,
              sourceType: 'direct_website',
              sourceUrls: [rawUrl],
              verificationStatus: 'Verified company',
              verificationEvidence: verification.evidence,
              confidence: verification.confidence,
              recentActivity: activities,
            },
            job.criteria,
            job.userId
          );

          // Extract structured signals and evaluate criteria fit
          const signals = extractStructuredSignals(rawCompanyName, activities, [prospect.description || '', verification.evidence || '']);
          prospect.buyingSignals = signals;

          const isNew = !globalDiscoveryLedger.isDomainSeen(prospect.domain);
          const evalResult = evaluateProspectCriteria(prospect, job.criteria, isNew);
          prospect.matchExplanation = evalResult;
          prospect.fitScore = evalResult.matchScore;
          prospect.isNewDiscovery = isNew;

          // Register in cross-job ledger
          if (prospect.domain) {
            globalDiscoveryLedger.markDomainSeen(prospect.domain, rawCompanyName, job.id, 'ai_discovery');
          }

          seenCompanyNames.set(nameKey, prospect);
          job.uniqueCompanies++;
          job.verifiedCompanies = (job.verifiedCompanies || 0) + 1;

          if (prospect.crawlStatus === 'completed') {
            job.websitesProcessed++;
          }
          if (prospect.email) {
            job.emailsFound++;
          }
          if (prospect.phone) {
            job.phonesFound++;
          }
          if (prospect.personName) {
            job.peopleFound++;
          }

          job.prospects.push(prospect);
          this.saveJob(job);

          await new Promise((r) => setTimeout(r, 300));
        }
      }

      this.saveJob(job);
    }

    if (this.stoppedJobs.has(job.id) || job.status === 'stopping' || job.status === 'stopped' || job.status === 'cancelled') {
      job.status = 'stopped';
      job.currentStage = 'stopped';
      job.currentTask = 'Stopped by user';
      job.currentStepText = `Discovery stopped — ${job.prospects.length} prospects saved`;
      this.addLog(
        job,
        `Discovery stopped by user — ${job.prospects.length} prospects safely preserved in database.`,
        'warning'
      );
      this.saveJob(job);
      return;
    }

    job.status = 'completed';
    const verifiedCount = job.prospects.filter((p) => p.verificationStatus === 'Verified company').length;
    const unverifiedCount = job.prospects.length - verifiedCount;
    job.verifiedCompanies = verifiedCount;
    job.unverifiedCompanies = unverifiedCount;

    job.currentStepText = `Completed! Discovered ${job.uniqueCompanies} individual companies (${verifiedCount} verified official domains, ${unverifiedCount} unverified) with ${job.emailsFound} emails.`;
    this.addLog(
      job,
      `Discovery completed: ${job.uniqueCompanies} individual companies discovered (${verifiedCount} verified official websites), ${job.emailsFound} direct emails found.`,
      'success'
    );
    this.saveJob(job);
  }

  /**
   * Re-verifies a specific company prospect's official website
   */
  public async verifySingleProspect(jobId: string, prospectId: string): Promise<DiscoveredProspect | null> {
    const job = this.getJob(jobId);
    if (!job) return null;

    const prospect = job.prospects.find((p) => p.id === prospectId);
    if (!prospect) return null;

    const verification = await verifyCompanyOfficialWebsite(
      prospect.companyName,
      prospect.website || undefined,
      prospect.industry,
      prospect.country
    );

    prospect.verificationStatus = verification.verificationStatus;
    prospect.verificationEvidence = verification.evidence;
    prospect.confidence = verification.confidence;

    if (verification.verificationStatus === 'Verified company' && verification.officialWebsite) {
      prospect.website = verification.officialWebsite;
      prospect.domain = verification.domain;

      // Enrich contacts if not crawled yet
      if (job.criteria.autoExtractContacts && prospect.crawlStatus !== 'completed') {
        const enriched = await enrichCandidateProspect(
          {
            ...prospect,
            verificationStatus: 'Verified company',
            verificationEvidence: verification.evidence,
          },
          job.criteria
        );
        Object.assign(prospect, enriched);
      }
    }

    job.verifiedCompanies = job.prospects.filter((p) => p.verificationStatus === 'Verified company').length;
    job.unverifiedCompanies = job.prospects.length - job.verifiedCompanies;
    this.saveJob(job);
    return prospect;
  }

  /**
   * Updates an existing discovered company prospect record
   */
  public updateProspect(
    jobId: string,
    prospectId: string,
    updates: Partial<DiscoveredProspect>
  ): DiscoveredProspect | null {
    const job = this.getJob(jobId);
    if (!job) return null;

    const prospect = job.prospects.find((p) => p.id === prospectId);
    if (!prospect) return null;

    if (updates.companyName) prospect.companyName = cleanCompanyName(updates.companyName);
    if (updates.website !== undefined) {
      prospect.website = updates.website;
      prospect.domain = extractCleanDomain(updates.website);
    }
    if (updates.industry !== undefined) prospect.industry = updates.industry;
    if (updates.description !== undefined) prospect.description = updates.description;
    if (updates.location !== undefined) prospect.location = updates.location;
    if (updates.country !== undefined) prospect.country = updates.country;
    if (updates.verificationStatus !== undefined) prospect.verificationStatus = updates.verificationStatus;

    job.verifiedCompanies = job.prospects.filter((p) => p.verificationStatus === 'Verified company').length;
    job.unverifiedCompanies = job.prospects.length - job.verifiedCompanies;
    this.saveJob(job);
    return prospect;
  }

  /**
   * One-way handoff: Triggers website scraper on a confirmed official company website
   * via JobCoordinator, updates shared company record and prospect without launching another discovery
   */
  public async crawlSingleProspect(jobId: string, prospectId: string): Promise<DiscoveredProspect | null> {
    const job = this.getJob(jobId);
    if (!job) return null;

    const prospect = job.prospects.find((p) => p.id === prospectId);
    if (!prospect || !prospect.website) return null;

    prospect.enrichmentStatus = 'running';
    prospect.crawlStatus = 'crawling';
    this.saveJob(job);

    const updatedCompany = await globalJobCoordinator.enqueueWebsiteScraperJob(
      prospect.domain,
      prospect.website,
      job.userId,
      Math.min(job.criteria.maxPagesPerCompany || 3, 5)
    );

    if (updatedCompany) {
      prospect.crawlStatus = 'completed';
      prospect.enrichmentStatus = 'completed';
      prospect.lastEnrichmentDate = updatedCompany.last_enrichment_date;
      prospect.employeeCount = updatedCompany.employee_count || prospect.employeeCount;

      if (updatedCompany.contacts && updatedCompany.contacts.length > 0) {
        prospect.rawContacts = updatedCompany.contacts;
        const primeContact =
          updatedCompany.contacts.find((c) => c.is_decision_maker && c.email) ||
          updatedCompany.contacts.find((c) => c.email && c.email_type !== 'Generic Business Email') ||
          updatedCompany.contacts.find((c) => c.email) ||
          updatedCompany.contacts[0];

        if (primeContact) {
          prospect.personName =
            primeContact.full_name || `${primeContact.first_name || ''} ${primeContact.last_name || ''}`.trim();
          prospect.jobTitle = primeContact.role || '';
          prospect.email = primeContact.email || '';
          prospect.emailType = primeContact.email_type;
          prospect.phone = primeContact.phone || '';
          prospect.linkedinUrl = primeContact.linkedin_url || primeContact.social_profiles?.linkedin;
          prospect.extractedPageUrl = primeContact.source_url || prospect.website;
        }
      } else if (updatedCompany.generic_emails && updatedCompany.generic_emails.length > 0) {
        prospect.email = updatedCompany.generic_emails[0];
        prospect.emailType = 'Generic Business Email';
      }
    } else {
      prospect.enrichmentStatus = 'failed';
      prospect.crawlStatus = 'failed';
    }

    job.websitesProcessed = job.prospects.filter((p) => p.crawlStatus === 'completed').length;
    job.emailsFound = job.prospects.filter((p) => Boolean(p.email)).length;
    job.phonesFound = job.prospects.filter((p) => Boolean(p.phone)).length;
    job.peopleFound = job.prospects.filter((p) => Boolean(p.personName)).length;

    this.saveJob(job);
    return prospect;
  }

  /**
   * One-way handoff: Enqueue enrichment for multiple eligible companies
   */
  public async enqueueEnrichmentBatch(
    jobId: string,
    prospectIds?: string[]
  ): Promise<{ enqueuedCount: number; job: DiscoveryJob | null }> {
    const job = this.getJob(jobId);
    if (!job) return { enqueuedCount: 0, job: null };

    const targetIds = prospectIds && prospectIds.length > 0 ? new Set(prospectIds) : null;
    const eligibleProspects = job.prospects.filter((p) => {
      if (targetIds && !targetIds.has(p.id)) return false;
      return (
        p.verificationStatus === 'Verified company' &&
        Boolean(p.website || p.domain) &&
        p.enrichmentStatus !== 'completed' &&
        !globalJobCoordinator.isEnrichmentActive(p.domain)
      );
    });

    for (const p of eligibleProspects) {
      p.enrichmentStatus = 'queued';
      // Kick off asynchronously through coordinator
      globalJobCoordinator
        .enqueueWebsiteScraperJob(p.domain, p.website, job.userId)
        .then((updated) => {
          if (updated) {
            p.enrichmentStatus = 'completed';
            p.crawlStatus = 'completed';
            p.lastEnrichmentDate = updated.last_enrichment_date;
            p.employeeCount = updated.employee_count || p.employeeCount;
            if (updated.contacts && updated.contacts.length > 0) {
              p.rawContacts = updated.contacts;
              const prime = updated.contacts.find((c) => c.email) || updated.contacts[0];
              if (prime) {
                p.personName = prime.full_name;
                p.jobTitle = prime.role;
                p.email = prime.email;
                p.phone = prime.phone;
              }
            }
            this.saveJob(job);
          }
        })
        .catch(() => {});
    }

    this.saveJob(job);
    return { enqueuedCount: eligibleProspects.length, job };
  }

  private addLog(job: DiscoveryJob, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const now = new Date();
    const timeStr = `[${now.toTimeString().split(' ')[0]}]`;
    const logItem: ActivityLog = {
      id: `disc_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      message,
      type,
    };
    job.logs.unshift(logItem);
    if (job.logs.length > 200) {
      job.logs.pop();
    }
  }
}

export const globalDiscoveryEngine = new DiscoveryEngine();
