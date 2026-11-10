import { ExtractedContact, ExtractionResult } from '../gemini';
import { CompanyFirmographics, RoleTier, RuleEvaluationItem } from '../../src/types';
import { globalEmailClassifier } from '../enrichment/emailClassifier';

export interface NormalizedResult {
  company_name: string;
  firmographics?: CompanyFirmographics;
  generic_emails?: string[];
  departmental_emails?: string[];
  contacts: ExtractedContact[];
  rule_evaluations?: RuleEvaluationItem[];
  rawText?: string;
  isValid: boolean;
  error?: string;
}

/**
 * Robust JSON extraction & normalization from any LLM response text
 * Handles Markdown code blocks, trailing commas, partial truncation, and Chinese/multilingual text preservation.
 */
export function normalizeAiExtraction(
  rawResponseText: string,
  fallbackCompanyName: string,
  defaultSourceUrl: string
): NormalizedResult {
  if (!rawResponseText || typeof rawResponseText !== 'string' || !rawResponseText.trim()) {
    return {
      company_name: fallbackCompanyName,
      contacts: [],
      isValid: false,
      error: 'Empty response from model',
    };
  }

  let cleaned = rawResponseText.trim();

  // Strip Markdown code fences: ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Attempt to isolate JSON object if surrounded by preamble/postscript
  if (!cleaned.startsWith('{')) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }

  // Clean trailing commas in JSON arrays/objects
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  let parsed: any = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    // Attempt fallback heuristic repairs:
    // e.g. unclosed array or object
    try {
      let repair = cleaned;
      if (!repair.endsWith('}')) {
        if (repair.endsWith(',')) repair = repair.slice(0, -1);
        if (!repair.includes(']}') && repair.includes('[')) repair += ']}';
        else repair += '}';
      }
      parsed = JSON.parse(repair);
    } catch {
      // Regex extraction fallback as last resort
      parsed = extractContactsViaRegex(cleaned, fallbackCompanyName, defaultSourceUrl);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      company_name: fallbackCompanyName,
      contacts: [],
      isValid: false,
      error: 'Failed to parse structured JSON',
      rawText: rawResponseText,
    };
  }

  const companyName = String(parsed.company_name || parsed.companyName || fallbackCompanyName || '').trim();

  // Extract structured firmographics
  let firmographics: CompanyFirmographics | undefined = undefined;
  const rawFirmo = parsed.firmographics || parsed.firmographic || parsed.company_profile;
  const industry = String(rawFirmo?.industry || parsed.industry || parsed.vertical || '').trim();
  const rawTier = String(rawFirmo?.employee_tier || rawFirmo?.company_size || parsed.employee_tier || parsed.company_size || '').trim();
  const rawRange = String(rawFirmo?.employee_range || parsed.employee_range || '').trim();
  const rawCount = String(rawFirmo?.employee_count || parsed.employee_count || '').trim();
  const rawYear = String(rawFirmo?.founded_year || rawFirmo?.founding_year || parsed.founded_year || parsed.founding_year || '').trim();
  const location = String(rawFirmo?.location || parsed.location || '').trim();
  const headquarters = String(rawFirmo?.headquarters || rawFirmo?.hq || parsed.headquarters || parsed.hq_address || '').trim();
  const countryCode = String(rawFirmo?.country_code || parsed.country_code || '').trim();
  const offeringSummary = String(rawFirmo?.offering_summary || rawFirmo?.products_summary || parsed.offering_summary || parsed.business_summary || '').trim();

  // Validate clean employee count: never save '0' or 'unknown'
  let cleanEmployeeCount: string | undefined = undefined;
  if (rawCount && rawCount !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(rawCount)) {
    const numMatch = rawCount.match(/\d{1,6}/);
    if (numMatch && parseInt(numMatch[0], 10) > 0) {
      cleanEmployeeCount = numMatch[0];
    }
  }

  // Validate clean founded year: strictly 4-digit valid calendar year, never '0' or 'unknown'
  let cleanFoundedYear: string | undefined = undefined;
  if (rawYear && rawYear !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(rawYear)) {
    const yrMatch = rawYear.match(/\b(1[789]\d{2}|20[0-2]\d)\b/);
    if (yrMatch) {
      cleanFoundedYear = yrMatch[1];
    }
  }

  // Determine employee tier / range
  let cleanTier = rawTier || undefined;
  let cleanRange = rawRange || undefined;
  if (cleanEmployeeCount && !cleanTier) {
    const c = parseInt(cleanEmployeeCount, 10);
    if (c <= 10) cleanTier = '1-10';
    else if (c <= 50) cleanTier = '11-50';
    else if (c <= 200) cleanTier = '51-200';
    else if (c <= 500) cleanTier = '201-500';
    else if (c <= 1000) cleanTier = '501-1000';
    else cleanTier = '1000+';
  }

  if (industry || cleanTier || cleanRange || cleanEmployeeCount || cleanFoundedYear || location || headquarters || offeringSummary) {
    firmographics = {
      industry: industry || undefined,
      employee_tier: cleanTier || undefined,
      employee_range: cleanRange || cleanTier || undefined,
      employee_count: cleanEmployeeCount || undefined,
      employee_count_source_url: rawFirmo?.employee_count_source_url || (cleanEmployeeCount ? defaultSourceUrl : undefined),
      employee_count_confidence: cleanEmployeeCount ? (rawFirmo?.employee_count_confidence || 'verified') : undefined,
      founded_year: cleanFoundedYear || undefined,
      founded_year_source_url: rawFirmo?.founded_year_source_url || (cleanFoundedYear ? defaultSourceUrl : undefined),
      founded_year_confidence: cleanFoundedYear ? (rawFirmo?.founded_year_confidence || 'verified') : undefined,
      confidence: (cleanEmployeeCount || cleanFoundedYear) ? 'verified' : undefined,
      last_checked_date: rawFirmo?.last_checked_date || new Date().toISOString(),
      location: location || undefined,
      headquarters: headquarters || undefined,
      country_code: countryCode || undefined,
      offering_summary: offeringSummary || undefined,
    };
  }

  // Extract company-level generic & departmental emails
  const genericEmails: string[] = Array.isArray(parsed.generic_emails)
    ? parsed.generic_emails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean)
    : [];
  const departmentalEmails: string[] = Array.isArray(parsed.departmental_emails)
    ? parsed.departmental_emails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean)
    : [];

  const rawContacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
  const validatedContacts: ExtractedContact[] = [];

  for (const c of rawContacts) {
    if (!c || typeof c !== 'object') continue;

    // Preserving authentic names, roles, emails without unwanted transformations
    const firstName = String(c.first_name || c.firstName || '').trim();
    const lastName = String(c.last_name || c.lastName || '').trim();
    let fullName = String(c.full_name || c.fullName || c.name || '').trim();

    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName} ${lastName}`.trim();
    }

    const rawEmail = String(c.email || c.professional_email || '').trim().toLowerCase();
    const rawProfEmail = String(c.professional_email || '').trim().toLowerCase();

    // STRICT RULE: Never create a real person's name from an email username alone
    // E.g. usergen@company.com must NOT create person named Usergen
    if (fullName && rawEmail && rawEmail.includes('@')) {
      const emailUser = rawEmail.split('@')[0].toLowerCase().replace(/[._-]/g, ' ').trim();
      const cleanFull = fullName.toLowerCase().replace(/[._-]/g, ' ').trim();
      if (cleanFull === emailUser || cleanFull === rawEmail.split('@')[0].toLowerCase()) {
        fullName = ''; // Reject fabricated name from email username
      }
    }

    const role = String(c.role || c.title || c.position || '').trim();
    const phone = String(c.phone || c.telephone || '').trim();
    const sourceUrl = String(c.source_url || c.sourceUrl || defaultSourceUrl).trim();

    // Extract social & role tier if present in AI response
    const linkedinUrl = String(c.linkedin_url || c.linkedin || c.social_profiles?.linkedin || '').trim();
    const roleTier = c.role_tier as RoleTier | undefined;

    // Determine email_type deterministically via globalEmailClassifier
    const classification = globalEmailClassifier.classify(rawEmail, {
      fullName,
      firstName,
      lastName,
      role,
      sourceUrl,
    });

    if (classification.isGeneric && rawEmail) {
      if (!genericEmails.includes(rawEmail)) {
        genericEmails.push(rawEmail);
      }
    }

    // Professional personal email must NOT be generic
    let finalProfEmail: string | undefined = undefined;
    if (!classification.isGeneric && (rawProfEmail || rawEmail)) {
      finalProfEmail = rawProfEmail || rawEmail;
    }

    const associationStatus = (c.association_status as any) || (finalProfEmail ? 'explicit' : 'none');
    const confidenceScore = typeof c.confidence_score === 'number'
      ? c.confidence_score
      : (finalProfEmail ? 90 : (fullName ? 70 : 40));

    // Must have at least an email or (a name + role/phone)
    if (finalProfEmail || (fullName && (role || phone))) {
      validatedContacts.push({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        role: role || (classification.isGeneric ? 'Company General' : 'Business Contact'),
        email: finalProfEmail || (classification.isGeneric ? '' : rawEmail),
        professional_email: finalProfEmail,
        association_status: associationStatus,
        confidence_score: confidenceScore,
        email_type: classification.classification,
        email_classification_reason: classification.reason,
        identity_verified: classification.identityVerified,
        identity_verification_evidence: classification.reason,
        phone,
        source_url: sourceUrl,
        role_tier: roleTier,
        linkedin_url: linkedinUrl || undefined,
      });
    }
  }

  // Parse rule_evaluations if returned by AI
  const ruleEvaluations: RuleEvaluationItem[] = [];
  if (Array.isArray(parsed.rule_evaluations)) {
    for (const r of parsed.rule_evaluations) {
      if (r && typeof r === 'object' && r.rule) {
        ruleEvaluations.push({
          rule: String(r.rule),
          status: r.status === 'FOLLOWED' || r.status === 'FAILED' ? r.status : 'UNVERIFIED',
          detail: String(r.detail || r.reason || ''),
        });
      }
    }
  }

  return {
    company_name: companyName,
    firmographics,
    generic_emails: genericEmails.length > 0 ? genericEmails : undefined,
    departmental_emails: departmentalEmails.length > 0 ? departmentalEmails : undefined,
    contacts: validatedContacts,
    rule_evaluations: ruleEvaluations.length > 0 ? ruleEvaluations : undefined,
    isValid: true,
    rawText: rawResponseText,
  };
}

function extractContactsViaRegex(text: string, fallbackCompany: string, defaultUrl: string): any {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emails = Array.from(new Set(text.match(emailRegex) || []));

  // Extract authentic firmographics from page text
  let employeeCount: string | undefined = undefined;
  let employeeRange: string | undefined = undefined;
  let employeeTier: string | undefined = undefined;
  let foundedYear: string | undefined = undefined;

  // Exact employee count patterns
  const empMatch = text.match(/\b(?:team of|we are|have|with|over|more than|approximately|about|around|nearly|staff of|employing)\s*(\d{1,6})\s*(?:\+|\s*plus)?\s*(?:full-time\s+|dedicated\s+|talented\s+)?(?:employees|attorneys|lawyers|professionals|people|staff|team members|members|workers|consultants)\b/i) ||
                   text.match(/\b(\d{1,6})\s*(?:\+|\s*plus)?\s*(?:full-time\s+|dedicated\s+|talented\s+)?(?:employees|attorneys|lawyers|professionals|staff|team members|workers|consultants)\b/i);
  if (empMatch && empMatch[1]) {
    const count = parseInt(empMatch[1], 10);
    if (count > 0 && count < 500000) {
      employeeCount = String(count);
      if (count <= 10) employeeTier = '1-10';
      else if (count <= 50) employeeTier = '11-50';
      else if (count <= 200) employeeTier = '51-200';
      else if (count <= 500) employeeTier = '201-500';
      else if (count <= 1000) employeeTier = '501-1000';
      else employeeTier = '1000+';
    }
  }

  // Range employee count patterns (e.g. 11-50 employees)
  if (!employeeCount) {
    const rangeMatch = text.match(/\b(\d{1,6})\s*(?:-|–|—|to)\s*(\d{1,6})\s*(?:employees|attorneys|lawyers|professionals|people|staff|team members|workers)\b/i);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      if (min > 0 && max > min && max < 500000) {
        employeeRange = `${min}–${max}`;
        if (max <= 10) employeeTier = '1-10';
        else if (max <= 50) employeeTier = '11-50';
        else if (max <= 200) employeeTier = '51-200';
        else if (max <= 500) employeeTier = '201-500';
        else if (max <= 1000) employeeTier = '501-1000';
        else employeeTier = '1000+';
      }
    }
  }

  // Founded year patterns (explicit evidence only - do NOT infer from copyright date)
  const foundedMatch = text.match(/\b(?:founded|established|est\.?)\s*(?:in\s*)?(\d{4})\b/i) ||
                       text.match(/\b(?:in business|serving clients|operating|established firm)\s*(?:since\s*)(\d{4})\b/i) ||
                       text.match(/\b(?:founding|founded)\s*year\s*(?::|is)?\s*(\d{4})\b/i);
  if (foundedMatch && foundedMatch[1]) {
    const yr = parseInt(foundedMatch[1], 10);
    if (yr >= 1700 && yr <= 2026) {
      foundedYear = String(yr);
    }
  }

  // Location / address pattern
  let location: string | undefined = undefined;
  const locMatch = text.match(/\b([A-Z][a-zA-Z\s.-]+,\s*[A-Z]{2}(?:\s+\d{5})?)\b/);
  if (locMatch && locMatch[1] && locMatch[1].length < 60) {
    location = locMatch[1].trim();
  }

  const genericEmails: string[] = [];
  for (const em of emails) {
    const cl = globalEmailClassifier.classify(em);
    if (cl.isGeneric) genericEmails.push(em.toLowerCase());
  }

  const firmographics: CompanyFirmographics | undefined = (employeeCount || employeeRange || foundedYear || location)
    ? {
        employee_count: employeeCount,
        employee_range: employeeRange || employeeTier,
        employee_tier: employeeTier,
        employee_count_source_url: (employeeCount || employeeRange) ? defaultUrl : undefined,
        employee_count_confidence: (employeeCount || employeeRange) ? 'verified' : undefined,
        founded_year: foundedYear,
        founded_year_source_url: foundedYear ? defaultUrl : undefined,
        founded_year_confidence: foundedYear ? 'verified' : undefined,
        confidence: (employeeCount || foundedYear) ? 'verified' : undefined,
        last_checked_date: new Date().toISOString(),
        location,
      }
    : undefined;

  return {
    company_name: fallbackCompany,
    firmographics,
    generic_emails: genericEmails,
    contacts: emails.map((email) => {
      const classification = globalEmailClassifier.classify(email);
      return {
        first_name: '',
        last_name: '',
        full_name: '',
        role: classification.isGeneric ? 'Company General' : 'Business Contact',
        email,
        email_type: classification.classification,
        email_classification_reason: classification.reason,
        identity_verified: classification.identityVerified,
        phone: '',
        source_url: defaultUrl,
      };
    }),
  };
}
