import { CompanyActivityItem } from '../../src/types';
import { DiscoveryCriteria, DiscoveredProspect } from './types';

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
  matchScore: number; // 0-100%
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

// Known enterprise mega-caps to exclude when user asks for startups, SMBs, or emerging companies
export const MEGA_CAP_COMPANIES = new Set([
  'microsoft',
  'apple',
  'google',
  'alphabet',
  'amazon',
  'salesforce',
  'oracle',
  'ibm',
  'adobe',
  'hubspot',
  'workday',
  'servicenow',
  'snowflake',
  'sap',
  'meta',
  'facebook',
  'netflix',
  'cisco',
  'intel',
  'nvidia',
  'uber',
  'airbnb',
  'paypal',
  'atlassian',
  'zoom',
  'slack',
  'intuit',
  'shopify',
  'stripe',
  'databricks',
  'twillio',
  'palantir',
]);

export function isMegaCapCompany(companyName: string, domain?: string): boolean {
  const normName = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (MEGA_CAP_COMPANIES.has(normName)) return true;

  if (domain) {
    const root = domain.toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '');
    if (MEGA_CAP_COMPANIES.has(root)) return true;
  }
  return false;
}

/**
 * Extracts structured buying signals from activity items, titles, snippets, or web text.
 */
export function extractStructuredSignals(
  companyName: string,
  activities: CompanyActivityItem[] = [],
  snippets: string[] = []
): BuyingSignal[] {
  const signals: BuyingSignal[] = [];
  const allTexts = [
    ...activities.map((a) => `${a.title}. ${a.snippet}`),
    ...snippets,
  ];

  for (const text of allTexts) {
    const lower = text.toLowerCase();

    // 1. Funding / Capital Raised Detection
    if (
      lower.includes('raised') ||
      lower.includes('raises') ||
      lower.includes('funding round') ||
      lower.includes('series a') ||
      lower.includes('series b') ||
      lower.includes('seed round') ||
      lower.includes('pre-seed') ||
      lower.includes('venture capital') ||
      lower.includes('secures $') ||
      lower.includes('closes $') ||
      /\$\d+(\.\d+)?\s*(m|million|b|billion|k)/i.test(text)
    ) {
      // Extract amount
      const amountMatch = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(million|billion|m|b|k)/i);
      const amount = amountMatch ? `$${amountMatch[1]}${amountMatch[2].toUpperCase().slice(0, 1)}` : undefined;

      // Extract round
      let round = 'Venture Round';
      if (/pre-seed/i.test(text)) round = 'Pre-Seed';
      else if (/seed/i.test(text)) round = 'Seed';
      else if (/series\s+a/i.test(text)) round = 'Series A';
      else if (/series\s+b/i.test(text)) round = 'Series B';
      else if (/series\s+c/i.test(text)) round = 'Series C';
      else if (/growth/i.test(text)) round = 'Growth Round';

      const headline = amount ? `Raised ${amount} ${round}` : `Recent ${round}`;
      if (!signals.some((s) => s.type === 'funding')) {
        signals.push({
          type: 'funding',
          headline,
          detail: text.slice(0, 180),
          badgeLabel: `💰 ${headline}`,
          amount,
          round,
          confidence: amount ? 'High' : 'Medium',
        });
      }
    }

    // 2. Active Hiring Detection
    if (
      lower.includes('hiring') ||
      lower.includes('open roles') ||
      lower.includes('job openings') ||
      lower.includes('expanding the team') ||
      lower.includes('careers at') ||
      lower.includes('headcount growth') ||
      lower.includes('we are looking for')
    ) {
      // Detect roles
      const roles: string[] = [];
      if (/sales|sdr|account executive|bdr/i.test(text)) roles.push('Sales/SDRs');
      if (/engineer|developer|tech|full stack/i.test(text)) roles.push('Engineering');
      if (/product|designer/i.test(text)) roles.push('Product/Design');
      if (/marketing|growth/i.test(text)) roles.push('Marketing');

      const roleSummary = roles.length > 0 ? roles.join(' & ') : 'Multiple Roles';
      const headline = `Actively Hiring (${roleSummary})`;

      if (!signals.some((s) => s.type === 'hiring')) {
        signals.push({
          type: 'hiring',
          headline,
          detail: text.slice(0, 180),
          badgeLabel: `👥 Hiring: ${roleSummary}`,
          roles,
          confidence: 'High',
        });
      }
    }

    // 3. Product Launch & Milestone
    if (
      lower.includes('launches') ||
      lower.includes('launched') ||
      lower.includes('announces new') ||
      lower.includes('unveils') ||
      lower.includes('releases v') ||
      lower.includes('new ai') ||
      lower.includes('platform update')
    ) {
      if (!signals.some((s) => s.type === 'product_launch')) {
        signals.push({
          type: 'product_launch',
          headline: 'New Product / Major Launch',
          detail: text.slice(0, 180),
          badgeLabel: '🚀 New Product Launch',
          confidence: 'Medium',
        });
      }
    }

    // 4. Executive Leadership Change
    if (
      lower.includes('named ceo') ||
      lower.includes('appointed') ||
      lower.includes('new vp') ||
      lower.includes('chief revenue') ||
      lower.includes('joins as') ||
      lower.includes('leadership team')
    ) {
      if (!signals.some((s) => s.type === 'leadership_change')) {
        signals.push({
          type: 'leadership_change',
          headline: 'Executive Leadership Transition',
          detail: text.slice(0, 180),
          badgeLabel: '👔 Leadership Appointment',
          confidence: 'High',
        });
      }
    }
  }

  return signals;
}

/**
 * Calculates a transparent Criteria Match Explanation & Fit Score for a candidate company
 */
export function evaluateProspectCriteria(
  prospect: Partial<DiscoveredProspect>,
  criteria: DiscoveryCriteria,
  isNew: boolean
): CriteriaMatchExplanation {
  const passedConditions: CriteriaMatchExplanation['passedConditions'] = [];
  let score = 70; // baseline for verified domain
  const reasons: string[] = [];

  const companyName = prospect.companyName || '';
  const isMega = isMegaCapCompany(companyName, prospect.domain);

  // Condition 1: Mega-Cap Exclusion
  const excludeMega = criteria.excludeMegaCaps ?? true;
  if (excludeMega) {
    if (isMega) {
      score -= 50;
      passedConditions.push({
        condition: 'Scale Filter (Exclude Mega-Caps)',
        status: 'failed',
        detail: `Identified as a major enterprise mega-cap (${companyName}). Criteria requested emerging startups/SMBs.`,
      });
      reasons.push('Enterprise mega-cap flagged');
    } else {
      score += 10;
      passedConditions.push({
        condition: 'Scale Filter (Non-Mega-Cap)',
        status: 'passed',
        detail: 'Confirmed emerging startup / SMB / growth company (not a Fortune 500 monopoly).',
      });
    }
  }

  // Condition 2: Industry / Sector Match
  const targetIndustry = (criteria.industry || criteria.keywords || '').toLowerCase();
  const desc = ((prospect.description || '') + ' ' + (prospect.industry || '')).toLowerCase();
  if (targetIndustry) {
    const terms = targetIndustry.split(/[,/ ]/).filter((t) => t.length > 2);
    const matches = terms.filter((term) => desc.includes(term));
    if (matches.length > 0 || desc.includes('software') || desc.includes('tech') || desc.includes('platform')) {
      score += 10;
      passedConditions.push({
        condition: 'Industry / Keyword Fit',
        status: 'passed',
        detail: `Matches target sector "${criteria.industry || criteria.keywords}".`,
      });
      reasons.push(`Sector fit: ${criteria.industry || 'Tech'}`);
    } else {
      passedConditions.push({
        condition: 'Industry / Keyword Fit',
        status: 'warning',
        detail: `Adjacent vertical or general technology match.`,
      });
    }
  }

  // Condition 3: Location / Geography
  if (criteria.country || criteria.state || criteria.city) {
    const locTarget = [criteria.city, criteria.state, criteria.country].filter(Boolean).join(', ');
    passedConditions.push({
      condition: 'Geographic Target',
      status: 'passed',
      detail: `Targeted for headquarters or operations in ${locTarget}.`,
    });
  }

  // Condition 4: Buying Signals & Daily Actions
  const signals = extractStructuredSignals(
    companyName,
    prospect.recentActivity || [],
    [prospect.description || '', prospect.verificationEvidence || '']
  );

  if (signals.length > 0) {
    score += 15;
    for (const sig of signals) {
      passedConditions.push({
        condition: `Buying Signal: ${sig.badgeLabel}`,
        status: 'passed',
        detail: sig.detail,
      });
      reasons.push(sig.badgeLabel);
    }
  } else if (criteria.buyingSignalFilter && criteria.buyingSignalFilter !== 'all') {
    passedConditions.push({
      condition: 'Active Buying Signal',
      status: 'warning',
      detail: 'No explicit funding or hiring announcement detected in recent public index.',
    });
  }

  // Condition 5: Brand New vs Previously Seen
  if (isNew) {
    score += 5;
    passedConditions.push({
      condition: 'Historical Uniqueness',
      status: 'passed',
      detail: '100% Brand new discovery — not present in any previous discovery jobs.',
    });
  } else {
    passedConditions.push({
      condition: 'Historical Uniqueness',
      status: 'warning',
      detail: 'Previously logged in discovery ledger.',
    });
  }

  // Normalization
  score = Math.max(25, Math.min(score, 99));

  let summary = `${score}% Match for ${criteria.industry || 'B2B'} criteria.`;
  if (signals.length > 0) {
    summary += ` Trigger detected: ${signals[0].headline}.`;
  }
  if (!isMega) {
    summary += ` Verified independent growth company.`;
  }

  return {
    matchScore: score,
    summary,
    passedConditions,
    isNewDiscovery: isNew,
    isMegaCap: isMega,
    activeSignals: signals,
  };
}
