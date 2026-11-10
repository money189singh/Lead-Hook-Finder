import { DiscoveredProspect, DiscoveryCriteria } from './types';
import { extractCleanDomain, cleanCompanyName } from './domainDetector';
import { globalDiscoveryCache } from './cache';
import { globalJobCoordinator } from '../coordination/jobCoordinator';
import { probeCompanyWebsite } from './instantScraper';
import { CompanyActivityItem } from '../../src/types';

/**
 * Workflow A — AI Prospect Discovery
 * Builds and validates candidate company prospect and recent activity evidence.
 * Does NOT launch the deep website crawler just to extract emails or contacts.
 * Deduplicates against existing Firebase company records and reuses fresh enrichment.
 */
export async function enrichCandidateProspect(
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
    foundedYear?: string;
    personName?: string;
    jobTitle?: string;
    decisionMakerEmail?: string;
    email?: string;
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
  criteria: DiscoveryCriteria,
  userId?: string
): Promise<DiscoveredProspect> {
  const domain = extractCleanDomain(candidate.domain || candidate.website || '');
  const now = new Date().toISOString();

  // 1. Check Discovery Cache first for unchanged discovery evidence (only if already enriched with email)
  if (domain) {
    const cached = globalDiscoveryCache.get(domain);
    if (cached && cached.data && cached.data.email && cached.data.email.includes('@')) {
      const cachedProspect: DiscoveredProspect = {
        id: cached.data.id || `disc_${domain}_${Date.now()}`,
        companyName: candidate.companyName || cached.companyName || cleanCompanyName('', domain),
        website: candidate.website || cached.data.website || `https://${domain}`,
        domain,
        location: candidate.location || cached.data.location || '',
        country: candidate.country || cached.data.country || criteria.country || '',
        state: candidate.state || cached.data.state || criteria.state || '',
        city: candidate.city || cached.data.city || criteria.city || '',
        industry: candidate.industry || cached.data.industry || criteria.industry || '',
        description: candidate.description || cached.data.description || '',
        employeeCount: candidate.employeeCount || cached.data.employeeCount || criteria.employeeRange || '',
        revenue: candidate.revenue || cached.data.revenue || criteria.revenueRange || '',
        sourceUrl: candidate.sourceUrl,
        sourceTitle: candidate.sourceTitle,
        sourceType: candidate.sourceType || 'search_result',
        sourceUrls: candidate.sourceUrls || [candidate.sourceUrl],
        verificationStatus: candidate.verificationStatus,
        verificationEvidence: candidate.verificationEvidence || cached.data.verificationEvidence,
        discoveredBy: 'ai_web_discovery',
        discoveredAt: cached.discoveredAt || now,
        lastCheckedAt: now,
        confidence: cached.data.confidence || candidate.confidence || 'High',
        personName: cached.data.personName,
        jobTitle: cached.data.jobTitle,
        department: cached.data.department,
        seniority: cached.data.seniority,
        email: cached.data.email,
        emailType: cached.data.emailType,
        genericEmail: cached.data.genericEmail || (cached.data.emailType?.toLowerCase().includes('generic') ? cached.data.email : `contact@${domain}`),
        decisionMakerEmail: cached.data.decisionMakerEmail || (cached.data.emailType?.toLowerCase().includes('personal') ? cached.data.email : undefined),
        phone: cached.data.phone,
        phoneType: cached.data.phoneType,
        linkedinUrl: cached.data.linkedinUrl,
        crawlStatus: cached.data.crawlStatus || 'completed',
        rawContacts: cached.data.rawContacts,
        recentActivity: candidate.recentActivity || cached.data.recentActivity || [],
        enrichmentStatus: cached.data.enrichmentStatus || 'completed',
        lastDiscoveryDate: cached.discoveredAt || now,
        lastEnrichmentDate: cached.lastCrawledAt,
      };

      return cachedProspect;
    }
  }

  // 2. Delegate to JobCoordinator:
  // - Saves company identity & activity evidence immediately to Firestore / local records
  // - Deduplicates against existing records
  // - Reuses existing website enrichment if already completed and fresh
  // - Enqueues website scraper if missing/stale without blocking discovery!
  const coordResult = await globalJobCoordinator.handleDiscoveryResult(
    {
      companyName: candidate.companyName,
      website: candidate.website,
      domain,
      location: candidate.location,
      country: candidate.country,
      state: candidate.state,
      city: candidate.city,
      industry: candidate.industry,
      description: candidate.description,
      employeeCount: candidate.employeeCount,
      revenue: candidate.revenue,
      sourceUrl: candidate.sourceUrl,
      sourceTitle: candidate.sourceTitle,
      sourceType: candidate.sourceType,
      sourceUrls: candidate.sourceUrls,
      verificationStatus: candidate.verificationStatus,
      verificationEvidence: candidate.verificationEvidence,
      confidence: candidate.confidence,
      recentActivity: candidate.recentActivity,
    },
    userId
  );

  const prospect = coordResult.prospect;

  // Ensure firmographics and decision maker fields from candidate are preserved
  if (candidate.city && !prospect.city) prospect.city = candidate.city;
  if (candidate.state && !prospect.state) prospect.state = candidate.state;
  if (candidate.country && !prospect.country) prospect.country = candidate.country;
  if (candidate.location && !prospect.location) prospect.location = candidate.location;
  if (candidate.foundedYear && !prospect.foundedYear) prospect.foundedYear = candidate.foundedYear;
  if (candidate.employeeCount && !prospect.employeeCount) prospect.employeeCount = candidate.employeeCount;
  if (candidate.personName && (!prospect.personName || prospect.personName.includes('Leadership') || prospect.personName.includes('Contact'))) {
    prospect.personName = candidate.personName;
    prospect.jobTitle = candidate.jobTitle || 'Founder & CEO';
  }
  if (candidate.decisionMakerEmail && !prospect.decisionMakerEmail) {
    prospect.decisionMakerEmail = candidate.decisionMakerEmail;
    if (!prospect.email || prospect.emailType === 'Generic Business Email') {
      prospect.email = candidate.decisionMakerEmail;
      prospect.emailType = 'Professional Personal Email';
    }
  } else if (candidate.email && !prospect.email) {
    prospect.email = candidate.email;
  }

  // 3. Instant On-Demand Probe if autoExtractContacts is true and contacts/emails are not yet populated
  if (
    criteria.autoExtractContacts !== false &&
    domain &&
    candidate.verificationStatus === 'Verified company' &&
    (!prospect.email || !prospect.personName || !prospect.foundedYear || !prospect.genericEmail)
  ) {
    try {
      const probe = await probeCompanyWebsite(domain, candidate.companyName, [
        candidate.description || '',
        candidate.verificationEvidence || '',
      ]);

      if (probe.personName && (!prospect.personName || prospect.personName.includes('Leadership'))) {
        prospect.personName = probe.personName;
        prospect.jobTitle = probe.jobTitle || 'Executive / Decision Maker';
      }
      if (probe.genericEmail && !prospect.genericEmail) {
        prospect.genericEmail = probe.genericEmail;
      }
      if (probe.decisionMakerEmail && !prospect.decisionMakerEmail) {
        prospect.decisionMakerEmail = probe.decisionMakerEmail;
      }
      if (probe.email && !prospect.email) {
        prospect.email = probe.email;
        prospect.emailType = probe.emailType || 'Generic Business Email';
      }
      if (probe.phone && !prospect.phone) {
        prospect.phone = probe.phone;
      }
      if (probe.linkedinUrl && !prospect.linkedinUrl) {
        prospect.linkedinUrl = probe.linkedinUrl;
      }
      if (probe.employeeCount && !prospect.employeeCount) {
        prospect.employeeCount = probe.employeeCount;
      }
      if (probe.foundedYear) {
        prospect.foundedYear = probe.foundedYear;
      }
      if (probe.contacts && (!prospect.rawContacts || prospect.rawContacts.length === 0)) {
        prospect.rawContacts = probe.contacts;
      }
      if (probe.email || probe.personName) {
        prospect.crawlStatus = 'completed';
        prospect.enrichmentStatus = 'completed';
      }
    } catch {
      // Direct website probe silently skipped if website is protected or offline
    }
  }

  // 4. Update Discovery cache with the verified identity & activities
  if (domain) {
    globalDiscoveryCache.set(domain, prospect.companyName, prospect);
  }

  return prospect;
}
