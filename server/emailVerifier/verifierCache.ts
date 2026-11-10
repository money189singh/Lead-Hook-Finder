import fs from 'fs';
import path from 'path';
import { EmailVerificationResult } from './types';

export class VerifierCache {
  private static readonly DATA_DIR = path.join(process.cwd(), 'data');
  private static readonly CACHE_FILE = path.join(VerifierCache.DATA_DIR, 'email_verifications.json');
  private static cache: Map<string, EmailVerificationResult> = new Map();
  private static isLoaded = false;
  // Default cache TTL: 30 days
  public static readonly DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  /**
   * Generate compound cache key: normalized_email + optional company_id
   */
  public static makeKey(normalizedEmail: string, companyId?: string): string {
    const cleanEmail = normalizedEmail.toLowerCase().trim();
    if (!companyId) return cleanEmail;
    return `${cleanEmail}::${companyId.toLowerCase().trim()}`;
  }

  /**
   * Load cache from disk into memory
   */
  public static load(): void {
    if (this.isLoaded) return;
    this.isLoaded = true;

    try {
      if (!fs.existsSync(this.DATA_DIR)) {
        fs.mkdirSync(this.DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(this.CACHE_FILE)) {
        const raw = fs.readFileSync(this.CACHE_FILE, 'utf8');
        const list: EmailVerificationResult[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.normalized_email) {
              const key = this.makeKey(item.normalized_email, item.company_id);
              this.cache.set(key, item);
              // Also index by bare normalized email for fallback queries
              if (!this.cache.has(item.normalized_email)) {
                this.cache.set(item.normalized_email, item);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[VerifierCache] Could not load verification cache from disk:', err?.message || err);
    }
  }

  /**
   * Save cache from memory to disk
   */
  public static save(): void {
    try {
      if (!fs.existsSync(this.DATA_DIR)) {
        fs.mkdirSync(this.DATA_DIR, { recursive: true });
      }

      // Collect unique items
      const uniqueItems = Array.from(new Set(this.cache.values()));
      fs.writeFileSync(this.CACHE_FILE, JSON.stringify(uniqueItems, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[VerifierCache] Could not persist verification cache to disk:', err?.message || err);
    }
  }

  /**
   * Get cached result if valid and not expired
   */
  public static get(
    normalizedEmail: string,
    companyId?: string,
    ttlMs: number = this.DEFAULT_TTL_MS
  ): EmailVerificationResult | null {
    this.load();

    const specificKey = this.makeKey(normalizedEmail, companyId);
    let item = this.cache.get(specificKey);
    if (!item && companyId) {
      item = this.cache.get(normalizedEmail.toLowerCase().trim());
    }

    if (!item) return null;

    // Check expiration
    const lastChecked = item.last_checked_at || item.verified_at;
    if (lastChecked) {
      const age = Date.now() - new Date(lastChecked).getTime();
      if (age > ttlMs) {
        return null; // Expired, needs reverification
      }
    }

    return item;
  }

  /**
   * Set or update cached result
   */
  public static set(result: EmailVerificationResult): void {
    this.load();
    const key = this.makeKey(result.normalized_email, result.company_id);
    this.cache.set(key, result);
    // Also index bare email
    this.cache.set(result.normalized_email.toLowerCase().trim(), result);
    this.save();
  }

  /**
   * Batch get cached results
   */
  public static getBatch(
    emails: string[],
    ttlMs: number = this.DEFAULT_TTL_MS
  ): Map<string, EmailVerificationResult> {
    this.load();
    const map = new Map<string, EmailVerificationResult>();
    for (const em of emails) {
      const normalized = em.toLowerCase().trim();
      const hit = this.get(normalized, undefined, ttlMs);
      if (hit) map.set(normalized, hit);
    }
    return map;
  }

  /**
   * Get stats about cached verifications
   */
  public static getStats(): {
    total_cached: number;
    valid_count: number;
    invalid_count: number;
    risky_count: number;
    unknown_count: number;
  } {
    this.load();
    const unique = Array.from(new Set(this.cache.values()));
    let valid_count = 0;
    let invalid_count = 0;
    let risky_count = 0;
    let unknown_count = 0;

    for (const item of unique) {
      if (item.verification_status === 'Valid') valid_count++;
      else if (item.verification_status === 'Invalid') invalid_count++;
      else if (item.verification_status === 'Risky') risky_count++;
      else unknown_count++;
    }

    return {
      total_cached: unique.length,
      valid_count,
      invalid_count,
      risky_count,
      unknown_count,
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  public static clear(): void {
    this.cache.clear();
    try {
      if (fs.existsSync(this.CACHE_FILE)) {
        fs.unlinkSync(this.CACHE_FILE);
      }
    } catch {}
  }
}
