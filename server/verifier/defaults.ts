import {
  VerificationCreditSettings,
  VerifierApiCredential,
  BusinessVerifierRules,
  CustomVerificationOptions,
  GovFilesConfig,
} from '../../src/types';

export const DEFAULT_GOVFILES_CONFIG: GovFilesConfig = {
  enabled: true,
  apiKey: process.env.GOVFILES_API_KEY || '',
  api_key: process.env.GOVFILES_API_KEY || '',
  status: 'active',
  has_key: Boolean(process.env.GOVFILES_API_KEY),
};

export const DEFAULT_CREDIT_SETTINGS: VerificationCreditSettings = {
  low_cost: 0.5,
  medium_cost: 1.0,
  high_cost: 2.0,
  available_credits: 10000,
  total_credits_used: 0,
};

export const DEFAULT_VERIFIER_API_CONFIG: VerifierApiCredential[] = [
  {
    id: 'api-govfiles-1',
    service: 'govfiles',
    name: 'GovFiles Corporate Entity Registry API',
    apiKey: process.env.GOVFILES_API_KEY || '',
    enabled: true,
    priority: 1,
    usage: 0,
    quota: 5000,
    status: 'active',
  },
  {
    id: 'api-gmaps-1',
    service: 'google_maps',
    name: 'Google Maps / Places API',
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    enabled: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    priority: 1,
    usage: 0,
    quota: 5000,
    status: process.env.GOOGLE_MAPS_API_KEY ? 'active' : 'disabled',
  },
  {
    id: 'api-search-1',
    service: 'search_1',
    name: 'Search API #1 (Google / SerpApi)',
    apiKey: process.env.SERPAPI_API_KEY || process.env.SEARCH_API_KEY || '',
    enabled: Boolean(process.env.SERPAPI_API_KEY || process.env.SEARCH_API_KEY),
    priority: 1,
    usage: 0,
    quota: 2500,
    status: process.env.SERPAPI_API_KEY || process.env.SEARCH_API_KEY ? 'active' : 'disabled',
  },
  {
    id: 'api-search-2',
    service: 'search_2',
    name: 'Search API #2 (DuckDuckGo / Backup Crawler)',
    apiKey: '',
    enabled: true,
    priority: 2,
    usage: 0,
    quota: 10000,
    status: 'active',
  },
  {
    id: 'api-gov-1',
    service: 'gov_1',
    name: 'Government Registry API #1 (OpenCorporates / Unified)',
    apiKey: process.env.OPENCORPORATES_API_KEY || '',
    enabled: true,
    priority: 1,
    usage: 0,
    quota: 1000,
    status: 'active',
  },
  {
    id: 'api-gov-2',
    service: 'gov_2',
    name: 'Government Registry API #2 (State SOS / SEC EDGAR)',
    apiKey: '',
    enabled: true,
    priority: 2,
    usage: 0,
    quota: 5000,
    status: 'active',
  },
];

export const DEFAULT_BUSINESS_VERIFIER_RULES: BusinessVerifierRules = {
  verification_instructions: `Verify the current operational status of the target business using multi-source evidence cross-referencing.

Examine Google Maps operational status, website HTTP accessibility, content recency dates, government registry filings, and recent search reviews.

Never guess. Insufficient or conflicting evidence must be classified as UNCERTAIN.`,
  evidence_requirements: `A business can only be marked OPEN if there is credible current evidence of operation (active website, current reviews, or Google Maps verified operating).

PERMANENTLY CLOSED requires explicit confirmation from Google Maps, government dissolution filings, or closure notices on official domain.

TEMPORARILY CLOSED requires official notice of temporary closure.`,
  search_behavior: `Query closure signals ('permanently closed', 'closed', 'reviews 2026') only when status is not already established by decisive primary sources.`,
  status_rules: `OPEN: Credible current operational evidence.
TEMPORARILY CLOSED: Confirmed temporary shutdown.
PERMANENTLY CLOSED: Explicit confirmation of cessation of business.
UNCERTAIN: Conflicting evidence, outdated information, or unverified.`,
  confidence_rules: `HIGH: Corroborating evidence across 2+ authoritative channels.
MEDIUM: Single authoritative source without contradiction.
LOW: Partial or indirect signals.`,
  api_priority: `1. Google Maps / Places
2. Direct Website Health & Activity
3. Search API Verification
4. State Government Registry
5. AI Evidence Synthesizer (only on conflict/ambiguity)`,
  reverification_intervals: {
    open_days: 30,
    uncertain_days: 7,
    temporarily_closed_days: 14,
    permanently_closed_days: 0, // No recheck
  },
  ai_usage_rules: `AI must NOT perform every individual verification action. Collect structured evidence first. Call AI interpreter only when evidence is conflicting or ambiguous.`,
  credit_costs: {
    low: 0.5,
    medium: 1.0,
    high: 2.0,
  },
};

export const DEFAULT_CUSTOM_OPTIONS: CustomVerificationOptions = {
  checkWebsite: true,
  checkGoogleMaps: true,
  checkSearch: true,
  checkGovernment: false,
  checkRecentReviews: true,
  checkSocialActivity: false,
  aiOnlyWhenUncertain: true,
};
