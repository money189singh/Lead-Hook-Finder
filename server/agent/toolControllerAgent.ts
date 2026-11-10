import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { getSettings, saveSettings, getHistory, saveJob, deleteHistoryItem } from '../storage';
import { crawlerEngine } from '../crawler';
import { analyzeIcpAndFindLookalikes } from '../discovery/lookalikeEngine';
import { globalDiscoveryEngine } from '../discovery/discoveryEngine';
import { globalCrmService } from '../crm/crmService';
import { LeadPipelineStage, CrmProviderType } from '../../src/types';

export interface AgentClientAction {
  type:
    | 'NAVIGATE'
    | 'EXPORT'
    | 'REFRESH_JOB'
    | 'REFRESH_SETTINGS'
    | 'REFRESH_HISTORY'
    | 'SHOW_TOAST';
  tab?: string;
  format?: 'csv' | 'xlsx';
  message?: string;
  toastType?: 'success' | 'info' | 'warning' | 'error';
}

export interface ExecutedToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result: Record<string, any>;
  status: 'success' | 'error';
}

export interface AgentChatResponse {
  reply: string;
  executedTools: ExecutedToolCall[];
  clientActions: AgentClientAction[];
  modelUsed: string;
}

const VALID_TABS = [
  'dashboard',
  'scraper',
  'results',
  'discovery',
  'google-maps',
  'algo-search',
  'social-radar',
  'buying-signals',
  'ai-studio',
  'workflows',
  'email-verifier',
  'verifier',
  'hunting-agents',
  'tech-detector',
  'waterfall',
  'inbound-gateway',
  'workspaces',
  'ai-control',
  'resilience',
  'history',
  'settings',
  'about',
];

const AGENT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'navigate_to_page',
    description: 'Navigate the LeadHook user interface to any page or module tab.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tab: {
          type: Type.STRING,
          description: `Target tab ID. One of: ${VALID_TABS.join(', ')}`,
        },
      },
      required: ['tab'],
    },
  },
  {
    name: 'start_website_scrape',
    description:
      'Start a live website contact scraping job on one or more company URLs or domains.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        urls: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Array of company domains or URLs to scrape (e.g. ["stripe.com", "linear.app"]).',
        },
        max_pages: {
          type: Type.NUMBER,
          description: 'Optional max pages per company (5, 10, 20, or 30).',
        },
        concurrency: {
          type: Type.NUMBER,
          description: 'Optional parallel websites concurrency (1 to 10).',
        },
        max_contacts: {
          type: Type.NUMBER,
          description: 'Optional max contacts per company (1, 2, 3, 5, 10, or 0 for unlimited).',
        },
        navigate_to_scraper: {
          type: Type.BOOLEAN,
          description: 'Whether to navigate UI to the scraper view automatically (default true).',
        },
      },
      required: ['urls'],
    },
  },
  {
    name: 'control_active_scrape',
    description: 'Pause, resume, stop, or clear the currently active website scraping job.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'One of: "pause", "resume", "stop", "clear"',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_system_status',
    description:
      'Inspect current LeadHook state including active scraping job progress, extracted contacts count, emails count, history count, and settings.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        include_sample_contacts: {
          type: Type.BOOLEAN,
          description: 'Whether to include up to 10 extracted contacts in the response.',
        },
      },
    },
  },
  {
    name: 'find_lookalike_domains',
    description:
      'Discover lookalike and competitor company domains from seed companies/domains, and optionally start scraping them immediately.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        seed_domains: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Seed company domains or names (e.g. ["stripe.com", "brex.com"]).',
        },
        target_region: {
          type: Type.STRING,
          description: 'Geographic region (e.g. "United States", "Europe", "Global").',
        },
        company_scale: {
          type: Type.STRING,
          description: 'Scale filter: "startups", "smb", "mid_market", or "all".',
        },
        target_count: {
          type: Type.NUMBER,
          description: 'Number of lookalike companies to find (default 10).',
        },
        auto_scrape: {
          type: Type.BOOLEAN,
          description: 'If true, immediately start scraping the discovered lookalike domains.',
        },
      },
      required: ['seed_domains'],
    },
  },
  {
    name: 'run_prospect_discovery',
    description: 'Start an AI Prospect Discovery search job by industry, location, and role.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        industry: {
          type: Type.STRING,
          description: 'Target industry (e.g. "SaaS", "Cybersecurity", "Fintech").',
        },
        country: {
          type: Type.STRING,
          description: 'Target country (e.g. "United States", "United Kingdom").',
        },
        city: {
          type: Type.STRING,
          description: 'Optional target city (e.g. "Austin", "New York").',
        },
        job_title: {
          type: Type.STRING,
          description: 'Target decision-maker roles (e.g. "CEO, Founder, VP Sales").',
        },
        target_count: {
          type: Type.NUMBER,
          description: 'Number of companies to discover (default 15).',
        },
      },
      required: ['industry'],
    },
  },
  {
    name: 'update_scraper_settings',
    description:
      'Update global LeadHook crawler & scraping settings (max pages, concurrency, max contacts, request delay, smart discovery, priority roles).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        max_pages: { type: Type.NUMBER, description: 'Max pages per domain (5, 10, 20, 30).' },
        max_contacts: { type: Type.NUMBER, description: 'Max contacts per domain (0 = unlimited).' },
        concurrency: { type: Type.NUMBER, description: 'Parallel websites (1 to 10).' },
        request_delay_ms: { type: Type.NUMBER, description: 'Delay between requests in ms (0 to 3000).' },
        smart_discovery: { type: Type.BOOLEAN, description: 'Enable smart page discovery.' },
        add_priority_roles: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Job titles to add to priority roles.',
        },
      },
    },
  },
  {
    name: 'manage_suppression_list',
    description:
      'Add or remove domains and email addresses on the Do-Not-Contact suppression list.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation: {
          type: Type.STRING,
          description: '"add" to block domains/emails, or "remove" to unblock them, or "clear" to empty list.',
        },
        domains: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Domains to block or unblock (e.g. ["competitor.com"]).',
        },
        emails: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Emails to block or unblock (e.g. ["optout@company.com"]).',
        },
      },
      required: ['operation'],
    },
  },
  {
    name: 'configure_outbound_webhook',
    description: 'Configure the automated Outbound Webhook dispatcher settings.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        enabled: { type: Type.BOOLEAN, description: 'Enable or disable auto-dispatch.' },
        url: { type: Type.STRING, description: 'Destination webhook HTTP/HTTPS URL.' },
        filter_mode: {
          type: Type.STRING,
          description: '"all_leads" or "high_icp_only".',
        },
      },
    },
  },
  {
    name: 'update_leads_pipeline',
    description:
      'Bulk-update pipeline stage, tags, or notes on extracted leads matching criteria (e.g. min ICP score, company name/domain, or all leads).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pipeline_stage: {
          type: Type.STRING,
          description: 'Stage to set: "New", "Contacted", "Qualified", "Follow-Up", or "Disqualified".',
        },
        add_tag: {
          type: Type.STRING,
          description: 'Optional tag to attach to matching leads (e.g. "Priority Q4").',
        },
        note: {
          type: Type.STRING,
          description: 'Optional note to attach to matching leads.',
        },
        min_icp_score: {
          type: Type.NUMBER,
          description: 'Only apply to leads with icp_score >= this number (e.g. 80).',
        },
        company_query: {
          type: Type.STRING,
          description: 'Optional company name or domain substring filter.',
        },
      },
    },
  },
  {
    name: 'export_leads',
    description: 'Trigger an immediate download/export of extracted leads in CSV or XLSX format.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        format: {
          type: Type.STRING,
          description: '"xlsx" or "csv".',
        },
      },
      required: ['format'],
    },
  },
  {
    name: 'configure_crm_integration',
    description:
      'Connect and configure an external CRM or outreach tool (In-House/Custom CRM, Apollo.io, HubSpot, Salesforce, or Pipedrive) with an API key/token/endpoint URL and enable automatic real-time lead syncing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        provider: {
          type: Type.STRING,
          description: 'CRM provider: "in_house", "apollo", "hubspot", "salesforce", or "pipedrive".',
        },
        api_key: {
          type: Type.STRING,
          description: 'API key or Private App Access Token for the CRM.',
        },
        endpoint_url: {
          type: Type.STRING,
          description: 'Endpoint URL for In-House/Custom CRM or Salesforce instance URL.',
        },
        company_domain: {
          type: Type.STRING,
          description: 'Pipedrive company domain or Salesforce Organization ID (OID).',
        },
        auto_sync_enabled: {
          type: Type.BOOLEAN,
          description: 'If true, automatically send all newly scraped and discovered leads to this CRM.',
        },
      },
      required: ['provider'],
    },
  },
  {
    name: 'generate_tool_api_key',
    description:
      'Generate a new LeadHook API key (lh_live_...) so external CRMs, Apollo, Zapier, Make, n8n, or custom tools can pull/push lead data automatically.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Label for the API key (e.g. "Apollo Sync Key", "Production CRM").',
        },
      },
    },
  },
  {
    name: 'sync_leads_to_crm',
    description:
      'Immediately push all collected leads from the active or latest scraping job to the connected CRM.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        provider: {
          type: Type.STRING,
          description: 'Optional CRM provider override ("in_house", "apollo", "hubspot", "salesforce", "pipedrive").',
        },
      },
    },
  },
];

async function executeSingleTool(
  name: string,
  args: Record<string, any>,
  clientActions: AgentClientAction[]
): Promise<Record<string, any>> {
  switch (name) {
    case 'navigate_to_page': {
      const rawTab = String(args.tab || 'dashboard').toLowerCase().trim();
      const matchedTab = VALID_TABS.find((t) => t === rawTab || rawTab.includes(t)) || 'dashboard';
      clientActions.push({ type: 'NAVIGATE', tab: matchedTab });
      return { success: true, navigated_to: matchedTab };
    }

    case 'start_website_scrape': {
      const urls: string[] = Array.isArray(args.urls)
        ? args.urls.map((u: any) => String(u).trim()).filter(Boolean)
        : [];
      if (urls.length === 0) {
        return { success: false, error: 'No valid URLs provided.' };
      }
      const customSettings: Record<string, any> = {};
      if (typeof args.max_pages === 'number') customSettings.max_pages = args.max_pages;
      if (typeof args.concurrency === 'number') customSettings.concurrency = args.concurrency;
      if (typeof args.max_contacts === 'number') customSettings.max_contacts = args.max_contacts;

      const job = crawlerEngine.startJob(urls, customSettings);
      clientActions.push({ type: 'REFRESH_JOB' });
      if (args.navigate_to_scraper !== false) {
        clientActions.push({ type: 'NAVIGATE', tab: 'scraper' });
      }
      clientActions.push({
        type: 'SHOW_TOAST',
        message: `AI Agent started scraping ${job.total_websites} website(s)`,
        toastType: 'success',
      });
      return {
        success: true,
        job_id: job.id,
        total_websites: job.total_websites,
        status: job.status,
      };
    }

    case 'control_active_scrape': {
      const action = String(args.action || '').toLowerCase().trim();
      if (action === 'pause') {
        crawlerEngine.pause();
      } else if (action === 'resume') {
        crawlerEngine.resume();
      } else if (action === 'stop') {
        crawlerEngine.stop();
      } else if (action === 'clear') {
        crawlerEngine.clearJob();
      } else {
        return { success: false, error: `Unknown action: ${action}` };
      }
      clientActions.push({ type: 'REFRESH_JOB' });
      return {
        success: true,
        action,
        current_status: crawlerEngine.getCurrentJob()?.status || 'idle',
      };
    }

    case 'get_system_status': {
      const job = crawlerEngine.getCurrentJob();
      const settings = getSettings();
      const history = getHistory();
      return {
        active_job: job
          ? {
              id: job.id,
              status: job.status,
              total_websites: job.total_websites,
              completed_websites: job.completed_websites,
              failed_websites: job.failed_websites,
              contacts_found: job.contacts_found,
              emails_found: job.emails_found,
              pages_crawled: job.pages_crawled,
              sample_contacts: args.include_sample_contacts
                ? (job.contacts || []).slice(0, 10).map((c) => ({
                    id: c.id,
                    company: c.company_name,
                    name: c.full_name,
                    role: c.role,
                    email: c.professional_email || c.email,
                    icp_score: c.icp_score,
                    stage: c.pipeline_stage || 'New',
                  }))
                : undefined,
            }
          : null,
        history_jobs_count: history.length,
        settings_summary: {
          max_pages: settings.max_pages,
          max_contacts: settings.max_contacts,
          concurrency: settings.concurrency,
          smart_discovery: settings.smart_discovery,
          suppressed_domains_count: (settings.suppressed_domains || []).length,
          suppressed_emails_count: (settings.suppressed_emails || []).length,
          outbound_webhook_enabled: Boolean(settings.outbound_webhook?.enabled),
        },
      };
    }

    case 'find_lookalike_domains': {
      const seeds: string[] = Array.isArray(args.seed_domains)
        ? args.seed_domains.map((s: any) => String(s).trim()).filter(Boolean)
        : [];
      if (seeds.length === 0) {
        return { success: false, error: 'Provide at least 1 seed domain.' };
      }
      const profile = await analyzeIcpAndFindLookalikes(seeds, {
        targetRegion: args.target_region || 'United States',
        companyScale: (args.company_scale as any) || 'smb',
        targetCount: args.target_count || 10,
      });
      const domains = (profile.lookalikes || []).map((l) => l.domain).filter(Boolean);
      let startedJobId: string | undefined;
      if (args.auto_scrape && domains.length > 0) {
        const urls = domains.map((d) => (d.startsWith('http') ? d : `https://${d}`));
        const job = crawlerEngine.startJob(urls);
        startedJobId = job.id;
        clientActions.push({ type: 'REFRESH_JOB' });
        clientActions.push({ type: 'NAVIGATE', tab: 'scraper' });
      }
      return {
        success: true,
        icp_title: profile.icpTitle,
        discovered_count: domains.length,
        lookalike_domains: domains,
        auto_scrape_started: Boolean(startedJobId),
        job_id: startedJobId,
      };
    }

    case 'run_prospect_discovery': {
      const job = await globalDiscoveryEngine.createAndStartJob({
        industry: String(args.industry || 'SaaS'),
        country: String(args.country || 'United States'),
        city: args.city ? String(args.city) : undefined,
        jobTitle: String(args.job_title || 'CEO, Founder, VP'),
        targetCount: Number(args.target_count) || 15,
        maxPagesPerCompany: 3,
        maxQueries: 5,
        autoExtractContacts: true,
        includeGenericEmails: true,
      });
      clientActions.push({ type: 'NAVIGATE', tab: 'discovery' });
      return {
        success: true,
        discovery_job_id: job.id,
        industry: args.industry,
        status: job.status,
      };
    }

    case 'update_scraper_settings': {
      const current = getSettings();
      const patch: Record<string, any> = {};
      if (typeof args.max_pages === 'number') patch.max_pages = args.max_pages;
      if (typeof args.max_contacts === 'number') patch.max_contacts = args.max_contacts;
      if (typeof args.concurrency === 'number') patch.concurrency = args.concurrency;
      if (typeof args.request_delay_ms === 'number') patch.request_delay_ms = args.request_delay_ms;
      if (typeof args.smart_discovery === 'boolean') patch.smart_discovery = args.smart_discovery;
      if (Array.isArray(args.add_priority_roles) && args.add_priority_roles.length > 0) {
        patch.priority_roles = Array.from(
          new Set([...(current.priority_roles || []), ...args.add_priority_roles.map(String)])
        );
      }
      const updated = saveSettings(patch);
      clientActions.push({ type: 'REFRESH_SETTINGS' });
      return {
        success: true,
        updated_fields: Object.keys(patch),
        current_settings: {
          max_pages: updated.max_pages,
          max_contacts: updated.max_contacts,
          concurrency: updated.concurrency,
          request_delay_ms: updated.request_delay_ms,
          smart_discovery: updated.smart_discovery,
        },
      };
    }

    case 'manage_suppression_list': {
      const current = getSettings();
      const op = String(args.operation || 'add').toLowerCase();
      const inDomains = Array.isArray(args.domains)
        ? args.domains.map((d: any) =>
            String(d).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
          )
        : [];
      const inEmails = Array.isArray(args.emails)
        ? args.emails.map((e: any) => String(e).toLowerCase().trim())
        : [];

      let nextDomains = [...(current.suppressed_domains || [])];
      let nextEmails = [...(current.suppressed_emails || [])];

      if (op === 'clear') {
        nextDomains = [];
        nextEmails = [];
      } else if (op === 'remove') {
        nextDomains = nextDomains.filter((d) => !inDomains.includes(d));
        nextEmails = nextEmails.filter((e) => !inEmails.includes(e));
      } else {
        nextDomains = Array.from(new Set([...nextDomains, ...inDomains]));
        nextEmails = Array.from(new Set([...nextEmails, ...inEmails]));
      }

      saveSettings({
        suppressed_domains: nextDomains,
        suppressed_emails: nextEmails,
      });
      clientActions.push({ type: 'REFRESH_SETTINGS' });
      return {
        success: true,
        operation: op,
        suppressed_domains_count: nextDomains.length,
        suppressed_emails_count: nextEmails.length,
      };
    }

    case 'configure_outbound_webhook': {
      const current = getSettings();
      const existing = current.outbound_webhook || {
        enabled: false,
        url: '',
        secret_header: '',
        filter_mode: 'all_leads',
      };
      const updatedWebhook = {
        ...existing,
        ...(typeof args.enabled === 'boolean' ? { enabled: args.enabled } : {}),
        ...(typeof args.url === 'string' ? { url: args.url.trim() } : {}),
        ...(args.filter_mode === 'high_icp_only' || args.filter_mode === 'all_leads'
          ? { filter_mode: args.filter_mode }
          : {}),
      };
      saveSettings({ outbound_webhook: updatedWebhook });
      clientActions.push({ type: 'REFRESH_SETTINGS' });
      return {
        success: true,
        outbound_webhook: updatedWebhook,
      };
    }

    case 'update_leads_pipeline': {
      const job = crawlerEngine.getCurrentJob();
      if (!job) {
        return { success: false, error: 'No active scraping job found.' };
      }
      const minScore = typeof args.min_icp_score === 'number' ? args.min_icp_score : undefined;
      const compQuery = args.company_query ? String(args.company_query).toLowerCase().trim() : undefined;
      let updatedCount = 0;

      const applyToContact = (c: any) => {
        if (minScore !== undefined && (c.icp_score || 0) < minScore) return false;
        if (
          compQuery &&
          !String(c.company_name || '').toLowerCase().includes(compQuery) &&
          !String(c.website || '').toLowerCase().includes(compQuery)
        ) {
          return false;
        }
        if (args.pipeline_stage) {
          c.pipeline_stage = args.pipeline_stage as LeadPipelineStage;
        }
        if (args.add_tag) {
          c.tags = Array.from(new Set([...(c.tags || []), String(args.add_tag).trim()]));
        }
        if (args.note) {
          c.notes = String(args.note).trim();
        }
        return true;
      };

      for (const site of job.websites || []) {
        for (const c of site.contacts || []) {
          if (applyToContact(c)) updatedCount++;
        }
      }
      for (const c of job.contacts || []) {
        applyToContact(c);
      }
      saveJob(job);
      clientActions.push({ type: 'REFRESH_JOB' });
      clientActions.push({ type: 'NAVIGATE', tab: 'results' });
      return {
        success: true,
        updated_leads_count: updatedCount,
        pipeline_stage: args.pipeline_stage,
        added_tag: args.add_tag,
      };
    }

    case 'export_leads': {
      const fmt = String(args.format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
      clientActions.push({ type: 'EXPORT', format: fmt });
      return {
        success: true,
        export_triggered: fmt,
      };
    }

    case 'configure_crm_integration': {
      const rawProv = String(args.provider || 'in_house').toLowerCase().trim();
      const provider: CrmProviderType =
        rawProv.includes('apollo')
          ? 'apollo'
          : rawProv.includes('hubspot')
          ? 'hubspot'
          : rawProv.includes('salesforce')
          ? 'salesforce'
          : rawProv.includes('pipedrive')
          ? 'pipedrive'
          : 'in_house';

      const currentCrm = globalCrmService.getConfig();
      const autoSync = typeof args.auto_sync_enabled === 'boolean' ? args.auto_sync_enabled : true;
      const apiKey = args.api_key ? String(args.api_key).trim() : '';
      const endpointUrl = args.endpoint_url ? String(args.endpoint_url).trim() : '';
      const domainOrOid = args.company_domain ? String(args.company_domain).trim() : '';

      const patch: any = {
        active_provider: provider,
        auto_sync_enabled: autoSync,
      };

      if (provider === 'apollo') {
        patch.apollo = {
          ...(currentCrm.apollo || {}),
          ...(apiKey ? { api_key: apiKey } : {}),
        };
      } else if (provider === 'hubspot') {
        patch.hubspot = {
          ...currentCrm.hubspot,
          ...(apiKey ? { access_token: apiKey } : {}),
        };
      } else if (provider === 'pipedrive') {
        patch.pipedrive = {
          ...currentCrm.pipedrive,
          ...(apiKey ? { api_token: apiKey } : {}),
          ...(domainOrOid ? { company_domain: domainOrOid } : {}),
        };
      } else if (provider === 'salesforce') {
        patch.salesforce = {
          ...currentCrm.salesforce,
          ...(apiKey ? { access_token: apiKey, mode: 'rest_api' } : {}),
          ...(endpointUrl ? { instance_url: endpointUrl, mode: 'rest_api' } : {}),
          ...(domainOrOid && !apiKey ? { oid: domainOrOid, mode: 'web_to_lead' } : {}),
        };
      } else {
        patch.in_house = {
          ...currentCrm.in_house,
          ...(endpointUrl ? { endpoint_url: endpointUrl } : {}),
          ...(apiKey ? { auth_type: 'bearer', auth_token: apiKey, api_key_value: apiKey } : {}),
        };
      }

      globalCrmService.saveConfig(patch);
      clientActions.push({ type: 'REFRESH_SETTINGS' });
      clientActions.push({
        type: 'SHOW_TOAST',
        message: `Connected ${provider.toUpperCase()} CRM (Auto-Sync: ${autoSync ? 'ON' : 'OFF'})`,
        toastType: 'success',
      });
      return {
        success: true,
        active_provider: provider,
        auto_sync_enabled: autoSync,
        has_api_key: Boolean(apiKey),
      };
    }

    case 'generate_tool_api_key': {
      const keyName = String(args.name || 'External CRM Integration').trim();
      const created = globalCrmService.generateApiKey(keyName);
      clientActions.push({ type: 'REFRESH_SETTINGS' });
      clientActions.push({
        type: 'SHOW_TOAST',
        message: `Generated new LeadHook API key (${created.name})`,
        toastType: 'success',
      });
      return {
        success: true,
        api_key: created.key,
        name: created.name,
        id: created.id,
        pull_endpoint: '/api/crm/external/leads',
      };
    }

    case 'sync_leads_to_crm': {
      const job = crawlerEngine.getCurrentJob();
      const contacts = job?.contacts || [];
      if (contacts.length === 0) {
        return {
          success: false,
          error: 'No extracted contacts found in the current job to sync.',
        };
      }
      const provOverride = args.provider as CrmProviderType | undefined;
      const syncRes = await globalCrmService.syncContacts(
        contacts,
        'LeadHook AI Agent Sync',
        provOverride
      );
      const activeProv = provOverride || globalCrmService.getConfig().active_provider;
      clientActions.push({
        type: 'SHOW_TOAST',
        message: `Synced ${syncRes.successful}/${syncRes.total} lead(s) to ${activeProv.toUpperCase()} CRM`,
        toastType: syncRes.successful > 0 ? 'success' : 'warning',
      });
      return {
        success: syncRes.successful > 0,
        provider: activeProv,
        total: syncRes.total,
        successful: syncRes.successful,
        failed: syncRes.failed,
      };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

const AGENT_MODEL_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
] as const;

const modelCooldownUntil = new Map<string, number>();

function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.statusText || err).toLowerCase();
  const status = err.status || err.statusCode || err.code;
  return (
    status === 429 ||
    status === '429' ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

function recordModelCooldown(model: string, err: any): void {
  const msg = String(err?.message || '');
  // If daily free tier quota is exhausted, cooldown this model for 30 minutes; otherwise 2 minutes
  const isDailyQuota = msg.includes('GenerateRequestsPerDay') || msg.includes('free_tier_requests');
  const cooldownMs = isDailyQuota ? 30 * 60 * 1000 : 2 * 60 * 1000;
  modelCooldownUntil.set(model, Date.now() + cooldownMs);
}

async function generateAgentContentWithFailover(
  ai: GoogleGenAI,
  contents: any[],
  systemInstruction: string
): Promise<{ response: any; modelUsed: string }> {
  const now = Date.now();
  const availableModels = AGENT_MODEL_CANDIDATES.filter((m) => {
    const until = modelCooldownUntil.get(m) || 0;
    return now >= until;
  });

  const modelsToTry = availableModels.length > 0 ? availableModels : AGENT_MODEL_CANDIDATES;
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: AGENT_TOOLS }],
        },
      });
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      if (isQuotaOrRateLimitError(err)) {
        recordModelCooldown(model, err);
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('All candidate Gemini models are currently unavailable.');
}

/**
 * Deterministic Multi-Step Fallback Command Executor when Gemini API key is not configured or all free-tier models are on quota cooldown
 */
async function executeFallbackIntent(
  message: string,
  clientActions: AgentClientAction[],
  executedTools: ExecutedToolCall[]
): Promise<string> {
  const lower = message.toLowerCase().trim();
  const summaries: string[] = [];

  // Extract URLs and domain patterns like stripe.com, linear.app, https://...
  const urlMatches = Array.from(
    message.matchAll(/https?:\/\/[^\s,]+/gi)
  ).map((m) => m[0]);

  const domainMatches = Array.from(
    new Set(
      Array.from(
        message.matchAll(/\b(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b/g)
      ).map((m) => m[1].toLowerCase())
    )
  );

  const emailMatches = Array.from(
    new Set(
      Array.from(message.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)).map((m) =>
        m[0].toLowerCase()
      )
    )
  );

  // 1. Check Scraper Settings update intent (can run alongside scraping or other commands)
  if (
    lower.includes('concurrency') ||
    lower.includes('max pages') ||
    lower.includes('max_pages') ||
    lower.includes('max contacts') ||
    lower.includes('max_contacts') ||
    lower.includes('delay') ||
    lower.includes('smart discovery')
  ) {
    const args: Record<string, any> = {};
    const concMatch = lower.match(/concurrency\s*(?:to|=|:)?\s*(\d+)/i);
    const pagesMatch = lower.match(/max[_\s]?pages\s*(?:to|=|:)?\s*(\d+)/i);
    const contactsMatch = lower.match(/max[_\s]?contacts\s*(?:to|=|:)?\s*(\d+)/i);
    const delayMatch = lower.match(/delay\s*(?:to|=|:)?\s*(\d+)/i);

    if (concMatch) args.concurrency = Math.min(10, Math.max(1, Number(concMatch[1])));
    if (pagesMatch) args.max_pages = Number(pagesMatch[1]);
    if (contactsMatch) args.max_contacts = Number(contactsMatch[1]);
    if (delayMatch) args.request_delay_ms = Number(delayMatch[1]);
    if (lower.includes('smart discovery')) {
      args.smart_discovery = !lower.includes('disable smart discovery') && !lower.includes('smart discovery off');
    }

    if (Object.keys(args).length === 0) {
      const genericNum = message.match(/\b(\d+)\b/);
      const val = genericNum ? Number(genericNum[1]) : 5;
      if (lower.includes('concurrency')) args.concurrency = Math.min(10, Math.max(1, val));
      if (lower.includes('max pages') || lower.includes('max_pages')) args.max_pages = val;
      if (lower.includes('max contacts') || lower.includes('max_contacts')) args.max_contacts = val;
    }

    if (Object.keys(args).length > 0) {
      const result = await executeSingleTool('update_scraper_settings', args, clientActions);
      executedTools.push({
        id: `call_${Date.now()}_${executedTools.length + 1}`,
        name: 'update_scraper_settings',
        args,
        result,
        status: 'success',
      });
      summaries.push(`Updated scraper settings (${Object.keys(args).join(', ')})`);
    }
  }

  // 2. Check Outbound Webhook configuration intent
  if (lower.includes('webhook')) {
    const webhookUrl = urlMatches[0] || '';
    const disable = lower.includes('disable') || lower.includes('off');
    const highIcpOnly = lower.includes('high icp') || lower.includes('high_icp');
    const args: Record<string, any> = {
      enabled: !disable,
      ...(webhookUrl ? { url: webhookUrl } : {}),
      filter_mode: highIcpOnly ? 'high_icp_only' : 'all_leads',
    };
    const result = await executeSingleTool('configure_outbound_webhook', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'configure_outbound_webhook',
      args,
      result,
      status: 'success',
    });
    summaries.push(
      `Configured outbound webhook (${result.outbound_webhook?.enabled ? 'enabled' : 'disabled'})`
    );
  }

  // 2b. Check Generate API Key intent
  if (
    (lower.includes('generate') || lower.includes('create') || lower.includes('new')) &&
    (lower.includes('api key') || lower.includes('apikey') || lower.includes('token')) &&
    !lower.includes('connect')
  ) {
    const nameMatch = message.match(/for\s+([a-zA-Z0-9\s_-]+)/i);
    const keyName = nameMatch?.[1]?.trim() || 'CRM Auto-Sync Key';
    const args = { name: keyName };
    const result = await executeSingleTool('generate_tool_api_key', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'generate_tool_api_key',
      args,
      result,
      status: 'success',
    });
    summaries.push(
      `Generated new LeadHook API key "${result.name}": ${result.api_key} (Endpoint: ${result.pull_endpoint})`
    );
  }

  // 2c. Check CRM Integration configuration intent (Apollo, HubSpot, Salesforce, Pipedrive, Custom/In-House CRM)
  if (
    lower.includes('crm') ||
    lower.includes('apollo') ||
    lower.includes('hubspot') ||
    lower.includes('salesforce') ||
    lower.includes('pipedrive')
  ) {
    const isSyncOnly =
      (lower.includes('sync') || lower.includes('push') || lower.includes('send')) &&
      !lower.includes('connect') &&
      !lower.includes('configure') &&
      !lower.includes('key') &&
      !lower.includes('token') &&
      urlMatches.length === 0;

    if (isSyncOnly) {
      const args: Record<string, any> = {};
      if (lower.includes('apollo')) args.provider = 'apollo';
      else if (lower.includes('hubspot')) args.provider = 'hubspot';
      else if (lower.includes('salesforce')) args.provider = 'salesforce';
      else if (lower.includes('pipedrive')) args.provider = 'pipedrive';

      const result = await executeSingleTool('sync_leads_to_crm', args, clientActions);
      executedTools.push({
        id: `call_${Date.now()}_${executedTools.length + 1}`,
        name: 'sync_leads_to_crm',
        args,
        result,
        status: result.success ? 'success' : 'error',
      });
      summaries.push(
        result.success
          ? `Synced ${result.successful}/${result.total} lead(s) to ${String(result.provider).toUpperCase()} CRM`
          : `CRM Sync note: ${result.error || 'Verify CRM credentials in Settings'}`
      );
    } else {
      const provider: CrmProviderType = lower.includes('apollo')
        ? 'apollo'
        : lower.includes('hubspot')
        ? 'hubspot'
        : lower.includes('salesforce')
        ? 'salesforce'
        : lower.includes('pipedrive')
        ? 'pipedrive'
        : 'in_house';

      const keyMatch = message.match(/(?:key|token)\s*(?:is|=|:)?\s*([a-zA-Z0-9_-]{8,})/i);
      const endpointUrl = urlMatches[0] || '';
      const disableAuto = lower.includes('disable auto') || lower.includes('auto sync off');
      const args: Record<string, any> = {
        provider,
        auto_sync_enabled: !disableAuto,
        ...(keyMatch?.[1] ? { api_key: keyMatch[1] } : {}),
        ...(endpointUrl ? { endpoint_url: endpointUrl } : {}),
      };
      const result = await executeSingleTool('configure_crm_integration', args, clientActions);
      executedTools.push({
        id: `call_${Date.now()}_${executedTools.length + 1}`,
        name: 'configure_crm_integration',
        args,
        result,
        status: 'success',
      });
      summaries.push(
        `Configured ${provider.toUpperCase()} CRM integration (Auto-Sync: ${result.auto_sync_enabled ? 'Enabled' : 'Disabled'})`
      );
    }
  }

  // 3. Check Block / Suppress intent
  if (
    lower.includes('block') ||
    lower.includes('suppress') ||
    lower.includes('do not contact') ||
    lower.includes('unblock') ||
    lower.includes('clear suppression')
  ) {
    const op = lower.includes('clear')
      ? 'clear'
      : lower.includes('unblock') || lower.includes('remove')
      ? 'remove'
      : 'add';
    const domains = domainMatches.filter((d) => !emailMatches.some((e) => e.endsWith(d)));
    const args = { operation: op, domains, emails: emailMatches };
    const result = await executeSingleTool('manage_suppression_list', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'manage_suppression_list',
      args,
      result,
      status: 'success',
    });
    summaries.push(
      `Updated suppression list (${result.suppressed_domains_count} blocked domains, ${result.suppressed_emails_count} blocked emails)`
    );
  }

  // 4. Check Lookalike / Competitor discovery intent
  if (lower.includes('lookalike') || lower.includes('similar') || lower.includes('competitor')) {
    const seeds = domainMatches.length > 0 ? domainMatches : ['stripe.com'];
    const autoScrape = lower.includes('scrape') || lower.includes('crawl');
    const args = { seed_domains: seeds, auto_scrape: autoScrape };
    const result = await executeSingleTool('find_lookalike_domains', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'find_lookalike_domains',
      args,
      result,
      status: result.success ? 'success' : 'error',
    });
    summaries.push(
      `Discovered ${result.discovered_count || 0} lookalike companies for ${seeds.join(', ')}: ${(result.lookalike_domains || []).slice(0, 6).join(', ')}${result.auto_scrape_started ? ' and started scraping them immediately' : ''}`
    );
  } else if (
    (lower.includes('scrape') || lower.includes('crawl') || lower.includes('extract')) &&
    domainMatches.length > 0 &&
    !lower.includes('block') &&
    !lower.includes('suppress')
  ) {
    // 5. Check Start Website Scrape intent
    const args = { urls: domainMatches, navigate_to_scraper: true };
    const result = await executeSingleTool('start_website_scrape', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'start_website_scrape',
      args,
      result,
      status: result.success ? 'success' : 'error',
    });
    summaries.push(`Started website scraping job (${result.job_id}) for ${domainMatches.join(', ')}`);
  }

  // 6. Check AI Prospect Discovery campaign intent
  if (
    (lower.includes('discover') || lower.includes('find companies') || lower.includes('prospect')) &&
    !lower.includes('lookalike') &&
    !lower.includes('smart discovery')
  ) {
    const inMatch = message.match(/(?:in|for)\s+([a-zA-Z0-9\s,&-]+?)(?:\s+located\s+in|\s+in\s+([A-Z][a-zA-Z\s,]+)|$)/i);
    const industry = inMatch?.[1]?.trim() || message.replace(/^(discover|find|search|prospect)\s+/i, '').trim() || 'B2B SaaS';
    const location = inMatch?.[2]?.trim() || '';
    const args = { industry, location, max_companies: 15 };
    const result = await executeSingleTool('start_prospect_discovery', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'start_prospect_discovery',
      args,
      result,
      status: result.success ? 'success' : 'error',
    });
    summaries.push(`Launched AI Prospect Discovery campaign (${result.discovery_job_id}) for "${industry}"`);
  }

  // 7. Pause / Resume / Stop active scrape
  if (
    /\b(pause|resume|stop)\b/.test(lower) &&
    (lower.includes('scrape') || lower.includes('job') || lower.includes('crawl'))
  ) {
    const act = lower.includes('pause') ? 'pause' : lower.includes('resume') ? 'resume' : 'stop';
    const args = { action: act };
    const result = await executeSingleTool('control_active_scrape', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'control_active_scrape',
      args,
      result,
      status: 'success',
    });
    summaries.push(`Executed "${act}" on the active scraping job (status: ${result.current_status})`);
  }

  // 8. Qualify / Pipeline stage / Tag update
  if (lower.includes('qualif') || lower.includes('stage') || lower.includes('tag') || lower.includes('follow-up') || lower.includes('contacted')) {
    const stage = lower.includes('disqualif')
      ? 'Disqualified'
      : lower.includes('contacted')
      ? 'Contacted'
      : lower.includes('follow')
      ? 'Follow-Up'
      : 'Qualified';
    const scoreMatch = lower.match(/(?:score|icp)\s*(?:>=|>|above|over)?\s*(\d+)/i);
    const minScore = scoreMatch ? Number(scoreMatch[1]) : lower.includes('high') || lower.includes('80') ? 80 : undefined;
    const tagMatch = message.match(/tag\s+(?:as|with)?\s*["']?([a-zA-Z0-9_-]+)["']?/i);
    const args: Record<string, any> = {
      pipeline_stage: stage,
      ...(minScore !== undefined ? { min_icp_score: minScore } : {}),
      ...(tagMatch?.[1] ? { add_tag: tagMatch[1] } : {}),
    };
    const result = await executeSingleTool('update_leads_pipeline', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'update_leads_pipeline',
      args,
      result,
      status: result.success ? 'success' : 'error',
    });
    summaries.push(
      result.success
        ? `Updated ${result.updated_leads_count} lead(s) to stage "${stage}"`
        : `Could not update leads: ${result.error}`
    );
  }

  // 9. Export intent
  if (lower.includes('export') || lower.includes('download')) {
    const fmt = lower.includes('csv') ? 'csv' : 'xlsx';
    const args = { format: fmt };
    const result = await executeSingleTool('export_leads', args, clientActions);
    executedTools.push({
      id: `call_${Date.now()}_${executedTools.length + 1}`,
      name: 'export_leads',
      args,
      result,
      status: 'success',
    });
    summaries.push(`Triggered ${fmt.toUpperCase()} export of extracted leads`);
  }

  // 10. Explicit Navigation intent (if not already navigated by another tool or if explicitly requested)
  if (
    lower.includes('navigate') ||
    lower.includes('open') ||
    lower.includes('go to') ||
    lower.includes('show') ||
    summaries.length === 0
  ) {
    for (const tab of VALID_TABS) {
      if (lower.includes(tab.replace('-', ' ')) || lower.includes(tab)) {
        const args = { tab };
        const result = await executeSingleTool('navigate_to_page', args, clientActions);
        executedTools.push({
          id: `call_${Date.now()}_${executedTools.length + 1}`,
          name: 'navigate_to_page',
          args,
          result,
          status: 'success',
        });
        summaries.push(`Navigated to ${tab}`);
        break;
      }
    }
  }

  if (summaries.length > 0) {
    return `${summaries.join('. ')}.`;
  }

  // Default: Get system status
  const statusResult = await executeSingleTool(
    'get_system_status',
    { include_sample_contacts: true },
    clientActions
  );
  executedTools.push({
    id: `call_${Date.now()}_status`,
    name: 'get_system_status',
    args: { include_sample_contacts: true },
    result: statusResult,
    status: 'success',
  });
  const activeJob = statusResult.active_job;
  if (activeJob) {
    return `Active job ${activeJob.id} is "${activeJob.status}" (${activeJob.completed_websites}/${activeJob.total_websites} websites completed, ${activeJob.contacts_found} contacts and ${activeJob.emails_found} emails extracted).`;
  }
  return `LeadHook is ready. ${statusResult.history_jobs_count} historical job(s) stored. You can ask me to scrape domains, find lookalikes, update settings, block domains, qualify leads, or navigate anywhere in the app.`;
}

export async function runToolControllerAgent(
  userMessage: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = []
): Promise<AgentChatResponse> {
  const clientActions: AgentClientAction[] = [];
  const executedTools: ExecutedToolCall[] = [];

  const settings = getSettings();
  const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();

  // Check if all Gemini candidate models are currently on quota cooldown
  const now = Date.now();
  const anyModelAvailable = AGENT_MODEL_CANDIDATES.some((m) => now >= (modelCooldownUntil.get(m) || 0));

  if (!apiKey || !anyModelAvailable) {
    const fallbackReply = await executeFallbackIntent(userMessage, clientActions, executedTools);
    return {
      reply: fallbackReply,
      executedTools,
      clientActions,
      modelUsed: 'leadhook-command-engine',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const job = crawlerEngine.getCurrentJob();
    const systemInstruction = `You are the LeadHook Master AI Controller Agent. You have full, direct control over the entire LeadHook application via your function tools.
Current Live State:
- Active Scrape Job: ${
      job
        ? `${job.id} (status: ${job.status}, websites: ${job.completed_websites}/${job.total_websites}, contacts: ${job.contacts_found}, emails: ${job.emails_found})`
        : 'None'
    }
- Scraper Settings: max_pages=${settings.max_pages}, concurrency=${settings.concurrency}, max_contacts=${settings.max_contacts}, smart_discovery=${settings.smart_discovery}
- Suppression List: ${(settings.suppressed_domains || []).length} domains, ${(settings.suppressed_emails || []).length} emails blocked.

Rules:
1. Whenever the user asks to scrape websites, pause/resume/stop jobs, find lookalikes, discover prospects, change settings, block domains/emails, configure webhooks, update lead stages/tags/notes, export data, or open a page, ALWAYS invoke the matching function tool(s) immediately.
2. You can call multiple tools in sequence or together if the user gives a multi-step command.
3. Keep your final text response concise, direct, and factual.`;

    const contents: any[] = [];
    for (const h of history.slice(-8)) {
      if (h.text && h.text.trim()) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    let { response, modelUsed } = await generateAgentContentWithFailover(ai, contents, systemInstruction);

    // Multi-step tool execution loop (up to 3 rounds)
    let loopCount = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 3) {
      loopCount++;
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }

      const functionResponseParts: any[] = [];
      for (const call of response.functionCalls) {
        const fnName = call.name || 'unknown';
        const fnArgs = (call.args as Record<string, any>) || {};
        const callId = call.id || `call_${Date.now()}_${executedTools.length}`;

        try {
          const toolResult = await executeSingleTool(fnName, fnArgs, clientActions);
          executedTools.push({
            id: callId,
            name: fnName,
            args: fnArgs,
            result: toolResult,
            status: toolResult.success === false ? 'error' : 'success',
          });
          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: fnName,
              response: toolResult,
            },
          });
        } catch (toolErr: any) {
          const errObj = { success: false, error: toolErr.message || 'Tool execution error' };
          executedTools.push({
            id: callId,
            name: fnName,
            args: fnArgs,
            result: errObj,
            status: 'error',
          });
          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: fnName,
              response: errObj,
            },
          });
        }
      }

      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });

      try {
        const nextTurn = await generateAgentContentWithFailover(ai, contents, systemInstruction);
        response = nextTurn.response;
        modelUsed = nextTurn.modelUsed;
      } catch {
        // Tool execution already succeeded; return clean summary without failing
        break;
      }
    }

    const replyText =
      response.text?.trim() ||
      (executedTools.length > 0
        ? `Executed ${executedTools.map((t) => t.name).join(', ')} successfully.`
        : 'Command completed.');

    return {
      reply: replyText,
      executedTools,
      clientActions,
      modelUsed,
    };
  } catch {
    if (executedTools.length > 0) {
      return {
        reply: `Executed ${executedTools.map((t) => t.name).join(', ')} successfully.`,
        executedTools,
        clientActions,
        modelUsed: 'leadhook-command-engine',
      };
    }
    const fallbackReply = await executeFallbackIntent(userMessage, clientActions, executedTools);
    return {
      reply: fallbackReply,
      executedTools,
      clientActions,
      modelUsed: 'leadhook-command-engine',
    };
  }
}
