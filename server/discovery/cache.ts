import fs from 'fs';
import path from 'path';
import { DiscoveredProspect } from './types';
import { extractCleanDomain } from './domainDetector';

interface CacheEntry {
  domain: string;
  companyName: string;
  discoveredAt: string;
  lastCrawledAt?: string;
  data: Partial<DiscoveredProspect>;
}

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'discovery_cache.json');
const DEFAULT_TTL_DAYS = 7;

export class DiscoveryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private loaded = false;

  constructor() {
    this.loadCache();
  }

  private loadCache() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (entry && entry.domain) {
              this.cache.set(entry.domain.toLowerCase(), entry);
            }
          }
        } else if (parsed && typeof parsed === 'object') {
          for (const [key, val] of Object.entries<any>(parsed)) {
            const dom = (val && val.domain) ? val.domain : key;
            if (dom && typeof dom === 'string') {
              this.cache.set(dom.toLowerCase(), val);
            }
          }
        }
      }
      this.loaded = true;
    } catch (e) {
      console.warn('Failed to load discovery cache from disk, initializing in memory:', e);
      this.cache = new Map();
    }
  }

  private saveCache() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const list = Array.from(this.cache.values());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save discovery cache to disk:', e);
    }
  }

  /**
   * Retrieves cached prospect if not expired
   */
  public get(domainOrUrl: string, ttlDays = DEFAULT_TTL_DAYS): CacheEntry | null {
    const domain = extractCleanDomain(domainOrUrl).toLowerCase();
    if (!domain) return null;

    const entry = this.cache.get(domain);
    if (!entry) return null;

    // Check expiration
    const discoveredTime = new Date(entry.discoveredAt).getTime();
    const expiryTime = discoveredTime + ttlDays * 24 * 60 * 60 * 1000;
    if (Date.now() > expiryTime) {
      this.cache.delete(domain);
      return null;
    }

    return entry;
  }

  /**
   * Puts or updates a prospect in the discovery cache
   */
  public set(domainOrUrl: string, companyName: string, data: Partial<DiscoveredProspect>) {
    const domain = extractCleanDomain(domainOrUrl).toLowerCase();
    if (!domain) return;

    const now = new Date().toISOString();
    const entry: CacheEntry = {
      domain,
      companyName,
      discoveredAt: now,
      lastCrawledAt: now,
      data,
    };

    this.cache.set(domain, entry);
    this.saveCache();
  }

  public clear() {
    this.cache.clear();
    this.saveCache();
  }
}

export const globalDiscoveryCache = new DiscoveryCache();
