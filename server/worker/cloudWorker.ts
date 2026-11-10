import fs from 'fs';
import path from 'path';
import {
  DiscoveryJob,
  DiscoveredProspect,
  DiscoverySource,
  JobCheckpoint,
  FailedTaskItem,
  WorkerHealthInfo,
} from '../discovery/types';
import { generateSearchQueries } from '../discovery/queryGenerator';
import { globalDiscoveryProvider } from '../discovery/provider';
import {
  extractCleanDomain,
  cleanCompanyName,
  isInvalidCompanyName,
  isArticleOrListicleTitle,
} from '../discovery/domainDetector';
import { classifySearchResult } from '../discovery/sourceClassifier';
import { extractCompaniesFromDirectory } from '../discovery/directoryExtractor';
import { verifyCompanyOfficialWebsite } from '../discovery/websiteVerifier';
import { enrichCandidateProspect } from '../discovery/prospectEnricher';
import { extractActivitiesFromSearchResults } from '../discovery/activityDetector';
import { globalDiscoveryLedger } from '../discovery/ledger';
import { isMegaCapCompany, evaluateProspectCriteria, extractStructuredSignals } from '../discovery/signalEngine';
import { ActivityLog } from '../../src/types';
import { globalNvidiaClient } from '../services/nvidia/nvidiaClient';
import { getActiveNvidiaModel } from '../services/nvidia/nvidiaModels';
import { globalAiResilience } from '../services/aiResilience';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOBS_DIR = path.join(DATA_DIR, 'discovery_jobs');
const WORKER_DIR = path.join(DATA_DIR, 'worker');

export class CloudWorkerEngine {
  public readonly workerId: string;
  public readonly concurrency: number;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private activeJobs: Set<string> = new Set();
  private startedAt: number = Date.now();
  private failedTasksCount = 0;
  private completedJobsCount = 0;
  private remoteHeartbeat: WorkerHealthInfo | null = null;

  constructor(workerId?: string, concurrency?: number) {
    this.workerId =
      workerId ||
      process.env.FIREBASE_WORKER_ID ||
      process.env.CLOUD_WORKER_ID ||
      process.env.WORKER_ID ||
      `firebase-worker-${process.pid || '01'}`;
    this.concurrency =
      concurrency || parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
    this.ensureDirs();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });
      if (!fs.existsSync(WORKER_DIR)) fs.mkdirSync(WORKER_DIR, { recursive: true });
    } catch (e: any) {
      console.warn('[CloudWorker] Error ensuring directories:', e.message);
    }
  }

  /**
   * Start worker background processing loop and heartbeat ticker
   */
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startedAt = Date.now();
    this.ensureDirs();
    console.log(`[CloudWorker] 🚀 Firebase / Cloud Background Worker "${this.workerId}" started (Concurrency: ${this.concurrency}).`);

    // Immediate initial heartbeat
    this.writeHeartbeat();

    // Heartbeat every 5 seconds
    this.heartbeatTimer = setInterval(() => {
      this.writeHeartbeat();
      this.checkStaleJobs();
    }, 5000);

    // Queue polling every 2.5 seconds
    const pollInterval = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2500', 10);
    this.pollTimer = setInterval(() => {
      this.pollAndProcessNextJob().catch((err) => {
        console.error('[CloudWorker] Queue poll error:', err.message);
      });
    }, pollInterval);

    // Run first poll right away
    this.pollAndProcessNextJob().catch(() => {});
  }

  /**
   * Graceful stop
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Write final offline heartbeat
    try {
      const hbFile = path.join(WORKER_DIR, `heartbeat_${this.workerId}.json`);
      if (fs.existsSync(hbFile)) {
        const data = JSON.parse(fs.readFileSync(hbFile, 'utf-8'));
        data.status = 'offline';
        data.lastHeartbeat = new Date().toISOString();
        fs.writeFileSync(hbFile, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch {}

    console.log(`[CloudWorker] 🛑 Worker "${this.workerId}" stopped gracefully.`);
  }

  /**
   * Update heartbeat file on disk for health checks
   */
  private writeHeartbeat() {
    try {
      this.ensureDirs();
      const hbFile = path.join(WORKER_DIR, `heartbeat_${this.workerId}.json`);
      const now = new Date().toISOString();
      const currentActiveId = this.activeJobs.size > 0 ? Array.from(this.activeJobs)[0] : null;

      const health: WorkerHealthInfo = {
        status: 'online',
        workerId: this.workerId,
        lastHeartbeat: now,
        secondsSinceHeartbeat: 0,
        activeJobs: this.activeJobs.size,
        queuedJobs: this.getQueuedJobCount(),
        completedJobs: this.completedJobsCount,
        failedTasks: this.failedTasksCount,
        concurrency: this.concurrency,
        uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
        executionMode: process.env.CLOUD_VM_HOST ? 'oracle_cloud_vm' : 'oracle_cloud_worker',
        provider: 'Oracle Cloud (Always Free)',
        aiProvider: 'Oracle Cloud Always Free VM',
        aiModel: 'Oracle Cloud Scraping Engine',
        currentJobId: currentActiveId,
        startedAt: new Date(this.startedAt).toISOString(),
        version: '1.0.0',
      };
      fs.writeFileSync(hbFile, JSON.stringify(health, null, 2), 'utf-8');

      // If running on a remote VM, notify the central application server
      if (process.env.APP_API_URL) {
        const remoteUrl = `${process.env.APP_API_URL.replace(/\/$/, '')}/api/discovery/worker/heartbeat`;
        fetch(remoteUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(health),
        }).catch(() => {});
      }

      // Also touch heartbeat and extend lease on all active jobs currently locked by this worker
      for (const jobId of this.activeJobs) {
        const job = this.readJob(jobId);
        if (job && job.workerId === this.workerId && job.status === 'running') {
          job.lastHeartbeat = now;
          job.leaseUntil = new Date(Date.now() + 60000).toISOString();
          job.updated_at = now;
          job.updatedAt = now;
          this.writeJob(job);
        }
      }
    } catch (e: any) {
      console.warn('[CloudWorker] Failed to write heartbeat:', e.message);
    }
  }

  /**
   * Register heartbeat reported by an external Google Cloud / Firebase VM worker
   */
  public registerRemoteHeartbeat(health: WorkerHealthInfo) {
    this.remoteHeartbeat = health;
  }

  /**
   * Get health status from local or disk heartbeat
   */
  public getHealth(): WorkerHealthInfo {
    // If a remote VM worker reported a heartbeat within the last 45 seconds, return its status
    if (this.remoteHeartbeat) {
      const diffMs = Date.now() - new Date(this.remoteHeartbeat.lastHeartbeat).getTime();
      if (diffMs < 45000) {
        return {
          ...this.remoteHeartbeat,
          secondsSinceHeartbeat: Math.floor(diffMs / 1000),
          status: 'online',
        };
      }
    }

    try {
      const hbFile = path.join(WORKER_DIR, `heartbeat_${this.workerId}.json`);
      if (fs.existsSync(hbFile)) {
        const data: WorkerHealthInfo = JSON.parse(fs.readFileSync(hbFile, 'utf-8'));
        const diffMs = Date.now() - new Date(data.lastHeartbeat).getTime();
        data.secondsSinceHeartbeat = Math.floor(diffMs / 1000);
        data.status = diffMs < 35000 ? 'online' : 'offline';
        data.activeJobs = this.activeJobs.size;
        data.queuedJobs = this.getQueuedJobCount();
        data.provider = 'Oracle Cloud (Always Free)';
        data.aiProvider = 'Oracle Cloud Always Free VM';
        data.aiModel = 'Oracle Cloud Scraping Engine';
        return data;
      }
    } catch {}

    const now = new Date().toISOString();
    return {
      status: this.isRunning ? 'online' : 'offline',
      workerId: this.workerId,
      lastHeartbeat: now,
      secondsSinceHeartbeat: 0,
      activeJobs: this.activeJobs.size,
      queuedJobs: this.getQueuedJobCount(),
      completedJobs: this.completedJobsCount,
      failedTasks: this.failedTasksCount,
      concurrency: this.concurrency,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      executionMode: process.env.CLOUD_VM_HOST ? 'oracle_cloud_vm' : 'oracle_cloud_worker',
      provider: 'Oracle Cloud (Always Free)',
      aiProvider: 'Oracle Cloud Always Free VM',
      aiModel: 'Oracle Cloud Scraping Engine',
      currentJobId: this.activeJobs.size > 0 ? Array.from(this.activeJobs)[0] : null,
      startedAt: new Date(this.startedAt).toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Check for stale/dead locks or expired leases
   */
  private checkStaleJobs() {
    try {
      if (!fs.existsSync(JOBS_DIR)) return;
      const files = fs.readdirSync(JOBS_DIR);
      const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes without heartbeat
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const filePath = path.join(JOBS_DIR, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const job: DiscoveryJob = JSON.parse(raw);

          if (
            (job.status === 'running' || job.status === 'starting') &&
            job.workerId &&
            !this.activeJobs.has(job.id)
          ) {
            const isLeaseExpired = job.leaseUntil ? new Date(job.leaseUntil).getTime() < now : false;
            const lastActive = new Date(job.lastHeartbeat || job.updated_at || job.created_at).getTime();
            const isHeartbeatExpired = now - lastActive > STALE_THRESHOLD_MS;

            if (isLeaseExpired || isHeartbeatExpired) {
              console.warn(
                `[CloudWorker] Stale/expired lease detected for job ${job.id} (Worker: ${job.workerId}). Releasing lock and queueing for retry.`
              );
              job.status = 'retrying';
              job.workerId = null;
              job.lockedAt = null;
              job.leaseUntil = null;
              job.retryCount = (job.retryCount || 0) + 1;
              job.currentStepText = 'Recovered expired lease from dead worker. Resuming from checkpoint...';
              this.addLog(
                job,
                `Worker ${job.workerId} lease expired. Job recovered automatically to resume from checkpoint.`,
                'warning'
              );
              this.writeJob(job);
            }
          }
        } catch {}
      }
    } catch (e: any) {
      console.warn('[CloudWorker] Error in stale job check:', e.message);
    }
  }

  private getQueuedJobCount(): number {
    try {
      if (!fs.existsSync(JOBS_DIR)) return 0;
      let count = 0;
      const files = fs.readdirSync(JOBS_DIR);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(JOBS_DIR, file), 'utf-8');
          const j = JSON.parse(raw);
          if (j.status === 'queued' || j.status === 'retrying') count++;
        } catch {}
      }
      return count;
    } catch {
      return 0;
    }
  }

  private readJob(id: string): DiscoveryJob | null {
    try {
      const file = path.join(JOBS_DIR, `${id}.json`);
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
      }
    } catch {}
    return null;
  }

  public writeJob(job: DiscoveryJob): void {
    try {
      this.ensureDirs();
      const file = path.join(JOBS_DIR, `${job.id}.json`);
      fs.writeFileSync(file, JSON.stringify(job, null, 2), 'utf-8');

      // If running on a remote VM, sync updates back to the central server
      if (process.env.APP_API_URL) {
        const syncUrl = `${process.env.APP_API_URL.replace(/\/$/, '')}/api/discovery/job/${job.id}/sync`;
        fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job }),
        }).catch(() => {});
      }
    } catch (e: any) {
      console.warn(`[CloudWorker] Failed to write job ${job.id}:`, e.message);
    }
  }

  /**
   * Immediately trigger pickup of next queued job (e.g. on new manual user job)
   */
  public async pickupNextJob(): Promise<void> {
    await this.pollAndProcessNextJob();
  }

  /**
   * Find next queued or retrying job and claim it atomically
   */
  private async pollAndProcessNextJob(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const candidates: DiscoveryJob[] = [];

      // 1. Check local jobs directory
      if (fs.existsSync(JOBS_DIR)) {
        const files = fs.readdirSync(JOBS_DIR);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const raw = fs.readFileSync(path.join(JOBS_DIR, file), 'utf-8');
            const j: DiscoveryJob = JSON.parse(raw);
            if (
              j.status === 'queued' ||
              j.status === 'retrying' ||
              (j.status === 'running' && !this.activeJobs.has(j.id))
            ) {
              candidates.push(j);
            }
          } catch {}
        }
      }

      // 2. If running on a remote VM, poll remote jobs from APP_API_URL
      if (process.env.APP_API_URL) {
        try {
          const remoteUrl = `${process.env.APP_API_URL.replace(/\/$/, '')}/api/discovery/jobs`;
          const res = await fetch(remoteUrl);
          if (res.ok) {
            const data = await res.json();
            const remoteJobs: DiscoveryJob[] = data.jobs || [];
            for (const rj of remoteJobs) {
              if (
                (rj.status === 'queued' || rj.status === 'retrying' || (rj.status === 'running' && !this.activeJobs.has(rj.id))) &&
                !candidates.some((c) => c.id === rj.id)
              ) {
                this.writeJob(rj);
                candidates.push(rj);
              }
            }
          }
        } catch (e: any) {
          // Non-blocking remote fetch notice
        }
      }

      if (candidates.length === 0) return;

      // Sort: User interactive jobs ALWAYS first, then priority, then oldest
      candidates.sort((a, b) => {
        const isUserA = a.userId && a.userId !== 'recurring_scheduler';
        const isUserB = b.userId && b.userId !== 'recurring_scheduler';
        if (isUserA && !isUserB) return -1;
        if (!isUserA && isUserB) return 1;

        const priorityScore = (p?: string) => (p === 'high' ? 3 : p === 'normal' ? 2 : 1);
        const scoreDiff = priorityScore(b.priority) - priorityScore(a.priority);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const targetJob = candidates[0];
      const isTargetUserJob = targetJob.userId && targetJob.userId !== 'recurring_scheduler';

      // Concurrency check: Allow user interactive jobs to burst up to concurrency + 2
      const maxAllowed = isTargetUserJob ? this.concurrency + 2 : this.concurrency;
      if (this.activeJobs.size >= maxAllowed) return;

      // Start the job
      await this.startJob(targetJob.id);
    } catch (e: any) {
      console.warn('[CloudWorker] Error picking up queued job:', e.message);
    }
  }

  /**
   * Directly start executing a job by ID
   */
  public async startJob(jobId: string): Promise<boolean> {
    if (this.activeJobs.has(jobId)) {
      return true;
    }

    const job = this.readJob(jobId);
    if (!job) return false;

    // Check if stopped or finished
    if (job.status === 'completed' || job.status === 'stopped' || job.status === 'cancelled') {
      return false;
    }

    // Claim job atomically
    const claimed = this.claimJob(jobId);
    if (claimed) {
      this.activeJobs.add(claimed.id);
      this.writeHeartbeat();

      // Process in background without blocking caller
      this.executeJob(claimed)
        .catch((err) => {
          console.error(`[CloudWorker] Job ${claimed.id} execution failed:`, err);
        })
        .finally(() => {
          this.activeJobs.delete(claimed.id);
          this.writeHeartbeat();
        });
      return true;
    }
    return false;
  }

  /**
   * Check if job is currently active in memory
   */
  public isJobActive(jobId: string): boolean {
    return this.activeJobs.has(jobId);
  }

  /**
   * Atomically lock/claim a job with lease expiration
   */
  public claimJob(jobId: string, customWorkerId?: string): DiscoveryJob | null {
    const job = this.readJob(jobId);
    if (!job) return null;

    const claimingWorkerId = customWorkerId || this.workerId;
    const now = Date.now();
    const isQueued = job.status === 'queued' || job.status === 'retrying';
    const isLeaseExpired =
      (job.status === 'running' || job.status === 'starting') &&
      job.leaseUntil &&
      new Date(job.leaseUntil).getTime() < now &&
      job.workerId !== claimingWorkerId;

    if (!isQueued && !isLeaseExpired) return null;

    const nowIso = new Date(now).toISOString();
    const leaseIso = new Date(now + 60000).toISOString();

    // Step 1: Transition to 'starting' with lease
    job.status = 'starting';
    job.workerId = claimingWorkerId;
    job.lockedAt = nowIso;
    job.leaseUntil = leaseIso;
    job.lastHeartbeat = nowIso;
    job.aiProvider = 'NVIDIA';
    job.aiModel = getActiveNvidiaModel();
    job.executionMode = 'cloud';
    job.totalTargets = job.criteria?.targetCount || 25;
    job.processedTargets = job.prospects?.length || 0;
    job.successfulTargets = job.uniqueCompanies || 0;
    job.failedTargets = job.failedCount || 0;
    job.updated_at = nowIso;
    job.updatedAt = nowIso;
    job.currentStage = 'starting';
    job.currentTask = 'Worker claimed job lease. Starting background pipeline...';
    this.writeJob(job);

    // Step 2: Atomic confirmation - re-read from disk to guarantee this worker won the lock
    const verified = this.readJob(jobId);
    if (!verified || verified.workerId !== claimingWorkerId) {
      console.warn(`[CloudWorker] Claim race lost for job ${jobId}. Yielding.`);
      return null;
    }

    // Step 3: Transition to 'running'
    verified.status = 'running';
    verified.startedAt = verified.startedAt || nowIso;
    verified.currentStage = 'running';
    this.addLog(
      verified,
      `Job claimed atomically by Oracle Cloud worker "${claimingWorkerId}" (Execution Engine: Oracle Cloud Always Free VM).`,
      'info'
    );
    this.writeJob(verified);
    return verified;
  }

  /**
   * The Full Independent Execution Pipeline for Cloud Prospect Discovery
   */
  public async executeJob(job: DiscoveryJob): Promise<void> {
    const jobId = job.id;
    const targetCount = Math.max(5, Math.min(job.criteria?.targetCount || 25, 500));
    const excludePrev = job.criteria?.excludePreviouslyDiscovered !== false && job.criteria?.freshnessMode !== 'all';
    const excludeMega = job.criteria?.excludeMegaCaps ?? true;

    // Initialize or resume from Checkpoint
    const checkpoint: JobCheckpoint = job.checkpoint || {
      queryIndex: 0,
      searchResultIndex: 0,
      seenDomains: [],
      seenCompanyKeys: [],
      lastSavedAt: new Date().toISOString(),
    };

    const seenDomains = new Set<string>(checkpoint.seenDomains || []);
    const seenCompanyNames = new Map<string, DiscoveredProspect>();

    // Pre-populate seen company keys from already saved prospects
    if (Array.isArray(job.prospects)) {
      for (const p of job.prospects) {
        if (p.domain) seenDomains.add(p.domain.toLowerCase());
        const key = (p.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (key) seenCompanyNames.set(key, p);
      }
    }

    if (checkpoint.seenCompanyKeys) {
      for (const k of checkpoint.seenCompanyKeys) {
        if (!seenCompanyNames.has(k)) {
          seenCompanyNames.set(k, {} as any);
        }
      }
    }

    // Ensure search queries are generated
    if (!job.queries || job.queries.length === 0) {
      job.queries = generateSearchQueries(job.criteria);
      this.writeJob(job);
    }

    const searchQueries = job.queries;
    const startIndex = Math.max(0, Math.min(checkpoint.queryIndex || 0, searchQueries.length));

    console.log(
      `[CloudWorker] Executing job ${jobId} (Query ${startIndex + 1}/${searchQueries.length}, Target: ${targetCount}, Current Discovered: ${job.uniqueCompanies || 0})`
    );

    this.addLog(
      job,
      startIndex > 0
        ? `Resuming background discovery from Query ${startIndex + 1}/${searchQueries.length} with ${job.uniqueCompanies || 0} existing prospects saved.`
        : `Background discovery started. Target: ${targetCount} companies. Search queries: ${searchQueries.length}.`,
      'info'
    );

    job.currentStage = 'searching';
    this.writeJob(job);

    try {
      for (let i = startIndex; i < searchQueries.length; i++) {
        // Refresh job state from disk to catch external Stop/Pause actions immediately
        const freshJob = this.readJob(jobId);
        if (!freshJob) {
          console.warn(`[CloudWorker] Job ${jobId} was deleted externally. Halting.`);
          return;
        }

        // Check if Stop requested
        if (freshJob.status === 'stopping' || freshJob.status === 'stopped' || freshJob.status === 'cancelled') {
          console.log(`[CloudWorker] Stop detected for job ${jobId}. Halting at checkpoint.`);
          this.handleStopAtCheckpoint(freshJob);
          return;
        }

        // Check if Pause requested
        if (freshJob.status === 'paused') {
          console.log(`[CloudWorker] Pause detected for job ${jobId}. Yielding.`);
          freshJob.checkpoint = {
            queryIndex: i,
            searchResultIndex: 0,
            seenDomains: Array.from(seenDomains),
            seenCompanyKeys: Array.from(seenCompanyNames.keys()),
            lastSavedAt: new Date().toISOString(),
          };
          this.writeJob(freshJob);
          return;
        }

        // Check target count reached
        if (job.uniqueCompanies >= targetCount) {
          this.addLog(job, `Target count reached (${job.uniqueCompanies}/${targetCount} unique companies). Finishing job.`, 'success');
          break;
        }

        const query = searchQueries[i];
        job.currentStage = 'searching';
        job.currentTask = `Query ${i + 1}/${searchQueries.length}: "${query}"`;
        job.currentStepText = `Searching web [Query ${i + 1}/${searchQueries.length}]: "${query}"...`;
        job.queriesExecuted = i + 1;
        job.lastHeartbeat = new Date().toISOString();
        this.addLog(job, `Searching web: "${query}"`, 'info');
        this.writeJob(job);

        // Step 1: Execute Web Search with Exponential Backoff
        const searchResults = await this.retryWithBackoff(
          () => globalDiscoveryProvider.searchWeb(query, { maxResults: 15 }),
          3,
          job
        );

        if (!searchResults || searchResults.length === 0) {
          this.addLog(job, `No results returned for query: "${query}". Moving to next.`, 'warning');
          continue;
        }

        job.companiesDiscovered = (job.companiesDiscovered || 0) + searchResults.length;
        job.discoveredCount = job.companiesDiscovered;

        // Process search results
        for (let rIdx = 0; rIdx < searchResults.length; rIdx++) {
          const res = searchResults[rIdx];

          // Check Stop / Pause between results
          const midJob = this.readJob(jobId);
          if (midJob && (midJob.status === 'stopping' || midJob.status === 'stopped' || midJob.status === 'cancelled')) {
            this.handleStopAtCheckpoint(midJob);
            return;
          }
          if (midJob && midJob.status === 'paused') {
            midJob.checkpoint = {
              queryIndex: i,
              searchResultIndex: rIdx,
              seenDomains: Array.from(seenDomains),
              seenCompanyKeys: Array.from(seenCompanyNames.keys()),
              lastSavedAt: new Date().toISOString(),
            };
            this.writeJob(midJob);
            return;
          }

          if (job.uniqueCompanies >= targetCount) break;

          const rawUrl = res.url;
          if (!rawUrl) continue;

          const sourceDomain = extractCleanDomain(rawUrl);

          // Classify source
          let classification: 'directory_or_article' | 'official_company_website' | 'irrelevant';
          if (res.source === 'ai_curated_discovery' || res.source === 'openstreetmap_directory') {
            classification = 'official_company_website';
          } else {
            classification = classifySearchResult(rawUrl, res.title, res.snippet);
            if (isArticleOrListicleTitle(res.title)) {
              if (classification !== 'irrelevant') {
                classification = 'directory_or_article';
              }
            }
          }

          if (classification === 'irrelevant') {
            job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
            continue;
          }

          // Track Source in job.sources
          if (!job.sources) job.sources = [];
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
            job.currentStage = 'extracting_sources';
            job.currentTask = `Extracting companies from listicle/directory: "${res.title.slice(0, 45)}..."`;
            job.currentStepText = `Analyzing directory/article source: "${res.title.slice(0, 45)}..."`;
            this.writeJob(job);

            let extractedCompanies: any[] = [];
            try {
              extractedCompanies = await extractCompaniesFromDirectory(rawUrl, res.title);
            } catch (err: any) {
              this.recordFailedTask(job, {
                id: `fail_${Date.now()}`,
                url: rawUrl,
                companyName: res.title,
                reason: `Directory extraction error: ${err.message}`,
                attemptCount: 1,
                timestamp: new Date().toISOString(),
              });
              sourceRecord.status = 'failed';
            }

            for (const item of extractedCompanies) {
              if (job.uniqueCompanies >= targetCount) break;

              const cleanName = cleanCompanyName(item.name);
              if (isInvalidCompanyName(cleanName, sourceDomain)) {
                job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                continue;
              }

              // Mega-cap filter
              if (excludeMega && isMegaCapCompany(cleanName, item.website)) {
                job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                continue;
              }

              // Freshness filter
              if (excludePrev && globalDiscoveryLedger.isCompanySeen(cleanName)) {
                job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                continue;
              }

              const nameKey = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!nameKey || nameKey.length < 2) continue;

              if (seenCompanyNames.has(nameKey)) {
                job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                continue;
              }

              // Step: Verify official website
              job.currentStage = 'verifying_website';
              job.currentTask = `Verifying website for ${cleanName}`;
              job.currentStepText = `Verifying official website for: "${cleanName}"...`;
              this.writeJob(job);

              let verification: any;
              try {
                verification = await verifyCompanyOfficialWebsite(
                  cleanName,
                  item.website,
                  job.criteria?.industry,
                  job.criteria?.country,
                  sourceDomain
                );
              } catch (err: any) {
                this.recordFailedTask(job, {
                  id: `fail_${Date.now()}`,
                  companyName: cleanName,
                  reason: `Website verification error: ${err.message}`,
                  attemptCount: 1,
                  timestamp: new Date().toISOString(),
                });
                continue;
              }

              if (verification.verificationStatus === 'Rejected: not a company') {
                job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                continue;
              }

              if (verification.domain) {
                if (excludeMega && isMegaCapCompany(cleanName, verification.domain)) {
                  job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                  continue;
                }
                if (excludePrev && globalDiscoveryLedger.isDomainSeen(verification.domain)) {
                  job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                  continue;
                }
                if (seenDomains.has(verification.domain)) {
                  job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                  continue;
                }
                seenDomains.add(verification.domain);
                job.websitesFound = (job.websitesFound || 0) + 1;
              }

              // Extract business activities
              const activities = extractActivitiesFromSearchResults(cleanName, [
                { title: res.title, snippet: res.snippet, url: rawUrl },
              ]);

              // Step: Enrich Candidate Prospect (AI Decision Makers & Firmographics)
              job.currentStage = 'enriching_prospect';
              job.currentTask = `Extracting decision makers & emails for ${cleanName}`;
              job.currentStepText = `Enriching prospect evidence for: "${cleanName}"...`;
              this.writeJob(job);

              const candidateProspect = await enrichCandidateProspect(
                {
                  companyName: cleanName,
                  website: verification.officialWebsite,
                  domain: verification.domain,
                  industry: item.industry || job.criteria?.industry,
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
                job.criteria || ({} as any),
                job.userId
              );

              // Extract buying signals and match score
              const signals = extractStructuredSignals(cleanName, activities, [
                candidateProspect.description || '',
                verification.evidence || '',
              ]);
              candidateProspect.buyingSignals = signals;

              const isNew = verification.domain ? !globalDiscoveryLedger.isDomainSeen(verification.domain) : true;
              const evalResult = evaluateProspectCriteria(candidateProspect, job.criteria || ({} as any), isNew);
              candidateProspect.matchExplanation = evalResult;
              candidateProspect.fitScore = evalResult.matchScore;
              candidateProspect.isNewDiscovery = isNew;

              // Register in cross-job ledger
              if (verification.domain) {
                globalDiscoveryLedger.markDomainSeen(verification.domain, cleanName, job.id, 'ai_discovery');
              }

              seenCompanyNames.set(nameKey, candidateProspect);

              // Update job progress stats
              job.uniqueCompanies = (job.uniqueCompanies || 0) + 1;
              job.processedCount = job.uniqueCompanies;
              job.successfulCount = job.uniqueCompanies;

              if (verification.verificationStatus === 'Verified company') {
                job.verifiedCompanies = (job.verifiedCompanies || 0) + 1;
              } else {
                job.unverifiedCompanies = (job.unverifiedCompanies || 0) + 1;
              }

              if (candidateProspect.crawlStatus === 'completed') {
                job.websitesProcessed = (job.websitesProcessed || 0) + 1;
              }
              if (candidateProspect.email) {
                job.emailsFound = (job.emailsFound || 0) + 1;
              }
              if (candidateProspect.phone) {
                job.phonesFound = (job.phonesFound || 0) + 1;
              }
              if (candidateProspect.personName) {
                job.peopleFound = (job.peopleFound || 0) + 1;
              }

              // Require valid domain or website
              if (!candidateProspect.domain && !candidateProspect.website) {
                job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
                continue;
              }

              // Deduplicate before pushing
              const existingIdx = job.prospects.findIndex((p) => p.domain === candidateProspect.domain);
              if (existingIdx === -1) {
                job.prospects.push(candidateProspect);
              } else {
                job.prospects[existingIdx] = { ...job.prospects[existingIdx], ...candidateProspect };
              }

              // IMMEDIATE PERSISTENT CHECKPOINT
              job.checkpoint = {
                queryIndex: i,
                searchResultIndex: rIdx,
                seenDomains: Array.from(seenDomains),
                seenCompanyKeys: Array.from(seenCompanyNames.keys()),
                lastSavedAt: new Date().toISOString(),
              };
              job.lastHeartbeat = new Date().toISOString();
              job.updated_at = new Date().toISOString();
              job.updatedAt = job.updated_at;
              this.writeJob(job);

              await new Promise((r) => setTimeout(r, 200));
            }
          }

          // Branch B: Direct Official Company Website Candidate
          else if (classification === 'official_company_website') {
            const domain = extractCleanDomain(rawUrl);
            if (!domain || seenDomains.has(domain)) {
              job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
              continue;
            }

            if (excludeMega && isMegaCapCompany('', domain)) {
              job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
              continue;
            }
            if (excludePrev && globalDiscoveryLedger.isDomainSeen(domain)) {
              job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
              continue;
            }

            const rawCompanyName = cleanCompanyName(res.title, domain);
            if (isInvalidCompanyName(rawCompanyName, domain)) {
              job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
              continue;
            }

            const nameKey = rawCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!nameKey || seenCompanyNames.has(nameKey)) {
              job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
              continue;
            }

            // Step: Verify domain
            job.currentStage = 'verifying_website';
            job.currentTask = `Verifying domain ${domain} for ${rawCompanyName}`;
            this.writeJob(job);

            let verification: any;
            try {
              verification = await verifyCompanyOfficialWebsite(
                rawCompanyName,
                rawUrl,
                job.criteria?.industry,
                job.criteria?.country,
                undefined
              );
            } catch (err: any) {
              this.recordFailedTask(job, {
                id: `fail_${Date.now()}`,
                companyName: rawCompanyName,
                url: rawUrl,
                reason: `Direct verification error: ${err.message}`,
                attemptCount: 1,
                timestamp: new Date().toISOString(),
              });
              continue;
            }

            if (verification.verificationStatus !== 'Verified company') {
              job.duplicatesRemoved = (job.duplicatesRemoved || 0) + 1;
              continue;
            }

            seenDomains.add(domain);
            job.websitesFound = (job.websitesFound || 0) + 1;

            // Extract activities
            const activities = extractActivitiesFromSearchResults(rawCompanyName, [
              { title: res.title, snippet: res.snippet, url: rawUrl },
            ]);

            // Enrich prospect
            job.currentStage = 'enriching_prospect';
            job.currentTask = `Enriching decision maker contacts for ${rawCompanyName}`;
            this.writeJob(job);

            const prospect = await enrichCandidateProspect(
              {
                companyName: rawCompanyName,
                website: verification.officialWebsite || `https://${domain}`,
                domain: verification.domain || domain,
                industry: job.criteria?.industry,
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
              job.criteria || ({} as any),
              job.userId
            );

            const signals = extractStructuredSignals(rawCompanyName, activities, [
              prospect.description || '',
              verification.evidence || '',
            ]);
            prospect.buyingSignals = signals;

            const isNew = !globalDiscoveryLedger.isDomainSeen(prospect.domain);
            const evalResult = evaluateProspectCriteria(prospect, job.criteria || ({} as any), isNew);
            prospect.matchExplanation = evalResult;
            prospect.fitScore = evalResult.matchScore;
            prospect.isNewDiscovery = isNew;

            if (prospect.domain) {
              globalDiscoveryLedger.markDomainSeen(prospect.domain, rawCompanyName, job.id, 'ai_discovery');
            }

            seenCompanyNames.set(nameKey, prospect);
            job.uniqueCompanies = (job.uniqueCompanies || 0) + 1;
            job.processedCount = job.uniqueCompanies;
            job.successfulCount = job.uniqueCompanies;
            job.verifiedCompanies = (job.verifiedCompanies || 0) + 1;

            if (prospect.crawlStatus === 'completed') {
              job.websitesProcessed = (job.websitesProcessed || 0) + 1;
            }
            if (prospect.email) {
              job.emailsFound = (job.emailsFound || 0) + 1;
            }
            if (prospect.phone) {
              job.phonesFound = (job.phonesFound || 0) + 1;
            }
            if (prospect.personName) {
              job.peopleFound = (job.peopleFound || 0) + 1;
            }

            const existingIdx = job.prospects.findIndex((p) => p.domain === prospect.domain);
            if (existingIdx === -1) {
              job.prospects.push(prospect);
            } else {
              job.prospects[existingIdx] = { ...job.prospects[existingIdx], ...prospect };
            }

            // IMMEDIATE PERSISTENT CHECKPOINT
            job.checkpoint = {
              queryIndex: i,
              searchResultIndex: rIdx,
              seenDomains: Array.from(seenDomains),
              seenCompanyKeys: Array.from(seenCompanyNames.keys()),
              lastSavedAt: new Date().toISOString(),
            };
            job.lastHeartbeat = new Date().toISOString();
            job.updated_at = new Date().toISOString();
            job.updatedAt = job.updated_at;
            this.writeJob(job);

            await new Promise((r) => setTimeout(r, 200));
          }
        }

        // Save progress after query completes
        job.checkpoint = {
          queryIndex: i + 1,
          searchResultIndex: 0,
          seenDomains: Array.from(seenDomains),
          seenCompanyKeys: Array.from(seenCompanyNames.keys()),
          lastSavedAt: new Date().toISOString(),
        };
        job.lastHeartbeat = new Date().toISOString();
        this.writeJob(job);
      }

      // Check if job wasn't cancelled or stopped
      const finalCheck = this.readJob(jobId);
      if (finalCheck && finalCheck.status !== 'stopped' && finalCheck.status !== 'cancelled') {
        finalCheck.status = 'completed';
        finalCheck.completedAt = new Date().toISOString();
        finalCheck.workerId = null;
        finalCheck.currentStage = 'completed';
        finalCheck.currentTask = 'Discovery complete.';
        finalCheck.currentStepText = `Completed! Discovered ${finalCheck.uniqueCompanies || 0} companies with ${finalCheck.emailsFound || 0} direct contacts.`;
        this.addLog(
          finalCheck,
          `Discovery job completed in cloud worker. ${finalCheck.uniqueCompanies || 0} verified companies saved.`,
          'success'
        );
        this.writeJob(finalCheck);
        this.completedJobsCount++;
        console.log(`[CloudWorker] ✅ Job ${jobId} successfully completed (${finalCheck.uniqueCompanies || 0} prospects saved).`);
      }
    } catch (err: any) {
      console.error(`[CloudWorker] Fatal error in job ${jobId}:`, err);
      const errJob = this.readJob(jobId) || job;
      const retryCount = (errJob.retryCount || 0) + 1;
      errJob.retryCount = retryCount;
      errJob.errorCount = (errJob.errorCount || 0) + 1;

      if (retryCount <= 3) {
        errJob.status = 'retrying';
        errJob.currentStepText = `Encountered transient error (${err.message}). Retrying from checkpoint (Attempt ${retryCount}/3)...`;
        this.addLog(errJob, `Transient failure: ${err.message}. Retrying from checkpoint.`, 'warning');
      } else {
        errJob.status = 'failed';
        errJob.completedAt = new Date().toISOString();
        errJob.currentStepText = `Discovery failed after 3 retries: ${err.message}`;
        this.addLog(errJob, `Discovery failed: ${err.message}`, 'error');
      }

      errJob.workerId = null;
      this.writeJob(errJob);
    }
  }

  /**
   * Safely handle Stop action at checkpoint, keeping all partial results
   */
  private handleStopAtCheckpoint(job: DiscoveryJob) {
    job.status = 'stopped';
    job.completedAt = new Date().toISOString();
    job.workerId = null;
    job.currentStage = 'stopped';
    job.currentTask = 'Stopped by user.';
    job.currentStepText = `Discovery stopped — ${job.prospects.length} prospects saved.`;
    this.addLog(job, `Discovery stopped by user. ${job.prospects.length} prospects safely saved in database.`, 'info');
    this.writeJob(job);
    console.log(`[CloudWorker] Job ${job.id} safely stopped at checkpoint (${job.prospects.length} prospects saved).`);
  }

  /**
   * Record individual failed tasks without crashing the entire job
   */
  private recordFailedTask(job: DiscoveryJob, item: FailedTaskItem) {
    if (!job.failedTasks) job.failedTasks = [];
    job.failedTasks.push(item);
    job.failedCount = (job.failedCount || 0) + 1;
    this.failedTasksCount++;
    this.addLog(job, `Task warning: ${item.reason} (${item.companyName || item.url || 'Item'})`, 'warning');
  }

  /**
   * Helper for exponential backoff on transient errors, rate limits, and timeouts
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 4,
    job?: DiscoveryJob
  ): Promise<T> {
    return await globalAiResilience.executeWithRetry<T>(
      async () => fn(),
      {
        maxRetries,
        timeoutMs: 35000,
        baseDelayMs: 3000,
        maxDelayMs: 20000,
        job,
        taskLabel: job?.currentTask || 'Discovery Query',
      }
    );
  }

  private addLog(job: DiscoveryJob, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    if (!job.logs) job.logs = [];
    const log: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      message: `[CloudWorker] ${message}`,
      type,
    };
    job.logs.unshift(log);
    if (job.logs.length > 80) job.logs.length = 80;
  }
}

export const globalCloudWorker = new CloudWorkerEngine();
