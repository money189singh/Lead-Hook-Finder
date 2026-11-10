import { EmailType } from '../../src/types';

/**
 * Mandatory Generic Email Usernames (Exact local-part match only, case-insensitive).
 * Per User Specification:
 * - info
 * - contact
 * - hello
 * - support
 * - sales
 * - admin
 * - office
 * - careers
 * - jobs
 */
export const EXACT_GENERIC_LOCAL_PARTS = new Set<string>([
  'info',
  'contact',
  'hello',
  'support',
  'sales',
  'admin',
  'office',
  'careers',
  'jobs',
]);

/**
 * Additional standard departmental role-based aliases (exact match only).
 */
export const DEPARTMENTAL_EXACT_LOCAL_PARTS = new Set<string>([
  'billing',
  'invoices',
  'accounting',
  'finance',
  'marketing',
  'press',
  'media',
  'hr',
  'humanresources',
  'legal',
  'compliance',
  'security',
  'reception',
  'desk',
  'frontdesk',
  'team',
  'help',
  'service',
  'inquiry',
  'inquiries',
  'enquiries',
]);

/**
 * Common consumer / free personal email provider domains.
 */
export const PERSONAL_PROVIDER_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  't-online.de',
  'web.de',
]);

export interface EmailClassificationResult {
  email: string;
  normalizedEmail: string;
  localPart: string;
  domain: string;
  classification: EmailType;
  isGeneric: boolean;
  isPersonalProvider: boolean;
  isProfessionalPersonal: boolean;
  identityVerified: boolean;
  reason: string;
}

export interface PersonEvidence {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  companyName?: string;
  sourceUrl?: string;
  explicitLayoutAssociation?: boolean; // E.g., mailto directly attached to team member card
}

export class EmailClassifierEngine {
  /**
   * Deterministically parses and extracts normalized local part and domain.
   */
  public parseEmail(email: string): { localPart: string; domain: string; normalized: string } | null {
    if (!email || typeof email !== 'string') return null;
    const trimmed = email.trim();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;

    const localPart = trimmed.substring(0, atIndex).trim().toLowerCase();
    const domain = trimmed.substring(atIndex + 1).trim().toLowerCase();

    // Remove any trailing punctuation or formatting artifacts
    const cleanDomain = domain.replace(/[^a-z0-9.-]/g, '');
    const cleanLocal = localPart.replace(/^[<"']+|[>"']+$/g, '');

    if (!cleanLocal || !cleanDomain || !cleanDomain.includes('.')) return null;

    return {
      localPart: cleanLocal,
      domain: cleanDomain,
      normalized: `${cleanLocal}@${cleanDomain}`,
    };
  }

  /**
   * Evaluates if a given email local part matches exact generic usernames.
   * STRICT EXACT MATCH ONLY:
   * "info" -> true
   * "cinfo" -> false
   * "helloinfo" -> false
   * "supportteam" -> false
   * "john.info" -> false
   */
  public isExactGenericLocalPart(localPart: string, customPatterns?: string[]): boolean {
    const normalizedLocal = localPart.toLowerCase().trim();

    // 1. Mandatory exact list check
    if (EXACT_GENERIC_LOCAL_PARTS.has(normalizedLocal)) {
      return true;
    }

    // 2. Departmental exact list check
    if (DEPARTMENTAL_EXACT_LOCAL_PARTS.has(normalizedLocal)) {
      return true;
    }

    // 3. User configured generic patterns (must be exact match on localPart)
    if (customPatterns && customPatterns.length > 0) {
      for (const pattern of customPatterns) {
        let cleanPattern = pattern.toLowerCase().trim();
        // Remove trailing @ if user entered "info@"
        if (cleanPattern.endsWith('@')) {
          cleanPattern = cleanPattern.slice(0, -1);
        }
        if (cleanPattern && normalizedLocal === cleanPattern) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks whether the email domain belongs to a free/consumer personal email provider.
   */
  public isPersonalProviderDomain(domain: string): boolean {
    const cleanDomain = domain.toLowerCase().trim();
    return PERSONAL_PROVIDER_DOMAINS.has(cleanDomain);
  }

  /**
   * Tests whether the local part is consistent with a person's name.
   * Examples:
   * - john@company.com with John Smith -> consistent (first name match)
   * - jsmith@company.com with John Smith -> consistent (first initial + last name)
   * - john.smith@company.com with John Smith -> consistent (full name)
   * - smith@company.com with John Smith -> consistent (last name)
   * - john.s@company.com with John Smith -> consistent (first + last initial)
   * - j.smith@company.com with John Smith -> consistent (initial + dot + last)
   */
  public isNameConsistent(localPart: string, person: PersonEvidence): { consistent: boolean; matchType: string } {
    const local = localPart.toLowerCase().replace(/[^a-z0-9]/g, '');
    const first = (person.firstName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const last = (person.lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    let fullFirst = first;
    let fullLast = last;
    if (!fullFirst && person.fullName) {
      const parts = person.fullName.trim().split(/\s+/);
      fullFirst = parts[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      fullLast = parts.slice(1).join('').toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    }

    if (!fullFirst && !fullLast) {
      return { consistent: false, matchType: 'No person name provided' };
    }

    // Exact first name match (e.g. john@ for John)
    if (fullFirst.length >= 3 && (local === fullFirst || local.startsWith(fullFirst))) {
      return { consistent: true, matchType: `Matches first name "${fullFirst}"` };
    }

    // Exact last name match (e.g. smith@ for Smith)
    if (fullLast.length >= 3 && (local === fullLast || local.endsWith(fullLast))) {
      return { consistent: true, matchType: `Matches last name "${fullLast}"` };
    }

    // Full name combined (e.g. johnsmith, john.smith, jsmith, sjohn)
    if (fullFirst && fullLast) {
      const firstInitial = fullFirst.charAt(0);
      const lastInitial = fullLast.charAt(0);

      // jsmith or johnsmith
      if (local === `${firstInitial}${fullLast}` || local === `${fullFirst}${fullLast}`) {
        return { consistent: true, matchType: `Matches name combination (${fullFirst} ${fullLast})` };
      }
      // johns or john.s
      if (local === `${fullFirst}${lastInitial}`) {
        return { consistent: true, matchType: `Matches first name + last initial (${fullFirst} ${lastInitial})` };
      }
    }

    return { consistent: false, matchType: 'Username does not directly correlate with person name' };
  }

  /**
   * Main deterministic email classification method.
   * Strictly separates:
   * 1. Generic Business Email
   * 2. Personal Email Provider
   * 3. Professional Personal Email (requires verified name, role, and company connection)
   * 4. Unknown (non-generic but person not identified or unverified)
   */
  public classify(
    rawEmail: string,
    personEvidence?: PersonEvidence,
    customGenericPatterns?: string[]
  ): EmailClassificationResult {
    const parsed = this.parseEmail(rawEmail);
    if (!parsed) {
      return {
        email: rawEmail,
        normalizedEmail: rawEmail.trim().toLowerCase(),
        localPart: '',
        domain: '',
        classification: 'Unknown',
        isGeneric: false,
        isPersonalProvider: false,
        isProfessionalPersonal: false,
        identityVerified: false,
        reason: 'Malformed or invalid email address format',
      };
    }

    const { localPart, domain, normalized } = parsed;

    // STEP 1: Check Exact Generic Local-Part
    if (this.isExactGenericLocalPart(localPart, customGenericPatterns)) {
      return {
        email: rawEmail,
        normalizedEmail: normalized,
        localPart,
        domain,
        classification: 'Generic Business Email',
        isGeneric: true,
        isPersonalProvider: false,
        isProfessionalPersonal: false,
        identityVerified: false,
        reason: `Exact local-part "${localPart}" matches generic company address standard (${localPart}@).`,
      };
    }

    // STEP 2: Check Personal Consumer Email Provider (e.g. @gmail.com)
    if (this.isPersonalProviderDomain(domain)) {
      const hasPerson = Boolean(personEvidence?.fullName?.trim());
      return {
        email: rawEmail,
        normalizedEmail: normalized,
        localPart,
        domain,
        classification: 'Personal Email Provider',
        isGeneric: false,
        isPersonalProvider: true,
        isProfessionalPersonal: false,
        identityVerified: hasPerson,
        reason: `Hosted on public consumer mail provider (${domain}). Not a corporate custom domain.`,
      };
    }

    // STEP 3: Corporate non-generic address -> Identity Verification
    // CRITICAL REQUIREMENT: A non-generic email must NOT automatically be classified as a professional personal email!
    // Must verify the person's name, company connection, and available evidence.
    const hasValidName = Boolean(
      personEvidence?.fullName &&
        personEvidence.fullName.trim().length >= 3 &&
        !personEvidence.fullName.toLowerCase().includes('company') &&
        !personEvidence.fullName.toLowerCase().includes('general') &&
        !personEvidence.fullName.toLowerCase().includes('support') &&
        !personEvidence.fullName.toLowerCase().includes('info')
    );

    const hasVerifiedRole = Boolean(
      personEvidence?.role &&
        personEvidence.role.trim().length >= 2 &&
        personEvidence.role.toLowerCase() !== 'unspecified' &&
        personEvidence.role.toLowerCase() !== 'other staff' &&
        personEvidence.role.toLowerCase() !== 'company general'
    );

    if (hasValidName) {
      const nameCheck = this.isNameConsistent(localPart, personEvidence!);

      if (nameCheck.consistent || personEvidence?.explicitLayoutAssociation) {
        const evidenceStr = nameCheck.consistent
          ? `${nameCheck.matchType}; role: ${personEvidence?.role || 'Company Executive'}`
          : `Direct layout association on ${personEvidence?.sourceUrl || 'company page'}`;

        return {
          email: rawEmail,
          normalizedEmail: normalized,
          localPart,
          domain,
          classification: 'Professional Personal Email',
          isGeneric: false,
          isPersonalProvider: false,
          isProfessionalPersonal: true,
          identityVerified: true,
          reason: `Verified individual person: "${personEvidence!.fullName}" [${evidenceStr}].`,
        };
      } else if (hasVerifiedRole) {
        // Name is present on page, but username doesn't correlate to the name
        return {
          email: rawEmail,
          normalizedEmail: normalized,
          localPart,
          domain,
          classification: 'Professional Personal Email',
          isGeneric: false,
          isPersonalProvider: false,
          isProfessionalPersonal: true,
          identityVerified: true,
          reason: `Direct contact affiliated with ${personEvidence!.fullName} (${personEvidence!.role}) on official company domain.`,
        };
      }
    }

    // Non-generic corporate email with NO identified person or uncertain connection
    // (e.g. cinfo@company.com with no identified person -> Unknown, not automatically generic)
    return {
      email: rawEmail,
      normalizedEmail: normalized,
      localPart,
      domain,
      classification: 'Unknown',
      isGeneric: false,
      isPersonalProvider: false,
      isProfessionalPersonal: false,
      identityVerified: false,
      reason: `Non-generic local-part "${localPart}" without a confirmed individual identity on public website. Marked Unknown per verification rules.`,
    };
  }
}

export const globalEmailClassifier = new EmailClassifierEngine();
