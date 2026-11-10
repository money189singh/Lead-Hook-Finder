import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, isFirestorePermissionDeniedError, OperationType } from './firestoreErrors';
import { ScrapeSettings, HistoryItem, ScrapeJob, EmailVerificationResult } from '../types';

export const firestoreService = {
  /**
   * Save user settings to Firestore under users/{userId}/settings/current
   */
  async saveUserSettings(userId: string, settings: Partial<ScrapeSettings>): Promise<void> {
    if (!userId) return;
    const path = `users/${userId}/settings/current`;
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'current');
      // Strip undefined and prepare safe object
      const safeData: Record<string, any> = {
        userId,
        updatedAt: new Date().toISOString(),
      };

      if (settings.max_pages !== undefined) safeData.max_pages = settings.max_pages;
      if (settings.max_contacts !== undefined) safeData.max_contacts = settings.max_contacts;
      if (settings.smart_discovery !== undefined) safeData.smart_discovery = settings.smart_discovery;
      if (settings.concurrency !== undefined) safeData.concurrency = settings.concurrency;
      if (settings.request_delay_ms !== undefined) safeData.request_delay_ms = settings.request_delay_ms;
      if (settings.timeout_ms !== undefined) safeData.timeout_ms = settings.timeout_ms;
      if (settings.retry_count !== undefined) safeData.retry_count = settings.retry_count;
      if (settings.routing_strategy !== undefined) safeData.routing_strategy = settings.routing_strategy;
      if (settings.theme !== undefined) safeData.theme = settings.theme;
      if (settings.ai_agent_rules !== undefined) safeData.ai_agent_rules = settings.ai_agent_rules;
      if (settings.custom_rules !== undefined) safeData.custom_rules = settings.custom_rules;
      if (settings.priority_roles !== undefined) {
        safeData.priority_roles = JSON.stringify(settings.priority_roles);
      }
      if (settings.generic_email_patterns !== undefined) {
        safeData.generic_email_patterns = JSON.stringify(settings.generic_email_patterns);
      }

      await setDoc(docRef, safeData, { merge: true });
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      console.warn(`[Firestore] Offline or network error saving settings at ${path}:`, err?.message || err);
    }
  },

  /**
   * Load user settings from Firestore under users/{userId}/settings/current
   */
  async getUserSettings(userId: string): Promise<Partial<ScrapeSettings> | null> {
    if (!userId) return null;
    const path = `users/${userId}/settings/current`;
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'current');
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      const data = snap.data();
      const partialSettings: Partial<ScrapeSettings> = {};

      if (data.max_pages !== undefined) partialSettings.max_pages = data.max_pages;
      if (data.max_contacts !== undefined) partialSettings.max_contacts = data.max_contacts;
      if (data.smart_discovery !== undefined) partialSettings.smart_discovery = data.smart_discovery;
      if (data.concurrency !== undefined) partialSettings.concurrency = data.concurrency;
      if (data.request_delay_ms !== undefined) partialSettings.request_delay_ms = data.request_delay_ms;
      if (data.timeout_ms !== undefined) partialSettings.timeout_ms = data.timeout_ms;
      if (data.retry_count !== undefined) partialSettings.retry_count = data.retry_count;
      if (data.routing_strategy !== undefined) partialSettings.routing_strategy = data.routing_strategy;
      if (data.theme !== undefined) partialSettings.theme = data.theme;
      if (data.ai_agent_rules !== undefined) partialSettings.ai_agent_rules = data.ai_agent_rules;
      if (data.custom_rules !== undefined) partialSettings.custom_rules = data.custom_rules;
      if (data.priority_roles) {
        try {
          partialSettings.priority_roles = JSON.parse(data.priority_roles);
        } catch {}
      }
      if (data.generic_email_patterns) {
        try {
          partialSettings.generic_email_patterns = JSON.parse(data.generic_email_patterns);
        } catch {}
      }

      return partialSettings;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, path);
      }
      console.warn(`[Firestore] Offline or network error getting settings at ${path}:`, err?.message || err);
      return null;
    }
  },

  /**
   * Save completed or updated scraping job to Firestore under users/{userId}/scrapeJobs/{jobId}
   */
  async saveUserScrapeJob(userId: string, job: ScrapeJob): Promise<void> {
    if (!userId || !job || !job.id) return;
    const path = `users/${userId}/scrapeJobs/${job.id}`;
    try {
      const jobDocRef = doc(db, 'users', userId, 'scrapeJobs', job.id);

      // Serialize summary and payload for persistent storage
      const websitesSummary = (job.websites || []).map((w) => {
        const empCount = (w.firmographics?.employee_count && w.firmographics.employee_count !== '0')
          ? w.firmographics.employee_count
          : (w.employee_count && w.employee_count !== '0' ? w.employee_count : null);
        const empRange = w.firmographics?.employee_range || w.firmographics?.employee_tier || w.employee_range || null;
        const founded = (w.firmographics?.founded_year && w.firmographics.founded_year !== '0')
          ? w.firmographics.founded_year
          : (w.founded_year && w.founded_year !== '0' ? w.founded_year : null);
        const empSource = w.firmographics?.employee_count_source_url || w.employee_count_source_url || null;
        const foundedSource = w.firmographics?.founded_year_source_url || w.founded_year_source_url || null;
        const confidence = w.firmographics?.confidence || w.confidence || (empCount || founded ? 'verified' : null);
        const lastChecked = w.firmographics?.last_checked_date || w.last_checked_date || new Date().toISOString();

        return {
          domain: w.normalized_url,
          company: w.company_name,
          status: w.status,
          contacts: w.contacts_found,
          employee_count: empCount,
          employee_range: empRange,
          founded_year: founded,
          employee_count_source_url: empSource,
          founded_year_source_url: foundedSource,
          confidence,
          last_checked_date: lastChecked,
        };
      });

      // Store websites and contacts as JSON strings safely within Firestore size boundary
      const websitesJson = JSON.stringify(job.websites || []);
      const contactsJson = JSON.stringify(job.contacts || []);

      const jobRecord = {
        id: job.id,
        userId,
        date: new Date(job.created_at || Date.now()).toLocaleString(),
        created_at: job.created_at || new Date().toISOString(),
        status: job.status,
        total_websites: job.total_websites || 0,
        completed_websites: job.completed_websites || 0,
        failed_websites: job.failed_websites || 0,
        contacts_found: job.contacts_found || (job.contacts ? job.contacts.length : 0),
        emails_found: job.emails_found || 0,
        websites_summary: JSON.stringify(websitesSummary),
        websites_json: websitesJson,
        contacts_json: contactsJson,
      };

      await setDoc(jobDocRef, jobRecord);

      // Persist individual company documents to users/{userId}/companies/{companyId}
      if (job.websites && job.websites.length > 0) {
        for (const w of job.websites) {
          await this.saveUserCompany(userId, w);
        }
      }
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      console.warn(`[Firestore] Offline or network error saving job at ${path}:`, err?.message || err);
    }
  },

  /**
   * Save or merge individual company document with firmographics, employee count, and founded year
   * Ensures reliable values are not overwritten with empty or zero values.
   */
  async saveUserCompany(userId: string, company: Record<string, any>): Promise<void> {
    if (!userId || !company) return;
    const rawDomain = company.normalized_url || company.domain || company.url || '';
    const cleanDomain = rawDomain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase().trim();
    if (!cleanDomain) return;

    const companyId = cleanDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `users/${userId}/companies/${companyId}`;
    try {
      const companyDocRef = doc(db, 'users', userId, 'companies', companyId);
      const existingSnap = await getDoc(companyDocRef);
      const existing = existingSnap.exists() ? existingSnap.data() : null;

      // Extract candidate values
      const newEmpCount = company.firmographics?.employee_count || company.employee_count;
      const newEmpRange = company.firmographics?.employee_range || company.firmographics?.employee_tier || company.employee_range;
      const newFoundedYear = company.firmographics?.founded_year || company.founded_year;
      const newEmpSource = company.firmographics?.employee_count_source_url || company.employee_count_source_url;
      const newFoundedSource = company.firmographics?.founded_year_source_url || company.founded_year_source_url;
      const newConfidence = company.firmographics?.confidence || company.confidence;
      const newIndustry = company.firmographics?.industry || company.industry;
      const newLocation = company.firmographics?.location || company.firmographics?.headquarters || company.location;

      // Preserve existing reliable values if new is empty/zero/weaker
      const finalEmpCount = (newEmpCount && newEmpCount !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(String(newEmpCount)))
        ? String(newEmpCount)
        : (existing?.employee_count || undefined);

      const finalEmpRange = (newEmpRange && !/^(unknown|not found|none|n\/a)$/i.test(String(newEmpRange)))
        ? String(newEmpRange)
        : (existing?.employee_range || undefined);

      const finalFoundedYear = (newFoundedYear && newFoundedYear !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(String(newFoundedYear)))
        ? String(newFoundedYear)
        : (existing?.founded_year || undefined);

      const finalEmpSource = (newEmpCount && newEmpCount !== '0')
        ? newEmpSource
        : (existing?.employee_count_source_url || undefined);

      const finalFoundedSource = (newFoundedYear && newFoundedYear !== '0')
        ? newFoundedSource
        : (existing?.founded_year_source_url || undefined);

      const finalConfidence = (newEmpCount || newFoundedYear)
        ? (newConfidence || 'verified')
        : (existing?.confidence || undefined);

      const record: Record<string, any> = {
        id: companyId,
        userId,
        domain: cleanDomain,
        url: company.url || (cleanDomain ? `https://${cleanDomain}` : ''),
        company_name: company.company_name || cleanDomain,
        updatedAt: new Date().toISOString(),
      };

      if (finalEmpCount) record.employee_count = finalEmpCount;
      if (finalEmpRange) record.employee_range = finalEmpRange;
      if (finalFoundedYear) record.founded_year = finalFoundedYear;
      if (finalEmpSource) record.employee_count_source_url = finalEmpSource;
      if (finalFoundedSource) record.founded_year_source_url = finalFoundedSource;
      if (finalConfidence) record.confidence = finalConfidence;
      if (newIndustry || existing?.industry) record.industry = newIndustry || existing?.industry;
      if (newLocation || existing?.location) record.location = newLocation || existing?.location;
      record.last_checked_date = company.firmographics?.last_checked_date || company.last_checked_date || new Date().toISOString();

      // Research fields enrichment
      if (company.company_description || existing?.company_description) {
        record.company_description = company.company_description || existing?.company_description;
      }
      if (company.products_services || existing?.products_services) {
        record.products_services = company.products_services || existing?.products_services;
      }
      if (company.business_category || existing?.business_category) {
        record.business_category = company.business_category || existing?.business_category;
      }
      if (company.linkedin_url || existing?.linkedin_url) {
        record.linkedin_url = company.linkedin_url || existing?.linkedin_url;
      }
      if (company.incorporation_year || existing?.incorporation_year) {
        record.incorporation_year = company.incorporation_year || existing?.incorporation_year;
      }
      if (company.decision_makers_json || existing?.decision_makers_json) {
        record.decision_makers_json = company.decision_makers_json || existing?.decision_makers_json;
      }
      if (company.research_sources_json || existing?.research_sources_json) {
        record.research_sources_json = company.research_sources_json || existing?.research_sources_json;
      }
      if (company.research_last_run || existing?.research_last_run) {
        record.research_last_run = company.research_last_run || existing?.research_last_run;
      }
      if (company.research_status || existing?.research_status) {
        record.research_status = company.research_status || existing?.research_status;
      }

      await setDoc(companyDocRef, record, { merge: true });
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      console.warn(`[Firestore] Offline or network error saving company at ${path}:`, err?.message || err);
    }
  },

  /**
   * Get all company records saved for this user in Firestore
   */
  async getUserCompanies(userId: string): Promise<Record<string, any>[]> {
    if (!userId) return [];
    const path = `users/${userId}/companies`;
    try {
      const col = collection(db, 'users', userId, 'companies');
      const q = query(col, limit(100));
      const snap = await getDocs(q);
      const list: Record<string, any>[] = [];
      snap.forEach((d) => {
        list.push(d.data());
      });
      return list;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
      console.warn(`[Firestore] Error fetching user companies at ${path}:`, err?.message || err);
      return [];
    }
  },

  /**
   * Get single company record for user
   */
  async getUserCompany(userId: string, domainOrId: string): Promise<Record<string, any> | null> {
    if (!userId || !domainOrId) return null;
    const cleanDomain = domainOrId.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase().trim();
    const companyId = cleanDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `users/${userId}/companies/${companyId}`;
    try {
      const docRef = doc(db, 'users', userId, 'companies', companyId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, path);
      }
      return null;
    }
  },

  /**
   * Get all scraping history records for this user from Firestore
   */
  async getUserScrapeHistory(userId: string): Promise<HistoryItem[]> {
    if (!userId) return [];
    const path = `users/${userId}/scrapeJobs`;
    try {
      const jobsCol = collection(db, 'users', userId, 'scrapeJobs');
      const q = query(jobsCol, orderBy('created_at', 'desc'), limit(50));
      const snap = await getDocs(q);

      const items: HistoryItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        let summary: any[] = [];
        if (data.websites_summary) {
          try {
            summary = JSON.parse(data.websites_summary);
          } catch {}
        }

        items.push({
          id: data.id || d.id,
          date: data.date || new Date(data.created_at || Date.now()).toLocaleString(),
          total_websites: data.total_websites || 0,
          completed_websites: data.completed_websites || 0,
          failed_websites: data.failed_websites || 0,
          contacts_found: data.contacts_found || 0,
          emails_found: data.emails_found || 0,
          websites_summary: summary,
        });
      });

      return items;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
      console.warn(`[Firestore] Offline or network error listing scrape jobs at ${path}:`, err?.message || err);
      return [];
    }
  },

  /**
   * Get single job by ID with full website and contacts lists
   */
  async getUserJobById(userId: string, jobId: string): Promise<ScrapeJob | null> {
    if (!userId || !jobId) return null;
    const path = `users/${userId}/scrapeJobs/${jobId}`;
    try {
      const jobDocRef = doc(db, 'users', userId, 'scrapeJobs', jobId);
      const snap = await getDoc(jobDocRef);
      if (!snap.exists()) return null;

      const data = snap.data();
      let websites = [];
      let contacts = [];

      if (data.websites_json) {
        try {
          const rawWebsites = JSON.parse(data.websites_json);
          websites = (rawWebsites || []).map((w: any) => {
            const empCount = (w.firmographics?.employee_count && w.firmographics.employee_count !== '0')
              ? w.firmographics.employee_count
              : (w.employee_count && w.employee_count !== '0' ? w.employee_count : undefined);
            const empRange = w.firmographics?.employee_range || w.firmographics?.employee_tier || w.employee_range || undefined;
            const founded = (w.firmographics?.founded_year && w.firmographics.founded_year !== '0')
              ? w.firmographics.founded_year
              : (w.founded_year && w.founded_year !== '0' ? w.founded_year : undefined);

            const firmo = w.firmographics || {};
            firmo.employee_count = empCount;
            firmo.employee_range = empRange;
            firmo.employee_tier = firmo.employee_tier || empRange;
            firmo.founded_year = founded;
            firmo.last_checked_date = firmo.last_checked_date || w.last_checked_date || data.created_at;

            return {
              ...w,
              employee_count: empCount,
              employee_range: empRange,
              founded_year: founded,
              firmographics: firmo,
            };
          });
        } catch {}
      }
      if (data.contacts_json) {
        try {
          contacts = JSON.parse(data.contacts_json);
        } catch {}
      }

      const job: ScrapeJob = {
        id: data.id,
        created_at: data.created_at,
        status: data.status || 'completed',
        total_websites: data.total_websites || 0,
        completed_websites: data.completed_websites || 0,
        processing_websites: 0,
        failed_websites: data.failed_websites || 0,
        contacts_found: data.contacts_found || 0,
        emails_found: data.emails_found || 0,
        pages_discovered: 0,
        pages_crawled: 0,
        websites,
        contacts,
        logs: [],
      };

      return job;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, path);
      }
      console.warn(`[Firestore] Offline or network error getting job at ${path}:`, err?.message || err);
      return null;
    }
  },

  /**
   * Delete a job from user's history in Firestore
   */
  async deleteUserJob(userId: string, jobId: string): Promise<void> {
    if (!userId || !jobId) return;
    const path = `users/${userId}/scrapeJobs/${jobId}`;
    try {
      const jobDocRef = doc(db, 'users', userId, 'scrapeJobs', jobId);
      await deleteDoc(jobDocRef);
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
      console.warn(`[Firestore] Offline or network error deleting job at ${path}:`, err?.message || err);
    }
  },

  /**
   * Save discovery job to Firestore
   */
  async saveUserDiscoveryJob(userId: string, job: any): Promise<void> {
    if (!userId || !job || !job.id) return;
    const path = `users/${userId}/discoveryJobs/${job.id}`;
    try {
      const docRef = doc(db, 'users', userId, 'discoveryJobs', job.id);
      const record = {
        id: job.id,
        userId,
        status: job.status,
        created_at: job.created_at || new Date().toISOString(),
        uniqueCompanies: job.uniqueCompanies || 0,
        emailsFound: job.emailsFound || 0,
        peopleFound: job.peopleFound || 0,
        criteria_json: JSON.stringify(job.criteria || {}),
        prospects_json: JSON.stringify(job.prospects || []),
      };
      await setDoc(docRef, record);
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      console.warn(`[Firestore] Offline or network error saving discovery job at ${path}:`, err?.message || err);
    }
  },

  /**
   * Get discovery jobs from Firestore
   */
  async getUserDiscoveryJobs(userId: string): Promise<any[]> {
    if (!userId) return [];
    const path = `users/${userId}/discoveryJobs`;
    try {
      const col = collection(db, 'users', userId, 'discoveryJobs');
      const q = query(col, orderBy('created_at', 'desc'), limit(50));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: data.id || d.id,
          userId: data.userId,
          status: data.status,
          created_at: data.created_at,
          uniqueCompanies: data.uniqueCompanies || 0,
          emailsFound: data.emailsFound || 0,
          peopleFound: data.peopleFound || 0,
          criteria: data.criteria_json ? JSON.parse(data.criteria_json) : {},
          prospects: data.prospects_json ? JSON.parse(data.prospects_json) : [],
        });
      });
      return list;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
      console.warn(`[Firestore] Offline or network error listing discovery jobs at ${path}:`, err?.message || err);
      return [];
    }
  },

  /**
   * Save or update an email verification record in Firestore
   * users/{userId}/verifiedEmails/{emailId}
   */
  async saveUserVerifiedEmail(userId: string, record: EmailVerificationResult): Promise<void> {
    if (!userId || !record || !record.normalized_email) return;

    // Stable safe document ID: clean normalized email + optional company ID
    const base = `${record.normalized_email}_${record.company_id || 'global'}`;
    const emailId = base.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 120);
    const path = `users/${userId}/verifiedEmails/${emailId}`;

    try {
      const docRef = doc(db, 'users', userId, 'verifiedEmails', emailId);
      const safeRecord: Record<string, any> = {
        id: emailId,
        userId,
        email: record.email,
        normalized_email: record.normalized_email,
        email_category: record.email_category || 'unknown',
        verification_status: record.verification_status,
        syntax_status: record.syntax_status,
        domain_status: record.domain_status,
        mx_status: record.mx_status,
        disposable_status: record.disposable_status,
        smtp_status: record.smtp_status,
        verification_provider: 'self_hosted',
        verified_at: record.verified_at || new Date().toISOString(),
        last_checked_at: record.last_checked_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (record.company_id) safeRecord.company_id = record.company_id;
      if (record.company_name) safeRecord.company_name = record.company_name;
      if (record.source_url) safeRecord.source_url = record.source_url;
      if (record.verification_error) safeRecord.verification_error = record.verification_error.substring(0, 1024);
      if (record.verification_details) {
        safeRecord.verification_details = JSON.stringify(record.verification_details);
      }

      await setDoc(docRef, safeRecord, { merge: true });
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      console.warn(`[Firestore] Error saving verified email at ${path}:`, err?.message || err);
    }
  },

  /**
   * Batch save email verification records in Firestore
   */
  async batchSaveUserVerifiedEmails(userId: string, records: EmailVerificationResult[]): Promise<void> {
    if (!userId || !records || records.length === 0) return;
    for (const rec of records) {
      await this.saveUserVerifiedEmail(userId, rec);
    }
  },

  /**
   * Fetch all cached verified emails for user from Firestore
   */
  async getUserVerifiedEmails(userId: string): Promise<Record<string, EmailVerificationResult>> {
    if (!userId) return {};
    const path = `users/${userId}/verifiedEmails`;
    try {
      const col = collection(db, 'users', userId, 'verifiedEmails');
      const q = query(col, limit(500));
      const snap = await getDocs(q);
      const map: Record<string, EmailVerificationResult> = {};

      snap.forEach((d) => {
        const data = d.data();
        let details = undefined;
        if (data.verification_details) {
          try {
            details = JSON.parse(data.verification_details);
          } catch {}
        }

        const res: EmailVerificationResult = {
          email: data.email,
          normalized_email: data.normalized_email || (data.email || '').toLowerCase().trim(),
          company_id: data.company_id,
          company_name: data.company_name,
          source_url: data.source_url,
          email_category: data.email_category || 'unknown',
          verification_status: data.verification_status || 'Unknown',
          syntax_status: data.syntax_status || 'valid',
          domain_status: data.domain_status || 'valid',
          mx_status: data.mx_status || 'valid',
          disposable_status: data.disposable_status || 'clean',
          smtp_status: data.smtp_status || 'skipped',
          verification_provider: 'self_hosted',
          verified_at: data.verified_at || data.updatedAt || new Date().toISOString(),
          last_checked_at: data.last_checked_at || data.updatedAt || new Date().toISOString(),
          verification_error: data.verification_error,
          verification_details: details,
        };

        map[res.normalized_email] = res;
      });

      return map;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
      console.warn(`[Firestore] Error loading verified emails at ${path}:`, err?.message || err);
      return {};
    }
  },
};
