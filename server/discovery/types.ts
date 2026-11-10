import { EmailType, Contact, ActivityLog, CompanyActivityItem, EnrichmentWorkflowStatus } from '../../src/types';
import { BuyingSignal, CriteriaMatchExplanation } from './signalEngine';

export interface DiscoveryCriteria {
  naturalLanguagePrompt?: string;
  country?: string;
  state?: string;
  city?: string;
  industry?: string;
  companyName?: string;
  employeeRange?: string; // e.g. '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
  revenueRange?: string; // e.g. '< $1M', '$1M - $10M', '$10M - $50M', '$50M+'
  jobTitle?: string; // e.g. 'CEO, Founder, Sales Director'
  department?: string; // e.g. 'Executive', 'Sales', 'Engineering', 'Marketing'
  seniority?: string; // e.g. 'C-Suite / Executive', 'VP / Director', 'Manager'
  keywords?: string; // e.g. 'B2B SaaS, AI, Platform'
  technology?: string; // e.g. 'React, AWS, Salesforce'
  targetCount: number; // e.g. 10, 25, 50, 100, 250, 500
  maxPagesPerCompany: number; // default: 3
  maxQueries: number; // default: 10
  autoExtractContacts: boolean; // default: true
  includeGenericEmails: boolean; // default: true

  // Scale & Anti-Mega-Cap Filters
  companyScale?: 'all' | 'startups' | 'smb' | 'mid_market';
  excludeMegaCaps?: boolean; // default: true (excludes Fortune 500 / household giants like Microsoft, Salesforce, etc.)

  // Real Buying Signals & Daily Triggers
  buyingSignalFilter?: 'all' | 'funding' | 'hiring' | 'product_launch' | 'leadership_change' | 'any_signal';
  fundingStage?: string; // 'Bootstrapped', 'Seed', 'Series A', 'Series B', 'Any Funded'
  hiringActive?: boolean; // Actively hiring talent / open roles
  lookbackPeriod?: 'anytime' | 'last_30_days' | 'last_90_days';

  // Deduplication & Continuous Freshness
  freshnessMode?: 'new_only' | 'all'; // default: 'new_only' (guarantees finding new companies every time)
  excludePreviouslyDiscovered?: boolean; // default: true
}

export interface WebDiscoveryResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  city?: string;
  state?: string;
  country?: string;
  foundedYear?: string;
  employeeCount?: string;
  personName?: string;
  jobTitle?: string;
  decisionMakerEmail?: string;
  phone?: string;
  linkedinUrl?: string;
}

export interface ProspectDossier {
  prospectId: string;
  companyName: string;
  domain: string;
  decisionMakerName: string;
  decisionMakerTitle: string;
  decisionMakerEmail: string;
  location: {
    city?: string;
    state?: string;
    country?: string;
  };
  firmographics: {
    foundedYear?: string;
    employeeCount?: string;
    industry?: string;
  };
  executiveBio: string;
  painPoints: string[];
  buyingTriggers: string[];
  personalizedAngles: {
    locationAngle: string;
    scalingAngle: string;
    foundingAngle: string;
  };
  sequences: {
    coldEmail: {
      subject: string;
      body: string;
    };
    linkedinMessage: string;
    coldCallOpener: string;
  };
}

export type VerificationStatus =
  | 'Verified company'
  | 'Company found, website unverified'
  | 'Needs review'
  | 'Rejected: not a company';

export interface DiscoverySource {
  id: string;
  url: string;
  domain: string;
  title: string;
  sourceType: 'directory' | 'article' | 'listicle' | 'search_result';
  companiesFound: number;
  extractedCompanyNames: string[];
  status: 'scraped' | 'ai_extracted' | 'searched' | 'failed';
  accessedAt: string;
}

export interface DiscoveredProspect {
  id: string;
  companyName: string;
  website: string;
  domain: string;
  location?: string;
  country?: string;
  state?: string;
  city?: string;
  industry?: string;
  description?: string;
  employeeCount?: string;
  foundedYear?: string;
  revenue?: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType?: 'directory' | 'article' | 'search_result' | 'direct_website';
  sourceUrls?: string[];
  websiteStatus?: string;
  verificationStatus: VerificationStatus;
  verificationEvidence?: string;
  discoveredBy: 'ai_web_discovery';
  discoveredAt: string;
  lastCheckedAt: string;
  confidence: 'High' | 'Medium' | 'Low';
  
  // Person / Decision Maker fields
  personName?: string;
  jobTitle?: string;
  department?: string;
  seniority?: string;
  email?: string;
  emailType?: EmailType;
  genericEmail?: string;
  decisionMakerEmail?: string;
  phone?: string;
  phoneType?: string;
  linkedinUrl?: string;
  extractedPageUrl?: string;
  
  // Crawler integration status
  crawlStatus?: 'pending' | 'crawling' | 'completed' | 'failed' | 'skipped';
  rawContacts?: Contact[];

  // Activity & Coordination additions:
  recentActivity?: CompanyActivityItem[];
  enrichmentStatus?: EnrichmentWorkflowStatus;
  lastDiscoveryDate?: string;
  lastEnrichmentDate?: string;

  // Buying Signals & Condition Explanations
  buyingSignals?: BuyingSignal[];
  matchExplanation?: CriteriaMatchExplanation;
  fitScore?: number;
  isNewDiscovery?: boolean;
}

export interface ExtractedDirectoryCompany {
  name: string;
  website?: string;
  description?: string;
  location?: string;
  industry?: string;
  sourceUrl: string;
  sourceTitle: string;
}

export interface JobCheckpoint {
  queryIndex: number;
  searchResultIndex: number;
  seenDomains: string[];
  seenCompanyKeys: string[];
  lastSavedAt: string;
}

export interface FailedTaskItem {
  id: string;
  companyName?: string;
  url?: string;
  reason: string;
  attemptCount: number;
  timestamp: string;
}

export type DiscoveryJobStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled';

export interface DiscoveryJob {
  id: string;
  jobId?: string; // Canonical alias for id
  userId?: string;
  workspaceId?: string;
  type?: string; // 'ai_discovery' | 'website_crawling' | 'maps_scraping'
  searchQuery?: string;
  created_at: string;
  createdAt?: string; // Canonical alias for created_at
  updated_at: string;
  updatedAt?: string; // Canonical alias for updated_at
  startedAt?: string | null;
  completedAt?: string | null;
  lastHeartbeat?: string | null;
  workerId?: string | null;
  lockedAt?: string | null;
  leaseUntil?: string | null;
  stopRequested?: boolean;
  priority?: 'high' | 'normal' | 'low';
  executionMode?: 'cloud' | 'local' | 'embedded';
  aiProvider?: string; // 'NVIDIA' | 'Gemini'
  aiModel?: string;
  status: DiscoveryJobStatus;
  criteria: DiscoveryCriteria;
  targetCount?: number;
  totalTargets?: number;
  discoveredCount?: number;
  processedCount?: number;
  processedTargets?: number;
  successfulCount?: number;
  successfulTargets?: number;
  failedCount?: number;
  failedTargets?: number;
  currentTarget?: string;
  errorCount?: number;
  retryCount?: number;
  currentStage?: string;
  currentTask?: string;
  pagesDiscovered?: number;
  pagesProcessed?: number;
  pagesFailed?: number;
  decisionMakersFound?: number;
  error?: string;
  checkpoint?: JobCheckpoint;
  failedTasks?: FailedTaskItem[];
  queriesExecuted: number;
  companiesDiscovered: number;
  uniqueCompanies: number;
  verifiedCompanies: number;
  unverifiedCompanies: number;
  websitesFound: number;
  websitesProcessed: number;
  emailsFound: number;
  phonesFound: number;
  peopleFound: number;
  duplicatesRemoved: number;
  currentStepText: string;
  prospects: DiscoveredProspect[];
  sources: DiscoverySource[];
  logs: ActivityLog[];
  queries: string[];
}

export interface WorkerHealthInfo {
  status: 'online' | 'offline';
  workerId: string;
  lastHeartbeat: string;
  secondsSinceHeartbeat: number;
  activeJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedTasks: number;
  concurrency: number;
  uptimeSeconds: number;
  executionMode: string;
  provider?: string;
  aiProvider?: string;
  aiModel?: string;
  currentJobId?: string | null;
  startedAt?: string;
  version?: string;
}

export interface DiscoveryProvider {
  name: string;
  searchWeb(query: string, options?: { maxResults?: number }): Promise<WebDiscoveryResult[]>;
}

