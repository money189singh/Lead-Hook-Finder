import { DiscoveryCriteria } from './types';
import { globalDiscoveryLedger } from './ledger';

/**
 * Known mega-cap enterprise companies to exclude from search queries
 * so search engines don't waste slots returning giant monopolies.
 */
const EXCLUDE_MEGACAP_TERMS = [
  '-microsoft',
  '-salesforce',
  '-hubspot',
  '-oracle',
  '-adobe',
  '-workday',
  '-servicenow',
  '-snowflake',
  '-stripe',
  '-shopify',
  '-atlassian',
  '-zoom',
  '-slack',
  '-intuit',
  '-amazon',
  '-google',
  '-wikipedia',
  '-forbes',
  '-g2.com',
  '-capterra',
];

/**
 * Industry sub-vertical expansions for uncovering hidden gem startups and SMBs
 */
const SUB_VERTICAL_MAP: Record<string, string[]> = {
  saas: [
    'vertical SaaS',
    'workflow automation software',
    'B2B platform',
    'compliance software',
    'developer tools API',
    'inventory management software',
    'procurement automation',
    'customer success software',
    'field service management software',
    'billing and revenue operations software',
    'enterprise collaboration tool',
    'AI copilot workflow software',
  ],
  ai: [
    'generative AI agent startup',
    'applied AI platform',
    'computer vision software',
    'enterprise LLM workflow',
    'speech AI infrastructure',
    'autonomous AI workflow tool',
    'AI data pipeline platform',
    'vertical AI assistant',
  ],
  fintech: [
    'embedded finance infrastructure',
    'neobank platform',
    'B2B payments API',
    'wealthtech software',
    'insurtech platform',
    'payroll automation software',
    'treasury management software',
    'lending technology startup',
    'cross-border payment software',
  ],
  healthcare: [
    'digital health platform',
    'healthtech SaaS',
    'clinical workflow software',
    'telehealth technology startup',
    'medical practice management software',
    'health data interoperability',
    'patient engagement platform',
  ],
  ecommerce: [
    'e-commerce logistics software',
    'DTC fulfillment platform',
    'omnichannel inventory software',
    'e-commerce personalization tool',
    'returns automation software',
  ],
};

/**
 * Generates an expansive, progressive set of targeted search queries.
 * Designed to bypass mega-caps, target active buying signals (funding, hiring),
 * explore long-tail niches, and guarantee fresh, unseen prospects every time.
 */
export function generateSearchQueries(criteria: DiscoveryCriteria): string[] {
  const queries: string[] = [];
  const added = new Set<string>();

  const addQuery = (q: string) => {
    const clean = q.replace(/\s+/g, ' ').trim();
    if (clean && !added.has(clean.toLowerCase())) {
      added.add(clean.toLowerCase());
      queries.push(clean);
    }
  };

  const industry = criteria.industry?.trim() || '';
  const country = criteria.country?.trim() || '';
  const state = criteria.state?.trim() || '';
  const city = criteria.city?.trim() || '';
  const keywords = criteria.keywords?.trim() || '';
  const jobTitle = criteria.jobTitle?.trim() || '';
  const tech = criteria.technology?.trim() || '';
  const compName = criteria.companyName?.trim() || '';
  const scale = criteria.companyScale || 'startups';
  const excludeMega = criteria.excludeMegaCaps ?? true;
  const fundingStage = criteria.fundingStage?.trim() || '';
  const hiringActive = criteria.hiringActive;
  const buyingSignal = criteria.buyingSignalFilter || 'all';

  // Mega-cap negative filter string
  const negFilters = excludeMega ? EXCLUDE_MEGACAP_TERMS.slice(0, 10).join(' ') : '';

  // If specific company name is provided
  if (compName) {
    addQuery(`${compName} official website`);
    if (jobTitle) addQuery(`${compName} ${jobTitle} leadership team`);
    if (industry) addQuery(`${compName} ${industry} company profile`);
    addQuery(`${compName} hiring careers "open positions"`);
    addQuery(`${compName} funding raised investment announcement`);
    return queries;
  }

  // Location string construction
  const locParts = [city, state, country].filter(Boolean);
  const locationStr = locParts.length > 0 ? locParts.join(' ') : 'United States';

  // Base sector
  const baseSector = industry || (keywords ? keywords.split(',')[0].trim() : 'B2B software');
  const lowerSector = baseSector.toLowerCase();

  // Determine if this is a local service or trade industry
  const isLocalOrTrade =
    /repair|auto|mechanic|law|attorney|legal|plumb|electric|hvac|roof|dental|dentist|clinic|doctor|chiro|account|cpa|realt|estate|clean|contractor|salon|barber|restaur|cafe|bakery/i.test(
      baseSector
    );

  // Find relevant sub-verticals for niche expansion using word boundaries (preventing "repair" matching "ai")
  let subVerticals: string[] = [];
  if (!isLocalOrTrade) {
    for (const [key, list] of Object.entries(SUB_VERTICAL_MAP)) {
      const wordRegex = new RegExp(`\\b${key}\\b`, 'i');
      if (wordRegex.test(lowerSector)) {
        subVerticals = list;
        break;
      }
    }
  }

  if (subVerticals.length === 0) {
    if (isLocalOrTrade) {
      subVerticals = [
        `top ${baseSector} services`,
        `best rated ${baseSector}`,
        `local ${baseSector} specialists`,
        `trusted ${baseSector} providers`,
      ];
    } else {
      subVerticals = [
        `${baseSector} startup`,
        `innovative ${baseSector} software`,
        `emerging ${baseSector} platform`,
        `boutique ${baseSector} company`,
        `fast growing ${baseSector}`,
      ];
    }
  }

  // Scale qualifiers
  const scaleTerms: string[] = [];
  if (scale === 'startups') {
    scaleTerms.push('startup', 'seed stage', 'series A', 'early stage');
  } else if (scale === 'smb') {
    scaleTerms.push('small business', 'SMB', 'boutique', '10-50 employees');
  } else if (scale === 'mid_market') {
    scaleTerms.push('mid-market', 'scaleup', 'growth stage', '50-200 employees');
  } else {
    scaleTerms.push('startup', 'emerging company', 'SMB software');
  }

  // Clean sanitized sector
  const cleanSector = baseSector.replace(/["']/g, '').trim();

  // ==========================================
  // Strategy 0: High-Yield Natural Discovery Queries (Always First)
  // These are clean, realistic queries that return 10-20 genuine business domains
  // ==========================================
  if (isLocalOrTrade) {
    addQuery(`${cleanSector} ${locationStr}`);
    addQuery(`best ${cleanSector} in ${locationStr}`);
    addQuery(`top rated ${cleanSector} ${locationStr}`);
    addQuery(`${cleanSector} services ${locationStr}`);
    addQuery(`${cleanSector} companies ${locationStr}`);
    addQuery(`local ${cleanSector} providers ${locationStr}`);
  } else {
    addQuery(`${cleanSector} companies ${locationStr}`);
    addQuery(`${cleanSector} startups ${locationStr}`);
    addQuery(`top ${cleanSector} software ${locationStr}`);
    addQuery(`emerging ${cleanSector} platforms ${locationStr}`);
    addQuery(`best ${cleanSector} providers ${locationStr}`);
    addQuery(`${cleanSector} businesses in ${locationStr}`);
  }

  // ==========================================
  // Strategy 1: Active Buying Signals (Funding / Growth) - Tech/Startups only
  // ==========================================
  const isTechOrStartup = !isLocalOrTrade && (lowerSector.includes('software') || lowerSector.includes('tech') || lowerSector.includes('saas') || scale === 'startups');
  if ((buyingSignal === 'funding' || fundingStage) || (isTechOrStartup && buyingSignal === 'any_signal')) {
    const stageKeyword = fundingStage || 'Seed OR Series A';
    addQuery(`${cleanSector} startups ${stageKeyword} 2025 2026 ${locationStr}`);
    addQuery(`${cleanSector} startups funding round ${locationStr}`);
    addQuery(`recently funded ${cleanSector} startup ${locationStr}`);
  }

  // ==========================================
  // Strategy 2: Active Buying Signals (Hiring / Growth)
  // ==========================================
  if (buyingSignal === 'hiring' || buyingSignal === 'any_signal' || hiringActive) {
    addQuery(`${cleanSector} companies hiring ${locationStr}`);
    addQuery(`${cleanSector} careers open positions ${locationStr}`);
  }

  // ==========================================
  // Strategy 3: Sub-Vertical & Specific Niche Expansion
  // ==========================================
  for (const niche of subVerticals.slice(0, 5)) {
    const cleanNiche = niche.replace(/["']/g, '').trim();
    addQuery(`${cleanNiche} ${locationStr}`);
    addQuery(`top ${cleanNiche} companies in ${locationStr}`);
  }

  // ==========================================
  // Strategy 4: Role & Decision Maker Discovery
  // ==========================================
  if (jobTitle) {
    const mainTitles = jobTitle.split(/[,/]/).map((t) => t.trim().replace(/["']/g, '')).filter(Boolean);
    for (const title of mainTitles.slice(0, 2)) {
      addQuery(`${cleanSector} ${locationStr} ${title}`);
    }
  }

  // ==========================================
  // Strategy 5: Secondary Geographic Hubs (If broad national query)
  // ==========================================
  if (!city && country.toLowerCase().includes('united states')) {
    const regionalHubs = ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Georgia'];
    const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const rotatedHub = regionalHubs[daySeed % regionalHubs.length];
    addQuery(`${cleanSector} companies in ${rotatedHub}`);
  }

  // Fallback if queries are too short
  if (queries.length < 5) {
    addQuery(`${cleanSector} providers ${locationStr}`);
    addQuery(`list of ${cleanSector} companies ${locationStr}`);
  }

  // Cap queries according to criteria.maxQueries (default up to 25)
  const maxQueries = Math.max(8, Math.min(criteria.maxQueries || 20, 40));
  return queries.slice(0, maxQueries);
}
