import { Contact, RoleTier } from '../../src/types';

export interface DecisionMakerEvaluation {
  isDecisionMaker: boolean;
  tier: 'Top Executive / Owner' | 'Senior Decision Maker' | 'Operational Lead' | 'Not Decision Maker';
  decisionRank: number; // Higher is more senior (100 = Owner/Founder/CEO, etc.)
  matchedRoleKeyword: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string;
}

export const DECISION_MAKER_TARGET_ROLES = [
  'Owner',
  'Co-Owner',
  'Founder',
  'Co-Founder',
  'Chief Executive Officer',
  'CEO',
  'President',
  'Managing Director',
  'Managing Partner',
  'Principal',
  'Partner',
  'Chairman',
  'Executive Director',
  'Chief Operating Officer',
  'COO',
  'Chief Financial Officer',
  'CFO',
  'Chief Technology Officer',
  'CTO',
  'General Manager',
  'Vice President',
  'VP',
];

export class DecisionMakerFinder {
  /**
   * Evaluates if a given contact or role title represents a company owner or decision-maker.
   */
  public evaluateRole(rawRole?: string, roleTier?: RoleTier): DecisionMakerEvaluation {
    if (!rawRole || typeof rawRole !== 'string') {
      return {
        isDecisionMaker: false,
        tier: 'Not Decision Maker',
        decisionRank: 0,
        matchedRoleKeyword: '',
        confidence: 'LOW',
        evidence: 'No specific role title provided',
      };
    }

    const title = rawRole.toLowerCase().trim();

    // 1. Highest Tier: Owners & Founders (Rank 100)
    if (/\b(founder|co-founder|owner|co-owner|proprietor)\b/i.test(title)) {
      const match = title.match(/\b(founder|co-founder|owner|co-owner|proprietor)\b/i)?.[0] || 'Founder/Owner';
      return {
        isDecisionMaker: true,
        tier: 'Top Executive / Owner',
        decisionRank: 100,
        matchedRoleKeyword: match,
        confidence: 'HIGH',
        evidence: `Confirmed primary ownership role: "${rawRole}"`,
      };
    }

    // 2. Chief Executive / President / Managing Director (Rank 95)
    if (
      /\b(ceo|chief executive officer|chief executive|president|managing director|managing partner)\b/i.test(title) &&
      !title.includes('vice president') &&
      !title.includes('assistant')
    ) {
      const match = title.match(/\b(ceo|chief executive officer|chief executive|president|managing director|managing partner)\b/i)?.[0] || 'CEO';
      return {
        isDecisionMaker: true,
        tier: 'Top Executive / Owner',
        decisionRank: 95,
        matchedRoleKeyword: match,
        confidence: 'HIGH',
        evidence: `Top organizational executive: "${rawRole}"`,
      };
    }

    // 3. Principal / Partner / Chairman / Board (Rank 90)
    if (/\b(principal|senior partner|equity partner|partner|chairman|chairperson|board member)\b/i.test(title)) {
      const match = title.match(/\b(principal|senior partner|equity partner|partner|chairman|chairperson)\b/i)?.[0] || 'Principal/Partner';
      return {
        isDecisionMaker: true,
        tier: 'Top Executive / Owner',
        decisionRank: 90,
        matchedRoleKeyword: match,
        confidence: 'HIGH',
        evidence: `Principal firm leadership: "${rawRole}"`,
      };
    }

    // 4. Other C-Suite (COO, CFO, CTO, CMO, CRO, CIO) (Rank 85)
    if (
      /\b(coo|cfo|cto|cmo|cro|cio|cpo|chief operating|chief financial|chief technology|chief revenue|chief commercial)\b/i.test(title)
    ) {
      const match = title.match(/\b(coo|cfo|cto|cmo|cro|cio|cpo|chief [a-z]+ officer)\b/i)?.[0] || 'C-Suite';
      return {
        isDecisionMaker: true,
        tier: 'Senior Decision Maker',
        decisionRank: 85,
        matchedRoleKeyword: match,
        confidence: 'HIGH',
        evidence: `Executive leadership decision maker: "${rawRole}"`,
      };
    }

    // 5. Vice Presidents & Executive Directors (Rank 75)
    if (/\b(vice president|vp|svp|evp|executive director|general manager|director general)\b/i.test(title)) {
      const match = title.match(/\b(vice president|vp|svp|evp|executive director|general manager)\b/i)?.[0] || 'VP/Executive Director';
      return {
        isDecisionMaker: true,
        tier: 'Senior Decision Maker',
        decisionRank: 75,
        matchedRoleKeyword: match,
        confidence: 'MEDIUM',
        evidence: `Senior management / VP tier: "${rawRole}"`,
      };
    }

    // 6. Department Heads / Directors (Rank 65)
    if (/\b(director|head of)\b/i.test(title) && !title.includes('assistant')) {
      const match = title.match(/\b(director|head of [a-z]+)\b/i)?.[0] || 'Director';
      return {
        isDecisionMaker: true,
        tier: 'Operational Lead',
        decisionRank: 65,
        matchedRoleKeyword: match,
        confidence: 'MEDIUM',
        evidence: `Departmental leadership: "${rawRole}"`,
      };
    }

    // Fallback: check RoleTier
    if (roleTier === 'C-Suite / Executive') {
      return {
        isDecisionMaker: true,
        tier: 'Senior Decision Maker',
        decisionRank: 80,
        matchedRoleKeyword: 'C-Suite Tier',
        confidence: 'MEDIUM',
        evidence: `Executive tier role: "${rawRole}"`,
      };
    }

    return {
      isDecisionMaker: false,
      tier: 'Not Decision Maker',
      decisionRank: 20,
      matchedRoleKeyword: '',
      confidence: 'HIGH',
      evidence: `Role "${rawRole}" is general staff, not a commercial owner or decision maker.`,
    };
  }

  /**
   * Evaluates and enriches a single contact with decision maker tier, score, and reasons
   */
  public evaluateAndEnrich(contact: Contact): Contact {
    const evalResult = this.evaluateRole(contact.role, contact.role_tier);
    contact.is_decision_maker = evalResult.isDecisionMaker;
    contact.decision_maker_tier = evalResult.tier;
    contact.decision_maker_score = evalResult.decisionRank;
    contact.decision_maker_reasons = [evalResult.evidence];
    if (contact.email_type === 'Professional Personal Email' || contact.email_type === 'Personal') {
      contact.decision_maker_reasons.push('Direct verified personal email');
    }
    if (contact.linkedin_url) {
      contact.decision_maker_reasons.push('Verified LinkedIn profile');
    }
    return contact;
  }

  /**
   * Finds the highest-ranked decision maker among a list of contacts.
   */
  public findTopDecisionMaker(contacts: Contact[]): Contact | undefined {
    if (!contacts || contacts.length === 0) return undefined;
    const prioritized = this.prioritizeDecisionMakers(contacts);
    return prioritized.find((c) => c.is_decision_maker) || prioritized[0];
  }

  /**
   * Sorts and identifies the best decision makers from a list of contacts.
   * Prioritizes confirmed owners, founders, CEOs, and C-suite executives over non-decision-makers.
   */
  public prioritizeDecisionMakers(contacts: Contact[], priorityRoles?: string[]): Contact[] {
    const priorityList = (priorityRoles || []).map((r) => r.toLowerCase().trim());

    const scored = contacts.map((c) => {
      this.evaluateAndEnrich(c);
      const evalResult = this.evaluateRole(c.role, c.role_tier);

      let score = evalResult.decisionRank;
      // Bonus for matching custom user priority roles
      if (priorityList.length > 0 && c.role) {
        const lowerRole = c.role.toLowerCase();
        if (priorityList.some((pr) => lowerRole.includes(pr))) {
          score += 25;
        }
      }
      // Bonus for professional personal email attached to decision maker
      if (c.email_type === 'Professional Personal Email' || c.email_type === 'Personal') {
        score += 15;
      }
      // Bonus for LinkedIn profile
      if (c.linkedin_url) {
        score += 5;
      }
      return { contact: c, score, evalResult };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.contact);
  }
}

export const globalDecisionMakerFinder = new DecisionMakerFinder();
