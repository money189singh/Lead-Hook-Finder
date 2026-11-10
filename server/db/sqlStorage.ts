import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'leadhook.sqlite');
const DATASETS_BACKUP_DIR = path.join(DATA_DIR, 'datasets');

// Cloud storage capacity defaults: 500 MB quota (like cloud tier allocation)
const TOTAL_CLOUD_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB

export interface StoredDataset {
  id: string;
  tool: string;
  search_name: string;
  created_at: string;
  updated_at: string;
  record_count: number;
  file_size: number;
  ai_organized: boolean;
  ai_summary?: {
    summary: string;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
    decision_makers_percent: number;
    verified_emails_percent: number;
    top_industries: string[];
    recommended_outreach: string;
  };
  tags: string[];
  cloud_synced: boolean;
  raw_data?: any[];
}

export interface StorageCategoryInfo {
  category: 'maps' | 'discovery' | 'scraper' | 'signals' | 'ai_organized';
  label: string;
  bytes: number;
  record_count: number;
  color: string;
  accent_class: string;
}

export interface CloudStorageInfo {
  total_quota_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_percent: number;
  categories: {
    maps: StorageCategoryInfo;
    discovery: StorageCategoryInfo;
    scraper: StorageCategoryInfo;
    signals: StorageCategoryInfo;
    ai_organized: StorageCategoryInfo;
  };
  total_datasets: number;
  total_leads: number;
  last_sync: string;
  engine: string;
}

export class SqlStorageEngine {
  private db: Database | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.ensureDirs();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(DATASETS_BACKUP_DIR)) {
        fs.mkdirSync(DATASETS_BACKUP_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('[SqlStorage] Directory creation notice:', err);
    }
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const SQL = await initSqlJs();
        let buffer: Buffer | null = null;

        if (fs.existsSync(DB_FILE)) {
          try {
            buffer = fs.readFileSync(DB_FILE);
            this.db = new SQL.Database(buffer);
          } catch (e) {
            console.warn('[SqlStorage] Corrupt DB file, initializing fresh:', e);
            this.db = new SQL.Database();
          }
        } else {
          this.db = new SQL.Database();
        }

        this.bootstrapSchema();
        this.isInitialized = true;
        this.saveToDisk();

        // Auto-migrate past jobs from disk if needed
        setTimeout(() => {
          this.autoMigratePastJobs().catch((e) =>
            console.warn('[SqlStorage] Background migration notice:', e.message)
          );
        }, 100);
      } catch (err: any) {
        console.error('[SqlStorage] Fatal initialization error:', err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  private bootstrapSchema() {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        search_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        record_count INTEGER NOT NULL DEFAULT 0,
        file_size INTEGER NOT NULL DEFAULT 0,
        ai_organized INTEGER NOT NULL DEFAULT 0,
        ai_summary TEXT,
        tags TEXT,
        cloud_synced INTEGER NOT NULL DEFAULT 1,
        raw_data_json TEXT
      );

      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        company_name TEXT,
        website TEXT,
        phone TEXT,
        email TEXT,
        contact_name TEXT,
        contact_role TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        industry TEXT,
        fit_score INTEGER,
        verification_status TEXT,
        ai_tier TEXT,
        ai_tags TEXT,
        data_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_datasets_created ON datasets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_dataset ON leads(dataset_id);
    `);
  }

  public saveToDisk() {
    if (!this.db) return;
    try {
      this.ensureDirs();
      const binaryArray = this.db.export();
      const buffer = Buffer.from(binaryArray);
      fs.writeFileSync(DB_FILE, buffer);
    } catch (err) {
      console.warn('[SqlStorage] Could not write database to disk:', err);
    }
  }

  /**
   * Automatically ingests past runs from disk (maps_jobs, discovery_jobs, jobs) into SQLite
   */
  public async autoMigratePastJobs() {
    await this.init();
    if (!this.db) return;

    // Check how many datasets exist
    const res = this.db.exec('SELECT COUNT(*) FROM datasets');
    const existingCount = res[0]?.values[0]?.[0] as number || 0;

    // 1. Check maps_jobs directory
    const mapsJobsDir = path.join(DATA_DIR, 'maps_jobs');
    if (fs.existsSync(mapsJobsDir)) {
      const files = fs.readdirSync(mapsJobsDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(mapsJobsDir, file), 'utf-8');
          const job = JSON.parse(raw);
          if (job && job.id && (job.leads?.length > 0 || job.total_found > 0)) {
            const datasetId = `file_maps_${job.id}`;
            const exists = this.getDataset(datasetId);
            if (!exists) {
              const leads = job.leads || [];
              this.storeDataset({
                id: datasetId,
                tool: 'Google Maps Scraper',
                search_name: job.command || 'Local Business Search',
                created_at: job.created_at || new Date().toISOString(),
                records: leads,
                tags: ['Google Maps', 'Local Leads', leads.some((l: any) => l.website) ? 'Websites Found' : 'Places'],
              });
            }
          }
        } catch {}
      }
    }

    // 2. Check discovery_jobs directory
    const discJobsDir = path.join(DATA_DIR, 'discovery_jobs');
    if (fs.existsSync(discJobsDir)) {
      const files = fs.readdirSync(discJobsDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(discJobsDir, file), 'utf-8');
          const job = JSON.parse(raw);
          if (job && job.id && job.prospects?.length > 0) {
            const datasetId = `file_disc_${job.id}`;
            const exists = this.getDataset(datasetId);
            if (!exists) {
              const prospects = job.prospects || [];
              this.storeDataset({
                id: datasetId,
                tool: 'AI Prospect Discovery',
                search_name: job.searchQuery || job.criteria?.naturalLanguagePrompt || 'B2B Prospect Discovery',
                created_at: job.created_at || job.createdAt || new Date().toISOString(),
                records: prospects.map((p: any) => ({
                  name: p.companyName,
                  company: p.companyName,
                  website: p.website,
                  domain: p.domain,
                  description: p.description,
                  industry: p.industry,
                  location: p.location,
                  city: p.city,
                  state: p.state,
                  country: p.country,
                  employeeCount: p.employeeCount,
                  jobTitle: p.jobTitle,
                  email: p.decisionMakerEmail || p.email,
                  contactName: p.personName || p.contactName,
                  verificationStatus: p.verificationStatus,
                  confidence: p.confidence,
                  fitScore: p.fitScore,
                  buyingSignals: p.buyingSignals,
                })),
                tags: ['AI Prospecting', 'B2B Companies', 'Decision Makers'],
              });
            }
          }
        } catch {}
      }
    }

    // 3. Check jobs directory (Website Crawler)
    const jobsDir = path.join(DATA_DIR, 'jobs');
    if (fs.existsSync(jobsDir)) {
      const files = fs.readdirSync(jobsDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(jobsDir, file), 'utf-8');
          const job = JSON.parse(raw);
          if (job && job.id && (job.contacts?.length > 0 || job.results?.length > 0)) {
            const datasetId = `file_crawl_${job.id}`;
            const exists = this.getDataset(datasetId);
            if (!exists) {
              const contacts = job.contacts || [];
              this.storeDataset({
                id: datasetId,
                tool: 'Website Scraper',
                search_name: job.urls?.[0] ? `${job.urls[0]} (+${(job.urls.length - 1)} sites)` : 'Website Contact Crawl',
                created_at: job.created_at || new Date().toISOString(),
                records: contacts,
                tags: ['Website Scraper', 'Direct Contacts', 'Emails'],
              });
            }
          }
        } catch {}
      }
    }

    // 4. Check signals directory (Buying Signals Radar)
    const signalsFile = path.join(DATA_DIR, 'signals', 'buying_signals.json');
    if (fs.existsSync(signalsFile)) {
      try {
        const raw = fs.readFileSync(signalsFile, 'utf-8');
        const signals = JSON.parse(raw);
        if (Array.isArray(signals) && signals.length > 0) {
          const datasetId = 'file_signals_history';
          const exists = this.getDataset(datasetId);
          if (!exists) {
            this.storeDataset({
              id: datasetId,
              tool: 'Signals Scanner',
              search_name: 'Buying Signals Radar Scans',
              created_at: signals[0]?.detectedAt || new Date().toISOString(),
              records: signals.map((s: any) => ({
                id: s.id,
                name: s.companyName,
                company: s.companyName,
                website: s.website || (s.domain ? `https://${s.domain}` : ''),
                domain: s.domain,
                headline: s.headline,
                description: s.description,
                signalType: s.signalType,
                buyingIntentScore: s.buyingIntentScore,
                fitScore: s.buyingIntentScore || 85,
                confidence: s.confidence,
                verificationStatus: 'Trigger Active',
                ai_tier: s.buyingIntentScore && s.buyingIntentScore >= 85 ? 'Tier 1' : 'Tier 2',
                ai_tags: [s.signalType, 'Commercial Signal'],
              })),
              tags: ['Signals Radar', 'Commercial Triggers', `${signals.length} Signals`],
            });
          }
        }
      } catch {}
    }
  }

  /**
   * Stores a dataset and all its records in SQLite with full indexing and file persistence
   */
  public storeDataset(params: {
    id?: string;
    tool: string;
    search_name: string;
    created_at?: string;
    records: any[];
    tags?: string[];
    ai_summary?: any;
    ai_organized?: boolean;
  }): StoredDataset {
    if (!this.db) throw new Error('Database not initialized');

    const id = params.id || `ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = params.created_at || new Date().toISOString();
    const records = params.records || [];
    const tags = params.tags || [params.tool];
    const tagsStr = JSON.stringify(tags);
    const rawDataJson = JSON.stringify(records);
    const fileSize = Buffer.byteLength(rawDataJson, 'utf-8');
    const aiOrganized = params.ai_organized ? 1 : 0;
    const aiSummaryStr = params.ai_summary ? JSON.stringify(params.ai_summary) : null;

    // Insert or Replace into datasets table
    this.db.run(
      `INSERT OR REPLACE INTO datasets (
        id, tool, search_name, created_at, updated_at, record_count, file_size, ai_organized, ai_summary, tags, cloud_synced, raw_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.tool,
        params.search_name,
        now,
        new Date().toISOString(),
        records.length,
        fileSize,
        aiOrganized,
        aiSummaryStr,
        tagsStr,
        1,
        rawDataJson,
      ]
    );

    // Delete any old lead rows for this dataset
    this.db.run(`DELETE FROM leads WHERE dataset_id = ?`, [id]);

    // Insert individual lead rows for fast relational filtering
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const leadId = `lead_${id}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      const companyName = r.name || r.company || r.companyName || r.company_name || '';
      const website = r.website || r.url || r.officialWebsite || '';
      const phone = r.phone || r.phone_number || '';
      const email = r.email || (Array.isArray(r.extracted_emails) ? r.extracted_emails[0]?.email : '') || '';
      const contactName = r.contactName || r.personName || r.fullName || r.first_name || '';
      const contactRole = r.jobTitle || r.role || r.category || '';
      const address = r.address || '';
      const city = r.city || '';
      const state = r.state || '';
      const country = r.country || '';
      const industry = r.industry || r.category || '';
      const fitScore = typeof r.fitScore === 'number' ? r.fitScore : (r.buyingIntentScore || 70);
      const verificationStatus = r.verificationStatus || (r.status || 'Verified');
      const aiTier = r.ai_tier || (fitScore >= 80 ? 'Tier 1' : fitScore >= 60 ? 'Tier 2' : 'Tier 3');
      const aiTags = Array.isArray(r.ai_tags) ? JSON.stringify(r.ai_tags) : '';

      this.db.run(
        `INSERT INTO leads (
          id, dataset_id, company_name, website, phone, email, contact_name, contact_role, address, city, state, country, industry, fit_score, verification_status, ai_tier, ai_tags, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leadId,
          id,
          companyName,
          website,
          phone,
          email,
          contactName,
          contactRole,
          address,
          city,
          state,
          country,
          industry,
          fitScore,
          verificationStatus,
          aiTier,
          aiTags,
          JSON.stringify(r),
        ]
      );
    }

    this.saveToDisk();

    // Also persist individual dataset JSON in datasets backup directory for direct file safety
    try {
      const backupPath = path.join(DATASETS_BACKUP_DIR, `${id}.json`);
      fs.writeFileSync(
        backupPath,
        JSON.stringify(
          {
            id,
            tool: params.tool,
            search_name: params.search_name,
            created_at: now,
            records,
            tags,
            ai_summary: params.ai_summary,
            ai_organized: params.ai_organized,
          },
          null,
          2
        )
      );
    } catch {}

    return {
      id,
      tool: params.tool,
      search_name: params.search_name,
      created_at: now,
      updated_at: new Date().toISOString(),
      record_count: records.length,
      file_size: fileSize,
      ai_organized: Boolean(params.ai_organized),
      ai_summary: params.ai_summary,
      tags,
      cloud_synced: true,
      raw_data: records,
    };
  }

  public getAllDatasets(): StoredDataset[] {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      `SELECT id, tool, search_name, created_at, updated_at, record_count, file_size, ai_organized, ai_summary, tags, cloud_synced FROM datasets ORDER BY created_at DESC`
    );

    const list: StoredDataset[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      let tags: string[] = [];
      let aiSummary: any = undefined;
      try {
        if (row.tags) tags = JSON.parse(row.tags);
      } catch {}
      try {
        if (row.ai_summary) aiSummary = JSON.parse(row.ai_summary);
      } catch {}

      list.push({
        id: row.id,
        tool: row.tool,
        search_name: row.search_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        record_count: Number(row.record_count) || 0,
        file_size: Number(row.file_size) || 0,
        ai_organized: Boolean(row.ai_organized),
        ai_summary: aiSummary,
        tags,
        cloud_synced: Boolean(row.cloud_synced),
      });
    }
    stmt.free();
    return list;
  }

  public getDataset(id: string): StoredDataset | null {
    if (!this.db) return null;

    const stmt = this.db.prepare(`SELECT * FROM datasets WHERE id = ?`);
    stmt.bind([id]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      let tags: string[] = [];
      let aiSummary: any = undefined;
      let rawData: any[] = [];
      try {
        if (row.tags) tags = JSON.parse(row.tags);
      } catch {}
      try {
        if (row.ai_summary) aiSummary = JSON.parse(row.ai_summary);
      } catch {}
      try {
        if (row.raw_data_json) rawData = JSON.parse(row.raw_data_json);
      } catch {}

      stmt.free();
      return {
        id: row.id,
        tool: row.tool,
        search_name: row.search_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        record_count: Number(row.record_count) || 0,
        file_size: Number(row.file_size) || 0,
        ai_organized: Boolean(row.ai_organized),
        ai_summary: aiSummary,
        tags,
        cloud_synced: Boolean(row.cloud_synced),
        raw_data: rawData,
      };
    }

    stmt.free();
    return null;
  }

  public deleteDataset(id: string): boolean {
    if (!this.db) return false;

    this.db.run(`DELETE FROM datasets WHERE id = ?`, [id]);
    this.db.run(`DELETE FROM leads WHERE dataset_id = ?`, [id]);
    this.saveToDisk();

    try {
      const backupPath = path.join(DATASETS_BACKUP_DIR, `${id}.json`);
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    } catch {}

    return true;
  }

  /**
   * Generates exact Apple macOS / iPhone style storage stats
   */
  public getCloudStorageInfo(): CloudStorageInfo {
    const datasets = this.getAllDatasets();

    let mapsBytes = 0;
    let mapsCount = 0;
    let discBytes = 0;
    let discCount = 0;
    let crawlBytes = 0;
    let crawlCount = 0;
    let signalsBytes = 0;
    let signalsCount = 0;
    let aiOrgBytes = 0;
    let aiOrgCount = 0;

    for (const d of datasets) {
      const size = d.file_size || Math.max(1024, d.record_count * 1800);
      if (d.ai_organized) {
        aiOrgBytes += Math.round(size * 0.4);
      }

      if (d.tool.includes('Maps')) {
        mapsBytes += size;
        mapsCount += d.record_count;
      } else if (d.tool.includes('Discovery') || d.tool.includes('Algo')) {
        discBytes += size;
        discCount += d.record_count;
      } else if (d.tool.includes('Signals') || d.tool.includes('Radar')) {
        signalsBytes += size;
        signalsCount += d.record_count;
      } else {
        crawlBytes += size;
        crawlCount += d.record_count;
      }
    }

    // Baseline minimum allocation for cloud metadata and SQLite index
    const baseSqliteBytes = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 128 * 1024;
    const totalUsedBytes = mapsBytes + discBytes + crawlBytes + signalsBytes + baseSqliteBytes;
    const freeBytes = Math.max(0, TOTAL_CLOUD_QUOTA_BYTES - totalUsedBytes);
    const usedPercent = Math.min(100, (totalUsedBytes / TOTAL_CLOUD_QUOTA_BYTES) * 100);

    return {
      total_quota_bytes: TOTAL_CLOUD_QUOTA_BYTES,
      used_bytes: totalUsedBytes,
      free_bytes: freeBytes,
      used_percent: Number(usedPercent.toFixed(1)),
      categories: {
        maps: {
          category: 'maps',
          label: 'Google Maps Leads',
          bytes: mapsBytes,
          record_count: mapsCount,
          color: '#3B82F6', // iOS / Mac Blue
          accent_class: 'bg-blue-500',
        },
        discovery: {
          category: 'discovery',
          label: 'AI Prospect Discoveries',
          bytes: discBytes,
          record_count: discCount,
          color: '#10B981', // iOS / Mac Green
          accent_class: 'bg-emerald-500',
        },
        scraper: {
          category: 'scraper',
          label: 'Website Crawls & Contacts',
          bytes: crawlBytes,
          record_count: crawlCount,
          color: '#F59E0B', // iOS / Mac Yellow/Amber
          accent_class: 'bg-amber-500',
        },
        signals: {
          category: 'signals',
          label: 'Buying Signals Radar',
          bytes: signalsBytes,
          record_count: signalsCount,
          color: '#8B5CF6', // iOS / Mac Purple
          accent_class: 'bg-purple-500',
        },
        ai_organized: {
          category: 'ai_organized',
          label: 'AI Organized & Enriched',
          bytes: aiOrgBytes,
          record_count: aiOrgCount,
          color: '#EC4899', // iOS / Mac Pink/Rose
          accent_class: 'bg-pink-500',
        },
      },
      total_datasets: datasets.length,
      total_leads: mapsCount + discCount + crawlCount + signalsCount,
      last_sync: new Date().toISOString(),
      engine: 'SQLite 3 Wasm + Cloud File Storage',
    };
  }
}

export const globalSqlStorage = new SqlStorageEngine();
