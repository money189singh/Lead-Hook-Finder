import fs from 'fs';
import path from 'path';
import { ResearchedCompanyProfile, ResearchSourceItem } from './types';
import { extractCleanDomain } from '../discovery/domainDetector';
import appletConfig from '../../firebase-applet-config.json';

const DATA_DIR = path.join(process.cwd(), 'data');
const COMPANIES_DIR = path.join(DATA_DIR, 'companies');

export class FirebaseCompanyMerger {
  private firestoreAvailable = true;

  constructor() {
    this.ensureDirs();
  }

  private ensureDirs(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(COMPANIES_DIR)) {
        fs.mkdirSync(COMPANIES_DIR, { recursive: true });
      }
    } catch {}
  }

  public getCompanyId(domainOrName: string): string {
    const cleanDomain = extractCleanDomain(domainOrName) || domainOrName.toLowerCase().trim();
    return cleanDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Get existing local server company record if present
   */
  public getLocalCompany(companyId: string): Record<string, any> | null {
    this.ensureDirs();
    try {
      const file = path.join(COMPANIES_DIR, `${companyId}.json`);
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
      }
    } catch (err: any) {
      console.warn(`[FirebaseMerger] Error reading local company ${companyId}:`, err.message);
    }
    return null;
  }

  /**
   * Save local server company record
   */
  public saveLocalCompany(companyId: string, data: Record<string, any>): void {
    this.ensureDirs();
    try {
      const file = path.join(COMPANIES_DIR, `${companyId}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn(`[FirebaseMerger] Error saving local company ${companyId}:`, err.message);
    }
  }

  /**
   * Compare evidence strength:
   * 'Official source' > 'Credible secondary source' > 'Search lead — needs verification' > 'Unknown'
   */
  private getConfidenceRank(confidence?: string): number {
    switch (confidence) {
      case 'Official source':
      case 'verified':
      case 'official':
        return 4;
      case 'Credible secondary source':
      case 'credible':
        return 3;
      case 'Search lead — needs verification':
      case 'search_lead':
      case 'range':
        return 2;
      default:
        return 1;
    }
  }

  /**
   * Non-destructive merge of research data into company record
   */
  public mergeResearchData(
    existing: Record<string, any> | null,
    researched: ResearchedCompanyProfile,
    options: {
      companyName: string;
      domain?: string;
      website?: string;
      userId?: string;
      sources?: ResearchSourceItem[];
    }
  ): Record<string, any> {
    const cleanDomain = options.domain ? extractCleanDomain(options.domain) : (existing?.domain || '');
    const companyId = this.getCompanyId(cleanDomain || options.companyName);
    const now = new Date().toISOString();

    const merged: Record<string, any> = {
      ...(existing || {}),
      id: companyId,
      domain: cleanDomain || existing?.domain,
      company_name: existing?.company_name || researched.official_company_name?.value || options.companyName,
      url: existing?.url || researched.official_website?.value || (cleanDomain ? `https://${cleanDomain}` : ''),
      updatedAt: now,
      research_last_run: now,
    };

    if (options.userId) {
      merged.userId = options.userId;
    }

    // 1. Company Identity & Profile Fields
    if (researched.industry?.value && !existing?.industry) {
      merged.industry = researched.industry.value;
    }
    if (researched.location?.value && !existing?.location) {
      merged.location = researched.location.value;
    }
    if (researched.company_description?.value) {
      merged.company_description = researched.company_description.value;
    }
    if (researched.what_company_does?.value && !merged.company_description) {
      merged.company_description = researched.what_company_does.value;
    }
    if (researched.main_products_or_services?.value) {
      merged.products_services = researched.main_products_or_services.value;
    }
    if (researched.business_category?.value) {
      merged.business_category = researched.business_category.value;
    }
    if (researched.linkedin_page?.value && !existing?.linkedin_url) {
      merged.linkedin_url = researched.linkedin_page.value;
    }

    // 2. Employee Count & Range (Preserve stronger evidence)
    const existingEmpConfidence = existing?.confidence || (existing?.employee_count ? 'verified' : 'Unknown');
    const researchedEmpConfidence = researched.employee_count?.confidence || researched.employee_range?.confidence || 'Unknown';

    const existingEmpRank = this.getConfidenceRank(existingEmpConfidence);
    const researchedEmpRank = this.getConfidenceRank(researchedEmpConfidence);

    if (researched.employee_count?.value) {
      // Overwrite only if existing has no count OR researched has equal/stronger confidence
      if (!existing?.employee_count || researchedEmpRank >= existingEmpRank) {
        merged.employee_count = researched.employee_count.value;
        merged.employee_count_source_url = researched.employee_count.source_url || merged.employee_count_source_url;
        merged.employee_count_confidence = researched.employee_count.confidence;
      }
    }

    if (researched.employee_range?.value && !merged.employee_range) {
      merged.employee_range = researched.employee_range.value;
    }

    // 3. Founded Year vs Incorporation Year
    const existingFoundedConfidence = existing?.founded_year_confidence || (existing?.founded_year ? 'verified' : 'Unknown');
    const researchedFoundedConfidence = researched.founded_year?.confidence || 'Unknown';

    if (researched.founded_year?.value) {
      if (!existing?.founded_year || this.getConfidenceRank(researchedFoundedConfidence) >= this.getConfidenceRank(existingFoundedConfidence)) {
        merged.founded_year = researched.founded_year.value;
        merged.founded_year_source_url = researched.founded_year.source_url || merged.founded_year_source_url;
        merged.founded_year_confidence = researched.founded_year.confidence;
      }
    }

    if (researched.incorporation_year?.value) {
      merged.incorporation_year = researched.incorporation_year.value;
    }

    // 4. Decision Makers & Sources
    if (researched.decision_makers && researched.decision_makers.length > 0) {
      // Merge with existing decision makers if any, avoiding duplicate names
      let existingDMs: any[] = [];
      if (existing?.decision_makers_json) {
        try {
          existingDMs = JSON.parse(existing.decision_makers_json);
        } catch {}
      }

      const mergedDMs = [...existingDMs];
      for (const dm of researched.decision_makers) {
        const lowerName = dm.full_name.toLowerCase().trim();
        const existingIdx = mergedDMs.findIndex((d) => d.full_name?.toLowerCase().trim() === lowerName);
        if (existingIdx === -1) {
          mergedDMs.push(dm);
        } else {
          // Update profile URL or snippet if missing
          mergedDMs[existingIdx] = {
            ...mergedDMs[existingIdx],
            profile_url: mergedDMs[existingIdx].profile_url || dm.profile_url,
            department: mergedDMs[existingIdx].department || dm.department,
            source_url: mergedDMs[existingIdx].source_url || dm.source_url,
            evidence_snippet: mergedDMs[existingIdx].evidence_snippet || dm.evidence_snippet,
          };
        }
      }
      merged.decision_makers_json = JSON.stringify(mergedDMs);
    }

    if (options.sources && options.sources.length > 0) {
      merged.research_sources_json = JSON.stringify(options.sources.slice(0, 20));
    }

    merged.research_status = 'completed';

    return merged;
  }

  /**
   * Save merged record to local disk and to Firestore (via REST if credentials exist)
   */
  public async persistMergedCompany(
    companyRecord: Record<string, any>,
    userId?: string
  ): Promise<{ savedLocal: boolean; savedFirestore: boolean }> {
    const companyId = companyRecord.id;
    let savedLocal = false;
    let savedFirestore = false;

    // 1. Always save local server record
    try {
      this.saveLocalCompany(companyId, companyRecord);
      savedLocal = true;
    } catch (e: any) {
      console.warn('[FirebaseMerger] Local save error:', e.message);
    }

    // 2. If userId, appletConfig exist, and firestore is available, attempt Firestore REST update
    if (this.firestoreAvailable && userId && appletConfig?.projectId && appletConfig?.apiKey) {
      try {
        const projectId = appletConfig.projectId;
        const apiKey = appletConfig.apiKey;
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/companies/${companyId}?key=${apiKey}`;

        // Convert flat record to Firestore fields format
        const fields: Record<string, any> = {};
        for (const [key, val] of Object.entries(companyRecord)) {
          if (val === undefined || val === null) continue;
          if (typeof val === 'string') {
            fields[key] = { stringValue: val };
          } else if (typeof val === 'number') {
            fields[key] = { integerValue: String(val) };
          } else if (typeof val === 'boolean') {
            fields[key] = { booleanValue: val };
          } else if (Array.isArray(val)) {
            fields[key] = {
              arrayValue: {
                values: val.map((v) => ({ stringValue: String(v) })),
              },
            };
          }
        }

        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });

        if (res.ok) {
          savedFirestore = true;
        } else {
          // If firestore database is not configured/provisioned, disable silently without dumping raw error json
          if (res.status === 404 || res.status === 403) {
            this.firestoreAvailable = false;
          }
        }
      } catch {
        this.firestoreAvailable = false;
      }
    }

    return { savedLocal, savedFirestore };
  }
}

export const globalFirebaseCompanyMerger = new FirebaseCompanyMerger();
