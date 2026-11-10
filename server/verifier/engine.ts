import {
  VerificationJobStatus,
  VerificationLevel,
  CustomVerificationOptions,
  VerificationResult,
  WebsiteResult,
  Contact,
  ScrapeJob,
} from '../../src/types';
import { globalCreditManager } from './credits';
import { globalVerificationRuleEngine } from './ruleEngine';
import { storage } from '../storage';
import { crawlerEngine } from '../crawler';

export interface VerificationTarget {
  business_name?: string;
  company_name?: string;
  url: string;
  address?: string;
  phone?: string;
}

export class BusinessVerifierEngine {
  private currentStatus: VerificationJobStatus = {
    id: 'idle',
    status: 'idle',
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    open_count: 0,
    temporarily_closed_count: 0,
    permanently_closed_count: 0,
    uncertain_count: 0,
    estimated_credits: 0,
    credits_used: 0,
    credits_remaining: 10000,
    verification_level: 'MEDIUM',
    api_usage: {
      google_maps_calls: 0,
      search_calls: 0,
      gov_calls: 0,
      ai_calls: 0,
      api_errors: 0,
      fallback_events: 0,
    },
  };

  private isPaused = false;
  private isStopped = false;

  public getStatus(): VerificationJobStatus {
    const credSettings = globalCreditManager.getSettings();
    return {
      ...this.currentStatus,
      credits_remaining: credSettings.available_credits,
    };
  }

  public pause() {
    this.isPaused = true;
    this.currentStatus.status = 'paused';
    this.currentStatus.current_status_text = 'Verification paused by user.';
  }

  public resume() {
    this.isPaused = false;
    this.currentStatus.status = 'running';
    this.currentStatus.current_status_text = 'Resuming verification...';
  }

  public stop() {
    this.isStopped = true;
    this.currentStatus.status = 'idle';
    this.currentStatus.current_status_text = 'Verification stopped.';
  }

  /**
   * Verifies a batch of targets (e.g. from VERIFY SELECTED or VERIFY ALL)
   */
  public async runBatch(
    targets: VerificationTarget[],
    level: VerificationLevel,
    customOptions?: CustomVerificationOptions
  ): Promise<VerificationJobStatus> {
    const settings = storage.getSettings();
    const credSettings = globalCreditManager.getSettings();
    const estimate = globalCreditManager.calculateEstimate(targets.length, level, customOptions);

    this.isPaused = false;
    this.isStopped = false;

    this.currentStatus = {
      id: `ver-job-${Date.now()}`,
      status: 'running',
      total: targets.length,
      processed: 0,
      successful: 0,
      failed: 0,
      open_count: 0,
      temporarily_closed_count: 0,
      permanently_closed_count: 0,
      uncertain_count: 0,
      estimated_credits: estimate.estimatedCredits,
      credits_used: 0,
      credits_remaining: credSettings.available_credits,
      verification_level: level,
      started_at: new Date().toISOString(),
      current_status_text: `Starting verification of ${targets.length} business(es)...`,
      api_usage: {
        google_maps_calls: 0,
        search_calls: 0,
        gov_calls: 0,
        ai_calls: 0,
        api_errors: 0,
        fallback_events: 0,
      },
    };

    let totalDeductedCredits = 0;
    let currentJob = crawlerEngine.getCurrentJob();
    if (!currentJob) {
      const history = storage.getHistory();
      if (history && history.length > 0) {
        currentJob = storage.getJobById(history[0].id);
        if (currentJob) {
          crawlerEngine.setCurrentJob(currentJob);
        }
      }
    }

    for (let i = 0; i < targets.length; i++) {
      if (this.isStopped) break;

      while (this.isPaused && !this.isStopped) {
        await new Promise((r) => setTimeout(r, 500));
      }

      const target = targets[i];
      const rawName = target.business_name || target.company_name || '';
      const domainName = (target.url || '').replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split('.')[0];
      const resolvedName = rawName.trim() || domainName || 'Business';

      this.currentStatus.current_business = resolvedName;
      this.currentStatus.current_status_text = `[${i + 1}/${targets.length}] Verifying ${resolvedName}...`;

      // Requirement #5: Deduct credits only when a business verification actually starts successfully
      const deduction = globalCreditManager.deductForSingleBusiness(level, customOptions);
      if (!deduction.success) {
        this.currentStatus.status = 'failed';
        this.currentStatus.current_status_text = `Insufficient verification credits remaining. Processed ${i} of ${targets.length}.`;
        break;
      }

      totalDeductedCredits += deduction.deducted;
      this.currentStatus.credits_used = Math.round(totalDeductedCredits * 10) / 10;
      this.currentStatus.credits_remaining = deduction.remaining;

      const googleMapsKey = settings.verification_api_config?.find((c) => c.service === 'google_maps' && c.enabled)?.apiKey || process.env.GOOGLE_MAPS_API_KEY;
      const govFilesKey = settings.govfiles_config?.api_key || settings.verification_api_config?.find((c) => c.service === 'govfiles' && c.enabled)?.apiKey || process.env.GOVFILES_API_KEY;
      const search1Key = settings.verification_api_config?.find((c) => c.service === 'search_1' && c.enabled)?.apiKey || process.env.SERPAPI_API_KEY;
      const search2Key = settings.verification_api_config?.find((c) => c.service === 'search_2' && c.enabled)?.apiKey;

      this.currentStatus.current_checks_progress = [];

      try {
        const { result, apiUsageCounts } = await globalVerificationRuleEngine.executeVerificationLadder(
          {
            business_name: resolvedName,
            url: target.url,
            address: target.address,
            phone: target.phone,
            level,
            custom_options: customOptions,
            rules: settings.business_verifier_rules,
            govfiles_enabled: settings.govfiles_config?.enabled !== false,
            api_keys: {
              google_maps: googleMapsKey,
              govfiles: govFilesKey,
              search_1: search1Key,
              search_2: search2Key,
            },
            onProgressStep: (stepText) => {
              if (this.currentStatus.current_checks_progress) {
                this.currentStatus.current_checks_progress.push(stepText);
                if (this.currentStatus.current_checks_progress.length > 6) {
                  this.currentStatus.current_checks_progress.shift();
                }
              }
            },
          },
          deduction.deducted
        );

        // Accumulate API counters
        this.currentStatus.api_usage.google_maps_calls += apiUsageCounts.google_maps_calls;
        this.currentStatus.api_usage.search_calls += apiUsageCounts.search_calls;
        this.currentStatus.api_usage.gov_calls += apiUsageCounts.gov_calls;
        this.currentStatus.api_usage.govfiles_calls = (this.currentStatus.api_usage.govfiles_calls || 0) + (apiUsageCounts.govfiles_calls || 0);
        this.currentStatus.api_usage.ai_calls += apiUsageCounts.ai_calls;
        this.currentStatus.api_usage.api_errors += apiUsageCounts.api_errors;
        this.currentStatus.api_usage.fallback_events += apiUsageCounts.fallback_events;

        // Update counts
        this.currentStatus.successful += 1;
        if (result.final_business_status === 'OPEN') this.currentStatus.open_count += 1;
        else if (result.final_business_status === 'TEMPORARILY CLOSED') this.currentStatus.temporarily_closed_count += 1;
        else if (result.final_business_status === 'PERMANENTLY CLOSED') this.currentStatus.permanently_closed_count += 1;
        else this.currentStatus.uncertain_count += 1;

        // Sync into currentJob (WebsiteResult & Contacts) immediately on each business
        if (currentJob) {
          this.applyVerificationToJob(currentJob, target.url, result);
          currentJob.verification_status = { ...this.currentStatus };
          storage.saveJob(currentJob);
        }
      } catch (err: any) {
        console.error(`Verification error for ${target.url}:`, err);
        this.currentStatus.failed += 1;
        // If system error occurs, refund the business credit
        globalCreditManager.refund(deduction.deducted);
        totalDeductedCredits -= deduction.deducted;
        this.currentStatus.credits_used = Math.round(totalDeductedCredits * 10) / 10;
      }

      this.currentStatus.processed = i + 1;
      if (currentJob) {
        currentJob.verification_status = { ...this.currentStatus };
        storage.saveJob(currentJob);
      }
    }

    this.currentStatus.status = 'completed';
    this.currentStatus.completed_at = new Date().toISOString();
    this.currentStatus.current_status_text = `Verification completed. Processed ${this.currentStatus.processed} business(es). Credits used: ${this.currentStatus.credits_used}.`;

    // Record Credit History entry
    if (this.currentStatus.processed > 0) {
      globalCreditManager.recordBatchHistory(
        level,
        this.currentStatus.processed,
        this.currentStatus.credits_used,
        currentJob?.id
      );
    }

    if (currentJob) {
      currentJob.verification_status = { ...this.currentStatus };
      storage.saveJob(currentJob);
    }

    return this.getStatus();
  }

  /**
   * Verifies an individual business (VERIFY NOW)
   */
  public async verifySingle(
    target: VerificationTarget,
    level: VerificationLevel = 'MEDIUM',
    customOptions?: CustomVerificationOptions
  ): Promise<VerificationResult | null> {
    const settings = storage.getSettings();
    const deduction = globalCreditManager.deductForSingleBusiness(level, customOptions);
    if (!deduction.success) {
      throw new Error(`Insufficient verification credits. Needed: ${globalCreditManager.getCostPerBusiness(level, customOptions)}, Available: ${deduction.remaining}`);
    }

    const googleMapsKey = settings.verification_api_config?.find((c) => c.service === 'google_maps' && c.enabled)?.apiKey || process.env.GOOGLE_MAPS_API_KEY;
    const govFilesKey = settings.govfiles_config?.api_key || settings.verification_api_config?.find((c) => c.service === 'govfiles' && c.enabled)?.apiKey || process.env.GOVFILES_API_KEY;
    const search1Key = settings.verification_api_config?.find((c) => c.service === 'search_1' && c.enabled)?.apiKey || process.env.SERPAPI_API_KEY;
    const search2Key = settings.verification_api_config?.find((c) => c.service === 'search_2' && c.enabled)?.apiKey;

    const rawName = target.business_name || target.company_name || '';
    const domainName = (target.url || '').replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].split('.')[0];
    const resolvedName = rawName.trim() || domainName || 'Business';

    try {
      const { result } = await globalVerificationRuleEngine.executeVerificationLadder(
        {
          business_name: resolvedName,
          url: target.url,
          address: target.address,
          phone: target.phone,
          level,
          custom_options: customOptions,
          rules: settings.business_verifier_rules,
          govfiles_enabled: settings.govfiles_config?.enabled !== false,
          api_keys: {
            google_maps: googleMapsKey,
            govfiles: govFilesKey,
            search_1: search1Key,
            search_2: search2Key,
          },
        },
        deduction.deducted
      );

      let currentJob = crawlerEngine.getCurrentJob();
      if (!currentJob) {
        const history = storage.getHistory();
        if (history && history.length > 0) {
          currentJob = storage.getJobById(history[0].id);
          if (currentJob) {
            crawlerEngine.setCurrentJob(currentJob);
          }
        }
      }

      if (currentJob) {
        this.applyVerificationToJob(currentJob, target.url, result);
        storage.saveJob(currentJob);
      }

      globalCreditManager.recordBatchHistory(level, 1, deduction.deducted, currentJob?.id, `Individual verification: ${resolvedName}`);

      return result;
    } catch (err: any) {
      console.error(`Verification error for ${target.url}:`, err);
      globalCreditManager.refund(deduction.deducted);
      throw err;
    }
  }

  /**
   * Applies verification result to the WebsiteResult and all its contacts in the ScrapeJob
   */
  private applyVerificationToJob(job: ScrapeJob, targetUrl: string, result: VerificationResult) {
    const cleanTargetDomain = (targetUrl || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
    const cleanTargetUrl = (targetUrl || '').toLowerCase().trim().replace(/\/$/, '');

    // Find and update WebsiteResult
    let website = job.websites.find((w) => {
      const wCleanUrl = (w.url || '').toLowerCase().trim().replace(/\/$/, '');
      if (wCleanUrl && cleanTargetUrl && wCleanUrl === cleanTargetUrl) return true;
      const wDomain = (w.url || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
      if (cleanTargetDomain && wDomain === cleanTargetDomain) return true;
      if (result.business_name && w.company_name && w.company_name.toLowerCase().trim() === result.business_name.toLowerCase().trim()) return true;
      return false;
    });

    if (!website) {
      // If not present in websites array, add it!
      website = {
        url: targetUrl,
        normalized_url: cleanTargetDomain || targetUrl,
        company_name: result.business_name || cleanTargetDomain,
        status: 'Completed',
        pages_discovered: 1,
        pages_crawled: 1,
        contacts_found: 0,
        emails_found: 0,
        contacts: [],
      };
      job.websites.push(website);
      job.total_websites = job.websites.length;
    }

    // Maintain verification history if previously verified
    if (website.verification && website.verification.final_business_status !== result.final_business_status) {
      const historyEntry = {
        previous_status: website.verification.final_business_status,
        new_status: result.final_business_status,
        verification_date: result.last_verified,
        evidence: result.status_evidence,
        verification_level: result.verification_level,
        credits_used: result.credits_used,
      };
      result.history = [...(website.verification.history || []), historyEntry];
    } else if (website.verification?.history) {
      result.history = website.verification.history;
    }

    website.verification = result;

    // Also enrich all associated contacts in the job
    for (const contact of job.contacts) {
      const cDomain = (contact.website || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      if (cDomain === cleanTargetDomain || (website && contact.company_name === website.company_name)) {
        contact.google_maps_found = result.google_maps_found;
        contact.google_maps_status = result.google_maps_status;
        contact.google_maps_match = result.google_maps_match;
        contact.google_maps_url = result.google_maps_url;
        contact.google_maps_business_name = result.google_maps_business_name;
        contact.google_maps_address = result.google_maps_address;
        contact.google_maps_phone = result.google_maps_phone;
        contact.google_maps_website = result.google_maps_website;
        contact.search_verification = result.search_verification;
        contact.search_evidence = result.search_evidence;
        contact.website_status = result.website_status;
        contact.website_http_status = result.website_http_status;
        contact.website_last_modified = result.website_last_modified;
        contact.latest_website_content_date = result.latest_website_content_date;
        contact.website_date_source = result.website_date_source;
        contact.website_activity_evidence = result.website_activity_evidence;
        contact.latest_review_date = result.latest_review_date;
        contact.latest_activity_date = result.latest_activity_date;
        contact.activity_evidence = result.activity_evidence;
        contact.government_entity_found = result.government_entity_found;
        contact.government_legal_name = result.government_legal_name;
        contact.government_entity_name = result.government_entity_name;
        contact.government_entity_id = result.government_entity_id;
        contact.government_entity_type = result.government_entity_type;
        contact.government_entity_status = result.government_entity_status;
        contact.government_source = result.government_source;
        contact.government_last_filing_date = result.government_last_filing_date;
        contact.government_verification_date = result.government_verification_date;
        contact.final_business_status = result.final_business_status;
        contact.status_confidence = result.status_confidence;
        contact.status_evidence = result.status_evidence;
        contact.status_sources = result.status_sources;
        contact.verification_trace = result.verification_trace;
        contact.last_verified = result.last_verified;
        contact.next_verification_date = result.next_verification_date;
        contact.verification_level = result.verification_level;
        contact.credits_used = result.credits_used;
        contact.lead_eligibility = result.lead_eligibility;
      }
    }
  }
}

export const globalVerifierEngine = new BusinessVerifierEngine();
