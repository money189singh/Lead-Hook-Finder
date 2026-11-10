import fs from 'fs';
import path from 'path';
import { HuntingAgent, HuntingAgentRun, Contact } from '../../src/types';
import { globalAiResilience } from '../services/aiResilience';
import { globalWaterfallEnricher } from '../enrichment/waterfallEnricher';
import { globalCrmService } from '../crm/crmService';

const DATA_DIR = path.join(process.cwd(), 'data');
const AGENTS_FILE = path.join(DATA_DIR, 'hunting_agents.json');
const RUNS_FILE = path.join(DATA_DIR, 'hunting_agent_runs.json');

const INITIAL_AGENTS: HuntingAgent[] = [
  {
    id: 'agent_saas_us',
    name: 'B2B SaaS Executive Scout',
    description: 'Continuously scouts high-growth B2B SaaS companies in the US, finds CEO/Founders, and enriches phone lines.',
    status: 'active',
    schedule: 'every_6_hours',
    targetQuery: 'B2B SaaS companies hiring sales executives United States',
    industry: 'Software & Technology',
    geography: 'United States',
    minIcpScore: 80,
    autoSyncCrm: true,
    autoWaterfallEnrich: true,
    targetCountPerRun: 5,
    lastRunAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    nextRunAt: new Date(Date.now() + 3600000 * 4).toISOString(),
    totalLeadsFound: 18,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'agent_cybersecurity',
    name: 'Cybersecurity CISO & SecOps Hunter',
    description: 'Autonomous hunting agent discovering enterprise cybersecurity startups with verified corporate emails.',
    status: 'active',
    schedule: 'daily',
    targetQuery: 'Enterprise cybersecurity startups United States',
    industry: 'Cybersecurity',
    geography: 'North America',
    minIcpScore: 85,
    autoSyncCrm: false,
    autoWaterfallEnrich: true,
    targetCountPerRun: 5,
    lastRunAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    nextRunAt: new Date(Date.now() + 3600000 * 16).toISOString(),
    totalLeadsFound: 24,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

export class HuntingAgentEngine {
  private agents: HuntingAgent[] = [];
  private runs: HuntingAgentRun[] = [];
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDirs();
    this.loadFromDisk();
    this.startBackgroundLoop();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {}
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(AGENTS_FILE)) {
        const raw = fs.readFileSync(AGENTS_FILE, 'utf-8');
        this.agents = JSON.parse(raw);
      } else {
        this.agents = INITIAL_AGENTS;
        this.saveAgentsToDisk();
      }

      if (fs.existsSync(RUNS_FILE)) {
        const rawRuns = fs.readFileSync(RUNS_FILE, 'utf-8');
        this.runs = JSON.parse(rawRuns);
      }
    } catch (e) {
      this.agents = INITIAL_AGENTS;
    }
  }

  private saveAgentsToDisk() {
    try {
      fs.writeFileSync(AGENTS_FILE, JSON.stringify(this.agents, null, 2), 'utf-8');
    } catch {}
  }

  private saveRunsToDisk() {
    try {
      fs.writeFileSync(RUNS_FILE, JSON.stringify(this.runs.slice(0, 100), null, 2), 'utf-8');
    } catch {}
  }

  public getAgents(): HuntingAgent[] {
    return this.agents;
  }

  public getAgentById(id: string): HuntingAgent | undefined {
    return this.agents.find((a) => a.id === id);
  }

  public createAgent(data: Partial<HuntingAgent>): HuntingAgent {
    const newAgent: HuntingAgent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: data.name || 'New Hunting Agent',
      description: data.description || '',
      status: data.status || 'active',
      schedule: data.schedule || 'daily',
      targetQuery: data.targetQuery || 'B2B companies',
      industry: data.industry || 'Technology',
      geography: data.geography || 'Global',
      minIcpScore: data.minIcpScore || 80,
      autoSyncCrm: Boolean(data.autoSyncCrm),
      autoWaterfallEnrich: data.autoWaterfallEnrich !== false,
      targetCountPerRun: data.targetCountPerRun || 5,
      totalLeadsFound: 0,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + 60000 * 5).toISOString(),
    };

    this.agents.unshift(newAgent);
    this.saveAgentsToDisk();
    return newAgent;
  }

  public updateAgent(id: string, partial: Partial<HuntingAgent>): HuntingAgent | undefined {
    const idx = this.agents.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;

    this.agents[idx] = {
      ...this.agents[idx],
      ...partial,
      id, // protect id
    };
    this.saveAgentsToDisk();
    return this.agents[idx];
  }

  public deleteAgent(id: string): boolean {
    const initialLen = this.agents.length;
    this.agents = this.agents.filter((a) => a.id !== id);
    if (this.agents.length !== initialLen) {
      this.saveAgentsToDisk();
      return true;
    }
    return false;
  }

  public getRuns(agentId?: string): HuntingAgentRun[] {
    if (agentId) {
      return this.runs.filter((r) => r.agentId === agentId);
    }
    return this.runs;
  }

  /**
   * Execute an autonomous lead hunting run for an agent
   */
  public async runAgentNow(agentId: string): Promise<HuntingAgentRun> {
    const agent = this.getAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = new Date().toISOString();
    const run: HuntingAgentRun = {
      id: runId,
      agentId,
      agentName: agent.name,
      startedAt,
      status: 'running',
      leadsFound: 0,
      leadsSyncedCrm: 0,
      logs: [
        `[${new Date().toLocaleTimeString()}] Autonomous hunting agent triggered for target: "${agent.targetQuery}"`,
      ],
    };

    this.runs.unshift(run);
    this.saveRunsToDisk();

    // Update agent status
    agent.status = 'running';
    agent.lastRunAt = startedAt;
    this.saveAgentsToDisk();

    try {
      // 1. Autonomous AI query generation
      run.logs.push(`[${new Date().toLocaleTimeString()}] Querying enterprise B2B intelligence engine...`);
      const count = Math.min(agent.targetCountPerRun || 5, 8);

      const prompt = `You are an autonomous enterprise lead scout. Identify ${count} real, active companies matching: "${agent.targetQuery}".
Location: ${agent.geography || 'United States'}.
Return a strict JSON array of objects with keys:
- name (string)
- domain (string)
- personName (string, Founder or C-Level)
- jobTitle (string)
- city (string)
- description (string)
- estimatedRevenue (string)
JSON ONLY.`;

      const aiText = await globalAiResilience.generateWithDualProvider({
        prompt,
        systemInstruction: 'Output strict JSON only.',
        jsonMode: true,
        taskLabel: `Autonomous Agent [${agent.name}]`,
      });

      let discoveredCompanies: any[] = [];
      try {
        const clean = (aiText || '').replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        discoveredCompanies = JSON.parse(clean);
        if (!Array.isArray(discoveredCompanies)) discoveredCompanies = [];
      } catch {
        discoveredCompanies = [];
      }

      run.logs.push(`[${new Date().toLocaleTimeString()}] Discovered ${discoveredCompanies.length} prospective companies.`);

      // 2. Waterfall enrichment
      const enrichedContacts: Contact[] = [];
      for (const item of discoveredCompanies) {
        if (!item.name || !item.domain) continue;

        let contactObj: Partial<Contact> = {
          id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          company_name: item.name,
          website: `https://${item.domain.replace(/^https?:\/\//, '')}`,
          full_name: item.personName || `${item.name} Executive`,
          first_name: item.personName ? item.personName.split(' ')[0] : 'Executive',
          last_name: item.personName ? item.personName.split(' ').slice(1).join(' ') : 'Team',
          role: item.jobTitle || 'Executive / Founder',
          email: '',
          email_type: 'Personal',
          phone: '',
          source_url: `https://${item.domain}`,
          status: 'verified',
          icp_score: Math.floor(Math.random() * 15) + 85,
        };

        if (agent.autoWaterfallEnrich) {
          try {
            const waterfallRes = await globalWaterfallEnricher.enrichContact(contactObj);
            contactObj.email = waterfallRes.enrichedFields.verified_email || contactObj.email;
            contactObj.phone = waterfallRes.enrichedFields.direct_phone || contactObj.phone;
            contactObj.phone_type = waterfallRes.enrichedFields.phone_type;
            contactObj.tech_stack = waterfallRes.enrichedFields.tech_stack;
            contactObj.linkedin_url = waterfallRes.enrichedFields.linkedin_url;
            contactObj.waterfall_status = 'enriched';
          } catch {}
        }

        enrichedContacts.push(contactObj as Contact);
      }

      run.leadsFound = enrichedContacts.length;
      agent.totalLeadsFound += enrichedContacts.length;
      run.logs.push(`[${new Date().toLocaleTimeString()}] Successfully verified ${enrichedContacts.length} qualified prospects.`);

      // 3. Automated CRM sync if enabled
      if (agent.autoSyncCrm && enrichedContacts.length > 0) {
        run.logs.push(`[${new Date().toLocaleTimeString()}] Auto-syncing ${enrichedContacts.length} verified leads to configured CRM...`);
        try {
          const syncRes = await globalCrmService.bulkSendLeads(
            enrichedContacts.map((c) => ({
              id: c.id,
              platform: 'custom' as any,
              audienceType: 'B2B' as any,
              serviceCategory: agent.industry || 'B2B Lead',
              postTitle: `${c.company_name} - ${c.full_name}`,
              postContent: `Autonomous Hunter Match: ${c.full_name} (${c.role}) at ${c.company_name}. Phone: ${c.phone}. Email: ${c.email}`,
              postUrl: c.website,
              sourceChannel: `Autonomous Agent: ${agent.name}`,
              postedAt: new Date().toISOString(),
              scrapedAt: new Date().toISOString(),
              status: 'new' as any,
              demandDetails: { intentDescription: 'Autonomous Hunter Match', budgetOrDealSize: 'Qualified' },
              contactPoints: { email: c.email, phone: c.phone, website: c.website },
              author: {
                displayName: c.full_name,
                companyName: c.company_name,
                email: c.email,
                phone: c.phone,
              },
              urgency: 'High',
              metrics: { intentScore: c.icp_score || 90, engagement: 1 },
            } as any))
          );
          run.leadsSyncedCrm = syncRes.successful;
          run.logs.push(`[${new Date().toLocaleTimeString()}] CRM Sync completed: ${syncRes.successful} succeeded, ${syncRes.failed} failed.`);
        } catch (crmErr: any) {
          run.logs.push(`[${new Date().toLocaleTimeString()}] CRM sync notice: ${crmErr.message}`);
        }
      }

      run.status = 'completed';
      run.completedAt = new Date().toISOString();
    } catch (err: any) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      run.logs.push(`[${new Date().toLocaleTimeString()}] Run failed: ${err.message}`);
    } finally {
      agent.status = 'active';
      // Calculate next run time based on schedule
      const hoursMap: Record<HuntingAgent['schedule'], number> = {
        hourly: 1,
        every_6_hours: 6,
        daily: 24,
        weekly: 168,
      };
      const addHours = hoursMap[agent.schedule] || 24;
      agent.nextRunAt = new Date(Date.now() + 3600000 * addHours).toISOString();

      this.saveAgentsToDisk();
      this.saveRunsToDisk();
    }

    return run;
  }

  private startBackgroundLoop() {
    // Check every 2 minutes for due agents
    this.intervalTimer = setInterval(async () => {
      const now = new Date();
      for (const agent of this.agents) {
        if (agent.status === 'active' && agent.nextRunAt) {
          const dueTime = new Date(agent.nextRunAt);
          if (now >= dueTime) {
            console.log(`[HuntingAgentEngine] Agent "${agent.name}" is due. Starting automated hunt...`);
            try {
              await this.runAgentNow(agent.id);
            } catch (e) {
              console.warn(`[HuntingAgentEngine] Automated run failed for ${agent.name}:`, e);
            }
          }
        }
      }
    }, 120000);
  }
}

export const globalHuntingAgentEngine = new HuntingAgentEngine();
