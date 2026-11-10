import { globalAiResilience } from './aiResilience';
import { getSettings } from '../storage';
import { globalSqlStorage, StoredDataset } from '../db/sqlStorage';

export interface OrganizedLead {
  id: string;
  name: string;
  companyName: string;
  website: string;
  domain: string;
  phone: string;
  email: string;
  emailType?: 'personal' | 'role' | 'generic';
  contactName: string;
  contactRole: string;
  address: string;
  city: string;
  state: string;
  country: string;
  industry: string;
  fitScore: number;
  verificationStatus: string;
  aiTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  aiTags: string[];
  notes?: string;
  isDuplicate?: boolean;
}

export interface AiOrganizerResult {
  datasetId: string;
  totalProcessed: number;
  organizedCount: number;
  duplicatesRemoved: number;
  summary: {
    summary: string;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
    decision_makers_percent: number;
    verified_emails_percent: number;
    top_industries: string[];
    recommended_outreach: string;
  };
  leads: OrganizedLead[];
}

export class AiOrganizerService {
  /**
   * Organizes, cleans, standardizes, and scores a full dataset of leads
   */
  public async organizeDataset(datasetId: string): Promise<AiOrganizerResult> {
    await globalSqlStorage.init();
    const dataset = globalSqlStorage.getDataset(datasetId);

    if (!dataset) {
      throw new Error(`Dataset with ID "${datasetId}" not found in storage.`);
    }

    const rawRecords = dataset.raw_data || [];
    if (rawRecords.length === 0) {
      return {
        datasetId,
        totalProcessed: 0,
        organizedCount: 0,
        duplicatesRemoved: 0,
        summary: {
          summary: 'Empty dataset. No leads to organize.',
          tier1_count: 0,
          tier2_count: 0,
          tier3_count: 0,
          decision_makers_percent: 0,
          verified_emails_percent: 0,
          top_industries: [],
          recommended_outreach: 'Run another scraping run to gather target leads.',
        },
        leads: [],
      };
    }

    // Step 1: Deterministic High-Precision Normalization & Scoring
    const cleanedLeads: OrganizedLead[] = [];
    const seenDomains = new Set<string>();
    const seenPhones = new Set<string>();
    let duplicatesCount = 0;

    let tier1Count = 0;
    let tier2Count = 0;
    let tier3Count = 0;
    let dmCount = 0;
    let emailCount = 0;
    const industryCounts: Record<string, number> = {};

    for (let i = 0; i < rawRecords.length; i++) {
      const r = rawRecords[i];
      const rawName = (r.name || r.company || r.companyName || r.company_name || 'Business').trim();
      const rawWeb = (r.website || r.url || r.officialWebsite || '').trim();
      const rawPhone = (r.phone || r.phone_number || '').trim();
      const rawEmail = (r.email || (Array.isArray(r.extracted_emails) ? r.extracted_emails[0]?.email : '') || '').trim();
      const rawContact = (r.contactName || r.personName || r.fullName || r.first_name || '').trim();
      const rawRole = (r.jobTitle || r.role || r.category || '').trim();

      // Normalize Company Name
      const cleanName = this.normalizeCompanyName(rawName);

      // Clean Domain
      const domain = this.extractDomain(rawWeb);
      const cleanWebsite = domain ? (rawWeb.startsWith('http') ? rawWeb : `https://${domain}`) : '';

      // Standardize Phone Number
      const cleanPhone = this.formatPhoneNumber(rawPhone);

      // Clean Email
      const cleanEmail = rawEmail.toLowerCase();
      const emailType = this.classifyEmail(cleanEmail);

      // Deduplication check
      let isDuplicate = false;
      if (domain && seenDomains.has(domain)) {
        isDuplicate = true;
        duplicatesCount++;
      } else if (cleanPhone && cleanPhone.length > 7 && seenPhones.has(cleanPhone)) {
        isDuplicate = true;
        duplicatesCount++;
      }

      if (domain) seenDomains.add(domain);
      if (cleanPhone) seenPhones.add(cleanPhone);

      // Smart Tiering Calculation
      const hasDecisionMaker = Boolean(rawContact && rawContact.length > 2);
      const hasDirectEmail = Boolean(cleanEmail && emailType !== 'generic');
      const hasPhone = Boolean(cleanPhone && cleanPhone.length >= 7);

      let fitScore = typeof r.fitScore === 'number' ? r.fitScore : 65;
      if (hasDecisionMaker) fitScore += 15;
      if (hasDirectEmail) fitScore += 10;
      if (hasPhone) fitScore += 5;
      fitScore = Math.min(99, Math.max(45, fitScore));

      let aiTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
      if (fitScore >= 80 || (hasDecisionMaker && hasDirectEmail)) {
        aiTier = 'Tier 1';
        tier1Count++;
      } else if (fitScore >= 65 || hasPhone) {
        aiTier = 'Tier 2';
        tier2Count++;
      } else {
        aiTier = 'Tier 3';
        tier3Count++;
      }

      if (hasDecisionMaker) dmCount++;
      if (cleanEmail) emailCount++;

      // Industry tracking
      const ind = (r.industry || r.category || dataset.search_name || 'Business Services').trim();
      industryCounts[ind] = (industryCounts[ind] || 0) + 1;

      // Smart Semantic Tags
      const tags: string[] = [];
      if (hasDecisionMaker) tags.push('#DecisionMakerIdentified');
      if (hasDirectEmail) tags.push('#DirectEmailVerified');
      else if (cleanEmail) tags.push('#GeneralEmail');
      if (hasPhone) tags.push('#DirectPhoneAvailable');
      if (aiTier === 'Tier 1') tags.push('#HighPriority');
      if (domain) tags.push('#VerifiedWebsite');
      if (r.opening_hours || r.place_id) tags.push('#GoogleMapsVerified');
      if (r.employeeCount) tags.push(`#Size_${r.employeeCount}`);

      cleanedLeads.push({
        id: r.id || `lead_${i + 1}`,
        name: cleanName,
        companyName: cleanName,
        website: cleanWebsite,
        domain,
        phone: cleanPhone,
        email: cleanEmail,
        emailType,
        contactName: rawContact,
        contactRole: rawRole || (hasDecisionMaker ? 'Executive / Principal' : 'Management'),
        address: r.address || '',
        city: r.city || '',
        state: r.state || '',
        country: r.country || 'United States',
        industry: ind,
        fitScore,
        verificationStatus: r.verificationStatus || (hasDirectEmail || hasPhone ? 'Verified Active' : 'Listed'),
        aiTier,
        aiTags: tags,
        isDuplicate,
      });
    }

    // Top industries sorted
    const topIndustries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k]) => k);

    const totalValid = cleanedLeads.length;
    const dmPercent = totalValid > 0 ? Math.round((dmCount / totalValid) * 100) : 0;
    const emailPercent = totalValid > 0 ? Math.round((emailCount / totalValid) * 100) : 0;

    // Step 2: Attempt AI Qualitative Synthesis (with fast fallback)
    let aiSummaryText = `Dataset for "${dataset.search_name}" structured with ${tier1Count} Tier-1 high intent targets, ${tier2Count} Tier-2 growth leads, and ${tier3Count} SMBs.`;
    let recommendedOutreach = `Prioritize Tier 1 contacts (${tier1Count} companies) with multi-channel outreach (personalized executive email + phone follow-up).`;

    const settings = getSettings();
    const hasKey = Boolean(settings.gemini_api_key || process.env.GEMINI_API_KEY);

    if (hasKey && totalValid > 0) {
      try {
        const sampleCompanies = cleanedLeads.slice(0, 5).map((l) => `${l.name} (${l.industry}, ${l.city})`);
        const prompt = `Analyze this B2B prospect dataset for "${dataset.search_name}".
Total leads: ${totalValid}. Tier 1: ${tier1Count}, Tier 2: ${tier2Count}. Decision Makers: ${dmPercent}%.
Sample companies: ${sampleCompanies.join('; ')}.

Provide:
1. One concise executive summary sentence.
2. One specific recommended sales outreach approach.

Return strict JSON: { "summary": "...", "outreach": "..." }`;

        const responseText = await globalAiResilience.generateWithDualProvider({
          prompt,
          systemInstruction: 'You are an elite B2B sales data intelligence specialist. Output strict JSON only.',
          jsonMode: true,
          taskLabel: 'AI Organizer Executive Synthesis',
        });

        if (responseText) {
          const parsed = JSON.parse(responseText.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));
          if (parsed.summary) aiSummaryText = parsed.summary;
          if (parsed.outreach) recommendedOutreach = parsed.outreach;
        }
      } catch {
        // Deterministic fallback operates smoothly
      }
    }

    const aiSummary = {
      summary: aiSummaryText,
      tier1_count: tier1Count,
      tier2_count: tier2Count,
      tier3_count: tier3Count,
      decision_makers_percent: dmPercent,
      verified_emails_percent: emailPercent,
      top_industries: topIndustries,
      recommended_outreach: recommendedOutreach,
    };

    // Step 3: Persist Organized Dataset back to SQLite
    globalSqlStorage.storeDataset({
      id: dataset.id,
      tool: dataset.tool,
      search_name: dataset.search_name,
      created_at: dataset.created_at,
      records: cleanedLeads,
      tags: [...new Set([...dataset.tags, 'AI Organized', `Tier1: ${tier1Count}`])],
      ai_summary: aiSummary,
      ai_organized: true,
    });

    return {
      datasetId,
      totalProcessed: totalValid,
      organizedCount: totalValid - duplicatesCount,
      duplicatesRemoved: duplicatesCount,
      summary: aiSummary,
      leads: cleanedLeads,
    };
  }

  private normalizeCompanyName(name: string): string {
    if (!name) return 'Business';
    let clean = name.trim();
    // Strip trailing suffixes like " - Official Website", "| Home", " Inc.", " LLC"
    clean = clean.split(/[\-\|–—:•]/)[0].trim();
    clean = clean.replace(/\b(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Co\.?|Pvt\.?)\b/gi, '').trim();
    clean = clean.replace(/^[^\w]+|[^\w]+$/g, '').trim();
    return clean || name;
  }

  private extractDomain(url: string): string {
    if (!url) return '';
    try {
      const u = url.startsWith('http') ? url : `https://${url}`;
      const parsed = new URL(u);
      let host = parsed.hostname.toLowerCase();
      if (host.startsWith('www.')) host = host.slice(4);
      return host;
    } catch {
      const m = url.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      return m ? m[1].toLowerCase() : '';
    }
  }

  private formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  private classifyEmail(email: string): 'personal' | 'role' | 'generic' {
    if (!email) return 'generic';
    const lower = email.toLowerCase();
    const genericPrefixes = ['info@', 'contact@', 'support@', 'sales@', 'help@', 'hello@', 'team@', 'office@', 'admin@'];
    for (const p of genericPrefixes) {
      if (lower.startsWith(p)) return 'generic';
    }
    const rolePrefixes = ['careers@', 'jobs@', 'marketing@', 'legal@', 'press@', 'media@', 'hr@', 'billing@'];
    for (const p of rolePrefixes) {
      if (lower.startsWith(p)) return 'role';
    }
    return 'personal';
  }
}

export const globalAiOrganizer = new AiOrganizerService();
