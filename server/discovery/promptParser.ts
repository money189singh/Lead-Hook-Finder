import { GoogleGenAI, Type } from '@google/genai';
import { DiscoveryCriteria } from './types';
import { getSettings } from '../storage';
import { globalAiResilience } from '../services/aiResilience';

/**
 * Parses natural-language prospect search descriptions into structured DiscoveryCriteria
 */
export async function parseNaturalLanguageSearch(prompt: string): Promise<DiscoveryCriteria> {
  const cleanPrompt = prompt.trim();
  const settings = getSettings();
  const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;

  const defaultResult: DiscoveryCriteria = {
    naturalLanguagePrompt: cleanPrompt,
    country: 'United States',
    state: '',
    city: '',
    industry: 'SaaS',
    companyName: '',
    employeeRange: '11-50',
    revenueRange: '',
    jobTitle: 'Founder, CEO',
    department: 'Executive',
    seniority: 'C-Suite / Executive',
    keywords: '',
    technology: '',
    targetCount: 25,
    maxPagesPerCompany: 3,
    maxQueries: 10,
    autoExtractContacts: true,
    includeGenericEmails: true,
  };

  const hasKey = Boolean(apiKey || process.env.NVIDIA_API_KEY);
  if (!hasKey) {
    return parseWithRuleFallback(cleanPrompt, defaultResult);
  }

  try {
    const systemPrompt = `You are a search query parser for a B2B sales prospect discovery engine.
Convert the user's natural language request into structured search criteria.
Extract:
- country (e.g. "United States", "United Kingdom", "Canada")
- state (e.g. "California", "Texas", "New York")
- city (e.g. "San Francisco", "Austin", "London")
- industry (e.g. "SaaS", "FinTech", "HealthTech", "E-Commerce", "Cybersecurity", "Manufacturing")
- employeeRange (e.g. "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+")
- revenueRange (e.g. "< $1M", "$1M - $10M", "$10M - $50M", "$50M+")
- jobTitle (e.g. "CEO, Founder", "Sales Director, VP of Sales", "CTO, Head of Engineering")
- department (e.g. "Executive", "Sales", "Engineering", "Marketing")
- seniority (e.g. "C-Suite / Executive", "VP / Director", "Manager")
- keywords (comma separated relevant tags or phrases)
- technology (tech stack mentioned if any, e.g. "React", "AWS")
- targetCount (number of prospects desired, default to 25, capped between 5 and 500)

Return strict JSON only.`;

    const text = await globalAiResilience.generateWithDualProvider({
      prompt: cleanPrompt,
      systemInstruction: systemPrompt,
      jsonMode: true,
      taskLabel: 'Search Prompt Parser',
    });

    if (text) {
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      const parsed = JSON.parse(cleanText);
      return {
        ...defaultResult,
        ...parsed,
        naturalLanguagePrompt: cleanPrompt,
        targetCount: Math.min(Math.max(parsed.targetCount || 25, 5), 500),
      };
    }
  } catch (err: any) {
    const errMsg = err?.message || '';
    console.log('[PromptParser] AI parsing fallback notice:', errMsg.slice(0, 100));
  }

  return parseWithRuleFallback(cleanPrompt, defaultResult);
}

function parseWithRuleFallback(prompt: string, defaultResult: DiscoveryCriteria): DiscoveryCriteria {
  const lower = prompt.toLowerCase();
  const res = { ...defaultResult, naturalLanguagePrompt: prompt };

  // Target count detection (e.g. "Find 500 companies", "25 prospects", "100 SaaS")
  const numMatch = prompt.match(/\b(find|discover|get|search|extract)?\s*(\d{1,4})\s*(companies|leads|prospects|startups|businesses|firms)?\b/i);
  if (numMatch && numMatch[2]) {
    const val = parseInt(numMatch[2], 10);
    if (!isNaN(val) && val >= 5 && val <= 500) {
      res.targetCount = val;
    }
  }

  // Location detection
  if (lower.includes('united states') || lower.includes('in the us') || lower.includes('in us') || lower.includes('usa') || lower.includes('american')) {
    res.country = 'United States';
  } else if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('london') || lower.includes('british')) {
    res.country = 'United Kingdom';
  } else if (lower.includes('canada') || lower.includes('toronto') || lower.includes('vancouver') || lower.includes('canadian')) {
    res.country = 'Canada';
  } else if (lower.includes('australia') || lower.includes('sydney') || lower.includes('melbourne') || lower.includes('australian')) {
    res.country = 'Australia';
  } else if (lower.includes('germany') || lower.includes('berlin') || lower.includes('german')) {
    res.country = 'Germany';
  } else if (lower.includes('france') || lower.includes('paris') || lower.includes('french')) {
    res.country = 'France';
  } else if (lower.includes('india') || lower.includes('bangalore') || lower.includes('mumbai')) {
    res.country = 'India';
  }

  // States
  const states = ['California', 'Texas', 'New York', 'Florida', 'Washington', 'Massachusetts', 'Illinois', 'Colorado', 'Georgia', 'North Carolina', 'Utah', 'Virginia'];
  for (const st of states) {
    if (lower.includes(st.toLowerCase())) {
      res.state = st;
      break;
    }
  }

  // Cities
  const cities = ['San Francisco', 'Austin', 'New York', 'Seattle', 'Boston', 'Chicago', 'Los Angeles', 'Denver', 'Atlanta', 'Miami', 'London', 'Toronto', 'Sydney'];
  for (const ci of cities) {
    if (lower.includes(ci.toLowerCase())) {
      res.city = ci;
      break;
    }
  }

  // Industries
  if (lower.includes('b2b saas') || lower.includes('saas') || lower.includes('software as a service') || lower.includes('cloud software')) {
    res.industry = 'SaaS';
  } else if (lower.includes('fintech') || lower.includes('financial tech') || lower.includes('banking tech')) {
    res.industry = 'FinTech';
  } else if (lower.includes('healthtech') || lower.includes('healthcare') || lower.includes('biotech') || lower.includes('health tech')) {
    res.industry = 'HealthTech';
  } else if (lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('retail tech') || lower.includes('direct to consumer') || lower.includes('d2c')) {
    res.industry = 'E-Commerce';
  } else if (lower.includes('cybersecurity') || lower.includes('infosec') || lower.includes('security software')) {
    res.industry = 'Cybersecurity';
  } else if (lower.includes('artificial intelligence') || lower.includes('ai startup') || lower.includes('machine learning') || lower.includes('generative ai')) {
    res.industry = 'Artificial Intelligence';
  } else if (lower.includes('edtech') || lower.includes('education technology')) {
    res.industry = 'EdTech';
  } else if (lower.includes('proptech') || lower.includes('real estate tech')) {
    res.industry = 'PropTech';
  } else if (lower.includes('cleantech') || lower.includes('climate tech') || lower.includes('green tech')) {
    res.industry = 'CleanTech';
  }

  // Roles & Seniority
  const roles: string[] = [];
  if (lower.includes('founder') || lower.includes('co-founder')) roles.push('Founder');
  if (lower.includes('ceo') || lower.includes('chief executive')) roles.push('CEO');
  if (lower.includes('sales director') || lower.includes('head of sales') || lower.includes('vp sales') || lower.includes('vp of sales') || lower.includes('cro')) roles.push('VP of Sales');
  if (lower.includes('cto') || lower.includes('head of engineering') || lower.includes('vp engineering')) roles.push('CTO');
  if (lower.includes('cfo') || lower.includes('finance director')) roles.push('CFO');
  if (lower.includes('cmo') || lower.includes('marketing director') || lower.includes('vp marketing')) roles.push('Marketing Director');
  if (roles.length > 0) {
    res.jobTitle = roles.join(', ');
  }

  // Employee range
  if (lower.includes('1-10') || lower.includes('1 to 10') || lower.includes('seed stage')) {
    res.employeeRange = '1-10';
  } else if (lower.includes('10-50') || lower.includes('11-50') || lower.includes('10 to 50') || lower.includes('small team')) {
    res.employeeRange = '11-50';
  } else if (lower.includes('10-200') || lower.includes('10 to 200') || lower.includes('50-200') || lower.includes('51-200') || lower.includes('50 to 200')) {
    res.employeeRange = '51-200';
  } else if (lower.includes('200-500') || lower.includes('201-500') || lower.includes('mid-market')) {
    res.employeeRange = '201-500';
  } else if (lower.includes('500+') || lower.includes('501-1000') || lower.includes('1000+') || lower.includes('enterprise')) {
    res.employeeRange = '501-1000';
  }

  return res;
}
