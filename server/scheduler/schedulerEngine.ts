import fs from 'fs';
import path from 'path';
import { RecurringSchedule, ScheduleRunLog, DiscoveryCriteria, GoogleSheetsColumnMapping, GoogleSheetsSyncStats, DiscoveredProspect } from '../../src/types';
import { globalDiscoveryEngine } from '../discovery/discoveryEngine';
import { globalGoogleSheetsEngine } from '../sheets/sheetsEngine';

const SCHEDULES_DIR = path.join(process.cwd(), 'data', 'recurring_schedules');
const SCHEDULES_FILE = path.join(SCHEDULES_DIR, 'schedules.json');
const RUNS_FILE = path.join(SCHEDULES_DIR, 'runs.json');

export class SchedulerEngine {
  private schedules: Map<string, RecurringSchedule> = new Map();
  private runs: ScheduleRunLog[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor() {
    this.ensureDirs();
    this.load();
    this.startLoop();
    // Immediate wake-up check: process overdue schedules within 2s of container boot/wake
    setTimeout(() => {
      this.checkAndExecutePending();
    }, 2000);
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(SCHEDULES_DIR)) {
        fs.mkdirSync(SCHEDULES_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('[Scheduler] Error creating schedules dir:', e);
    }
  }

  private load() {
    try {
      this.ensureDirs();
      if (fs.existsSync(SCHEDULES_FILE)) {
        const raw = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
        const list: RecurringSchedule[] = JSON.parse(raw);
        for (const item of list) {
          // If schedule was saved as 'running' before a crash or restart, reset it so it is never permanently locked
          if (item.lastRunStatus === 'running') {
            item.lastRunStatus = item.totalRuns > 0 ? 'success' : 'failed';
          }
          this.schedules.set(item.id, item);
        }
      } else {
        // Seed default daily schedule example for immediate convenience
        this.seedDefaultSchedule();
      }

      if (fs.existsSync(RUNS_FILE)) {
        const raw = fs.readFileSync(RUNS_FILE, 'utf-8');
        this.runs = JSON.parse(raw);
        for (const run of this.runs) {
          if (run.status === 'running') {
            const runAge = Date.now() - new Date(run.startedAt).getTime();
            if (runAge > 5 * 60 * 1000) {
              if (run.jobId) {
                const job = globalDiscoveryEngine.getJob(run.jobId);
                const count = job?.uniqueCompanies || job?.prospects?.length || 0;
                run.prospectsFound = count;
                run.status = count > 0 ? 'completed' : 'failed';
                run.completedAt = run.completedAt || new Date().toISOString();
              } else {
                run.status = 'failed';
                run.completedAt = run.completedAt || new Date().toISOString();
              }
            }
          }
        }
        this.saveRuns();
      }
    } catch (e) {
      console.warn('[Scheduler] Error loading schedules:', e);
    }
  }

  private seedDefaultSchedule() {
    const defaultSchedule: RecurringSchedule = {
      id: `sched_daily_growth_${Date.now()}`,
      name: 'Daily Growth Startups & Seed Triggers',
      cadence: 'daily',
      timeOfDayUtc: '08:00',
      targetCount: 20,
      criteria: {
        industry: 'B2B SaaS',
        country: 'United States',
        jobTitle: 'Founder, CEO, VP of Sales',
        companyScale: 'startups',
        excludeMegaCaps: true,
        buyingSignalFilter: 'any_signal',
        freshnessMode: 'new_only',
        excludePreviouslyDiscovered: true,
        targetCount: 20,
        maxPagesPerCompany: 3,
        maxQueries: 15,
        autoExtractContacts: true,
        includeGenericEmails: true,
      },
      enabled: false,
      autoEnrichWebsite: true,
      totalProspectsFound: 0,
      totalRuns: 0,
      nextRunAt: this.computeNextRun('daily', '08:00'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.schedules.set(defaultSchedule.id, defaultSchedule);
    this.saveSchedules();
  }

  private saveSchedules() {
    try {
      this.ensureDirs();
      const list = Array.from(this.schedules.values());
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Scheduler] Error saving schedules:', e);
    }
  }

  private saveRuns() {
    try {
      this.ensureDirs();
      fs.writeFileSync(RUNS_FILE, JSON.stringify(this.runs.slice(-200), null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Scheduler] Error saving runs:', e);
    }
  }

  public computeNextRun(cadence: RecurringSchedule['cadence'], timeOfDayUtc = '08:00', customHours = 24): string {
    const now = new Date();
    const next = new Date(now);

    if (cadence === 'hourly') {
      next.setHours(next.getHours() + 1);
      return next.toISOString();
    }

    if (cadence === 'every_2_hours') {
      next.setHours(next.getHours() + 2);
      return next.toISOString();
    }

    if (cadence === 'every_3_hours') {
      next.setHours(next.getHours() + 3);
      return next.toISOString();
    }

    if (cadence === 'every_4_hours') {
      next.setHours(next.getHours() + 4);
      return next.toISOString();
    }

    if (cadence === 'every_6_hours') {
      next.setHours(next.getHours() + 6);
      return next.toISOString();
    }

    if (cadence === 'every_8_hours') {
      next.setHours(next.getHours() + 8);
      return next.toISOString();
    }

    if (cadence === 'every_12_hours') {
      next.setHours(next.getHours() + 12);
      return next.toISOString();
    }

    if (cadence === 'every_2_days') {
      next.setDate(next.getDate() + 2);
      return next.toISOString();
    }

    if (cadence === 'weekly') {
      next.setDate(next.getDate() + 7);
      return next.toISOString();
    }

    if (cadence === 'custom_hours') {
      const h = Math.max(1, Math.min(customHours || 1, 720));
      next.setHours(next.getHours() + h);
      return next.toISOString();
    }

    // Default: daily at target time
    const [hours, minutes] = timeOfDayUtc.split(':').map((v) => parseInt(v, 10) || 0);
    next.setUTCHours(hours, minutes, 0, 0);

    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    return next.toISOString();
  }

  private startLoop() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    // Check every 60 seconds
    this.checkInterval = setInterval(() => {
      this.checkAndExecutePending();
    }, 60 * 1000);
  }

  private async checkAndExecutePending() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      for (const schedule of this.schedules.values()) {
        if (!schedule.enabled) continue;
        if (schedule.lastRunStatus === 'running') {
          const runAge = schedule.lastRunAt ? now - new Date(schedule.lastRunAt).getTime() : 0;
          if (runAge > 5 * 60 * 1000) {
            console.warn(`[Scheduler] Resetting orphaned running state for schedule "${schedule.name}" (${schedule.id})`);
            schedule.lastRunStatus = 'failed';
            this.saveSchedules();
          } else {
            continue;
          }
        }

        const nextTime = new Date(schedule.nextRunAt).getTime();
        if (now >= nextTime) {
          console.log(`[Scheduler] Triggering scheduled job for "${schedule.name}" (${schedule.id})`);
          // Advance nextRunAt immediately so loop doesn't re-trigger in 60s
          schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);
          this.saveSchedules();
          await this.executeSchedule(schedule);
        }
      }
    } catch (e: any) {
      console.warn('[Scheduler] Error in check loop:', e.message);
    } finally {
      this.isProcessing = false;
    }
  }

  public async executeSchedule(schedule: RecurringSchedule): Promise<ScheduleRunLog> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const runLog: ScheduleRunLog = {
      id: runId,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      startedAt: new Date().toISOString(),
      status: 'running',
      prospectsFound: 0,
    };

    this.runs.unshift(runLog);
    schedule.lastRunStatus = 'running';
    schedule.lastRunAt = runLog.startedAt;
    this.saveSchedules();
    this.saveRuns();

    try {
      // Force Freshness Mode so each run finds new prospects
      const criteria: DiscoveryCriteria = {
        ...schedule.criteria,
        targetCount: schedule.targetCount || 20,
        freshnessMode: 'new_only',
        excludePreviouslyDiscovered: true,
        excludeMegaCaps: schedule.criteria.excludeMegaCaps ?? true,
      };

      const job = await globalDiscoveryEngine.createAndStartJob(criteria, 'recurring_scheduler');
      runLog.jobId = job.id;

      // Monitor job completion in background
      this.pollJobCompletion(job.id, schedule, runLog);

      return runLog;
    } catch (err: any) {
      runLog.status = 'failed';
      runLog.error = err.message;
      runLog.completedAt = new Date().toISOString();
      schedule.lastRunStatus = 'failed';
      schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);
      this.saveSchedules();
      this.saveRuns();
      return runLog;
    }
  }

  private pollJobCompletion(jobId: string, schedule: RecurringSchedule, runLog: ScheduleRunLog) {
    const startTime = Date.now();
    const pollTimer = setInterval(() => {
      const job = globalDiscoveryEngine.getJob(jobId);
      if (!job) {
        clearInterval(pollTimer);
        schedule.lastRunStatus = 'failed';
        this.saveSchedules();
        return;
      }

      const isTimeout = Date.now() - startTime > 8 * 60 * 1000;
      const isFinished =
        job.status === 'completed' ||
        job.status === 'failed' ||
        job.status === 'cancelled' ||
        job.status === 'stopped' ||
        isTimeout ||
        (job.uniqueCompanies && job.uniqueCompanies >= (schedule.targetCount || 20));

      if (isFinished) {
        clearInterval(pollTimer);
        runLog.completedAt = new Date().toISOString();
        runLog.status = (job.uniqueCompanies || 0) > 0 ? 'completed' : (job.status === 'completed' ? 'completed' : 'failed');
        runLog.prospectsFound = job.uniqueCompanies || (job.prospects?.length || 0);

        schedule.totalRuns++;
        schedule.totalProspectsFound += runLog.prospectsFound;
        schedule.lastRunProspectsCount = runLog.prospectsFound;
        schedule.lastRunStatus = runLog.status === 'completed' ? 'success' : 'failed';
        schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);
        schedule.updatedAt = new Date().toISOString();

        this.saveSchedules();
        this.saveRuns();

        // If autoEnrichWebsite is enabled, enqueue eligible verified prospects for enrichment
        if (schedule.autoEnrichWebsite && job.status === 'completed') {
          const eligibleIds = job.prospects
            .filter((p) => p.verificationStatus === 'Verified company' && p.website)
            .map((p) => p.id);
          if (eligibleIds.length > 0) {
            globalDiscoveryEngine.enqueueEnrichmentBatch(job.id, eligibleIds).catch(() => {});
          }
        }

        // GOOGLE SHEETS AUTO-SYNC AFTER CONFIRMED DATABASE SAVE
        if (schedule.googleSheetsEnabled && schedule.googleSpreadsheetId) {
          console.log(`[Scheduler] Starting Google Sheets Auto-Sync for "${schedule.name}" -> Spreadsheet "${schedule.googleSpreadsheetName || schedule.googleSpreadsheetId}" (${job.prospects.length} prospects)`);
          globalGoogleSheetsEngine
            .syncScheduleProspectsToSheet(schedule, job.prospects)
            .then((syncStats) => {
              runLog.googleSheetsSync = syncStats;
              schedule.lastGoogleSheetsSync = syncStats;
              this.saveSchedules();
              this.saveRuns();
              console.log(`[Scheduler] Google Sheets sync completed for "${schedule.name}": ${syncStats.recordsAdded} added, ${syncStats.recordsUpdated} updated, status: ${syncStats.status}`);
            })
            .catch((syncErr: any) => {
              console.error(`[Scheduler] Google Sheets sync error for "${schedule.name}":`, syncErr.message);
              const failedStats = {
                status: 'Failed' as const,
                spreadsheetId: schedule.googleSpreadsheetId,
                spreadsheetName: schedule.googleSpreadsheetName,
                sheetName: schedule.googleSheetName || 'Leads',
                recordsAdded: 0,
                recordsUpdated: 0,
                totalSynced: 0,
                lastSyncedAt: new Date().toISOString(),
                error: syncErr.message,
              };
              runLog.googleSheetsSync = failedStats;
              schedule.lastGoogleSheetsSync = failedStats;
              this.saveSchedules();
              this.saveRuns();
            });
        }
      }
    }, 3000);
  }

  /**
   * Executes a schedule and holds execution until completed,
   * keeping serverless / Cloud Run CPU 100% active during cron calls
   */
  public async executeScheduleAndWait(schedule: RecurringSchedule, maxWaitMs = 120000): Promise<ScheduleRunLog> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const runLog: ScheduleRunLog = {
      id: runId,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      startedAt: new Date().toISOString(),
      status: 'running',
      prospectsFound: 0,
    };

    this.runs.unshift(runLog);
    schedule.lastRunStatus = 'running';
    schedule.lastRunAt = runLog.startedAt;
    this.saveSchedules();
    this.saveRuns();

    try {
      const criteria: DiscoveryCriteria = {
        ...schedule.criteria,
        targetCount: schedule.targetCount || 20,
        freshnessMode: 'new_only',
        excludePreviouslyDiscovered: true,
        excludeMegaCaps: schedule.criteria.excludeMegaCaps ?? true,
      };

      const job = await globalDiscoveryEngine.createAndStartJob(criteria, 'recurring_scheduler');
      runLog.jobId = job.id;

      // Wait until job reaches completion or targetCount
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        const currentJob = globalDiscoveryEngine.getJob(job.id);
        if (!currentJob) break;

        const isFinished =
          currentJob.status === 'completed' ||
          currentJob.status === 'failed' ||
          currentJob.status === 'cancelled' ||
          currentJob.status === 'stopped' ||
          (currentJob.uniqueCompanies && currentJob.uniqueCompanies >= (schedule.targetCount || 20));

        if (isFinished) {
          runLog.completedAt = new Date().toISOString();
          runLog.status = (currentJob.uniqueCompanies || 0) > 0 ? 'completed' : (currentJob.status === 'completed' ? 'completed' : 'failed');
          runLog.prospectsFound = currentJob.uniqueCompanies || (currentJob.prospects?.length || 0);

          schedule.totalRuns++;
          schedule.totalProspectsFound += runLog.prospectsFound;
          schedule.lastRunProspectsCount = runLog.prospectsFound;
          schedule.lastRunStatus = runLog.status === 'completed' ? 'success' : 'failed';
          schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);
          schedule.updatedAt = new Date().toISOString();

          this.saveSchedules();
          this.saveRuns();

          // Auto-Enrich Website
          if (schedule.autoEnrichWebsite && currentJob.status === 'completed') {
            const eligibleIds = currentJob.prospects
              .filter((p) => p.verificationStatus === 'Verified company' && p.website)
              .map((p) => p.id);
            if (eligibleIds.length > 0) {
              globalDiscoveryEngine.enqueueEnrichmentBatch(currentJob.id, eligibleIds).catch(() => {});
            }
          }

          // Auto-Sync to Google Sheets
          if (schedule.googleSheetsEnabled && schedule.googleSpreadsheetId) {
            try {
              const syncStats = await globalGoogleSheetsEngine.syncScheduleProspectsToSheet(schedule, currentJob.prospects);
              runLog.googleSheetsSync = syncStats;
              schedule.lastGoogleSheetsSync = syncStats;
              this.saveSchedules();
              this.saveRuns();
            } catch (err: any) {
              console.error(`[Scheduler] Google Sheets sync error for "${schedule.name}":`, err.message);
            }
          }

          return runLog;
        }

        await new Promise((r) => setTimeout(r, 2000));
      }

      // If timed out waiting in request cycle, fallback to background polling
      this.pollJobCompletion(job.id, schedule, runLog);
      return runLog;
    } catch (err: any) {
      runLog.status = 'failed';
      runLog.error = err.message;
      runLog.completedAt = new Date().toISOString();
      schedule.lastRunStatus = 'failed';
      schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);
      this.saveSchedules();
      this.saveRuns();
      return runLog;
    }
  }

  /**
   * Cloud Cron Tick Handler:
   * Called by external webhook (Cloud Scheduler, cron-job.org, GitHub Action)
   * or internal keep-alive loop. Checks for pending schedules and executes them synchronously.
   */
  public async handleCronTick(options?: { force?: boolean; scheduleId?: string }): Promise<{
    success: boolean;
    executedCount: number;
    message: string;
    serverTime: string;
    runs: ScheduleRunLog[];
  }> {
    const now = Date.now();
    const executedRuns: ScheduleRunLog[] = [];

    // Specific schedule execution
    if (options?.scheduleId) {
      const schedule = this.schedules.get(options.scheduleId);
      if (schedule && schedule.enabled) {
        const run = await this.executeScheduleAndWait(schedule, 15000);
        return {
          success: true,
          executedCount: 1,
          message: `Triggered schedule "${schedule.name}" on cloud tick. Status: ${run.status}${run.status === 'completed' ? ` (found ${run.prospectsFound} leads)` : ' (processing in background)'}.`,
          serverTime: new Date().toISOString(),
          runs: [run],
        };
      }
    }

    // Check all enabled schedules
    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue;
      const nextTime = new Date(schedule.nextRunAt).getTime();
      const isDue = now >= nextTime || options?.force;

      if (isDue) {
        console.log(`[Scheduler] Cloud Cron Tick executing due schedule "${schedule.name}" (${schedule.id})`);
        // Immediately advance nextRunAt
        schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);
        this.saveSchedules();

        // Limit wait to 15s to keep external webhook well within 30s timeout limit
        const run = await this.executeScheduleAndWait(schedule, 15000);
        executedRuns.push(run);
      }
    }

    return {
      success: true,
      executedCount: executedRuns.length,
      message:
        executedRuns.length > 0
          ? `Executed ${executedRuns.length} due schedule(s) successfully while laptop is offline.`
          : 'All schedules are currently up-to-date. Next run scheduled.',
      serverTime: new Date().toISOString(),
      runs: executedRuns,
    };
  }

  public getAllSchedules(): RecurringSchedule[] {
    const list = Array.from(this.schedules.values());
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }

  public getSchedule(id: string): RecurringSchedule | null {
    return this.schedules.get(id) || null;
  }

  public createSchedule(data: {
    name: string;
    cadence: RecurringSchedule['cadence'];
    timeOfDayUtc?: string;
    customHours?: number;
    targetCount: number;
    criteria: DiscoveryCriteria;
    enabled?: boolean;
    autoEnrichWebsite?: boolean;
    startImmediately?: boolean;
    googleSheetsEnabled?: boolean;
    googleSpreadsheetId?: string;
    googleSpreadsheetName?: string;
    googleSheetId?: number;
    googleSheetName?: string;
    googleSheetsMapping?: Partial<GoogleSheetsColumnMapping>;
    connectedUserEmail?: string;
  }): RecurringSchedule {
    const id = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const nextRun = this.computeNextRun(data.cadence, data.timeOfDayUtc, data.customHours);

    const schedule: RecurringSchedule = {
      id,
      name: data.name.trim() || 'Daily Discovery Schedule',
      cadence: data.cadence || 'daily',
      timeOfDayUtc: data.timeOfDayUtc || '08:00',
      customHours: data.customHours,
      targetCount: Math.max(5, Math.min(data.targetCount || 20, 250)),
      criteria: data.criteria,
      enabled: data.enabled !== undefined ? data.enabled : true,
      autoEnrichWebsite: data.autoEnrichWebsite ?? true,
      totalProspectsFound: 0,
      totalRuns: 0,
      nextRunAt: nextRun,
      createdAt: now,
      updatedAt: now,
      googleSheetsEnabled: Boolean(data.googleSheetsEnabled),
      googleSpreadsheetId: data.googleSpreadsheetId,
      googleSpreadsheetName: data.googleSpreadsheetName,
      googleSheetId: data.googleSheetId,
      googleSheetName: data.googleSheetName,
      googleSheetsMapping: data.googleSheetsMapping,
      connectedUserEmail: data.connectedUserEmail,
    };

    this.schedules.set(id, schedule);
    this.saveSchedules();

    if (data.startImmediately && schedule.enabled) {
      setTimeout(() => {
        this.executeSchedule(schedule).catch((e) => console.warn('[Scheduler] Immediate run error:', e));
      }, 350);
    }

    return schedule;
  }

  public updateSchedule(id: string, updates: Partial<RecurringSchedule>): RecurringSchedule | null {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;

    if (updates.name !== undefined) schedule.name = updates.name.trim();
    if (updates.cadence !== undefined) schedule.cadence = updates.cadence;
    if (updates.timeOfDayUtc !== undefined) schedule.timeOfDayUtc = updates.timeOfDayUtc;
    if (updates.customHours !== undefined) schedule.customHours = updates.customHours;
    if (updates.targetCount !== undefined) schedule.targetCount = updates.targetCount;
    if (updates.criteria !== undefined) schedule.criteria = updates.criteria;
    if (updates.enabled !== undefined) schedule.enabled = updates.enabled;
    if (updates.autoEnrichWebsite !== undefined) schedule.autoEnrichWebsite = updates.autoEnrichWebsite;
    if (updates.googleSheetsEnabled !== undefined) schedule.googleSheetsEnabled = updates.googleSheetsEnabled;
    if (updates.googleSpreadsheetId !== undefined) schedule.googleSpreadsheetId = updates.googleSpreadsheetId;
    if (updates.googleSpreadsheetName !== undefined) schedule.googleSpreadsheetName = updates.googleSpreadsheetName;
    if (updates.googleSheetId !== undefined) schedule.googleSheetId = updates.googleSheetId;
    if (updates.googleSheetName !== undefined) schedule.googleSheetName = updates.googleSheetName;
    if (updates.googleSheetsMapping !== undefined) schedule.googleSheetsMapping = updates.googleSheetsMapping;
    if (updates.connectedUserEmail !== undefined) schedule.connectedUserEmail = updates.connectedUserEmail;

    schedule.updatedAt = new Date().toISOString();
    schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);

    this.saveSchedules();
    return schedule;
  }

  public deleteSchedule(id: string): boolean {
    const deleted = this.schedules.delete(id);
    if (deleted) this.saveSchedules();
    return deleted;
  }

  public toggleSchedule(id: string, enabled?: boolean): RecurringSchedule | null {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;

    schedule.enabled = enabled !== undefined ? enabled : !schedule.enabled;
    schedule.updatedAt = new Date().toISOString();
    if (schedule.enabled) {
      schedule.nextRunAt = this.computeNextRun(schedule.cadence, schedule.timeOfDayUtc, schedule.customHours);
    }
    this.saveSchedules();
    return schedule;
  }

  public async triggerScheduleNow(id: string): Promise<ScheduleRunLog | null> {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;
    return await this.executeSchedule(schedule);
  }

  public getAllRuns(scheduleId?: string): ScheduleRunLog[] {
    let hasChanges = false;
    for (const run of this.runs) {
      if (run.status === 'running' && run.jobId) {
        const job = globalDiscoveryEngine.getJob(run.jobId);
        if (job) {
          const count = job.uniqueCompanies || (job.prospects?.length || 0);
          if (count > 0 || job.status === 'completed' || job.status === 'failed') {
            run.prospectsFound = count;
            if (job.status === 'completed') {
              run.status = 'completed';
              run.completedAt = run.completedAt || new Date().toISOString();
              hasChanges = true;
            } else if (job.status === 'failed') {
              run.status = count > 0 ? 'completed' : 'failed';
              run.completedAt = run.completedAt || new Date().toISOString();
              hasChanges = true;
            }
          }
        }
      }
    }
    if (hasChanges) {
      this.saveRuns();
    }

    if (scheduleId) {
      return this.runs.filter((r) => r.scheduleId === scheduleId);
    }
    return this.runs.slice(0, 100);
  }

  public async syncScheduleToGoogleSheets(scheduleId: string, customToken?: string): Promise<GoogleSheetsSyncStats> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    if (!schedule.googleSheetsEnabled || !schedule.googleSpreadsheetId) {
      throw new Error('Google Sheets is not configured for this schedule.');
    }

    if (customToken) {
      globalGoogleSheetsEngine.saveUserTokens(
        schedule.connectedUserEmail || 'moneysinghgtme@gmail.com',
        customToken,
        undefined,
        3600
      );
    }

    // Collect all prospects across all completed runs of this schedule
    const allProspects: DiscoveredProspect[] = [];
    const seenDomains = new Set<string>();

    const runs = this.runs.filter((r) => r.scheduleId === scheduleId);
    for (const r of runs) {
      if (r.jobId) {
        const job = globalDiscoveryEngine.getJob(r.jobId);
        if (job && job.prospects) {
          for (const p of job.prospects) {
            const dom = p.domain || p.website;
            if (dom && !seenDomains.has(dom)) {
              seenDomains.add(dom);
              allProspects.push(p);
            }
          }
        }
      }
    }

    // If no prospects found from schedule jobs, gather latest matching prospects
    if (allProspects.length === 0) {
      const allJobs = globalDiscoveryEngine.getAllJobs();
      for (const j of allJobs) {
        if (j.prospects) {
          for (const p of j.prospects) {
            const dom = p.domain || p.website;
            if (dom && !seenDomains.has(dom) && allProspects.length < (schedule.targetCount || 20) * 2) {
              seenDomains.add(dom);
              allProspects.push(p);
            }
          }
        }
      }
    }

    console.log(`[Scheduler] Manual Sync initiated for "${schedule.name}": ${allProspects.length} prospects gathered`);
    const syncStats = await globalGoogleSheetsEngine.syncScheduleProspectsToSheet(schedule, allProspects);

    schedule.lastGoogleSheetsSync = syncStats;
    this.saveSchedules();

    // Update run logs
    const latestRun = this.runs.find((r) => r.scheduleId === scheduleId);
    if (latestRun) {
      latestRun.googleSheetsSync = syncStats;
      this.saveRuns();
    }

    return syncStats;
  }
}

export const globalSchedulerEngine = new SchedulerEngine();
