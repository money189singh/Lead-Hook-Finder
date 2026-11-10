import { GoogleGenAI, Type } from '@google/genai';
import { getSettings } from '../storage';

export interface NaturalLanguageFilterSpec {
  query: string;
  requireLinkedin?: boolean;
  requirePhone?: boolean;
  requireProfessionalEmail?: boolean;
  requireGenericEmail?: boolean;
  requireDecisionMaker?: boolean;
  requireOwnerOrFounder?: boolean;
  minEmployees?: number;
  maxEmployees?: number;
  minFoundedYear?: number;
  maxFoundedYear?: number;
  minIcpScore?: number;
  minConfidenceScore?: number;
  emailVerificationStatus?: 'Valid' | 'Risky' | 'Invalid';
  roleKeywords?: string[];
  locationKeywords?: string[];
  industryKeywords?: string[];
  techStackKeywords?: string[];
  companyKeywords?: string[];
  pipelineStage?: string;
  activePills: string[];
  source: 'gemini' | 'deterministic';
}

const NL_FILTER_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

const cooldownMap = new Map<string, number>();

export function parseNaturalLanguageFilterDeterministic(rawQuery: string): NaturalLanguageFilterSpec {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();
  const spec: NaturalLanguageFilterSpec = {
    query: q,
    activePills: [],
    source: 'deterministic',
  };

  // 1. LinkedIn requirement
  if (/\b(linkedin|linked\s+in)\b/i.test(lower)) {
    spec.requireLinkedin = true;
    spec.activePills.push('Has LinkedIn Profile');
  }

  // 2. Phone requirement
  if (/\b(phone|mobile|telephone|direct\s+dial|direct\s+number|call)\b/i.test(lower)) {
    spec.requirePhone = true;
    spec.activePills.push('Has Phone Number');
  }

  // 3. Professional / Direct Email requirement
  if (/\b(professional\s+email|direct\s+email|personal\s+email|work\s+email|with\s+email|has\s+email|verified\s+email)\b/i.test(lower)) {
    spec.requireProfessionalEmail = true;
    spec.activePills.push('Has Professional Email');
  }

  // 4. Verified Valid Email
  if (/\b(valid\s+email|verified\s+email|mx\s+verified|deliverable)\b/i.test(lower)) {
    spec.emailVerificationStatus = 'Valid';
    spec.activePills.push('Email Status: Valid');
  }

  // 5. Generic Email requirement
  if (/\b(generic\s+email|generic\s+inbox|company\s+inbox)\b/i.test(lower)) {
    spec.requireGenericEmail = true;
    spec.activePills.push('Has Generic Inbox');
  }

  // 6. Decision Makers & Founders/Owners
  if (/\b(decision[\s-]*maker|decision[\s-]*makers|executives?|leadership|c-suite|c\s+level)\b/i.test(lower)) {
    spec.requireDecisionMaker = true;
    spec.activePills.push('Decision-Makers Only');
  }
  if (/\b(founders?|co-founders?|owners?|ceo|president|managing\s+partner)\b/i.test(lower)) {
    spec.requireOwnerOrFounder = true;
    spec.activePills.push('Owner / Founder / CEO');
  }

  // 7. Employee Count ranges & thresholds
  // e.g. "50 to 200 employees", "50-200 employees"
  const empRangeMatch = lower.match(/(\d[\d,]*)\s*(?:-|–|—|to)\s*(\d[\d,]*)\s*(?:employees|emp|staff|people|headcount)/i);
  if (empRangeMatch) {
    const min = parseInt(empRangeMatch[1].replace(/,/g, ''), 10);
    const max = parseInt(empRangeMatch[2].replace(/,/g, ''), 10);
    if (!isNaN(min) && !isNaN(max)) {
      spec.minEmployees = min;
      spec.maxEmployees = max;
      spec.activePills.push(`Employees: ${min}–${max}`);
    }
  } else {
    // e.g. "50+ employees", "more than 50 employees", "over 100 employees", "at least 50 employees"
    const empMinMatch =
      lower.match(/(?:over|more\s+than|at\s+least|minimum|min|>=?|>)\s*(\d[\d,]*)\s*\+?\s*(?:employees|emp|staff|people|headcount)/i) ||
      lower.match(/(\d[\d,]*)\s*(?:\+|\s*plus|\s*or\s+more)\s*(?:employees|emp|staff|people|headcount)/i);
    if (empMinMatch) {
      const min = parseInt(empMinMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(min)) {
        spec.minEmployees = min;
        spec.activePills.push(`Employees ≥ ${min}`);
      }
    }

    // e.g. "under 50 employees", "less than 100 employees", "fewer than 200 employees"
    const empMaxMatch = lower.match(/(?:under|less\s+than|fewer\s+than|below|max|<=?|<)\s*(\d[\d,]*)\s*(?:employees|emp|staff|people|headcount)/i);
    if (empMaxMatch) {
      const max = parseInt(empMaxMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(max)) {
        spec.maxEmployees = max;
        spec.activePills.push(`Employees ≤ ${max}`);
      }
    }
  }

  // 8. Founded Year thresholds
  const foundedAfterMatch = lower.match(/(?:founded|established|est\.?|since|after|from)\s*(?:in\s+or\s+after\s+|after\s+)?((?:19|20)\d{2})\s*(?:\+|onward|or\s+later)?/i);
  const foundedBeforeMatch = lower.match(/(?:founded|established|est\.?|before|prior\s+to)\s*(?:before\s+)?((?:19|20)\d{2})/i);
  if (foundedBeforeMatch && /\b(before|prior|earlier|under)\b/i.test(foundedBeforeMatch[0])) {
    const yr = parseInt(foundedBeforeMatch[1], 10);
    spec.maxFoundedYear = yr;
    spec.activePills.push(`Founded ≤ ${yr}`);
  } else if (foundedAfterMatch) {
    const yr = parseInt(foundedAfterMatch[1], 10);
    spec.minFoundedYear = yr;
    spec.activePills.push(`Founded ≥ ${yr}`);
  }

  // 9. ICP Score & Confidence Score
  const icpMatch = lower.match(/icp(?:\s+score)?\s*(?:of\s+|over\s+|above\s+|>=?\s*)?(\d{2,3})\s*%?\+?/i);
  if (icpMatch) {
    const sc = parseInt(icpMatch[1], 10);
    if (sc >= 1 && sc <= 100) {
      spec.minIcpScore = sc;
      spec.activePills.push(`ICP Score ≥ ${sc}%`);
    }
  } else if (/\bhigh\s+icp\b/i.test(lower)) {
    spec.minIcpScore = 80;
    spec.activePills.push('ICP Score ≥ 80%');
  }

  const confMatch = lower.match(/(\d{2,3})\s*%?\+?\s*(?:confidence|accuracy)/i) || lower.match(/(?:confidence|accuracy)\s*(?:over|above|>=?)\s*(\d{2,3})/i);
  if (confMatch) {
    const cf = parseInt(confMatch[1], 10);
    if (cf >= 1 && cf <= 100) {
      spec.minConfidenceScore = cf;
      spec.activePills.push(`Confidence ≥ ${cf}%`);
    }
  } else if (/\b(high\s+confidence|high\s+accuracy)\b/i.test(lower)) {
    spec.minConfidenceScore = 90;
    spec.activePills.push('Confidence ≥ 90%');
  }

  // 10. Known Tech Stack Keywords
  const knownTech = [
    'shopify', 'hubspot', 'salesforce', 'stripe', 'webflow', 'wordpress',
    'next.js', 'nextjs', 'cloudflare', 'vercel', 'aws', 'intercom', 'zendesk',
    'klaviyo', 'marketo', 'segment', 'mixpanel', 'amplitude', 'hotjar', 'posthog',
    'google analytics', 'google tag manager', 'chargebee', 'paypal', 'squarespace', 'magento'
  ];
  const matchedTech: string[] = [];
  for (const t of knownTech) {
    if (lower.includes(t)) {
      matchedTech.push(t);
    }
  }
  if (matchedTech.length > 0) {
    spec.techStackKeywords = matchedTech;
    spec.activePills.push(`Tech: ${matchedTech.join(', ')}`);
  }

  // 11. Role Keywords (specific titles beyond generic decision-maker)
  const roleMatches: string[] = [];
  const rolePatterns = [
    'partner', 'attorney', 'lawyer', 'counsel', 'director', 'vp', 'vice president',
    'marketing', 'sales', 'engineering', 'cto', 'cfo', 'coo', 'cmo', 'cro', 'manager', 'principal'
  ];
  for (const rp of rolePatterns) {
    const rx = new RegExp(`\\b${rp}s?\\b`, 'i');
    if (rx.test(lower)) {
      roleMatches.push(rp);
    }
  }
  if (roleMatches.length > 0) {
    spec.roleKeywords = roleMatches;
    spec.activePills.push(`Role: ${roleMatches.join(', ')}`);
  }

  // 12. Pipeline Stage
  for (const stage of ['New', 'Contacted', 'Qualified', 'Follow-Up', 'Disqualified']) {
    if (new RegExp(`\\b${stage.toLowerCase()}\\b`, 'i').test(lower)) {
      spec.pipelineStage = stage;
      spec.activePills.push(`Stage: ${stage}`);
    }
  }

  return spec;
}

export async function interpretNaturalLanguageFilter(rawQuery: string): Promise<NaturalLanguageFilterSpec> {
  const cleanQuery = (rawQuery || '').trim();
  if (!cleanQuery) {
    return { query: '', activePills: [], source: 'deterministic' };
  }

  const deterministicBase = parseNaturalLanguageFilterDeterministic(cleanQuery);

  const settings = getSettings();
  const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return deterministicBase;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = `You are a precision B2B lead intelligence query parser.
Convert the user's natural language filter request into a structured JSON filter specification for filtering a B2B leads and contacts table.
Rules:
- Set boolean flags (requireLinkedin, requirePhone, requireProfessionalEmail, requireGenericEmail, requireDecisionMaker, requireOwnerOrFounder) ONLY when requested or implied by the query.
- Extract numeric thresholds accurately:
  - "50+ employees" or "at least 50 employees" -> minEmployees: 50
  - "under 200 employees" -> maxEmployees: 200
  - "50 to 200 employees" -> minEmployees: 50, maxEmployees: 200
  - "founded after 2018" -> minFoundedYear: 2018
  - "founded before 2010" -> maxFoundedYear: 2010
  - "ICP score over 80" -> minIcpScore: 80
  - "90%+ confidence" -> minConfidenceScore: 90
- Populate roleKeywords, locationKeywords, industryKeywords, techStackKeywords, or companyKeywords with lowercase strings ONLY when the user mentions specific titles, locations, industries, technologies, or company names.
- Populate activePills with short, clear filter tags (e.g., ["Has LinkedIn", "Employees ≥ 50"]) summarizing every active condition.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      requireLinkedin: { type: Type.BOOLEAN },
      requirePhone: { type: Type.BOOLEAN },
      requireProfessionalEmail: { type: Type.BOOLEAN },
      requireGenericEmail: { type: Type.BOOLEAN },
      requireDecisionMaker: { type: Type.BOOLEAN },
      requireOwnerOrFounder: { type: Type.BOOLEAN },
      minEmployees: { type: Type.NUMBER },
      maxEmployees: { type: Type.NUMBER },
      minFoundedYear: { type: Type.NUMBER },
      maxFoundedYear: { type: Type.NUMBER },
      minIcpScore: { type: Type.NUMBER },
      minConfidenceScore: { type: Type.NUMBER },
      emailVerificationStatus: { type: Type.STRING },
      roleKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      locationKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      industryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      techStackKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      companyKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      pipelineStage: { type: Type.STRING },
      activePills: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['activePills'],
  };

  for (const modelName of NL_FILTER_MODELS) {
    const cooldownUntil = cooldownMap.get(modelName) || 0;
    if (Date.now() < cooldownUntil) continue;

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Parse this lead table filter request: "${cleanQuery}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.1,
        },
      });

      const text = response.text || '';
      if (text) {
        const parsed = JSON.parse(text);
        const pills: string[] =
          Array.isArray(parsed.activePills) && parsed.activePills.length > 0
            ? parsed.activePills
            : deterministicBase.activePills;

        return {
          query: cleanQuery,
          requireLinkedin: parsed.requireLinkedin ?? deterministicBase.requireLinkedin,
          requirePhone: parsed.requirePhone ?? deterministicBase.requirePhone,
          requireProfessionalEmail: parsed.requireProfessionalEmail ?? deterministicBase.requireProfessionalEmail,
          requireGenericEmail: parsed.requireGenericEmail ?? deterministicBase.requireGenericEmail,
          requireDecisionMaker: parsed.requireDecisionMaker ?? deterministicBase.requireDecisionMaker,
          requireOwnerOrFounder: parsed.requireOwnerOrFounder ?? deterministicBase.requireOwnerOrFounder,
          minEmployees: parsed.minEmployees ?? deterministicBase.minEmployees,
          maxEmployees: parsed.maxEmployees ?? deterministicBase.maxEmployees,
          minFoundedYear: parsed.minFoundedYear ?? deterministicBase.minFoundedYear,
          maxFoundedYear: parsed.maxFoundedYear ?? deterministicBase.maxFoundedYear,
          minIcpScore: parsed.minIcpScore ?? deterministicBase.minIcpScore,
          minConfidenceScore: parsed.minConfidenceScore ?? deterministicBase.minConfidenceScore,
          emailVerificationStatus: parsed.emailVerificationStatus || deterministicBase.emailVerificationStatus,
          roleKeywords: parsed.roleKeywords?.length ? parsed.roleKeywords : deterministicBase.roleKeywords,
          locationKeywords: parsed.locationKeywords?.length ? parsed.locationKeywords : undefined,
          industryKeywords: parsed.industryKeywords?.length ? parsed.industryKeywords : undefined,
          techStackKeywords: parsed.techStackKeywords?.length ? parsed.techStackKeywords : deterministicBase.techStackKeywords,
          companyKeywords: parsed.companyKeywords?.length ? parsed.companyKeywords : undefined,
          pipelineStage: parsed.pipelineStage || deterministicBase.pipelineStage,
          activePills: pills.length > 0 ? pills : [`Query: "${cleanQuery}"`],
          source: 'gemini',
        };
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        cooldownMap.set(modelName, Date.now() + 10 * 60 * 1000);
      }
    }
  }

  if (deterministicBase.activePills.length === 0) {
    deterministicBase.companyKeywords = cleanQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['show', 'only', 'leads', 'with', 'and', 'the', 'for', 'from', 'that', 'have', 'has'].includes(w));
    deterministicBase.activePills.push(`Matched: "${cleanQuery}"`);
  }

  return deterministicBase;
}
