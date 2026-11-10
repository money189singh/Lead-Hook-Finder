import { Contact, CompanyFirmographics, IcpConfig, EmailType } from '../../src/types';

export interface FilterEvaluationResult {
  passed: boolean;
  status: 'INCLUDED' | 'EXCLUDED' | 'UNKNOWN';
  inclusionReasons: string[];
  exclusionReasons: string[];
}

export class IcpFilterEngine {
  /**
   * Normalizes employee size strings into standardized tiers:
   * '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
   */
  public normalizeEmployeeTier(rawTier?: string): string | null {
    if (!rawTier || typeof rawTier !== 'string') return null;
    const clean = rawTier.trim().toLowerCase().replace(/–/g, '-');

    if (clean.includes('1-10') || clean === '1 to 10' || clean.includes('micro') || clean.includes('1-5') || clean.includes('1-9')) {
      return '1-10';
    }
    if (clean.includes('11-50') || clean === '11 to 50' || clean.includes('10-50')) {
      return '11-50';
    }
    if (clean.includes('51-200') || clean === '51 to 200' || clean.includes('50-200')) {
      return '51-200';
    }
    if (clean.includes('201-500') || clean === '201 to 500') {
      return '201-500';
    }
    if (clean.includes('501-1000') || clean === '501 to 1000') {
      return '501-1000';
    }
    if (clean.includes('1000+') || clean.includes('1000-') || clean.includes('enterprise') || clean.includes('10,000')) {
      return '1000+';
    }

    // Try parsing a direct number: e.g. "8 employees" -> '1-10'
    const numMatch = clean.match(/\b(\d+)\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 1 && num <= 10) return '1-10';
      if (num > 10 && num <= 50) return '11-50';
      if (num > 50 && num <= 200) return '51-200';
      if (num > 200 && num <= 500) return '201-500';
      if (num > 500 && num <= 1000) return '501-1000';
      if (num > 1000) return '1000+';
    }

    return null;
  }

  /**
   * Evaluates if a company's firmographics match the strict ICP filters.
   */
  public evaluateCompany(
    firmographics: CompanyFirmographics | undefined,
    config: IcpConfig | undefined
  ): FilterEvaluationResult {
    const inclusionReasons: string[] = [];
    const exclusionReasons: string[] = [];

    if (!config || !config.enabled) {
      return {
        passed: true,
        status: 'INCLUDED',
        inclusionReasons: ['ICP filtering disabled - all companies included'],
        exclusionReasons: [],
      };
    }

    const isStrict = config.strict_mode !== false; // Default strict mode if enabled
    const unknownPolicy = config.unknown_policy || 'mark_unverified';

    // 1. Company Size / Employee Range Check
    if (config.preferred_company_sizes && config.preferred_company_sizes.length > 0) {
      const normalizedReqs = config.preferred_company_sizes.map((s) => s.replace(/–/g, '-').trim());
      const companyTier = this.normalizeEmployeeTier(firmographics?.employee_tier);

      if (companyTier) {
        if (normalizedReqs.includes(companyTier)) {
          inclusionReasons.push(`Company size verified (${companyTier} employees matches target ${normalizedReqs.join(', ')})`);
        } else {
          exclusionReasons.push(
            `Company size "${firmographics?.employee_tier || companyTier}" does not match required range: [${normalizedReqs.join(', ')}]`
          );
        }
      } else {
        // Unknown employee count
        if (unknownPolicy === 'exclude') {
          exclusionReasons.push(
            `Company employee count could not be verified from public sources (Policy: Exclude unknown)`
          );
        } else {
          inclusionReasons.push(
            `Company employee count is Unknown (Policy: ${unknownPolicy === 'include' ? 'Include unknown' : 'Mark unverified'})`
          );
        }
      }
    }

    // 2. Industry Vertical Check
    if (config.target_industries && config.target_industries.length > 0) {
      const companyIndustry = (firmographics?.industry || '').toLowerCase();
      if (companyIndustry) {
        let matched = false;
        for (const targetInd of config.target_industries) {
          if (companyIndustry.includes(targetInd.toLowerCase())) {
            matched = true;
            inclusionReasons.push(`Industry verified: "${firmographics?.industry}" matches target "${targetInd}"`);
            break;
          }
        }
        if (!matched && isStrict) {
          exclusionReasons.push(
            `Industry "${firmographics?.industry}" does not match target industries: [${config.target_industries.slice(0, 4).join(', ')}]`
          );
        }
      } else if (unknownPolicy === 'exclude' && isStrict) {
        exclusionReasons.push('Company industry could not be verified from public sources (Policy: Exclude unknown)');
      }
    }

    // 3. Location Check
    if (config.target_locations && config.target_locations.length > 0) {
      const hq = (firmographics?.headquarters || '').toLowerCase();
      if (hq) {
        let locMatched = false;
        for (const loc of config.target_locations) {
          if (hq.includes(loc.toLowerCase())) {
            locMatched = true;
            inclusionReasons.push(`Location verified: "${firmographics?.headquarters}" matches target "${loc}"`);
            break;
          }
        }
        if (!locMatched && isStrict) {
          exclusionReasons.push(`Location "${firmographics?.headquarters}" does not match target locations`);
        }
      } else if (unknownPolicy === 'exclude' && isStrict) {
        exclusionReasons.push('Company location could not be verified (Policy: Exclude unknown)');
      }
    }

    const passed = exclusionReasons.length === 0;
    const status: 'INCLUDED' | 'EXCLUDED' | 'UNKNOWN' = passed
      ? 'INCLUDED'
      : unknownPolicy === 'mark_unverified' && exclusionReasons.some((r) => r.includes('could not be verified'))
      ? 'UNKNOWN'
      : 'EXCLUDED';

    return {
      passed,
      status,
      inclusionReasons,
      exclusionReasons,
    };
  }

  /**
   * Evaluates if a contact matches strict ICP filters (Email type, Role, Decision Maker, etc.).
   */
  public evaluateContact(
    contact: Contact,
    firmographics: CompanyFirmographics | undefined,
    config: IcpConfig | undefined
  ): FilterEvaluationResult {
    const inclusionReasons: string[] = [];
    const exclusionReasons: string[] = [];

    if (!config || !config.enabled) {
      return {
        passed: true,
        status: 'INCLUDED',
        inclusionReasons: ['ICP filtering disabled'],
        exclusionReasons: [],
      };
    }

    const isStrict = config.strict_mode !== false;
    const unknownPolicy = config.unknown_policy || 'mark_unverified';

    // First check company-level firmographics
    const companyEval = this.evaluateCompany(firmographics, config);
    if (!companyEval.passed && isStrict) {
      exclusionReasons.push(...companyEval.exclusionReasons);
    } else {
      inclusionReasons.push(...companyEval.inclusionReasons);
    }

    // 1. Email Type Filter Enforcement
    if (config.required_email_types && config.required_email_types.length > 0) {
      const emailType = contact.email_type;

      // Handle aliases: 'Personal' -> 'Professional Personal Email', 'Generic' -> 'Generic Business Email'
      const normalizedType =
        emailType === 'Personal'
          ? 'Professional Personal Email'
          : emailType === 'Generic'
          ? 'Generic Business Email'
          : emailType;

      const reqTypes = config.required_email_types.map((t) =>
        t === 'Personal' ? 'Professional Personal Email' : t === 'Generic' ? 'Generic Business Email' : t
      );

      if (reqTypes.includes(normalizedType as any)) {
        inclusionReasons.push(`Email type verified: "${normalizedType}" matches required policy.`);
      } else {
        if (normalizedType === 'Unknown') {
          if (unknownPolicy === 'exclude') {
            exclusionReasons.push(
              `Email type is Unknown / unverified identity (Required: [${reqTypes.join(', ')}]; Policy: Exclude unknown)`
            );
          } else {
            inclusionReasons.push(`Email type is Unknown (Policy: ${unknownPolicy})`);
          }
        } else {
          exclusionReasons.push(
            `Email type "${normalizedType}" does not match selected filter: [${reqTypes.join(', ')}]`
          );
        }
      }
    }

    // 2. Target Roles / Job Title Enforcement
    if (config.target_roles && config.target_roles.length > 0) {
      const role = (contact.role || '').toLowerCase();
      let roleMatched = false;

      // Authentic commercial decision makers or executive leadership should always match
      const isExecutiveOrDecisionMaker =
        contact.is_decision_maker === true ||
        contact.decision_maker_tier === 'Top Executive / Owner' ||
        contact.decision_maker_tier === 'Operational Lead' ||
        contact.role_tier === 'C-Suite / Executive' ||
        contact.role_tier === 'Finance & Legal' ||
        /\b(partner|owner|founder|director|managing|attorney|lawyer|counsel|principal|president|executive|chief|officer|vp)\b/i.test(role);

      for (const targetRole of config.target_roles) {
        const cleanTarget = targetRole.trim().toLowerCase();
        if (!cleanTarget) continue;
        const regex = new RegExp(`\\b${cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(role) || (cleanTarget.length > 3 && role.includes(cleanTarget))) {
          roleMatched = true;
          inclusionReasons.push(`Job title verified: "${contact.role}" matches target role "${targetRole}".`);
          break;
        }
      }

      if (!roleMatched && isExecutiveOrDecisionMaker) {
        roleMatched = true;
        inclusionReasons.push(`Job title verified: "${contact.role}" recognized as verified commercial executive / leadership.`);
      }

      if (!roleMatched && isStrict) {
        exclusionReasons.push(
          `Job title "${contact.role || 'Unspecified'}" does not match required roles: [${config.target_roles.slice(0, 4).join(', ')}]`
        );
      }
    }

    // 3. Minimum ICP score threshold
    if (config.min_icp_score && config.min_icp_score > 0 && contact.icp_score !== undefined) {
      if (contact.icp_score >= config.min_icp_score) {
        inclusionReasons.push(`ICP Score ${contact.icp_score}% meets threshold >= ${config.min_icp_score}%.`);
      } else if (isStrict) {
        exclusionReasons.push(`ICP Score ${contact.icp_score}% is below threshold (${config.min_icp_score}%).`);
      }
    }

    const passed = exclusionReasons.length === 0;
    const status: 'INCLUDED' | 'EXCLUDED' | 'UNKNOWN' = passed
      ? 'INCLUDED'
      : unknownPolicy === 'mark_unverified' && exclusionReasons.some((r) => r.includes('could not be verified'))
      ? 'UNKNOWN'
      : 'EXCLUDED';

    return {
      passed,
      status,
      inclusionReasons,
      exclusionReasons,
    };
  }

  /**
   * Applies strict filtering to an entire batch of contacts and firmographics.
   * Attaches status, inclusion reasons, and exclusion reasons directly to each contact.
   */
  public filterContacts(
    contacts: Contact[],
    firmographics: CompanyFirmographics | undefined,
    config: IcpConfig | undefined
  ): {
    allContacts: Contact[];
    includedContacts: Contact[];
    excludedContacts: Contact[];
  } {
    const includedContacts: Contact[] = [];
    const excludedContacts: Contact[] = [];

    const processed = contacts.map((c) => {
      const evalRes = this.evaluateContact(c, firmographics, config);
      c.icp_filter_status = evalRes.status;
      c.icp_inclusion_reasons = evalRes.inclusionReasons;
      c.icp_exclusion_reasons = evalRes.exclusionReasons;

      if (evalRes.passed) {
        includedContacts.push(c);
      } else {
        excludedContacts.push(c);
      }

      return c;
    });

    return {
      allContacts: processed,
      includedContacts,
      excludedContacts,
    };
  }
}

export const globalIcpFilterEngine = new IcpFilterEngine();
