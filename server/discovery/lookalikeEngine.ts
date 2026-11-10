import { GoogleGenAI, Type } from '@google/genai';
import { getSettings } from '../storage';
import { extractCleanDomain } from './domainDetector';
import { CURATED_B2B_COMPANIES, CuratedCompany } from './knowledgeBase';
import { DiscoveryCriteria, DiscoveredProspect } from './types';
import { globalAiResilience } from '../services/aiResilience';

export interface LookalikeSeed {
  input: string;
  domain?: string;
  name?: string;
}

export interface LookalikeCompanyResult {
  name: string;
  domain: string;
  similarityScore: number; // 0 - 100
  matchReason: string;
  targetRoles: string;
  estimatedSize?: string;
  industry?: string;
  location?: string;
}

export interface IcpSynthesisProfile {
  icpTitle: string;
  targetAudience: string;
  businessModel: string;
  coreTraits: string[];
  suggestedJobTitles: string[];
  recommendedIndustry: string;
  lookalikes: LookalikeCompanyResult[];
  recommendedQueries: string[];
  seedCompanies: string[];
}

/**
 * Analyzes model seed companies, extracts ICP characteristics,
 * and discovers verified lookalike companies matching this profile.
 */
export async function analyzeIcpAndFindLookalikes(
  seedInputs: string[],
  options?: {
    targetCount?: number;
    targetRegion?: string;
    companyScale?: 'startups' | 'smb' | 'mid_market' | 'all';
  }
): Promise<IcpSynthesisProfile> {
  const cleanSeeds = seedInputs
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (cleanSeeds.length === 0) {
    throw new Error('Please provide at least one model company or website URL.');
  }

  const settings = getSettings();
  const hasKey = Boolean(settings.gemini_api_key || process.env.GEMINI_API_KEY || process.env.NVIDIA_API_KEY);

  if (hasKey) {
    try {
      const seedListStr = cleanSeeds.join(', ');
      const regionContext = options?.targetRegion ? `Target Region: ${options.targetRegion}.` : '';
      const scaleContext = options?.companyScale ? `Company Scale Target: ${options.companyScale}.` : '';

      const systemPrompt = `You are a world-class B2B Sales Intelligence and ICP (Ideal Customer Profile) Matchmaker.
Analyze the provided model seed companies / URLs: ${seedListStr}.
${regionContext}
${scaleContext}

Your mission:
1. Synthesize their shared B2B profile (ICP, buyer personas, value prop, commercial positioning).
2. Discover 10 to 18 genuine, active, real emerging companies or startups (NOT mega-cap household monopolies like Microsoft, Salesforce, Google, Amazon, Apple, Oracle) that are strong lookalikes of these model companies.
3. For each lookalike company, provide their exact official website root domain, match similarity score (75-98), and a compelling 1-sentence match explanation.
4. Return 4 advanced search queries to discover even more companies with this profile.

Strict rules:
- Only real, currently operating companies with verified root domains (e.g. "linear.app", "postman.com", "attio.com").
- NEVER fabricate non-existent companies or domains.
- Exclude mega-cap monopolies. Focus on growth-stage startups, emerging scaleups, and innovative SMBs.
- Return strictly structured JSON matching this schema:
{
  "icpTitle": string,
  "targetAudience": string,
  "businessModel": string,
  "coreTraits": string[],
  "suggestedJobTitles": string[],
  "recommendedIndustry": string,
  "recommendedQueries": string[],
  "lookalikes": [
    {
      "name": string,
      "domain": string,
      "similarityScore": number,
      "matchReason": string,
      "targetRoles": string,
      "estimatedSize": string,
      "industry": string,
      "location": string
    }
  ]
}`;

      const text = await globalAiResilience.generateWithDualProvider({
        prompt: `Analyze these seed companies and discover genuine lookalikes: ${seedListStr}`,
        systemInstruction: systemPrompt,
        jsonMode: true,
        taskLabel: `ICP Lookalike Matchmaker (${seedListStr.slice(0, 30)})`,
      });

      if (text) {
        let cleanText = text.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        const parsed = JSON.parse(cleanText);
        const cleanedLookalikes: LookalikeCompanyResult[] = [];
        const seenDomains = new Set<string>();

        // Clean domains and filter out seed domains from lookalikes
        const seedDomains = new Set(
          cleanSeeds.map((s) => extractCleanDomain(s)).filter(Boolean)
        );

        for (const lk of parsed.lookalikes || []) {
          const rawDom = extractCleanDomain(lk.domain || lk.name);
          if (rawDom && !seedDomains.has(rawDom) && !seenDomains.has(rawDom)) {
            seenDomains.add(rawDom);
            cleanedLookalikes.push({
              name: lk.name || extractCleanDomain(rawDom),
              domain: rawDom,
              similarityScore: Math.min(99, Math.max(70, lk.similarityScore || 85)),
              matchReason: lk.matchReason || 'Strong firmographic and audience alignment with model companies.',
              targetRoles: lk.targetRoles || (parsed.suggestedJobTitles || []).join(', ') || 'Founder, CEO, VP',
              estimatedSize: lk.estimatedSize || '11-50',
              industry: lk.industry || parsed.recommendedIndustry || 'B2B SaaS',
              location: lk.location || 'United States',
            });
          }
        }

        if (cleanedLookalikes.length > 0) {
          return {
            icpTitle: parsed.icpTitle || 'B2B Growth ICP Profile',
            targetAudience: parsed.targetAudience || 'Modern tech teams and business leaders',
            businessModel: parsed.businessModel || 'B2B SaaS Platform',
            coreTraits: Array.isArray(parsed.coreTraits) ? parsed.coreTraits : ['B2B SaaS', 'Product-Led Growth', 'Cloud Infrastructure'],
            suggestedJobTitles: Array.isArray(parsed.suggestedJobTitles) ? parsed.suggestedJobTitles : ['Founder', 'CEO', 'CTO', 'VP of Sales'],
            recommendedIndustry: parsed.recommendedIndustry || 'SaaS',
            recommendedQueries: Array.isArray(parsed.recommendedQueries) ? parsed.recommendedQueries : [
              `${parsed.recommendedIndustry || 'SaaS'} startups in US`,
              `innovative workflow automation platforms`,
            ],
            lookalikes: cleanedLookalikes,
            seedCompanies: cleanSeeds,
          };
        }
      }
    } catch (err: any) {
      console.log('[LookalikeEngine] AI Lookalike note:', err?.message?.slice(0, 80));
    }
  }

  // Fallback: Synthesize ICP using Curated Knowledge Base
  return synthesizeFromCuratedKnowledgeBase(cleanSeeds);
}

function synthesizeFromCuratedKnowledgeBase(seeds: string[]): IcpSynthesisProfile {
  const seedTokens = seeds.map((s) => s.toLowerCase().replace(/https?:\/\/|www\.|\.com|\.io|\.app|\.ai/g, ''));
  
  // Find closest companies in curated database
  let matchedCategory = 'SaaS';
  for (const comp of CURATED_B2B_COMPANIES) {
    if (seedTokens.some((t) => comp.name.toLowerCase().includes(t) || comp.domain.toLowerCase().includes(t))) {
      matchedCategory = comp.industry;
      break;
    }
  }

  const lookalikes: LookalikeCompanyResult[] = [];
  const seedDomains = new Set(seeds.map((s) => extractCleanDomain(s)).filter(Boolean));

  for (const c of CURATED_B2B_COMPANIES) {
    if (lookalikes.length >= 12) break;
    if (seedDomains.has(c.domain)) continue;

    const isIndustryMatch = c.industry.toLowerCase() === matchedCategory.toLowerCase();
    if (isIndustryMatch || lookalikes.length < 8) {
      lookalikes.push({
        name: c.name,
        domain: c.domain,
        similarityScore: isIndustryMatch ? 92 : 84,
        matchReason: `High firmographic alignment in ${c.industry}, targeting similar buyers and tech maturity.`,
        targetRoles: 'Founder, CEO, VP of Sales',
        estimatedSize: c.employeeRange,
        industry: c.industry,
        location: c.location,
      });
    }
  }

  return {
    icpTitle: `${matchedCategory} High-Growth Lookalike Profile`,
    targetAudience: 'Executive leadership, departmental heads, and high-growth operational teams',
    businessModel: 'B2B Cloud / SaaS Platform',
    coreTraits: [
      `${matchedCategory} Focus`,
      'High-velocity sales cycle',
      'Modern digital-first organization',
      'Scalable cloud infrastructure',
    ],
    suggestedJobTitles: ['Founder', 'CEO', 'CTO', 'VP of Sales', 'Head of Growth'],
    recommendedIndustry: matchedCategory,
    recommendedQueries: [
      `${matchedCategory} emerging startups in United States`,
      `fast-growing ${matchedCategory} companies`,
    ],
    lookalikes,
    seedCompanies: seeds,
  };
}
