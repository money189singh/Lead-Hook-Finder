export type EmailType =
  | 'Professional Personal Email'
  | 'Generic Business Email'
  | 'Personal Email Provider'
  | 'Role-based'
  | 'Unknown'
  | 'Personal'
  | 'Generic';

export type JobStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

export type WebsiteStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'No contacts found'
  | 'No email found'
  | 'Generic email found'
  | 'Crawl failed'
  | 'Access restricted'
  | 'Timeout'
  | 'Invalid URL'
  | 'JavaScript error';

export type ProviderGroup = 'global' | 'chinese' | 'custom';

export type ProviderType =
  | 'qwen'
  | 'deepseek'
  | 'kimi'
  | 'glm'
  | 'minimax'
  | 'custom_chinese'
  | 'gemini'
  | 'openai'
  | 'claude'
  | 'custom_openai';

export type RoutingStrategy =
  | 'auto'
  | 'manual'
  | 'free_first'
  | 'low_cost_first'
  | 'fastest'
  | 'highest_quality';

export type CredentialStatus =
  | 'active'
  | 'cooldown'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'auth_error'
  | 'invalid_model'
  | 'disabled';

export type StandardErrorCode =
  | 'RATE_LIMIT'
  | 'QUOTA'
  | 'AUTH'
  | 'INVALID_MODEL'
  | 'REQUEST_TOO_LARGE'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface ModelCapability {
  id: string;
  name: string;
  contextWindow?: number;
  supportsJson: boolean;
  supportsStructuredOutput: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
  isFreeOrLowCost?: boolean;
  tier?: 'free' | 'low_cost' | 'standard' | 'flagship';
}

export interface AiCredential {
  id: string;
  provider: ProviderType;
  name: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  region?: string;
  workspaceId?: string;
  priority: number;
  enabled: boolean;
  status: CredentialStatus;
  cooldownUntil?: number;
  lastError?: {
    code: StandardErrorCode;
    message: string;
    timestamp: string;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rateLimits429: number;
    quotaErrors: number;
    totalLatencyMs: number;
    averageLatencyMs: number;
    lastUsed?: string;
  };
}

export interface FailoverEvent {
  id: string;
  timestamp: string;
  timeStr: string;
  level: 'info' | 'success' | 'warning' | 'error';
  provider: string;
  model?: string;
  credentialId?: string;
  message: string;
  companyUrl?: string;
}

export interface ExtractionTaskMetadata {
  provider: ProviderType;
  providerName: string;
  model: string;
  attempts: number;
  latencyMs: number;
  timestamp: string;
  status: 'success' | 'fallback_success' | 'failed';
  errorCodes?: StandardErrorCode[];
}

export interface SocialProfiles {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  youtube?: string;
  instagram?: string;
  github?: string;
}

export type RoleTier =
  | 'C-Suite / Executive'
  | 'Sales & Marketing'
  | 'Procurement & Operations'
  | 'Technical / Engineering'
  | 'Finance & Legal'
  | 'General Management'
  | 'Other Staff';

export type IcpTier = 'High Match' | 'Moderate Match' | 'Low Match' | 'Unmatched';

export interface CompanyFirmographics {
  industry?: string;
  employee_tier?: string; // '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+'
  employee_count?: string;
  employee_range?: string;
  employee_count_source_url?: string;
  employee_count_confidence?: string;
  founded_year?: string;
  founded_year_source_url?: string;
  founded_year_confidence?: string;
  headquarters?: string;
  location?: string;
  country_code?: string;
  offering_summary?: string;
  confidence?: string;
  last_checked_date?: string;
}

export interface IcpConfig {
  enabled: boolean;
  strict_mode?: boolean; // When true, hard-enforces filters and excludes non-matching leads
  unknown_policy?: 'include' | 'exclude' | 'mark_unverified'; // How to treat unknown employee size or email type
  target_roles: string[];
  target_industries: string[];
  preferred_company_sizes: string[]; // e.g. '1-10', '11-50', etc.
  required_email_types?: EmailType[]; // e.g. ['Professional Personal Email']
  target_locations?: string[];
  min_icp_score: number;
  weights: {
    roleWeight: number;
    industryWeight: number;
    companySizeWeight: number;
    emailTypeWeight: number;
    socialWeight: number;
  };
}

export interface RuleEvaluationItem {
  rule: string;
  status: 'FOLLOWED' | 'FAILED' | 'UNVERIFIED';
  detail: string;
}

export interface Contact {
  id: string;
  company_name: string;
  website: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  email: string;
  email_type: EmailType;
  phone: string;
  source_url: string;
  status: string;
  provider?: string;
  model?: string;
  attempts?: number;
  latency_ms?: number;
  extraction_time?: string;
  proxy_used?: string;
  professional_email?: string;
  company_generic_emails?: string[];
  departmental_emails?: string[];
  association_status?: 'explicit' | 'inferred' | 'none';
  confidence_score?: number;
  // Accurate Email Detection & Identity Verification:
  email_classification_reason?: string;
  identity_verified?: boolean;
  identity_verification_evidence?: string;
  is_decision_maker?: boolean;
  decision_maker_tier?: string;
  decision_maker_score?: number;
  decision_maker_reasons?: string[];
  company_size?: string;
  industry?: string;
  // Strict ICP Filtering:
  icp_filter_status?: 'INCLUDED' | 'EXCLUDED' | 'UNKNOWN';
  icp_exclusion_reasons?: string[];
  icp_inclusion_reasons?: string[];
  rule_evaluations?: RuleEvaluationItem[];
  // Lead Enrichment & Social Intelligence additions:
  role_tier?: RoleTier;
  icp_score?: number; // 0 - 100%
  icp_tier?: IcpTier;
  icp_match_reasons?: string[];
  social_profiles?: SocialProfiles;
  linkedin_url?: string;
  twitter_url?: string;
  // Technology detection & Team assignment:
  tech_stack?: string[];
  assigned_to?: string;
  phone_type?: 'mobile' | 'direct' | 'office' | 'toll_free';
  waterfall_status?: 'pending' | 'in_progress' | 'enriched' | 'failed';
  // Business Verification columns:
  google_maps_found?: boolean;
  google_maps_status?: string;
  google_maps_match?: string;
  google_maps_url?: string;
  google_maps_business_name?: string;
  google_maps_address?: string;
  google_maps_phone?: string;
  google_maps_website?: string;
  search_verification?: string;
  search_evidence?: string;
  website_status?: string;
  website_http_status?: number;
  website_last_modified?: string;
  latest_website_content_date?: string;
  website_date_source?: string;
  website_activity_evidence?: string;
  latest_review_date?: string;
  latest_activity_date?: string;
  activity_evidence?: string;
  government_entity_found?: boolean;
  government_legal_name?: string;
  government_entity_name?: string;
  government_entity_id?: string;
  government_entity_type?: string;
  government_entity_status?: string;
  government_source?: string;
  government_last_filing_date?: string;
  government_verification_date?: string;
  final_business_status?: BusinessStatus;
  status_confidence?: StatusConfidence;
  status_evidence?: string;
  status_sources?: string[];
  verification_trace?: any;
  last_verified?: string;
  next_verification_date?: string;
  verification_level?: VerificationLevel;
  credits_used?: number;
  lead_eligibility?: LeadEligibility;
  email_verification?: EmailVerificationResult;
  // Lead Pipeline, Tagging & Notes:
  pipeline_stage?: LeadPipelineStage;
  tags?: string[];
  notes?: string;
}

export type LeadPipelineStage = 'New' | 'Contacted' | 'Qualified' | 'Follow-Up' | 'Disqualified';

export interface OutboundWebhookConfig {
  enabled: boolean;
  url: string;
  secret_header?: string;
  filter_mode?: 'all_leads' | 'high_icp_only';
}

export type BusinessStatus = 'OPEN' | 'TEMPORARILY CLOSED' | 'PERMANENTLY CLOSED' | 'UNCERTAIN';
export type VerificationLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CUSTOM';
export type StatusConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type LeadEligibility = 'KEEP' | 'SKIP' | 'VERIFY';
export type WebsiteOperationalStatus = 'WORKING' | 'PARTIALLY WORKING' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
export type GovernmentEntityStatus = 'ACTIVE' | 'GOOD STANDING' | 'INACTIVE' | 'DISSOLVED' | 'TERMINATED' | 'REVOKED' | 'SUSPENDED' | 'NOT FOUND' | 'UNKNOWN';

export interface CustomVerificationOptions {
  checkWebsite: boolean;
  checkGoogleMaps: boolean;
  checkSearch: boolean;
  checkGovernment: boolean;
  checkRecentReviews?: boolean;
  checkSocialActivity?: boolean;
  aiOnlyWhenUncertain: boolean;
}

export interface VerificationHistoryEntry {
  previous_status: BusinessStatus;
  new_status: BusinessStatus;
  verification_date: string;
  date?: string;
  evidence: string;
  evidence_summary?: string;
  verification_level: VerificationLevel;
  level?: VerificationLevel;
  credits_used: number;
  confidence?: StatusConfidence;
}

export interface VerificationTraceItem {
  status: 'CHECKED' | 'FOUND' | 'NOT FOUND' | 'ERROR' | 'SKIPPED' | 'USED' | 'NOT USED';
  timestamp?: string;
  detail?: string;
}

export interface VerificationTrace {
  google_maps: VerificationTraceItem;
  website: VerificationTraceItem;
  website_last_modified: VerificationTraceItem;
  website_activity: VerificationTraceItem;
  govfiles: VerificationTraceItem;
  search: VerificationTraceItem;
  ai: VerificationTraceItem;
  [key: string]: VerificationTraceItem | undefined;
}

export interface VerificationResult {
  business_name: string;
  url: string;
  google_maps_found?: boolean;
  google_maps_status?: string;
  google_maps_match?: string;
  google_maps_url?: string;
  google_maps_business_name?: string;
  google_maps_address?: string;
  google_maps_phone?: string;
  google_maps_website?: string;
  search_verification?: string;
  search_evidence?: string;
  website_status?: WebsiteOperationalStatus;
  website_http_status?: number;
  website_last_modified?: string;
  latest_website_content_date?: string;
  website_date_source?: string;
  website_activity_evidence?: string;
  latest_review_date?: string;
  latest_activity_date?: string;
  activity_evidence?: string;
  government_entity_found?: boolean;
  government_entity_name?: string;
  government_legal_name?: string;
  government_entity_type?: string;
  government_state?: string;
  government_entity_id?: string;
  government_entity_status?: GovernmentEntityStatus;
  government_last_filing_date?: string;
  government_source?: string;
  government_verification_date?: string;
  final_business_status: BusinessStatus;
  status_confidence: StatusConfidence;
  status_evidence: string;
  status_sources: string[];
  verification_trace?: VerificationTrace | Record<string, any>;
  last_verified: string;
  next_verification_date: string;
  verification_level: VerificationLevel;
  credits_used: number;
  lead_eligibility: LeadEligibility;
  history?: VerificationHistoryEntry[];
}

export interface GovFilesConfig {
  apiKey?: string;
  api_key?: string;
  enabled: boolean;
  status: 'active' | 'quota_exceeded' | 'error' | 'disabled' | 'untested';
  has_key?: boolean;
  fallback_active?: boolean;
  lastTested?: string;
  lastError?: string;
}

export interface VerificationCreditSettings {
  low_cost: number;
  medium_cost: number;
  high_cost: number;
  available_credits: number;
  total_credits_used: number;
  cost_per_level?: Record<string, number>;
}

export interface CreditHistoryItem {
  id: string;
  date: string;
  verification_level: VerificationLevel;
  businesses_processed: number;
  credits_used: number;
  job_id?: string;
  notes?: string;
}

export type CreditUsageRecord = CreditHistoryItem;

export interface VerifierApiCredential {
  id: string;
  service: 'google_maps' | 'search_1' | 'search_2' | 'gov_1' | 'gov_2' | 'govfiles' | 'ai_provider';
  name: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
  usage: number;
  quota: number;
  status: 'active' | 'quota_exceeded' | 'error' | 'disabled';
  lastUsed?: string;
  lastError?: string;
}

export interface BusinessVerifierRules {
  verification_instructions: string;
  evidence_requirements: string;
  search_behavior: string;
  status_rules: string;
  confidence_rules: string;
  api_priority: string;
  reverification_intervals: {
    open_days: number;
    uncertain_days: number;
    temporarily_closed_days: number;
    permanently_closed_days: number;
  };
  ai_usage_rules: string;
  credit_costs: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface VerificationJobStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  open_count: number;
  temporarily_closed_count: number;
  permanently_closed_count: number;
  uncertain_count: number;
  estimated_credits: number;
  credits_used: number;
  credits_remaining: number;
  verification_level: VerificationLevel;
  current_business?: string;
  current_status_text?: string;
  current_checks_progress?: string[];
  started_at?: string;
  completed_at?: string;
  api_usage: {
    google_maps_calls: number;
    search_calls: number;
    gov_calls: number;
    govfiles_calls?: number;
    ai_calls: number;
    api_errors: number;
    fallback_events: number;
  };
}

export type ProxyProtocol = 'http' | 'https' | 'socks5';
export type ProxyRotationMode = 'round_robin' | 'random' | 'fastest' | 'geo_pinned' | 'disabled';

export interface ProxyItem {
  id: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  geolocation?: string; // e.g., 'US', 'GB', 'AE', 'CN', 'SG', 'DE'
  country?: string;
  totalRequests?: number;
  successfulRequests?: number;
  enabled: boolean;
  status: 'active' | 'cooldown' | 'failed' | 'untested';
  latencyMs?: number;
  lastChecked?: string;
  failureCount: number;
  successCount: number;
  errorMsg?: string;
}

export type ProxyNode = ProxyItem;

export interface ProxyPoolConfig {
  enabled: boolean;
  rotationMode: ProxyRotationMode;
  pinnedGeo?: string;
  maxFailuresBeforeCooldown: number;
  cooldownDurationMinutes: number;
  proxies: ProxyItem[];
}

export interface AntiBotConfig {
  enabled: boolean;
  rotateUserAgents: boolean;
  randomizeClientHints: boolean;
  humanizedJitter: boolean;
  minJitterMs: number;
  maxJitterMs: number;
  randomizeHeadersOrder: boolean;
}

export interface ContentPruningConfig {
  enabled: boolean;
  stripNavAndFooter: boolean;
  stripCookieBanners: boolean;
  stripMarketingModals: boolean;
  prioritizeSemanticSelectors: boolean;
  extractSchemaOrgMicrodata: boolean;
  extractContextualMailtoSnippets: boolean;
  maxTokenBudgetPerPage: number;
  compactWhitespace: boolean;
}

export interface PruningStats {
  rawBytesTotal: number;
  prunedBytesTotal: number;
  tokensEstimatedSaved: number;
  percentSaved: number;
  schemaEntitiesExtracted: number;
}

export interface QueueMetrics {
  pendingTasks: number;
  activeWorkers: number;
  completedTasks: number;
  failedTasks: number;
  throughputPerMinute: number;
  avgDomainCrawlMs: number;
  estimatedTimeRemainingSec: number;
}

export interface WebsiteResult {
  url: string;
  normalized_url: string;
  company_name: string;
  status: WebsiteStatus;
  pages_discovered: number;
  pages_crawled: number;
  contacts_found: number;
  emails_found: number;
  contacts: Contact[];
  error?: string;
  crawled_urls?: string[];
  extraction_metadata?: ExtractionTaskMetadata;
  proxy_used?: string;
  proxy_node?: string;
  pruning_savings_pct?: number;
  // Lead Enrichment & Social Intelligence additions:
  firmographics?: CompanyFirmographics;
  social_profiles?: SocialProfiles;
  avg_icp_score?: number;
  high_icp_contacts_count?: number;
  // Business Verification additions:
  verification?: VerificationResult;
  // Strict ICP & Decision-Maker Status:
  icp_filter_status?: 'INCLUDED' | 'EXCLUDED' | 'UNKNOWN';
  icp_exclusion_reasons?: string[];
  icp_filter_reasons?: string[];
  decision_maker_found?: boolean;
  decision_maker_summary?: string;
  decision_maker?: Contact;
  active_rules_applied?: string[];
  rule_evaluations?: RuleEvaluationItem[];
  // Deep Crawling & Coverage Fields:
  generic_emails?: string[];
  generic_email_items?: GenericEmailItem[];
  departmental_emails?: string[];
  employee_count?: string;
  employee_range?: string;
  employee_tier?: string;
  employee_count_source_url?: string;
  employee_count_confidence?: string;
  founded_year?: string;
  founded_year_source_url?: string;
  founded_year_confidence?: string;
  linkedin_url?: string;
  location?: string;
  last_checked_date?: string;
  confidence?: string;
  pages_remaining?: number;
  pages_failed?: number;
  crawl_limit_reached?: boolean;
  crawl_coverage_summary?: string;
  crawl_depth?: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  website?: string;
}

export interface ScrapeSettings {
  gemini_api_key: string;
  has_key: boolean;
  ai_providers?: AiCredential[];
  routing_strategy?: RoutingStrategy;
  max_pages: number; // 5, 10, 20, 30
  max_contacts: number; // 1, 2, 3, 5, 10, 0 (unlimited)
  smart_discovery: boolean;
  concurrency: number; // 1, 3, 5, 10, 15, 20
  request_delay_ms: number; // 500 - 3000
  timeout_ms: number; // 10000 - 30000
  retry_count: number; // 0, 1, 2
  priority_roles: string[];
  generic_email_patterns: string[];
  ai_agent_rules: string;
  custom_rules?: string;
  email_filter_mode?: 'all' | 'professional_only' | 'generic_only';
  strict_icp_mode?: boolean;
  theme: 'dark' | 'light' | 'system';
  // Resilience & High-Throughput additions:
  proxy_config?: ProxyPoolConfig;
  anti_bot_config?: AntiBotConfig;
  pruning_config?: ContentPruningConfig;
  // Lead Enrichment & ICP Scoring additions:
  icp_config?: IcpConfig;
  // Business Verifier additions:
  verification_credit_settings?: VerificationCreditSettings;
  verification_api_config?: VerifierApiCredential[];
  business_verifier_rules?: BusinessVerifierRules;
  govfiles_config?: GovFilesConfig;
  // External AI Company Research (OpenRouter + Web Search)
  research_config?: ResearchConfig;
  // Workflow Coordination & Freshness additions:
  discovery_freshness_days?: number; // default: 7 days
  enrichment_freshness_days?: number; // default: 30 days
  auto_enqueue_enrichment?: boolean; // default: true
  // Do-Not-Contact Suppression & Outbound Webhook:
  suppressed_domains?: string[];
  suppressed_emails?: string[];
  outbound_webhook?: OutboundWebhookConfig;
}

export interface CompanyActivityItem {
  id: string;
  category: 'hiring' | 'expansion' | 'partnership' | 'leadership_change' | 'announcement' | 'funding' | 'general_news';
  title: string;
  snippet: string;
  source_url: string;
  publication_date?: string;
  detected_at: string;
}

export type DiscoveryWorkflowStatus = 'discovered' | 'skipped' | 'none';
export type ActivityWorkflowStatus = 'pending' | 'completed' | 'none';
export type EnrichmentWorkflowStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'stale';

export interface CompanyWorkflowMetadata {
  discovery_status?: DiscoveryWorkflowStatus;
  activity_status?: ActivityWorkflowStatus;
  enrichment_status?: EnrichmentWorkflowStatus;
  last_discovery_date?: string;
  last_activity_date?: string;
  last_enrichment_date?: string;
  enrichment_job_id?: string;
  recent_activity?: CompanyActivityItem[];
}

export interface GenericEmailItem {
  id: string;
  company_name: string;
  website: string;
  email: string;
  email_type: string;
  department?: string;
  phone?: string;
  source_url: string;
  status: string;
  email_verification?: EmailVerificationResult;
}

export interface ScrapeJob {
  id: string;
  created_at: string;
  status: JobStatus;
  total_websites: number;
  completed_websites: number;
  processing_websites: number;
  failed_websites: number;
  contacts_found: number;
  emails_found: number;
  current_website?: string;
  current_page?: string;
  current_status_text?: string;
  pages_discovered: number;
  pages_crawled: number;
  websites: WebsiteResult[];
  contacts: Contact[];
  generic_emails?: GenericEmailItem[];
  logs: ActivityLog[];
  active_provider?: string;
  active_model?: string;
  queue_metrics?: QueueMetrics;
  pruning_stats?: PruningStats;
  proxy_status_summary?: {
    totalProxies: number;
    activeProxies: number;
    mode: ProxyRotationMode;
  };
  verification_status?: VerificationJobStatus;
  // Granular Scraper Counters:
  websitesQueued?: number;
  websitesActivelyCrawling?: number;
  websitesCompleted?: number;
  uniquePagesDiscovered?: number;
  uniquePagesAttempted?: number;
  pagesSuccessfullyInspected?: number;
  failedPagesAndRetries?: number;
}

export interface HistoryItem {
  id: string;
  date: string;
  total_websites: number;
  completed_websites: number;
  failed_websites: number;
  contacts_found: number;
  emails_found: number;
  websites_summary: {
    domain: string;
    company: string;
    status: string;
    contacts: number;
  }[];
}

export interface BuyingSignal {
  type: 'funding' | 'hiring' | 'product_launch' | 'leadership_change' | 'partnership' | 'expansion' | 'general';
  headline: string;
  detail: string;
  badgeLabel: string;
  amount?: string;
  round?: string;
  roles?: string[];
  date?: string;
  sourceUrl?: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface CriteriaMatchExplanation {
  matchScore: number;
  summary: string;
  passedConditions: {
    condition: string;
    status: 'passed' | 'warning' | 'failed';
    detail: string;
  }[];
  isNewDiscovery: boolean;
  isMegaCap: boolean;
  activeSignals: BuyingSignal[];
}

export interface DiscoveryCriteria {
  naturalLanguagePrompt?: string;
  country?: string;
  state?: string;
  city?: string;
  industry?: string;
  companyName?: string;
  employeeRange?: string;
  revenueRange?: string;
  jobTitle?: string;
  department?: string;
  seniority?: string;
  keywords?: string;
  technology?: string;
  targetCount: number;
  maxPagesPerCompany: number;
  maxQueries: number;
  autoExtractContacts: boolean;
  includeGenericEmails: boolean;

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

export interface GoogleSheetsColumnMapping {
  companyNameColumn: string; // e.g. "Company"
  websiteColumn: string; // e.g. "Website"
  locationColumn: string; // e.g. "Location"
  countryColumn: string; // e.g. "Country"
  stateColumn: string; // e.g. "State"
  cityColumn: string; // e.g. "City"
  employeesColumn: string; // e.g. "Employees"
  foundedColumn: string; // e.g. "Founded"
  industryColumn: string; // e.g. "Industry"
  revenueColumn: string; // e.g. "Revenue"
  genericEmailColumn: string; // e.g. "Generic Email"
  namedContactColumn: string; // e.g. "Named Contact"
  decisionMakerColumn: string; // e.g. "Decision Maker"
  decisionMakerTitleColumn: string; // e.g. "Decision Maker Title"
  decisionMakerEmailColumn: string; // e.g. "Decision Maker Email"
  phoneColumn: string; // e.g. "Phone"
  sourceUrlColumn: string; // e.g. "Source URL"
  verificationStatusColumn: string; // e.g. "Verification Status"
  lastScrapedColumn: string; // e.g. "Last Scraped"
}

export interface GoogleSheetsScheduleConfig {
  googleSheetsEnabled: boolean;
  googleSpreadsheetId?: string;
  googleSpreadsheetName?: string;
  googleSheetId?: number; // sheet numeric id (e.g. 0)
  googleSheetName?: string; // worksheet title, e.g. "Law Firms"
  columnMapping?: Partial<GoogleSheetsColumnMapping>;
  connectedUserEmail?: string;
}

export interface GoogleSheetsSyncStats {
  status: 'Pending' | 'Syncing' | 'Completed' | 'Partially Completed' | 'Failed' | 'Authentication Required';
  spreadsheetName?: string;
  spreadsheetId?: string;
  sheetName?: string;
  sheetId?: number;
  recordsAdded: number;
  recordsUpdated: number;
  totalSynced: number;
  lastSyncedAt?: string;
  spreadsheetUrl?: string;
  error?: string;
}

export interface RecurringSchedule {
  id: string;
  name: string;
  cadence: 'hourly' | 'every_2_hours' | 'every_3_hours' | 'every_4_hours' | 'every_6_hours' | 'every_8_hours' | 'every_12_hours' | 'daily' | 'every_2_days' | 'weekly' | 'custom_hours';
  customHours?: number;
  timeOfDayUtc?: string; // e.g. "08:00"
  targetCount: number;
  criteria: DiscoveryCriteria;
  enabled: boolean;
  autoEnrichWebsite: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastRunProspectsCount?: number;
  totalProspectsFound: number;
  totalRuns: number;
  createdAt: string;
  updatedAt: string;

  // Google Sheets Auto-Sync per-schedule configuration
  googleSheetsEnabled?: boolean;
  googleSpreadsheetId?: string;
  googleSpreadsheetName?: string;
  googleSheetId?: number;
  googleSheetName?: string;
  googleSheetsMapping?: Partial<GoogleSheetsColumnMapping>;
  connectedUserEmail?: string;
  lastGoogleSheetsSync?: GoogleSheetsSyncStats;
}

export interface ScheduleRunLog {
  id: string;
  scheduleId: string;
  scheduleName: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  prospectsFound: number;
  jobId?: string;
  error?: string;
  googleSheetsSync?: GoogleSheetsSyncStats;
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
  jobId?: string;
  userId?: string;
  workspaceId?: string;
  type?: string;
  searchQuery?: string;
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  lastHeartbeat?: string | null;
  workerId?: string | null;
  lockedAt?: string | null;
  leaseUntil?: string | null;
  stopRequested?: boolean;
  priority?: 'high' | 'normal' | 'low';
  executionMode?: 'cloud' | 'local' | 'embedded';
  aiProvider?: string;
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
  verifiedCompanies?: number;
  unverifiedCompanies?: number;
  websitesFound: number;
  websitesProcessed: number;
  emailsFound: number;
  phonesFound: number;
  peopleFound: number;
  duplicatesRemoved: number;
  currentStepText: string;
  prospects: DiscoveredProspect[];
  sources?: DiscoverySource[];
  logs: ActivityLog[];
  queries: string[];

  // Granular Discovery Counters:
  searchQueriesCompleted?: number;
  duplicatesSkipped?: number;
  activitySourcesChecked?: number;
  companiesSaved?: number;
  companiesHandedOff?: number;
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
  aiProvider?: string;
  aiModel?: string;
  currentJobId?: string | null;
  startedAt?: string;
  version?: string;
}

// ==========================================
// EXTERNAL AI COMPANY RESEARCH (OPENROUTER & WEB SEARCH)
// ==========================================

export type ResearchEvidenceStatus =
  | 'Official source'
  | 'Credible secondary source'
  | 'Search lead — needs verification'
  | 'Conflicting evidence'
  | 'Unknown';

export type ResearchSourceType =
  | 'official_site'
  | 'government_registry'
  | 'business_directory'
  | 'linkedin_public'
  | 'press_or_report'
  | 'general_web'
  | 'unknown';

export interface ResearchedField<T> {
  value?: T;
  source_url?: string;
  source_type?: ResearchSourceType;
  evidence_snippet?: string;
  confidence: ResearchEvidenceStatus;
  research_date: string;
}

export interface ResearchedPerson {
  full_name: string;
  job_title: string;
  company_association: string;
  department?: string;
  profile_url?: string;
  is_company_page?: boolean;
  source_url: string;
  evidence_snippet: string;
  confidence: ResearchEvidenceStatus;
  research_timestamp: string;
  needs_review?: boolean;
}

export interface ResearchedCompanyProfile {
  // Identity
  official_company_name?: ResearchedField<string>;
  official_website?: ResearchedField<string>;
  domain?: ResearchedField<string>;
  linkedin_page?: ResearchedField<string>;
  location?: ResearchedField<string>;
  industry?: ResearchedField<string>;

  // Profile
  what_company_does?: ResearchedField<string>;
  main_products_or_services?: ResearchedField<string[]>;
  company_description?: ResearchedField<string>;
  business_category?: ResearchedField<string>;

  // Firmographics
  employee_count?: ResearchedField<string>;
  employee_range?: ResearchedField<string>;
  employee_count_type?: 'exact' | 'approximate' | 'range' | 'lower_bound' | 'upper_bound';
  founded_year?: ResearchedField<string>;
  incorporation_year?: ResearchedField<string>; // Legal incorporation if distinct from founding

  // Documented People & Decision-Makers
  decision_makers: ResearchedPerson[];
}

export interface ResearchConfig {
  openrouter_api_key?: string;
  has_openrouter_key?: boolean;
  model?: string; // Default: 'meta-llama/llama-3.3-70b-instruct' or 'google/gemini-2.5-flash'
  search_provider?: 'auto' | 'openrouter_web' | 'duckduckgo';
  enabled?: boolean;
  max_search_results?: number;
  cache_ttl_hours?: number;
}

export interface CompanyResearchRequest {
  companyName: string;
  domain?: string;
  website?: string;
  location?: string;
  fields?: string[];
  forceRefresh?: boolean;
  userId?: string;
  model?: string;
  searchProvider?: 'auto' | 'openrouter_web' | 'duckduckgo';
}

export interface ResearchSourceItem {
  title: string;
  url: string;
  snippet: string;
  source_type: ResearchSourceType;
}

export interface CompanyResearchResult {
  success: boolean;
  company_name: string;
  domain: string;
  researched_profile: ResearchedCompanyProfile;
  sources_used: ResearchSourceItem[];
  metadata: {
    provider: string;
    model: string;
    search_integration: string;
    duration_ms: number;
    timestamp: string;
    from_cache: boolean;
    tokens_used?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    firebase_saved: boolean;
    firebase_company_id?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ResearchStatusResponse {
  configured: boolean;
  has_openrouter_key: boolean;
  active_model: string;
  search_integration: string;
  cache_stats: {
    total_entries: number;
    active_entries: number;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHits: number;
    totalLatencyMs: number;
    averageLatencyMs: number;
  };
  supported_providers: string[];
}

export type EmailVerificationStatus = 'Valid' | 'Invalid' | 'Risky' | 'Unknown' | 'Not checked';
export type EmailSyntaxStatus = 'valid' | 'invalid';
export type EmailDomainStatus = 'valid' | 'invalid' | 'unknown' | 'timeout' | 'error';
export type EmailMxStatus = 'valid' | 'fallback_a' | 'missing' | 'timeout' | 'error';
export type EmailDisposableStatus = 'clean' | 'disposable';
export type EmailSmtpStatus = 'accepted' | 'rejected' | 'catch_all' | 'blocked' | 'timeout' | 'unavailable' | 'disabled' | 'skipped';
export type EmailCategory = 'professional_personal' | 'generic_business' | 'personal_provider' | 'unknown';

export interface EmailVerificationResult {
  email: string;
  normalized_email: string;
  company_id?: string;
  company_name?: string;
  source_url?: string;
  email_category: EmailCategory;
  verification_status: EmailVerificationStatus;
  syntax_status: EmailSyntaxStatus;
  domain_status: EmailDomainStatus;
  mx_status: EmailMxStatus;
  disposable_status: EmailDisposableStatus;
  smtp_status: EmailSmtpStatus;
  verification_provider: 'self_hosted';
  verified_at: string;
  last_checked_at: string;
  verification_error?: string;
  // BounceBan-grade deliverability metrics
  deliverability_score?: number;
  bounce_probability?: string;
  is_catch_all?: boolean;
  is_disposable?: boolean;
  is_role_account?: boolean;
  is_free_provider?: boolean;
  mx_provider?: string;
  has_spf?: boolean;
  has_dmarc?: boolean;
  spf_record?: string;
  dmarc_record?: string;
  mailbox_status?: 'deliverable' | 'undeliverable' | 'risky' | 'unknown' | 'catch_all';
  diagnostic_factors?: Array<{
    name: string;
    status: 'passed' | 'failed' | 'warning';
    detail: string;
  }>;
  verification_details?: {
    reason?: string;
    mx_records?: Array<{ exchange: string; priority: number }>;
    has_fallback_a?: boolean;
    a_records?: string[];
    is_role_account?: boolean;
    role_department?: string;
    smtp_banner?: string;
    smtp_code?: number;
    smtp_response?: string;
    latency_ms?: number;
    deliverability_score?: number;
    bounce_probability?: string;
    is_catch_all?: boolean;
    mx_provider?: string;
    has_spf?: boolean;
    has_dmarc?: boolean;
  };
}

export interface EmailVerificationJobStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  processed: number;
  valid_count: number;
  invalid_count: number;
  risky_count: number;
  unknown_count: number;
  started_at: string;
  completed_at?: string;
  results: EmailVerificationResult[];
  current_email?: string;
  error?: string;
}

export interface EmailVerifierStatusResponse {
  healthy: boolean;
  provider: 'self_hosted';
  supported_checks: {
    syntax: boolean;
    domain_dns: boolean;
    mx_records: boolean;
    a_record_fallback: boolean;
    disposable_detection: boolean;
    role_account_detection: boolean;
    smtp_probing: boolean;
  };
  smtp_available: boolean;
  smtp_probe_enabled: boolean;
  environment_note?: string;
  cache_stats: {
    total_cached: number;
    valid_count: number;
    invalid_count: number;
    risky_count: number;
    unknown_count: number;
  };
}

export interface DecisionMakerContact {
  name: string;
  role: string;
  department?: string;
  company?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  identityConfidence?: 'Verified' | 'Supported' | 'Suggested';
  emailAssociationStatus?: 'explicit' | 'inferred' | 'none';
  evidence?: string;
}

export interface GoogleMapsLead {
  id: string;
  name: string;
  category?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  price_level?: string;
  maps_url: string;
  place_id?: string;
  opening_hours?: string[];
  description?: string;
  extracted_emails?: Array<{
    email: string;
    type: 'generic' | 'personal';
    status?: EmailVerificationStatus;
  }>;
  contacts?: Array<{
    name: string;
    role: string;
    email?: string;
    phone?: string;
    department?: string;
    identityConfidence?: 'Verified' | 'Supported' | 'Suggested';
    emailAssociationStatus?: 'explicit' | 'inferred' | 'none';
    sourceUrl?: string;
  }>;
  decision_makers?: DecisionMakerContact[];
  social_profiles?: SocialProfiles;
  scraped_at?: string;
  crawl_status?: 'idle' | 'crawling' | 'crawled' | 'no_website' | 'failed';
  lead_score?: number; // 0 - 100
  priority_tier?: 'High Priority' | 'Medium Priority' | 'Low Priority';
  recommendation_reasons?: string[];
  buying_signals?: BuyingSignalItem[];
}

export interface GoogleMapsScrapeJob {
  id: string;
  userId?: string;
  command: string;
  location?: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  current_step: string;
  total_found: number;
  websites_scraped: number;
  emails_found: number;
  verified_emails: number;
  contacts_found: number;
  decision_makers_found?: number;
  created_at: string;
  completed_at?: string;
  leads: GoogleMapsLead[];
  grounding_chunks?: Array<{
    title: string;
    uri: string;
    placeId?: string;
  }>;
  logs: Array<{
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>;

  // Granular Progress & Deduplication Metrics:
  results_discovered?: number;
  results_processed?: number;
  results_extracted?: number;
  duplicates_skipped?: number;
  failed_results?: number;
  remaining_results?: number;
  target_count?: number;
  current_stage?: string;
}

// ==========================================
// BUYING SIGNALS RADAR & LIVE NEWS FEED
// ==========================================

export type BuyingSignalType =
  | 'hiring'
  | 'funding'
  | 'expansion'
  | 'leadership'
  | 'product'
  | 'partnership'
  | 'acquisition'
  | 'technology'
  | 'news';

export interface BuyingSignalItem {
  id: string;
  companyId?: string;
  companyName: string;
  domain?: string;
  website?: string;
  signalType: BuyingSignalType;
  headline: string;
  description: string;
  sourceUrl?: string;
  sourceName?: string;
  dateDetected: string;
  confidence: 'Verified' | 'Supported' | 'Suggested';
  freshness: 'Today' | 'This Week' | 'This Month' | 'Recent';
  relevanceScore: number; // 0 - 100
  buyingIntentScore?: number; // 0 - 100
  intentTier?: 'High Intent' | 'Moderate Intent' | 'Emerging Signal';
  relatedContactName?: string;
  relatedContactRole?: string;
  evidenceSnippet?: string;
}

export interface NewsFeedItem {
  id: string;
  companyName: string;
  domain?: string;
  headline: string;
  summary: string;
  publishedDate: string;
  signalType: BuyingSignalType;
  importance: 'high' | 'medium' | 'low';
  source: string;
  sourceUrl: string;
  aiRelevanceExplanation: string;
  relatedProspectId?: string;
  category: 'Funding' | 'Hiring' | 'Expansion' | 'Leadership' | 'Product' | 'Partnership' | 'Acquisition' | 'Company News' | 'Industry';
}

export interface DailyOpportunity {
  id: string;
  companyId: string;
  companyName: string;
  domain: string;
  website: string;
  location?: string;
  industry?: string;
  employeeCount?: string;
  leadScore: number; // 0 - 100
  buyingSignalScore: number; // 0 - 100
  intentTier: 'High Intent' | 'Moderate Intent' | 'Emerging Signal';
  reasons: string[];
  bestAction: string;
  keyContact?: {
    name: string;
    role: string;
    email?: string;
    phone?: string;
    confidence?: string;
  };
  recentSignals: BuyingSignalItem[];
}

// ==========================================
// CLOUD BACKGROUND WORKER & JOB OBSERVALITY
// ==========================================

export type WorkerJobType = 'ai_discovery' | 'maps_scraping' | 'website_crawling' | 'signals_monitor';
export type WorkerJobStatus = 'queued' | 'running' | 'paused' | 'stopping' | 'stopped' | 'completed' | 'failed';

export interface CloudWorkerJob {
  id: string;
  jobType: WorkerJobType;
  userId?: string;
  searchConfiguration: any;
  createdTime: string;
  startedTime?: string;
  lastHeartbeat: string;
  completedTime?: string;
  progress: number; // 0 - 100
  currentTask: string;
  resultsDiscovered: number;
  resultsProcessed: number;
  resultsSuccess: number;
  duplicatesSkipped: number;
  failedCount: number;
  status: WorkerJobStatus;
  workerId?: string;
  workerHost?: string;
  checkpointsSaved?: number;
  errors?: string[];
  observabilityLogs?: Array<{
    timestamp: string;
    stage: string;
    status: string;
    itemsProcessed: number;
    apiCalls: number;
    aiCalls: number;
    message: string;
  }>;
}

export interface WorkerHealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  uptimeSeconds: number;
  activeJobsCount: number;
  queuedJobsCount: number;
  workerId: string;
  environment: string;
  digitalOceanConfigured: boolean;
  geminiConfigured: boolean;
  lastHeartbeat: string;
}

// ==========================================
// SMART SEGMENTATION & AI DATA CLEANUP
// ==========================================

export type SmartSegmentId =
  | 'all'
  | 'high_value'
  | 'law_firms'
  | 'small_businesses'
  | 'growing_companies'
  | 'missing_decision_maker'
  | 'generic_emails_only'
  | 'verified_dm_emails'
  | 'phone_and_email'
  | 'weak_website_data'
  | 'recently_discovered';

export interface SmartSegment {
  id: SmartSegmentId;
  name: string;
  description: string;
  count: number;
  badgeColor: string;
}

export interface AiCleanupIssue {
  id: string;
  type: 'duplicate_company' | 'duplicate_contact' | 'duplicate_email' | 'conflicting_info' | 'invalid_field' | 'missing_enrichment';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedRecords: Array<{
    id: string;
    name: string;
    domain?: string;
    detail?: string;
  }>;
  suggestedAction: string;
  canAutoResolve: boolean;
}

// ==========================================
// AI SALES COPILOT & INTELLIGENCE SUITE
// ==========================================

export type OutreachTone = 'consultative' | 'direct' | 'executive' | 'challenger' | 'conversational';

export interface OutreachGenerationRequest {
  contactName: string;
  contactRole?: string;
  companyName: string;
  industry?: string;
  valueProposition: string;
  tone?: OutreachTone;
  targetDomain?: string;
  personalizationContext?: string;
}

export interface OutreachSequenceResult {
  subjectLines: Array<{ text: string; openRateEstimate: string; style: string }>;
  coldEmail: { hook: string; body: string; callToAction: string; fullText: string };
  linkedInConnection: { characterCount: number; message: string };
  linkedInInMail: { subject: string; body: string };
  coldCallScript: { openingHook: string; pitch: string; qualifyingQuestion: string; objectionPivot: string };
  followUps: Array<{ day: number; label: string; subject: string; body: string }>;
  metadata: { modelUsed: string; generatedAt: string };
}

export interface AccountDossierRequest {
  companyName: string;
  domain?: string;
  industry?: string;
  offeringSummary?: string;
}

export interface AccountDossierResult {
  companyName: string;
  domain: string;
  icpFitScore: number;
  icpTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  executiveSummary: string;
  likelyTechStack: string[];
  corePainPoints: Array<{ title: string; detail: string; severity: 'High' | 'Medium' }>;
  buyingCommittee: {
    economicBuyer: { title: string; priorities: string };
    champion: { title: string; priorities: string };
    blocker: { title: string; risks: string };
  };
  competitiveWedge: string;
  icebreakers: string[];
  recommendedPitchAngle: string;
  metadata: { modelUsed: string; generatedAt: string };
}

export interface IcpArchitectRequest {
  productDescription: string;
  targetPriceTier?: 'SMB' | 'Mid-Market' | 'Enterprise' | 'All';
  currentCustomerProfile?: string;
}

export interface IcpArchitectResult {
  icpName: string;
  coreIndustries: string[];
  subNiches: string[];
  employeeSizeRange: string;
  revenueRange: string;
  keyTitles: { primary: string[]; secondary: string[] };
  disqualifiers: string[];
  valueHook: string;
  searchQueries: {
    discoveryQueries: string[];
    googleMapsQueries: string[];
    booleanLinkedinQuery: string;
  };
  metadata: { modelUsed: string; generatedAt: string };
}

export interface ObjectionHandlerRequest {
  objection: string;
  productOrService?: string;
  prospectRole?: string;
}

export interface ObjectionHandlerResult {
  objection: string;
  psychologicalAnalysis: string;
  frameworks: Array<{
    name: string;
    strategy: string;
    script: string;
    riskLevel: 'Safe' | 'Bold' | 'Consultative';
  }>;
  followUpDiscoveryQuestion: string;
  pitfallsToAvoid: string[];
  metadata: { modelUsed: string; generatedAt: string };
}

// ---------------------------------------------------------------------------
// Social Demand Radar Types (Reddit, LinkedIn, Twitter, Forums Intent Mining)
// ---------------------------------------------------------------------------

export type SocialDemandPlatform = 'reddit' | 'linkedin' | 'twitter' | 'quora' | 'hackernews' | 'web_forum';
export type DemandAudienceType = 'B2B' | 'B2C';
export type DemandUrgency = 'Immediate' | 'High' | 'Medium' | 'Exploring';

export interface SocialDemandLead {
  id: string;
  platform: SocialDemandPlatform;
  audienceType: DemandAudienceType;
  serviceCategory: string; // e.g. "Accounting & Bookkeeping", "Web Development", "SEO & Marketing"
  postTitle: string;
  postContent: string;
  postUrl: string;
  sourceChannel: string; // e.g. "r/smallbusiness", "LinkedIn Public Posts", "r/Accounting"
  postedAt: string;
  author: {
    username: string;
    displayName: string;
    profileUrl?: string;
    companyName?: string;
    role?: string;
    location?: string;
  };
  demandDetails: {
    specificNeed: string;
    urgency: DemandUrgency;
    budget?: string;
    keyRequirements: string[];
    buyingIntentScore: number; // 0 - 100
  };
  contactPoints: {
    email?: string;
    emailStatus?: 'verified' | 'synthesized' | 'unverified';
    emailPermutations?: string[];
    phone?: string;
    directMessageUrl?: string;
    companyWebsite?: string;
    socialProfileUrl?: string;
  };
  aiDraftOutreach?: {
    channel: 'reddit_dm' | 'linkedin_msg' | 'cold_email';
    subject?: string;
    message: string;
  };
  scrapedAt: string;
  status: 'new' | 'contacted' | 'saved' | 'dismissed';
  crmSyncStatus?: {
    synced: boolean;
    provider?: string;
    syncedAt?: string;
    externalId?: string;
    error?: string;
  };
}

export interface SocialRadarScanRequest {
  query?: string;
  serviceCategory?: string;
  audienceType?: 'ALL' | 'B2B' | 'B2C';
  platforms?: SocialDemandPlatform[];
  urgency?: 'ALL' | DemandUrgency;
  subreddits?: string[];
  limit?: number;
}

export interface SocialRadarStats {
  totalLeads: number;
  b2bCount: number;
  b2cCount: number;
  immediateCount: number;
  redditCount: number;
  linkedinCount: number;
  twitterCount: number;
  forumsCount: number;
  lastScanAt?: string;
}

// ---------------------------------------------------------------------------
// Direct CRM & In-House Tool Integration Types
// ---------------------------------------------------------------------------

export type CrmProviderType = 'in_house' | 'apollo' | 'salesforce' | 'hubspot' | 'pipedrive';

export interface CrmInHouseConfig {
  endpoint_url: string;
  http_method: 'POST' | 'PUT';
  auth_type: 'none' | 'bearer' | 'api_key' | 'custom_header';
  auth_token?: string;
  api_key_header?: string;
  api_key_value?: string;
  custom_headers?: Record<string, string>;
  field_mapping?: {
    name_field?: string;
    email_field?: string;
    company_field?: string;
    phone_field?: string;
    title_field?: string;
    source_field?: string;
    intent_field?: string;
    urgency_field?: string;
    budget_field?: string;
    notes_field?: string;
    url_field?: string;
  };
}

export interface CrmApolloConfig {
  api_key?: string;
  label_names?: string;
}

export interface CrmSalesforceConfig {
  mode: 'rest_api' | 'web_to_lead';
  // REST API mode:
  instance_url?: string;
  access_token?: string;
  lead_object?: 'Lead' | 'Contact';
  // Web-to-Lead mode (Zero OAuth, immediate):
  oid?: string;
  web_to_lead_url?: string;
  lead_source?: string;
}

export interface CrmHubspotConfig {
  access_token?: string;
  lifecycle_stage?: string;
  lead_status?: string;
}

export interface CrmPipedriveConfig {
  api_token?: string;
  company_domain?: string;
}

export interface LeadHookApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used_at?: string;
}

export interface CrmConfig {
  active_provider: CrmProviderType;
  auto_sync_enabled: boolean;
  in_house: CrmInHouseConfig;
  apollo?: CrmApolloConfig;
  salesforce: CrmSalesforceConfig;
  hubspot: CrmHubspotConfig;
  pipedrive: CrmPipedriveConfig;
  leadhook_api_keys?: LeadHookApiKey[];
}

export interface CrmSyncLog {
  id: string;
  timestamp: string;
  leadId: string;
  leadTitle: string;
  companyName: string;
  provider: CrmProviderType;
  status: 'success' | 'failed';
  statusCode?: number;
  latencyMs: number;
  externalId?: string;
  message: string;
  error?: string;
}

// 1. Website Tech Stack & Tooling Detector Types
export interface DetectedTechnology {
  name: string;
  category: 'analytics' | 'crm' | 'cms' | 'payments' | 'cloud' | 'marketing' | 'advertising' | 'security' | 'other';
  icon?: string;
  confidence: number;
  description?: string;
}

export interface TechStackResult {
  url: string;
  domain: string;
  technologies: DetectedTechnology[];
  analyzedAt: string;
}

// 2. Waterfall Decision-Maker Finder & Phone Number Enrichment Types
export interface WaterfallStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  details?: string;
  latencyMs?: number;
}

export interface WaterfallEnrichmentResult {
  contactId: string;
  steps: WaterfallStep[];
  enrichedFields: {
    direct_phone?: string;
    phone_type?: 'mobile' | 'direct' | 'office' | 'toll_free';
    verified_email?: string;
    linkedin_url?: string;
    executive_title?: string;
    tech_stack?: string[];
  };
  confidence: number;
}

// 3. Autonomous "Always-On" Lead Hunting Agents Types
export interface HuntingAgent {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'running';
  schedule: 'hourly' | 'every_6_hours' | 'daily' | 'weekly';
  targetQuery: string;
  industry?: string;
  geography?: string;
  minIcpScore: number;
  autoSyncCrm: boolean;
  autoWaterfallEnrich: boolean;
  targetCountPerRun: number;
  lastRunAt?: string;
  nextRunAt?: string;
  totalLeadsFound: number;
  createdAt: string;
}

export interface HuntingAgentRun {
  id: string;
  agentId: string;
  agentName: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  leadsFound: number;
  leadsSyncedCrm: number;
  logs: string[];
}

// 4. Team Collaboration, Roles & Multi-Workspace Types
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface WorkspaceMember {
  id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  avatar?: string;
  joinedAt: string;
  lastActiveAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role?: WorkspaceRole;
  members: WorkspaceMember[];
  assignedLeadsCount?: number;
  createdAt: string;
}

// 5. Inbound Webhook Listener & Chrome Extension Gateway Types
export interface InboundWebhookLog {
  id: string;
  receivedAt: string;
  source: 'chrome_extension' | 'webhook' | 'bookmarklet' | 'form';
  targetUrl?: string;
  companyName?: string;
  contactsFound: number;
  status: 'processed' | 'queued' | 'failed';
  payloadSummary?: string;
}
