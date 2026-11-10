import fs from 'fs';
import path from 'path';
import { VerificationEngine } from './verificationEngine';
import {
  EmailVerificationJobStatus,
  EmailVerificationResult,
  VerificationOptions,
  EmailCategory,
} from './types';

export class VerificationQueue {
  private static readonly DATA_DIR = path.join(process.cwd(), 'data');
  private static readonly JOBS_FILE = path.join(VerificationQueue.DATA_DIR, 'email_verifier_jobs.json');
  private static jobs: Map<string, EmailVerificationJobStatus> = new Map();
  private static cancelledJobIds: Set<string> = new Set();
  private static isLoaded = false;

  public static load(): void {
    if (this.isLoaded) return;
    this.isLoaded = true;

    try {
      if (!fs.existsSync(this.DATA_DIR)) {
        fs.mkdirSync(this.DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(this.JOBS_FILE)) {
        const raw = fs.readFileSync(this.JOBS_FILE, 'utf8');
        const list: EmailVerificationJobStatus[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const j of list) {
            if (j && j.id) {
              // If a job was 'running' when server shut down, mark it completed or idle
              if (j.status === 'running') {
                j.status = 'completed';
              }
              this.jobs.set(j.id, j);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[VerificationQueue] Could not load jobs from disk:', err?.message || err);
    }
  }

  public static save(): void {
    try {
      if (!fs.existsSync(this.DATA_DIR)) {
        fs.mkdirSync(this.DATA_DIR, { recursive: true });
      }

      const list = Array.from(this.jobs.values());
      fs.writeFileSync(this.JOBS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[VerificationQueue] Could not persist jobs to disk:', err?.message || err);
    }
  }

  public static getJob(id: string): EmailVerificationJobStatus | null {
    this.load();
    return this.jobs.get(id) || null;
  }

  public static cancelJob(id: string): boolean {
    this.load();
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'running') {
      job.status = 'cancelled';
      job.completed_at = new Date().toISOString();
      this.cancelledJobIds.add(id);
      this.save();
      return true;
    }
    return false;
  }

  public static createJob(
    items: Array<{
      email: string;
      company_id?: string;
      company_name?: string;
      source_url?: string;
      email_category?: EmailCategory;
    }>,
    options?: VerificationOptions,
    concurrency: number = 5
  ): EmailVerificationJobStatus {
    this.load();

    const jobId = `vjob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job: EmailVerificationJobStatus = {
      id: jobId,
      status: 'running',
      total: items.length,
      processed: 0,
      valid_count: 0,
      invalid_count: 0,
      risky_count: 0,
      unknown_count: 0,
      started_at: new Date().toISOString(),
      results: [],
    };

    this.jobs.set(jobId, job);
    this.save();

    // Run asynchronously
    (async () => {
      try {
        const results = await VerificationEngine.verifyBatch(
          items,
          options,
          concurrency,
          (processed, total, currentEmail) => {
            if (this.cancelledJobIds.has(jobId)) {
              return;
            }
            job.processed = processed;
            job.current_email = currentEmail;
          }
        );

        if (this.cancelledJobIds.has(jobId)) {
          job.status = 'cancelled';
          this.cancelledJobIds.delete(jobId);
        } else {
          job.status = 'completed';
          job.results = results;
          job.processed = results.length;
          job.valid_count = results.filter((r) => r.verification_status === 'Valid').length;
          job.invalid_count = results.filter((r) => r.verification_status === 'Invalid').length;
          job.risky_count = results.filter((r) => r.verification_status === 'Risky').length;
          job.unknown_count = results.filter((r) => r.verification_status === 'Unknown').length;
        }

        job.completed_at = new Date().toISOString();
        this.save();
      } catch (err: any) {
        job.status = 'failed';
        job.error = err?.message || 'Verification job failed';
        job.completed_at = new Date().toISOString();
        this.save();
      }
    })();

    return job;
  }
}
