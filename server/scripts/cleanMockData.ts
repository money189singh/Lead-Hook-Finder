import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DISCOVERY_CACHE = path.join(DATA_DIR, 'discovery_cache.json');
const JOBS_DIR = path.join(DATA_DIR, 'discovery_jobs');
const COMPANIES_DIR = path.join(DATA_DIR, 'companies');
const ROW_MAPPINGS = path.join(DATA_DIR, 'sheets', 'row_mappings.json');
const RUNS_FILE = path.join(DATA_DIR, 'recurring_schedules', 'runs.json');

// Fake names produced by LLM hallucinations
const KNOWN_FAKE_NAMES = new Set([
  'syncrostack',
  'fluxify',
  'nexusflow',
  'quantgrid',
  'sentinull',
  'veritas health tech',
  'veritas health',
  'amnion',
  'speake',
  'orbitsales',
  'koda',
  'zenithmarketing',
]);

async function checkLiveDomain(domain: string): Promise<boolean> {
  if (!domain || domain.includes(' ') || !domain.includes('.')) return false;
  if (KNOWN_FAKE_NAMES.has(domain.toLowerCase().split('.')[0])) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://${domain}`, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function cleanData() {
  console.log('[CleanMockData] Starting mock data removal...');

  // 1. Clean Jobs
  if (fs.existsSync(JOBS_DIR)) {
    const jobFiles = fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith('.json'));
    for (const f of jobFiles) {
      const p = path.join(JOBS_DIR, f);
      try {
        const job = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (job.prospects && Array.isArray(job.prospects)) {
          const cleanedProspects = [];
          for (const item of job.prospects) {
            const nameLower = (item.companyName || '').toLowerCase().trim();
            const dom = (item.domain || item.website || '').replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
            if (KNOWN_FAKE_NAMES.has(nameLower) || KNOWN_FAKE_NAMES.has(dom.split('.')[0])) {
              console.log(`[CleanMockData] Removing fake company from job: ${item.companyName}`);
              continue;
            }

            // Remove synthetic fallback text
            if (item.personName && (item.personName.includes('Executive Team') || item.personName === 'Founder / CEO')) {
              item.personName = '';
              item.jobTitle = '';
            }
            if (item.decisionMakerEmail && (item.decisionMakerEmail.startsWith('contact@') || item.decisionMakerEmail.startsWith('executive@'))) {
              item.decisionMakerEmail = '';
            }
            if (item.email && (item.email.startsWith('contact@') || item.email.startsWith('executive@'))) {
              item.email = '';
              item.emailType = undefined;
            }
            if (item.genericEmail && item.genericEmail.startsWith('contact@') && !item.rawContacts?.some((c: any) => c.email === item.genericEmail)) {
              item.genericEmail = '';
            }

            cleanedProspects.push(item);
          }
          job.prospects = cleanedProspects;
          job.uniqueCompanies = cleanedProspects.length;
          job.verifiedCompanies = cleanedProspects.filter((c) => c.verificationStatus === 'Verified company').length;
          fs.writeFileSync(p, JSON.stringify(job, null, 2), 'utf8');
        }
      } catch {}
    }
  }

  // 2. Clean Discovery Cache
  if (fs.existsSync(DISCOVERY_CACHE)) {
    try {
      const cache = JSON.parse(fs.readFileSync(DISCOVERY_CACHE, 'utf8'));
      const newCache: Record<string, any> = {};
      for (const [key, val] of Object.entries<any>(cache)) {
        const nameLower = (val?.companyName || val?.data?.companyName || '').toLowerCase().trim();
        const dom = (key || '').toLowerCase();
        if (KNOWN_FAKE_NAMES.has(nameLower) || KNOWN_FAKE_NAMES.has(dom.split('.')[0])) {
          console.log(`[CleanMockData] Removing fake company from cache: ${val?.companyName || key}`);
          continue;
        }

        if (val?.data) {
          if (val.data.personName && (val.data.personName.includes('Executive Team') || val.data.personName === 'Founder / CEO')) {
            val.data.personName = '';
            val.data.jobTitle = '';
          }
          if (val.data.decisionMakerEmail && (val.data.decisionMakerEmail.startsWith('contact@') || val.data.decisionMakerEmail.startsWith('executive@'))) {
            val.data.decisionMakerEmail = '';
          }
          if (val.data.email && (val.data.email.startsWith('contact@') || val.data.email.startsWith('executive@'))) {
            val.data.email = '';
            val.data.emailType = undefined;
          }
          if (val.data.genericEmail && val.data.genericEmail.startsWith('contact@')) {
            val.data.genericEmail = '';
          }
        }

        newCache[key] = val;
      }
      fs.writeFileSync(DISCOVERY_CACHE, JSON.stringify(newCache, null, 2), 'utf8');
    } catch {}
  }

  // 3. Clean Companies Directory
  if (fs.existsSync(COMPANIES_DIR)) {
    const cFiles = fs.readdirSync(COMPANIES_DIR).filter((f) => f.endsWith('.json'));
    for (const f of cFiles) {
      const p = path.join(COMPANIES_DIR, f);
      try {
        const comp = JSON.parse(fs.readFileSync(p, 'utf8'));
        const nameLower = (comp.company_name || '').toLowerCase().trim();
        const dom = (comp.domain || '').toLowerCase().split('.')[0];
        if (KNOWN_FAKE_NAMES.has(nameLower) || KNOWN_FAKE_NAMES.has(dom)) {
          console.log(`[CleanMockData] Deleting fake company file: ${f}`);
          fs.unlinkSync(p);
        }
      } catch {}
    }
  }

  // 4. Clean Row Mappings
  if (fs.existsSync(ROW_MAPPINGS)) {
    try {
      const list = JSON.parse(fs.readFileSync(ROW_MAPPINGS, 'utf8'));
      const filtered = list.filter((item: any) => {
        const nameLower = (item.record?.companyName || '').toLowerCase().trim();
        const dom = (item.record?.domain || '').toLowerCase().split('.')[0];
        return !KNOWN_FAKE_NAMES.has(nameLower) && !KNOWN_FAKE_NAMES.has(dom);
      });
      fs.writeFileSync(ROW_MAPPINGS, JSON.stringify(filtered, null, 2), 'utf8');
    } catch {}
  }

  console.log('[CleanMockData] Mock data purged successfully.');
}

cleanData();
