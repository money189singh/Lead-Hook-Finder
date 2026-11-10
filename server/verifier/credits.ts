import fs from 'fs';
import path from 'path';
import {
  VerificationCreditSettings,
  CreditHistoryItem,
  VerificationLevel,
  CustomVerificationOptions,
} from '../../src/types';
import { DEFAULT_CREDIT_SETTINGS } from './defaults';

const DATA_DIR = path.join(process.cwd(), 'data');
const CREDITS_FILE = path.join(DATA_DIR, 'credits.json');
const CREDIT_HISTORY_FILE = path.join(DATA_DIR, 'credit_history.json');

export class VerificationCreditManager {
  private settings: VerificationCreditSettings;
  private history: CreditHistoryItem[] = [];

  constructor() {
    this.settings = { ...DEFAULT_CREDIT_SETTINGS };
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(CREDITS_FILE)) {
        const raw = fs.readFileSync(CREDITS_FILE, 'utf-8');
        this.settings = { ...DEFAULT_CREDIT_SETTINGS, ...JSON.parse(raw) };
      }

      if (fs.existsSync(CREDIT_HISTORY_FILE)) {
        const rawHist = fs.readFileSync(CREDIT_HISTORY_FILE, 'utf-8');
        this.history = JSON.parse(rawHist);
      } else {
        // Seed with a welcoming entry
        this.history = [
          {
            id: 'cred-hist-init',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            verification_level: 'MEDIUM',
            businesses_processed: 0,
            credits_used: 0,
            notes: 'System initialization - welcome grant of 10,000 verification credits',
          },
        ];
        this.saveHistoryToDisk();
      }
    } catch (err) {
      console.warn('VerificationCreditManager: disk read error, using memory state:', err);
    }
  }

  private saveSettingsToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CREDITS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.warn('VerificationCreditManager: could not save credits to disk:', err);
    }
  }

  private saveHistoryToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CREDIT_HISTORY_FILE, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (err) {
      console.warn('VerificationCreditManager: could not save credit history to disk:', err);
    }
  }

  public getSettings(): VerificationCreditSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<VerificationCreditSettings>): VerificationCreditSettings {
    this.settings = {
      ...this.settings,
      ...newSettings,
    };
    this.saveSettingsToDisk();
    return { ...this.settings };
  }

  public getHistory(): CreditHistoryItem[] {
    return [...this.history];
  }

  /**
   * Calculate cost per business for a given level and optional custom configuration
   */
  public getCostPerBusiness(level: VerificationLevel, custom?: CustomVerificationOptions): number {
    switch (level) {
      case 'LOW':
        return Number(this.settings.low_cost) || 0.5;
      case 'MEDIUM':
        return Number(this.settings.medium_cost) || 1.0;
      case 'HIGH':
        return Number(this.settings.high_cost) || 2.0;
      case 'CUSTOM': {
        if (!custom) return Number(this.settings.medium_cost) || 1.0;
        let cost = 0;
        if (custom.checkWebsite) cost += 0.2;
        if (custom.checkGoogleMaps) cost += 0.3;
        if (custom.checkSearch) cost += 0.5;
        if (custom.checkGovernment) cost += 0.4;
        if (custom.checkRecentReviews) cost += 0.3;
        if (custom.checkSocialActivity) cost += 0.2;
        if (custom.aiOnlyWhenUncertain) cost += 0.2;
        return Math.max(0.2, Math.round(cost * 10) / 10);
      }
      default:
        return 1.0;
    }
  }

  /**
   * Estimate total credit cost for a batch
   */
  public calculateEstimate(
    count: number,
    level: VerificationLevel,
    custom?: CustomVerificationOptions
  ): {
    costPerBusiness: number;
    estimatedCredits: number;
    availableCredits: number;
    estimatedRemainingCredits: number;
    hasEnoughCredits: boolean;
  } {
    const costPerBusiness = this.getCostPerBusiness(level, custom);
    const estimatedCredits = Math.round(count * costPerBusiness * 10) / 10;
    const availableCredits = this.settings.available_credits;
    const estimatedRemainingCredits = Math.max(0, Math.round((availableCredits - estimatedCredits) * 10) / 10);
    const hasEnoughCredits = availableCredits >= estimatedCredits;

    return {
      costPerBusiness,
      estimatedCredits,
      availableCredits,
      estimatedRemainingCredits,
      hasEnoughCredits,
    };
  }

  /**
   * Deducts credits for a single business verification that has ACTUALLY STARTED successfully.
   * Returns false if insufficient credits.
   */
  public deductForSingleBusiness(level: VerificationLevel, custom?: CustomVerificationOptions): { success: boolean; deducted: number; remaining: number } {
    const cost = this.getCostPerBusiness(level, custom);
    if (this.settings.available_credits < cost) {
      return { success: false, deducted: 0, remaining: this.settings.available_credits };
    }

    this.settings.available_credits = Math.round((this.settings.available_credits - cost) * 10) / 10;
    this.settings.total_credits_used = Math.round((this.settings.total_credits_used + cost) * 10) / 10;
    this.saveSettingsToDisk();

    return {
      success: true,
      deducted: cost,
      remaining: this.settings.available_credits,
    };
  }

  /**
   * Refunds credits in the rare event of an unrecoverable crash after deduction
   */
  public refund(amount: number) {
    this.settings.available_credits = Math.round((this.settings.available_credits + amount) * 10) / 10;
    this.settings.total_credits_used = Math.max(0, Math.round((this.settings.total_credits_used - amount) * 10) / 10);
    this.saveSettingsToDisk();
  }

  /**
   * Records a completed batch in the Credit Usage History
   */
  public recordBatchHistory(
    level: VerificationLevel,
    processedCount: number,
    creditsUsed: number,
    jobId?: string,
    notes?: string
  ): CreditHistoryItem {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const item: CreditHistoryItem = {
      id: `cred-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: formattedDate,
      verification_level: level,
      businesses_processed: processedCount,
      credits_used: Math.round(creditsUsed * 10) / 10,
      job_id: jobId,
      notes: notes || `Verified ${processedCount} business(es) via ${level} verification ladder`,
    };

    this.history.unshift(item);
    if (this.history.length > 200) {
      this.history = this.history.slice(0, 200);
    }
    this.saveHistoryToDisk();
    return item;
  }

  /**
   * Allows adding verification credits (top-up)
   */
  public addCredits(amount: number): VerificationCreditSettings {
    this.settings.available_credits = Math.round((this.settings.available_credits + amount) * 10) / 10;
    this.saveSettingsToDisk();

    this.history.unshift({
      id: `cred-hist-add-${Date.now()}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      verification_level: 'MEDIUM',
      businesses_processed: 0,
      credits_used: 0,
      notes: `Manually added ${amount} verification credits to workspace`,
    });
    this.saveHistoryToDisk();

    return { ...this.settings };
  }
}

export const globalCreditManager = new VerificationCreditManager();
