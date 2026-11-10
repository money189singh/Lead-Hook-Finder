import fs from 'fs';
import path from 'path';
import {
  DiscoveredProspect,
  CompanyActivityItem,
  EnrichmentWorkflowStatus,
  DiscoveryWorkflowStatus,
  ActivityWorkflowStatus,
  Contact,
  ScrapeSettings,
} from '../../src/types';
import { extractCleanDomain } from '../discovery/domainDetector';
import { globalFirebaseCompanyMerger } from '../research/firebaseMerger';
import { getSettings } from '../storage';
import { crawlerEngine } from '../crawler';

export interface CompanyWorkflowRecord {
  id: string; // companyId
  domain: string;
  url: string;
  company_name: string;
  location?: string;
  industry?: string;
  userId?: string;

  // Workflow statuses
  discovery_status: DiscoveryWorkflowStatus;
  activity_status: ActivityWorkflowStatus;
  enrichment_status: EnrichmentWorkflowStatus;

  last_discovery_date?: string;
  last_activity_date?: string;
  last_enrichment_date?: string;

  // Evidence
  recent_activity?: CompanyActivityItem[];
  discovery_sources?: string[];
  verification_status?: string;
  verification_evidence?: string;

  // Enriched website details (from Website Scraper)
  employee_count?: string;
  employee_range?: string;
  employee_count_source_url?: string;
  founded_year?: string;
  founded_year_source_url?: string;
  generic_emails?: string[];
  departmental_emails?: string[];
  contacts?: Contact[];
  contacts_count?: number;
  emails_count?: number;

  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const COMPANIES_DIR = path.join(DATA_DIR, 'companies');
const CACHE_DIR = path.join(DATA_DIR, 'freshness_cache');

export class JobCoordinator {
  // In-memory active jobs tracking: domain -> status
  private activeDiscoveryJobs: Set<string> = new Set();
  private activeEnrichmentJobs: Map<string, { startedAt: number; status: 'queued' | 'running' }> = new Map();

  constructor() {
    this.ensureDirs();
  }

  private ensureDirs(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(COMPANIES_DIR)) fs.mkdirSync(COMPANIES_DIR, { recursive: true });
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch (e) {
      console.warn('Could not create coordination dirs:', e);
    }
  }

  /**
   * Normalizes company domain as primary deduplication key.
   * Strips protocol, leading 'www.', path, port, tracking parameters, and trailing slashes.
   */
  public normalizeDomain(input: string): string {
    if (!input) return '';
    let clean = input.trim().toLowerCase();

    // Remove protocol
    clean = clean.replace(/^https?:\/\//i, '');
    // Remove port if any
    clean = clean.replace(/:\d+$/, '');
    // Remove path and query parameters
    clean = clean.split('/')[0].split('?')[0].split('#')[0];
    // Remove leading 'www.'
    clean = clean.replace(/^www\./i, '');
    // Remove trailing dots
    clean = clean.replace(/\.+$/, '');

    return extractCleanDomain(clean) || clean;
  }

  /**
   * Generates a safe company record ID from normalized domain or name
   */
  public getCompanyId(domainOrName: string): string {
    const domain = this.normalizeDomain(domainOrName);
    const base = domain || domainOrName.toLowerCase().trim();
    return base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  /**
   * Checks whether an enrichment job for this domain is currently queued or running
   */
  public isEnrichmentActive(domain: string): boolean {
    const norm = this.normalizeDomain(domain);
    return this.activeEnrichmentJobs.has(norm);
  }

  /**
   * Checks whether discovery is currently actively searching this domain
   */
  public isDiscoveryActive(domain: string): boolean {
    const norm = this.normalizeDomain(domain);
    return this.activeDiscoveryJobs.has(norm);
  }

  /**
   * Marks discovery active or finished for domain
   */
  public setDiscoveryActive(domain: string, active: boolean): void {
    const norm = this.normalizeDomain(domain);
    if (!norm) return;
    if (active) {
      this.activeDiscoveryJobs.add(norm);
    } else {
      this.activeDiscoveryJobs.delete(norm);
    }
  }

  /**
   * Reads existing company record from local disk or Firestore
   */
  public getCompanyRecord(domainOrId: string): CompanyWorkflowRecord | null {
    const companyId = this.getCompanyId(domainOrId);
    try {
      const filePath = path.join(COMPANIES_DIR, `${companyId}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e: any) {
      console.warn(`[JobCoordinator] Error reading company ${companyId}:`, e.message);
    }
    return null;
  }

  /**
   * Saves or updates company workflow record into local cache and Firestore
   */
  public async saveCompanyRecord(
    record: Partial<CompanyWorkflowRecord> & { domain: string; company_name: string },
    userId?: string
  ): Promise<CompanyWorkflowRecord> {
    const domain = this.normalizeDomain(record.domain);
    const companyId = this.getCompanyId(domain || record.company_name);
    const existing = this.getCompanyRecord(domain) || ({} as any);

    const now = new Date().toISOString();

    const merged: CompanyWorkflowRecord = {
      ...existing,
      ...record,
      id: companyId,
      domain: domain || existing.domain,
      url: record.url || existing.url || (domain ? `https://${domain}` : ''),
      company_name: record.company_name || existing.company_name || domain,
      userId: userId || record.userId || existing.userId,
      discovery_status: record.discovery_status || existing.discovery_status || 'discovered',
      activity_status: record.activity_status || existing.activity_status || 'completed',
      enrichment_status: record.enrichment_status || existing.enrichment_status || 'pending',
      last_discovery_date: record.last_discovery_date || existing.last_discovery_date || now,
      last_activity_date: record.last_activity_date || existing.last_activity_date || now,
      last_enrichment_date: record.last_enrichment_date || existing.last_enrichment_date,
      updatedAt: now,
    };

    // Merge recent activities avoiding duplicates
    if (record.recent_activity && record.recent_activity.length > 0) {
      const existingActs: CompanyActivityItem[] = existing.recent_activity || [];
      const seenTitles = new Set(existingActs.map((a) => a.title.toLowerCase()));
      const combined = [...existingActs];
      for (const act of record.recent_activity) {
        if (!seenTitles.has(act.title.toLowerCase())) {
          combined.push(act);
          seenTitles.add(act.title.toLowerCase());
        }
      }
      merged.recent_activity = combined.slice(0, 15);
    }

    // Persist to local JSON file
    try {
      this.ensureDirs();
      const filePath = path.join(COMPANIES_DIR, `${companyId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn(`[JobCoordinator] Error saving local company ${companyId}:`, e.message);
    }

    // Persist to Firestore via REST if Firebase configured
    try {
      const firestoreData: Record<string, any> = {
        ...merged,
        recent_activity_json: merged.recent_activity ? JSON.stringify(merged.recent_activity) : undefined,
        contacts_json: merged.contacts ? JSON.stringify(merged.contacts.slice(0, 20)) : undefined,
      };
      await globalFirebaseCompanyMerger.persistMergedCompany(firestoreData, merged.userId);
    } catch (e: any) {
      console.warn(`[JobCoordinator] Firestore sync notice for ${companyId}:`, e.message);
    }

    return merged;
  }

  /**
   * Freshness checks:
   * Returns true if last discovery date is within configured freshness window
   */
  public isDiscoveryFresh(company: CompanyWorkflowRecord | null, freshnessDays?: number): boolean {
    if (!company || !company.last_discovery_date) return false;
    const settings = getSettings();
    const days = freshnessDays ?? settings.discovery_freshness_days ?? 7;
    const date = new Date(company.last_discovery_date).getTime();
    return Date.now() - date < days * 24 * 60 * 60 * 1000;
  }

  /**
   * Returns true if last website crawl / enrichment is completed and within freshness window
   */
  public isEnrichmentFresh(company: CompanyWorkflowRecord | null, freshnessDays?: number): boolean {
    if (!company || !company.last_enrichment_date || company.enrichment_status !== 'completed') {
      return false;
    }
    const settings = getSettings();
    const days = freshnessDays ?? settings.enrichment_freshness_days ?? 30;
    const date = new Date(company.last_enrichment_date).getTime();
    return Date.now() - date < days * 24 * 60 * 60 * 1000;
  }

  /**
   * Workflow A: Handles Discovered Company & Activity Evidence.
   * Saves company identity and recent activity immediately without launching crawler.
   * Checks if enrichment exists/fresh, and optionally queues website scraper.
   */
  public async handleDiscoveryResult(
    candidate: {
      companyName: string;
      website?: string;
      domain?: string;
      location?: string;
      country?: string;
      state?: string;
      city?: string;
      industry?: string;
      description?: string;
      employeeCount?: string;
      revenue?: string;
      sourceUrl: string;
      sourceTitle: string;
      sourceType?: 'directory' | 'article' | 'search_result' | 'direct_website';
      sourceUrls?: string[];
      verificationStatus: 'Verified company' | 'Company found, website unverified' | 'Needs review' | 'Rejected: not a company';
      verificationEvidence?: string;
      confidence?: 'High' | 'Medium' | 'Low';
      recentActivity?: CompanyActivityItem[];
    },
    userId?: string
  ): Promise<{ prospect: DiscoveredProspect; reusedEnrichment: boolean; enqueuedEnrichment: boolean }> {
    const domain = this.normalizeDomain(candidate.domain || candidate.website || '');
    const now = new Date().toISOString();

    // Check if company record already exists
    const existing = domain ? this.getCompanyRecord(domain) : null;
    const isEnrichmentCurrent = this.isEnrichmentFresh(existing);

    // Save/update company identity and activity evidence immediately
    const updatedRecord = await this.saveCompanyRecord(
      {
        domain,
        url: candidate.website || (domain ? `https://${domain}` : ''),
        company_name: candidate.companyName,
        location: candidate.location || [candidate.city, candidate.state, candidate.country].filter(Boolean).join(', '),
        industry: candidate.industry,
        userId,
        discovery_status: 'discovered',
        activity_status: candidate.recentActivity && candidate.recentActivity.length > 0 ? 'completed' : 'pending',
        last_discovery_date: now,
        last_activity_date: now,
        recent_activity: candidate.recentActivity,
        verification_status: candidate.verificationStatus,
        verification_evidence: candidate.verificationEvidence,
        // Preserve enrichment status if already completed
        enrichment_status: isEnrichmentCurrent ? 'completed' : (existing?.enrichment_status || 'pending'),
      },
      userId
    );

    // Build the prospect record
    const prospect: DiscoveredProspect = {
      id: `disc_${domain || Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      companyName: updatedRecord.company_name,
      website: updatedRecord.url,
      domain: updatedRecord.domain,
      location: updatedRecord.location,
      country: candidate.country,
      state: candidate.state,
      city: candidate.city,
      industry: updatedRecord.industry,
      description: candidate.description,
      employeeCount: candidate.employeeCount || updatedRecord.employee_count,
      revenue: candidate.revenue,
      sourceUrl: candidate.sourceUrl,
      sourceTitle: candidate.sourceTitle,
      sourceType: candidate.sourceType || 'search_result',
      sourceUrls: candidate.sourceUrls || [candidate.sourceUrl],
      verificationStatus: candidate.verificationStatus,
      verificationEvidence: candidate.verificationEvidence,
      discoveredBy: 'ai_web_discovery',
      discoveredAt: updatedRecord.last_discovery_date || now,
      lastCheckedAt: now,
      confidence: candidate.confidence || (candidate.verificationStatus === 'Verified company' ? 'High' : 'Medium'),

      // Activity evidence
      recentActivity: updatedRecord.recent_activity || candidate.recentActivity || [],
      enrichmentStatus: updatedRecord.enrichment_status,
      lastDiscoveryDate: updatedRecord.last_discovery_date,
      lastEnrichmentDate: updatedRecord.last_enrichment_date,
    };

    let reusedEnrichment = false;
    let enqueuedEnrichment = false;

    // Reuse existing website enrichment if already fresh
    if (isEnrichmentCurrent && existing) {
      reusedEnrichment = true;
      prospect.crawlStatus = 'completed';
      prospect.enrichmentStatus = 'completed';
      prospect.employeeCount = existing.employee_count || prospect.employeeCount;

      if (existing.contacts && existing.contacts.length > 0) {
        prospect.rawContacts = existing.contacts;
        const primeContact = existing.contacts.find((c) => c.is_decision_maker || c.email) || existing.contacts[0];
        if (primeContact) {
          prospect.personName = primeContact.full_name;
          prospect.jobTitle = primeContact.role;
          prospect.email = primeContact.email;
          prospect.emailType = primeContact.email_type;
          prospect.phone = primeContact.phone;
          prospect.linkedinUrl = primeContact.linkedin_url;
        }
      }
    } else {
      prospect.crawlStatus = 'pending';
      prospect.enrichmentStatus = 'pending';

      // One-way handoff: if website enrichment is missing/stale and auto-enqueue is enabled, enqueue one job
      const settings = getSettings();
      if (
        settings.auto_enqueue_enrichment !== false &&
        candidate.verificationStatus === 'Verified company' &&
        domain &&
        !this.isEnrichmentActive(domain)
      ) {
        enqueuedEnrichment = true;
        this.enqueueWebsiteScraperJob(domain, prospect.website, userId).catch((err) => {
          console.warn(`[JobCoordinator] Background enrichment error for ${domain}:`, err.message);
        });
        prospect.enrichmentStatus = 'queued';
      }
    }

    return { prospect, reusedEnrichment, enqueuedEnrichment };
  }

  /**
   * Workflow B: Enqueues ONE scraper job for a company's confirmed official website.
   * Performs website crawling, extracts contacts, emails, employee counts, founding year,
   * updates the SAME company record, and marks enrichment completed.
   */
  public async enqueueWebsiteScraperJob(
    domain: string,
    websiteUrl: string,
    userId?: string,
    maxPages = 3
  ): Promise<CompanyWorkflowRecord | null> {
    const cleanDom = this.normalizeDomain(domain);
    if (!cleanDom) return null;

    // Prevent duplicate active jobs for the same company
    if (this.activeEnrichmentJobs.has(cleanDom)) {
      console.log(`[JobCoordinator] Enrichment job already running or queued for ${cleanDom}`);
      return this.getCompanyRecord(cleanDom);
    }

    this.activeEnrichmentJobs.set(cleanDom, { startedAt: Date.now(), status: 'queued' });

    // Update company status to 'queued'
    await this.saveCompanyRecord(
      {
        domain: cleanDom,
        company_name: cleanDom,
        url: websiteUrl || `https://${cleanDom}`,
        enrichment_status: 'queued',
      },
      userId
    );

    try {
      this.activeEnrichmentJobs.set(cleanDom, { startedAt: Date.now(), status: 'running' });

      // Update company status to 'running'
      await this.saveCompanyRecord(
        {
          domain: cleanDom,
          company_name: cleanDom,
          enrichment_status: 'running',
        },
        userId
      );

      // Execute Workflow B: Crawl official website with existing crawlerEngine
      const crawlResult = await crawlerEngine.enrichSingleDomain(websiteUrl || `https://${cleanDom}`, maxPages);

      const contacts: Contact[] = crawlResult.contacts || [];
      const genericEmails: string[] = crawlResult.generic_emails || [];
      const departmentalEmails: string[] = crawlResult.departmental_emails || [];
      const now = new Date().toISOString();

      // Update SAME company record in Firebase & local cache
      const updated = await this.saveCompanyRecord(
        {
          domain: cleanDom,
          company_name: crawlResult.company_name || cleanDom,
          url: crawlResult.url || websiteUrl,
          location: crawlResult.firmographics?.headquarters || crawlResult.firmographics?.location,
          industry: crawlResult.firmographics?.industry,
          employee_count: crawlResult.firmographics?.employee_count || crawlResult.employee_count,
          employee_range: crawlResult.firmographics?.employee_range || crawlResult.employee_range,
          employee_count_source_url: crawlResult.firmographics?.employee_count_source_url || crawlResult.employee_count_source_url,
          founded_year: crawlResult.firmographics?.founded_year || crawlResult.founded_year,
          founded_year_source_url: crawlResult.firmographics?.founded_year_source_url || crawlResult.founded_year_source_url,
          contacts,
          contacts_count: contacts.length,
          generic_emails: genericEmails,
          departmental_emails: departmentalEmails,
          emails_count: crawlResult.emails_found,
          enrichment_status: 'completed',
          last_enrichment_date: now,
          userId,
        },
        userId
      );

      return updated;
    } catch (err: any) {
      console.warn(`[JobCoordinator] Enrichment failed for ${cleanDom}:`, err.message);
      await this.saveCompanyRecord(
        {
          domain: cleanDom,
          company_name: cleanDom,
          enrichment_status: 'failed',
        },
        userId
      );
      return null;
    } finally {
      this.activeEnrichmentJobs.delete(cleanDom);
    }
  }

  /**
   * Helper to retrieve company workflow metadata and status
   */
  public getCompanyWorkflowStatus(domain: string): {
    exists: boolean;
    domain: string;
    discoveryStatus: DiscoveryWorkflowStatus;
    activityStatus: ActivityWorkflowStatus;
    enrichmentStatus: EnrichmentWorkflowStatus;
    isDiscoveryFresh: boolean;
    isEnrichmentFresh: boolean;
    lastDiscoveryDate?: string;
    lastEnrichmentDate?: string;
    recentActivitiesCount: number;
    contactsCount: number;
    company?: CompanyWorkflowRecord;
  } {
    const norm = this.normalizeDomain(domain);
    const company = this.getCompanyRecord(norm);
    if (!company) {
      return {
        exists: false,
        domain: norm,
        discoveryStatus: 'none',
        activityStatus: 'none',
        enrichmentStatus: this.isEnrichmentActive(norm) ? 'running' : 'pending',
        isDiscoveryFresh: false,
        isEnrichmentFresh: false,
        recentActivitiesCount: 0,
        contactsCount: 0,
      };
    }

    return {
      exists: true,
      domain: norm,
      discoveryStatus: company.discovery_status,
      activityStatus: company.activity_status,
      enrichmentStatus: this.isEnrichmentActive(norm) ? 'running' : company.enrichment_status,
      isDiscoveryFresh: this.isDiscoveryFresh(company),
      isEnrichmentFresh: this.isEnrichmentFresh(company),
      lastDiscoveryDate: company.last_discovery_date,
      lastEnrichmentDate: company.last_enrichment_date,
      recentActivitiesCount: company.recent_activity?.length || 0,
      contactsCount: company.contacts?.length || 0,
      company,
    };
  }
}

export const globalJobCoordinator = new JobCoordinator();
