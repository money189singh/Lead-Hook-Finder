import fs from 'fs';
import path from 'path';
import { CompanyResearchResult } from './types';
import { extractCleanDomain } from '../discovery/domainDetector';

const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'research_cache.json');

export class ResearchCacheManager {
  private cache: Map<string, { result: CompanyResearchResult; cachedAt: number; expiresAt: number }> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private ensureDataDir(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {}
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const now = Date.now();
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.key && item.result && item.expiresAt > now) {
              this.cache.set(item.key, {
                result: item.result,
                cachedAt: item.cachedAt || now,
                expiresAt: item.expiresAt,
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[ResearchCache] Could not load disk cache:', err.message);
    }
  }

  private saveToDisk(): void {
    try {
      this.ensureDataDir();
      const items: any[] = [];
      const now = Date.now();
      for (const [key, val] of this.cache.entries()) {
        if (val.expiresAt > now) {
          items.push({
            key,
            cachedAt: val.cachedAt,
            expiresAt: val.expiresAt,
            result: val.result,
          });
        }
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[ResearchCache] Could not save disk cache:', err.message);
    }
  }

  public generateKey(companyName: string, domain?: string): string {
    const cleanDomain = domain ? extractCleanDomain(domain) : '';
    const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '_').trim();
    return cleanDomain ? `domain:${cleanDomain}` : `name:${cleanName}`;
  }

  public get(companyName: string, domain?: string): CompanyResearchResult | null {
    const key = this.generateKey(companyName, domain);
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.result;
  }

  public set(
    companyName: string,
    domain: string | undefined,
    result: CompanyResearchResult,
    ttlHours: number = 24
  ): void {
    const key = this.generateKey(companyName, domain);
    const now = Date.now();
    const expiresAt = now + ttlHours * 60 * 60 * 1000;

    this.cache.set(key, {
      result,
      cachedAt: now,
      expiresAt,
    });

    this.saveToDisk();
  }

  public delete(companyName: string, domain?: string): void {
    const key = this.generateKey(companyName, domain);
    this.cache.delete(key);
    this.saveToDisk();
  }

  public clear(): void {
    this.cache.clear();
    this.saveToDisk();
  }

  public getStats(): { total_entries: number; active_entries: number } {
    const now = Date.now();
    let active = 0;
    for (const val of this.cache.values()) {
      if (val.expiresAt > now) active++;
    }
    return {
      total_entries: this.cache.size,
      active_entries: active,
    };
  }

  public listKeys(): Array<{ key: string; company: string; domain: string; expiresAt: string }> {
    const list: Array<{ key: string; company: string; domain: string; expiresAt: string }> = [];
    const now = Date.now();
    for (const [key, val] of this.cache.entries()) {
      if (val.expiresAt > now) {
        list.push({
          key,
          company: val.result.company_name,
          domain: val.result.domain,
          expiresAt: new Date(val.expiresAt).toISOString(),
        });
      }
    }
    return list;
  }
}

export const globalResearchCache = new ResearchCacheManager();
