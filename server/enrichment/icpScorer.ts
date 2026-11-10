import { Contact, RoleTier, IcpTier, CompanyFirmographics, IcpConfig } from '../../src/types';

export const DEFAULT_ICP_CONFIG: IcpConfig = {
  enabled: true,
  target_roles: [
    'CEO',
    'Chief Executive',
    'Founder',
    'Co-Founder',
    'Owner',
    'Managing Partner',
    'Senior Partner',
    'Partner',
    'Managing Director',
    'Director of Legal Services',
    'Managing Attorney',
    'Attorney',
    'Lawyer',
    'General Counsel',
    'President',
    'VP',
    'Vice President',
    'Director of Sales',
    'Head of Sales',
    'VP Sales',
    'Chief Marketing Officer',
    'CMO',
    'Head of Growth',
    'Chief Operating Officer',
    'COO',
    'Operations Director',
    'General Manager',
    'Chief Technology Officer',
    'CTO',
    'VP Engineering',
    'Head of Product',
  ],
  target_industries: [
    'SaaS',
    'Software',
    'Technology',
    'Information Technology',
    'Cloud',
    'Artificial Intelligence',
    'E-commerce',
    'Fintech',
    'Finance',
    'Healthcare',
    'Manufacturing',
    'Logistics',
    'Marketing',
    'Consulting',
    'Professional Services',
  ],
  preferred_company_sizes: ['11-50', '51-200', '201-500', '501-1000', '1000+'],
  min_icp_score: 50,
  weights: {
    roleWeight: 40,
    industryWeight: 25,
    companySizeWeight: 15,
    emailTypeWeight: 15,
    socialWeight: 5,
  },
};

export class IcpScoringEngine {
  /**
   * Categorizes any raw job title into a standardized commercial role tier.
   */
  public categorizeRole(rawTitle?: string): RoleTier {
    if (!rawTitle || typeof rawTitle !== 'string') {
      return 'Other Staff';
    }

    const title = rawTitle.toLowerCase().trim();

    // 1. C-Suite / Executive
    if (
      /\b(ceo|cto|cfo|coo|cmo|cro|cio|cpo|cso)\b/i.test(title) ||
      /\b(chief executive|chief technology|chief operating|chief financial|chief revenue|chief marketing)\b/i.test(title) ||
      /\b(founder|co-founder|owner|co-owner|proprietor|partner|managing partner)\b/i.test(title) ||
      /\b(managing director|director general|executive director|president|vice president|vp|svp|evp)\b/i.test(title) ||
      /\b(chairman|chairperson|board member)\b/i.test(title)
    ) {
      return 'C-Suite / Executive';
    }

    // 2. Sales & Marketing
    if (
      /\b(sales|account executive|business development|biz dev|bdr|sdr|client executive|growth)\b/i.test(title) ||
      /\b(marketing|demand generation|performance marketing|brand manager|public relations|pr|digital marketing)\b/i.test(title) ||
      /\b(commercial|partnerships|alliances|revenue)\b/i.test(title)
    ) {
      return 'Sales & Marketing';
    }

    // 3. Procurement & Operations
    if (
      /\b(operations|operations manager|supply chain|logistics|procurement|purchasing|sourcing|facilities)\b/i.test(title) ||
      /\b(plant manager|warehouse|vendor management|contracts manager)\b/i.test(title)
    ) {
      return 'Procurement & Operations';
    }

    // 4. Technical / Engineering
    if (
      /\b(engineer|engineering|developer|architect|software|devops|data scientist|ai|machine learning|it manager|system administrator)\b/i.test(title) ||
      /\b(product manager|product lead|head of product|technical lead|tech lead)\b/i.test(title)
    ) {
      return 'Technical / Engineering';
    }

    // 5. Finance & Legal
    if (
      /\b(finance|financial|accountant|accounting|controller|comptroller|treasury|tax|auditor)\b/i.test(title) ||
      /\b(legal|counsel|general counsel|compliance|attorney|lawyer)\b/i.test(title)
    ) {
      return 'Finance & Legal';
    }

    // 6. General Management
    if (
      /\b(general manager|branch manager|office manager|country manager|regional manager|director|head of)\b/i.test(title)
    ) {
      return 'General Management';
    }

    return 'Other Staff';
  }

  /**
   * Calculates an ICP match score (0-100%) and returns human-readable justification points.
   */
  public scoreContact(
    contact: Contact,
    firmographics?: CompanyFirmographics,
    customConfig?: IcpConfig
  ): {
    score: number;
    tier: IcpTier;
    roleTier: RoleTier;
    reasons: string[];
  } {
    const config = customConfig || DEFAULT_ICP_CONFIG;
    const reasons: string[] = [];
    let score = 0;

    // 1. Role Categorization
    const roleTier = contact.role_tier || this.categorizeRole(contact.role);
    const roleStr = (contact.role || '').toLowerCase();

    // Check direct target role match
    let targetRoleMatched = false;
    for (const target of config.target_roles) {
      if (roleStr.includes(target.toLowerCase())) {
        targetRoleMatched = true;
        break;
      }
    }

    if (targetRoleMatched) {
      score += 40;
      reasons.push(`+40% Target Role Match (${contact.role || roleTier})`);
    } else if (roleTier === 'C-Suite / Executive') {
      score += 35;
      reasons.push(`+35% C-Suite / Executive Tier (${contact.role})`);
    } else if (roleTier === 'Sales & Marketing') {
      score += 30;
      reasons.push(`+30% Commercial Decision Maker (${contact.role})`);
    } else if (roleTier === 'Procurement & Operations') {
      score += 28;
      reasons.push(`+28% Operations / Procurement Tier`);
    } else if (roleTier === 'Technical / Engineering' || roleTier === 'Finance & Legal') {
      score += 24;
      reasons.push(`+24% Specialized Department Lead`);
    } else if (roleTier === 'General Management') {
      score += 18;
      reasons.push(`+18% General Management Role`);
    } else {
      score += 8;
      reasons.push(`+8% General Company Contact`);
    }

    // 2. Email Verification & Type (Max 20 pts)
    if (contact.email) {
      if (contact.email_type === 'Personal') {
        score += 20;
        reasons.push(`+20% Verified Direct Personal Email`);
      } else if (contact.email_type === 'Role-based') {
        score += 12;
        reasons.push(`+12% Departmental Role-Based Email`);
      } else {
        score += 5;
        reasons.push(`+5% Generic Front-Desk Email`);
      }
    }

    // 3. Industry Alignment (Max 20 pts)
    if (firmographics?.industry) {
      const industryStr = firmographics.industry.toLowerCase();
      let matchedIndustry = false;
      for (const targetInd of config.target_industries) {
        if (industryStr.includes(targetInd.toLowerCase())) {
          matchedIndustry = true;
          break;
        }
      }

      if (matchedIndustry) {
        score += 20;
        reasons.push(`+20% High-Value Industry Match (${firmographics.industry})`);
      } else {
        score += 10;
        reasons.push(`+10% Commercial Vertical Identified (${firmographics.industry})`);
      }
    } else {
      // Default baseline for commercial web domain
      score += 8;
      reasons.push(`+8% Verified Commercial Website`);
    }

    // 4. Company Size / Employee Tier (Max 10 pts)
    if (firmographics?.employee_tier) {
      if (config.preferred_company_sizes.includes(firmographics.employee_tier)) {
        score += 10;
        reasons.push(`+10% Target Employee Tier (${firmographics.employee_tier} employees)`);
      } else {
        score += 5;
        reasons.push(`+5% Identified Scale (${firmographics.employee_tier} employees)`);
      }
    } else {
      score += 4;
    }

    // 5. Social & Direct Phone Presence (Max 10 pts)
    if (contact.linkedin_url || contact.social_profiles?.linkedin) {
      score += 6;
      reasons.push(`+6% Verified LinkedIn Profile Attached`);
    }
    if (contact.phone) {
      score += 4;
      reasons.push(`+4% Direct Phone Number Available`);
    }

    // Cap score at 100
    score = Math.min(100, Math.max(0, Math.round(score)));

    // Assign Tier
    let tier: IcpTier = 'Unmatched';
    if (score >= 80) tier = 'High Match';
    else if (score >= 50) tier = 'Moderate Match';
    else if (score >= 25) tier = 'Low Match';

    return {
      score,
      tier,
      roleTier,
      reasons,
    };
  }

  /**
   * Applies enrichment, role categorization, and ICP scoring to an array of contacts.
   */
  public enrichContacts(
    contacts: Contact[],
    firmographics?: CompanyFirmographics,
    config?: IcpConfig
  ): Contact[] {
    return contacts.map((c) => {
      const { score, tier, roleTier, reasons } = this.scoreContact(c, firmographics, config);
      return {
        ...c,
        role_tier: roleTier,
        icp_score: score,
        icp_tier: tier,
        icp_match_reasons: reasons,
      };
    });
  }
}

export const globalIcpScorer = new IcpScoringEngine();
