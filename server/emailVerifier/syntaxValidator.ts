import { SyntaxCheckResult } from './types';

/**
 * Self-Hosted RFC 5321 / RFC 5322 Email Syntax Validator
 * Accurately validates email syntax and normalizes casing/whitespace
 * without altering the original displayed address.
 */
export class SyntaxValidator {
  // Disallowed characters in unquoted local part
  private static readonly INVALID_LOCAL_CHARS = /[^\w!#$%&'*+/=?^`{|}~.-]/;

  /**
   * Validate and parse an email address
   */
  public static validate(rawEmail: string): SyntaxCheckResult {
    if (!rawEmail || typeof rawEmail !== 'string') {
      return {
        valid: false,
        normalizedEmail: '',
        localPart: '',
        domain: '',
        error: 'Email address is empty or null',
      };
    }

    const trimmed = rawEmail.trim();
    if (!trimmed) {
      return {
        valid: false,
        normalizedEmail: '',
        localPart: '',
        domain: '',
        error: 'Email address contains only whitespace',
      };
    }

    // Total length check (RFC 5321: max 254 octets)
    if (trimmed.length > 254) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart: '',
        domain: '',
        error: 'Total email address length exceeds 254 characters',
      };
    }

    // Must contain exactly one '@' (unless quoted, but standard business mailboxes are unquoted)
    const atIndices: number[] = [];
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '@') atIndices.push(i);
    }

    if (atIndices.length === 0) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart: '',
        domain: '',
        error: "Missing '@' separator",
      };
    }

    if (atIndices.length > 1) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart: '',
        domain: '',
        error: "Multiple '@' symbols detected in address",
      };
    }

    const atIndex = atIndices[0];
    const localPart = trimmed.substring(0, atIndex);
    const domain = trimmed.substring(atIndex + 1);

    // Validate local part
    if (localPart.length === 0) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart: '',
        domain,
        error: 'Missing username/local part before @',
      };
    }

    if (localPart.length > 64) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Username/local part exceeds maximum 64 characters (RFC 5321)',
      };
    }

    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Local part cannot begin or end with a dot',
      };
    }

    if (localPart.includes('..')) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Local part cannot contain consecutive dots (..)',
      };
    }

    if (this.INVALID_LOCAL_CHARS.test(localPart)) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Local part contains illegal characters',
      };
    }

    // Validate domain part
    if (domain.length === 0) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain: '',
        error: 'Missing domain name after @',
      };
    }

    if (domain.length > 253) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Domain name exceeds maximum 253 characters',
      };
    }

    if (domain.startsWith('.') || domain.endsWith('.')) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Domain cannot begin or end with a dot',
      };
    }

    if (domain.includes('..')) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Domain cannot contain consecutive dots (..)',
      };
    }

    const domainLabels = domain.split('.');
    if (domainLabels.length < 2) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: 'Domain must have at least one top-level domain (TLD)',
      };
    }

    // Check each domain label
    for (const label of domainLabels) {
      if (!label || label.length === 0) {
        return {
          valid: false,
          normalizedEmail: trimmed.toLowerCase(),
          localPart,
          domain,
          error: 'Domain contains empty label',
        };
      }
      if (label.length > 63) {
        return {
          valid: false,
          normalizedEmail: trimmed.toLowerCase(),
          localPart,
          domain,
          error: `Domain label "${label}" exceeds 63 characters`,
        };
      }
      if (label.startsWith('-') || label.endsWith('-')) {
        return {
          valid: false,
          normalizedEmail: trimmed.toLowerCase(),
          localPart,
          domain,
          error: `Domain label "${label}" cannot begin or end with a hyphen`,
        };
      }
      if (!/^[a-zA-Z0-9-]+$/.test(label)) {
        return {
          valid: false,
          normalizedEmail: trimmed.toLowerCase(),
          localPart,
          domain,
          error: `Domain label "${label}" contains invalid characters`,
        };
      }
    }

    // Check TLD (last label)
    const tld = domainLabels[domainLabels.length - 1];
    if (tld.length < 2) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: `Top-level domain (TLD) "${tld}" must be at least 2 characters`,
      };
    }
    if (/^\d+$/.test(tld)) {
      return {
        valid: false,
        normalizedEmail: trimmed.toLowerCase(),
        localPart,
        domain,
        error: `Top-level domain (TLD) "${tld}" cannot be purely numeric`,
      };
    }

    const normalized = `${localPart}@${domain.toLowerCase()}`;

    return {
      valid: true,
      normalizedEmail: normalized,
      localPart,
      domain: domain.toLowerCase(),
    };
  }
}
