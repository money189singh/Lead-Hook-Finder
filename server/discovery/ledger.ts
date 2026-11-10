import fs from 'fs';
import path from 'path';
import { extractCleanDomain, cleanCompanyName } from './domainDetector';

export interface LedgerEntry {
  domain: string;
  companyName: string;
  jobId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  source?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'discovery_ledger.json');

/**
 * Global Discovery Ledger
 * Tracks all domains and company names ever discovered across all past jobs and scraper batches.
 * Enables guaranteed "Find Brand New Every Time" discovery and historical deduplication.
 */
export class DiscoveryLedger {
  private seenDomains: Map<string, LedgerEntry> = new Map();
  private seenNames: Set<string> = new Set();
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private ensureDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('[Ledger] Failed to ensure data dir:', e);
    }
  }

  private load() {
    try {
      this.ensureDir();
      if (fs.existsSync(LEDGER_FILE)) {
        const raw = fs.readFileSync(LEDGER_FILE, 'utf-8');
        const list: LedgerEntry[] = JSON.parse(raw);
        for (const item of list) {
          if (item.domain) {
            const cleanDom = item.domain.toLowerCase();
            this.seenDomains.set(cleanDom, item);
            if (item.companyName) {
              const nameKey = item.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (nameKey) this.seenNames.add(nameKey);
            }
          }
        }
      }
      this.isLoaded = true;
      // Preload from existing discovery jobs if ledger was empty
      if (this.seenDomains.size === 0) {
        this.syncFromExistingJobs();
      }
    } catch (e) {
      console.warn('[Ledger] Failed to load ledger from disk:', e);
      this.seenDomains = new Map();
      this.seenNames = new Set();
    }
  }

  private syncFromExistingJobs() {
    try {
      const jobsDir = path.join(DATA_DIR, 'discovery_jobs');
      if (fs.existsSync(jobsDir)) {
        const files = fs.readdirSync(jobsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(path.join(jobsDir, file), 'utf-8');
              const job = JSON.parse(raw);
              if (Array.isArray(job.prospects)) {
                for (const p of job.prospects) {
                  if (p.domain) {
                    this.markDomainSeen(p.domain, p.companyName, job.id, 'historical_job');
                  }
                }
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('[Ledger] Failed to sync existing jobs into ledger:', e);
    }
  }

  public save() {
    try {
      this.ensureDir();
      const list = Array.from(this.seenDomains.values());
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Ledger] Failed to save ledger to disk:', e);
    }
  }

  public isDomainSeen(domainOrUrl: string): boolean {
    const domain = extractCleanDomain(domainOrUrl).toLowerCase();
    if (!domain) return false;
    return this.seenDomains.has(domain);
  }

  public isCompanySeen(name: string): boolean {
    if (!name) return false;
    const nameKey = cleanCompanyName(name).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nameKey || nameKey.length < 2) return false;
    return this.seenNames.has(nameKey);
  }

  public markDomainSeen(domainOrUrl: string, companyName: string, jobId?: string, source?: string) {
    const domain = extractCleanDomain(domainOrUrl).toLowerCase();
    if (!domain) return;

    const now = new Date().toISOString();
    const existing = this.seenDomains.get(domain);

    if (existing) {
      existing.lastSeenAt = now;
      if (companyName && !existing.companyName) {
        existing.companyName = companyName;
      }
    } else {
      this.seenDomains.set(domain, {
        domain,
        companyName: companyName || '',
        jobId,
        firstSeenAt: now,
        lastSeenAt: now,
        source: source || 'discovery',
      });
    }

    if (companyName) {
      const nameKey = cleanCompanyName(companyName).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (nameKey) this.seenNames.add(nameKey);
    }

    // Debounced persist
    this.save();
  }

  public getStats(): { totalSeen: number; lastAdded?: string } {
    const totalSeen = this.seenDomains.size;
    let lastAdded: string | undefined;
    for (const item of this.seenDomains.values()) {
      if (!lastAdded || item.firstSeenAt > lastAdded) {
        lastAdded = item.firstSeenAt;
      }
    }
    return { totalSeen, lastAdded };
  }

  public getAllSeenDomains(): string[] {
    return Array.from(this.seenDomains.keys());
  }

  public clear() {
    this.seenDomains.clear();
    this.seenNames.clear();
    this.save();
  }
}

export const globalDiscoveryLedger = new DiscoveryLedger();
