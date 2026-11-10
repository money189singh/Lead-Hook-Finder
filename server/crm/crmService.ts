import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  CrmConfig,
  CrmProviderType,
  CrmSyncLog,
  LeadHookApiKey,
  SocialDemandLead,
} from '../../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CRM_CONFIG_FILE = path.join(DATA_DIR, 'crm_config.json');
const CRM_LOGS_FILE = path.join(DATA_DIR, 'crm_sync_logs.json');

export const DEFAULT_CRM_CONFIG: CrmConfig = {
  active_provider: 'in_house',
  auto_sync_enabled: false,
  in_house: {
    endpoint_url: '',
    http_method: 'POST',
    auth_type: 'bearer',
    auth_token: '',
    api_key_header: 'X-API-Key',
    api_key_value: '',
    custom_headers: {},
    field_mapping: {
      name_field: 'name',
      email_field: 'email',
      company_field: 'company',
      phone_field: 'phone',
      title_field: 'title',
      source_field: 'source',
      intent_field: 'intent_score',
      urgency_field: 'urgency',
      budget_field: 'budget',
      notes_field: 'notes',
      url_field: 'post_url',
    },
  },
  apollo: {
    api_key: '',
    label_names: 'LeadHook Automated',
  },
  salesforce: {
    mode: 'web_to_lead',
    instance_url: '',
    access_token: '',
    lead_object: 'Lead',
    oid: '',
    web_to_lead_url: 'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8',
    lead_source: 'LeadHook Automated Pipeline',
  },
  hubspot: {
    access_token: '',
    lifecycle_stage: 'lead',
    lead_status: 'OPEN_DEAL',
  },
  pipedrive: {
    api_token: '',
    company_domain: '',
  },
  leadhook_api_keys: [],
};

function extractLeadProperties(lead: any) {
  const author = lead.author || {};
  const name = author.displayName || author.username || author.handle || lead.full_name || lead.name || 'Prospect';
  const nameParts = String(name).split(' ');
  const firstName = nameParts[0] || name;
  const lastName = nameParts.slice(1).join(' ') || 'Prospect';
  const email = lead.contactPoints?.email || author.email || lead.professional_email || lead.email || lead.work_email || '';
  const phone = lead.contactPoints?.phone || author.phone || lead.phone || lead.phone_number || '';
  const company = author.companyName || lead.company_name || lead.company || `${name}'s Business`;
  const role = author.role || lead.role || lead.job_title || 'Decision Maker';
  const intentScore = lead.demandDetails?.buyingIntentScore ?? lead.metrics?.intentScore ?? lead.icp_score ?? 85;
  const urgency = lead.demandDetails?.urgency ?? lead.urgency ?? 'Medium';
  const budget = lead.demandDetails?.budget || 'Negotiable';
  const specificNeed = lead.demandDetails?.specificNeed || lead.postTitle || lead.title || role;
  const location = author.location || lead.location || '';
  const postUrl = lead.postUrl || lead.website || lead.source_url || '';
  const content = lead.postContent || lead.snippet || lead.notes || '';

  return {
    name,
    firstName,
    lastName,
    email,
    phone,
    company,
    role,
    intentScore,
    urgency,
    budget,
    specificNeed,
    location,
    postUrl,
    content,
  };
}

export class CrmService {
  private config: CrmConfig = DEFAULT_CRM_CONFIG;
  private logs: CrmSyncLog[] = [];

  constructor() {
    this.ensureDirs();
    this.loadFromDisk();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not create data dir for CRM:', e);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(CRM_CONFIG_FILE)) {
        const raw = fs.readFileSync(CRM_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.config = {
          ...DEFAULT_CRM_CONFIG,
          ...parsed,
          in_house: { ...DEFAULT_CRM_CONFIG.in_house, ...(parsed.in_house || {}) },
          apollo: { ...DEFAULT_CRM_CONFIG.apollo, ...(parsed.apollo || {}) },
          salesforce: { ...DEFAULT_CRM_CONFIG.salesforce, ...(parsed.salesforce || {}) },
          hubspot: { ...DEFAULT_CRM_CONFIG.hubspot, ...(parsed.hubspot || {}) },
          pipedrive: { ...DEFAULT_CRM_CONFIG.pipedrive, ...(parsed.pipedrive || {}) },
          leadhook_api_keys: Array.isArray(parsed.leadhook_api_keys) ? parsed.leadhook_api_keys : [],
        };
      }
      if (fs.existsSync(CRM_LOGS_FILE)) {
        const rawLogs = fs.readFileSync(CRM_LOGS_FILE, 'utf-8');
        const parsedLogs = JSON.parse(rawLogs);
        if (Array.isArray(parsedLogs)) {
          this.logs = parsedLogs.slice(0, 100);
        }
      }
    } catch (e) {
      console.warn('Could not load CRM files from disk:', e);
    }
  }

  private saveToDisk() {
    try {
      this.ensureDirs();
      fs.writeFileSync(CRM_CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
      fs.writeFileSync(CRM_LOGS_FILE, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not save CRM config to disk:', e);
    }
  }

  public getConfig(): CrmConfig {
    return { ...this.config };
  }

  public getMaskedConfig(): any {
    const c = this.getConfig();
    return {
      ...c,
      in_house: {
        ...c.in_house,
        auth_token: c.in_house.auth_token ? `••••••••${c.in_house.auth_token.slice(-4)}` : '',
        api_key_value: c.in_house.api_key_value ? `••••••••${c.in_house.api_key_value.slice(-4)}` : '',
      },
      apollo: {
        ...(c.apollo || {}),
        api_key: c.apollo?.api_key ? `••••••••${c.apollo.api_key.slice(-4)}` : '',
      },
      salesforce: {
        ...c.salesforce,
        access_token: c.salesforce.access_token ? `••••••••${c.salesforce.access_token.slice(-4)}` : '',
      },
      hubspot: {
        ...c.hubspot,
        access_token: c.hubspot.access_token ? `••••••••${c.hubspot.access_token.slice(-4)}` : '',
      },
      pipedrive: {
        ...c.pipedrive,
        api_token: c.pipedrive.api_token ? `••••••••${c.pipedrive.api_token.slice(-4)}` : '',
      },
      leadhook_api_keys: c.leadhook_api_keys || [],
    };
  }

  public saveConfig(newConfig: Partial<CrmConfig>): CrmConfig {
    const existing = this.config;

    const in_house = {
      ...existing.in_house,
      ...(newConfig.in_house || {}),
    };
    if (newConfig.in_house?.auth_token?.includes('••••')) {
      in_house.auth_token = existing.in_house.auth_token;
    }
    if (newConfig.in_house?.api_key_value?.includes('••••')) {
      in_house.api_key_value = existing.in_house.api_key_value;
    }

    const apollo = {
      ...(existing.apollo || DEFAULT_CRM_CONFIG.apollo),
      ...(newConfig.apollo || {}),
    };
    if (newConfig.apollo?.api_key?.includes('••••')) {
      apollo.api_key = existing.apollo?.api_key || '';
    }

    const salesforce = {
      ...existing.salesforce,
      ...(newConfig.salesforce || {}),
    };
    if (newConfig.salesforce?.access_token?.includes('••••')) {
      salesforce.access_token = existing.salesforce.access_token;
    }

    const hubspot = {
      ...existing.hubspot,
      ...(newConfig.hubspot || {}),
    };
    if (newConfig.hubspot?.access_token?.includes('••••')) {
      hubspot.access_token = existing.hubspot.access_token;
    }

    const pipedrive = {
      ...existing.pipedrive,
      ...(newConfig.pipedrive || {}),
    };
    if (newConfig.pipedrive?.api_token?.includes('••••')) {
      pipedrive.api_token = existing.pipedrive.api_token;
    }

    this.config = {
      ...existing,
      ...newConfig,
      in_house,
      apollo,
      salesforce,
      hubspot,
      pipedrive,
      leadhook_api_keys: Array.isArray(newConfig.leadhook_api_keys)
        ? newConfig.leadhook_api_keys
        : existing.leadhook_api_keys || [],
    };

    this.saveToDisk();
    return this.config;
  }

  public generateApiKey(name: string = 'External CRM Integration'): LeadHookApiKey {
    const randomPart = crypto.randomBytes(18).toString('hex');
    const newKey: LeadHookApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'External CRM Integration',
      key: `lh_live_${randomPart}`,
      created_at: new Date().toISOString(),
    };
    const keys = [...(this.config.leadhook_api_keys || []), newKey];
    this.config.leadhook_api_keys = keys;
    this.saveToDisk();
    return newKey;
  }

  public revokeApiKey(idOrKey: string): boolean {
    const existing = this.config.leadhook_api_keys || [];
    const next = existing.filter((k) => k.id !== idOrKey && k.key !== idOrKey);
    if (next.length === existing.length) return false;
    this.config.leadhook_api_keys = next;
    this.saveToDisk();
    return true;
  }

  public validateApiKey(token: string): boolean {
    if (!token) return false;
    const clean = token.trim().replace(/^Bearer\s+/i, '');
    const keys = this.config.leadhook_api_keys || [];
    const found = keys.find((k) => k.key === clean);
    if (found) {
      found.last_used_at = new Date().toISOString();
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public getLogs(): CrmSyncLog[] {
    return [...this.logs];
  }

  private addLog(log: Omit<CrmSyncLog, 'id' | 'timestamp'>) {
    const fullLog: CrmSyncLog = {
      id: `crm_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.logs.unshift(fullLog);
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
    this.saveToDisk();
  }

  /**
   * Test Connection to configured or provided CRM endpoint
   */
  public async testConnection(overrideConfig?: CrmConfig): Promise<{
    success: boolean;
    message: string;
    statusCode?: number;
    latencyMs: number;
    responseSnippet?: string;
  }> {
    const config = overrideConfig || this.config;
    const provider = config.active_provider;

    const dummyLead: SocialDemandLead = {
      id: `test_lead_${Date.now()}`,
      platform: 'web_forum',
      audienceType: 'B2B',
      serviceCategory: 'Technology & Consulting',
      postTitle: '[TEST LEAD] LeadHook CRM Connection Ping',
      postContent: 'This is an automated connection test dispatched from LeadHook to verify direct CRM connectivity.',
      postUrl: 'https://leadhook.local/test',
      sourceChannel: 'LeadHook Diagnostic Suite',
      postedAt: new Date().toISOString(),
      author: {
        username: 'test_user',
        displayName: 'LeadHook Test Prospect',
        companyName: 'LeadHook Systems Inc.',
        role: 'Founder & CEO',
        location: 'San Francisco, CA',
      },
      demandDetails: {
        specificNeed: 'CRM Integration Verification',
        urgency: 'Immediate',
        budget: '$10,000+',
        keyRequirements: ['API Integration', 'Real-time Sync'],
        buyingIntentScore: 98,
      },
      contactPoints: {
        email: 'test.prospect@leadhook-crm-test.io',
        phone: '+1-555-0199',
        directMessageUrl: 'https://leadhook.local',
      },
      scrapedAt: new Date().toISOString(),
      status: 'new',
    };

    const startTime = Date.now();
    try {
      const result = await this.sendLeadToProvider(dummyLead, provider, config);
      const latencyMs = Date.now() - startTime;
      return {
        success: result.success,
        message: result.message,
        statusCode: result.statusCode,
        latencyMs,
        responseSnippet: result.responseSnippet,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        message: err.message || 'Connection test failed',
        latencyMs,
      };
    }
  }

  /**
   * Send a single lead to the active CRM
   */
  public async sendLead(
    lead: SocialDemandLead,
    providerOverride?: CrmProviderType
  ): Promise<{
    success: boolean;
    externalId?: string;
    message: string;
    statusCode?: number;
    latencyMs: number;
  }> {
    const provider = providerOverride || this.config.active_provider;
    const startTime = Date.now();

    try {
      const res = await this.sendLeadToProvider(lead, provider, this.config);
      const latencyMs = Date.now() - startTime;

      this.addLog({
        leadId: lead.id,
        leadTitle: lead.postTitle,
        companyName: lead.author.companyName || lead.author.displayName,
        provider,
        status: res.success ? 'success' : 'failed',
        statusCode: res.statusCode,
        latencyMs,
        externalId: res.externalId,
        message: res.message,
        error: res.success ? undefined : res.message,
      });

      return {
        success: res.success,
        externalId: res.externalId,
        message: res.message,
        statusCode: res.statusCode,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err.message || 'Unknown CRM dispatch error';

      this.addLog({
        leadId: lead.id,
        leadTitle: lead.postTitle,
        companyName: lead.author.companyName || lead.author.displayName,
        provider,
        status: 'failed',
        latencyMs,
        message: errorMsg,
        error: errorMsg,
      });

      return {
        success: false,
        message: errorMsg,
        latencyMs,
      };
    }
  }

  /**
   * Bulk send leads to active CRM
   */
  public async bulkSendLeads(
    leads: SocialDemandLead[],
    providerOverride?: CrmProviderType
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: any[];
  }> {
    const results: any[] = [];
    let successful = 0;
    let failed = 0;

    for (const lead of leads) {
      const res = await this.sendLead(lead, providerOverride);
      if (res.success) successful++;
      else failed++;
      results.push({ leadId: lead.id, ...res });
    }

    return {
      total: leads.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Convert Contact[] or DiscoveredProspect[] records and sync to active CRM
   */
  public async syncContacts(
    contacts: any[],
    sourceChannel: string = 'LeadHook Automated Pipeline',
    providerOverride?: CrmProviderType
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: any[];
  }> {
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    const mappedLeads: SocialDemandLead[] = contacts.map((c: any) => {
      const fullName = c.full_name || c.personName || c.name || 'Decision Maker';
      const companyName = c.company_name || c.companyName || c.company || 'Prospect Company';
      const email = c.professional_email || c.decisionMakerEmail || c.email || c.genericEmail || '';
      const phone = c.phone || '';
      const role = c.role || c.jobTitle || c.job_title || 'Executive';
      const website = c.website || c.domain || c.source_url || c.sourceUrl || 'https://leadhook.local';

      return {
        id: c.id || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        platform: 'web_forum',
        audienceType: 'B2B',
        serviceCategory: c.industry || 'B2B Lead',
        postTitle: `${companyName} - ${fullName} (${role})`,
        postContent: `Lead: ${fullName} | Role: ${role} | Company: ${companyName} | Email: ${email} | Phone: ${phone} | Stage: ${c.pipeline_stage || 'New'}`,
        postUrl: website.startsWith('http') ? website : `https://${website}`,
        sourceChannel,
        postedAt: new Date().toISOString(),
        author: {
          username: fullName.toLowerCase().replace(/\s+/g, '_'),
          displayName: fullName,
          companyName,
          role,
          location: c.location || c.city || '',
        },
        demandDetails: {
          specificNeed: role,
          urgency: 'High',
          budget: 'B2B',
          keyRequirements: c.tags || [],
          buyingIntentScore: typeof c.icp_score === 'number' ? c.icp_score : typeof c.fitScore === 'number' ? c.fitScore : 85,
        },
        contactPoints: {
          email,
          phone,
          companyWebsite: website,
        },
        scrapedAt: new Date().toISOString(),
        status: 'new',
      };
    });

    return this.bulkSendLeads(mappedLeads, providerOverride);
  }

  /**
   * Internal dispatcher per provider
   */
  private async sendLeadToProvider(
    lead: SocialDemandLead,
    provider: CrmProviderType,
    config: CrmConfig
  ): Promise<{
    success: boolean;
    externalId?: string;
    message: string;
    statusCode?: number;
    responseSnippet?: string;
  }> {
    switch (provider) {
      case 'in_house':
        return this.sendToInHouse(lead, config.in_house);
      case 'apollo':
        return this.sendToApollo(lead, config.apollo);
      case 'salesforce':
        return this.sendToSalesforce(lead, config.salesforce);
      case 'hubspot':
        return this.sendToHubSpot(lead, config.hubspot);
      case 'pipedrive':
        return this.sendToPipedrive(lead, config.pipedrive);
      default:
        throw new Error(`Unsupported CRM provider: ${provider}`);
    }
  }

  // 0. Apollo.io Direct Contact Creation Dispatcher
  private async sendToApollo(
    lead: SocialDemandLead,
    apollo?: CrmConfig['apollo']
  ): Promise<{
    success: boolean;
    externalId?: string;
    message: string;
    statusCode?: number;
    responseSnippet?: string;
  }> {
    if (!apollo?.api_key || !apollo.api_key.trim()) {
      throw new Error('Apollo.io API Key is required.');
    }

    const p = extractLeadProperties(lead);
    const labels = (apollo.label_names || 'LeadHook Automated')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Record<string, any> = {
      first_name: p.firstName,
      last_name: p.lastName,
      organization_name: p.company,
      title: p.role || p.specificNeed || 'Decision Maker',
      email: p.email || undefined,
      website_url: p.postUrl || undefined,
      direct_phone: p.phone || undefined,
      label_names: labels,
    };

    const abortCtrl = new AbortController();
    const timeout = setTimeout(() => abortCtrl.abort(), 12000);

    const response = await fetch('https://api.apollo.io/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apollo.api_key.trim(),
      },
      body: JSON.stringify(payload),
      signal: abortCtrl.signal,
    });

    clearTimeout(timeout);
    let snippet = '';
    let parsed: any = null;
    try {
      const txt = await response.text();
      snippet = txt.slice(0, 300);
      try {
        parsed = JSON.parse(txt);
      } catch {}
    } catch {}

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        message: `Apollo.io API returned HTTP ${response.status} - ${snippet}`,
        responseSnippet: snippet,
      };
    }

    const externalId = parsed?.contact?.id ? String(parsed.contact.id) : undefined;
    return {
      success: true,
      statusCode: response.status,
      externalId,
      message: `Contact synced to Apollo.io! (ID: ${externalId || 'Apollo'})`,
      responseSnippet: snippet,
    };
  }

  // 1. In-House Tool / Custom API Dispatcher
  private async sendToInHouse(
    lead: SocialDemandLead,
    inHouse: CrmConfig['in_house']
  ): Promise<{
    success: boolean;
    externalId?: string;
    message: string;
    statusCode?: number;
    responseSnippet?: string;
  }> {
    if (!inHouse.endpoint_url || !inHouse.endpoint_url.startsWith('http')) {
      throw new Error('In-House CRM Endpoint URL is not configured or invalid (must start with http:// or https://)');
    }

    const fm = inHouse.field_mapping || {};
    const p = extractLeadProperties(lead);

    // Construct mapped payload
    const payload: Record<string, any> = {
      [fm.name_field || 'name']: p.name,
      first_name: p.firstName,
      last_name: p.lastName,
      [fm.email_field || 'email']: p.email,
      [fm.company_field || 'company']: p.company,
      [fm.phone_field || 'phone']: p.phone,
      [fm.title_field || 'title']: lead.postTitle || p.specificNeed || '',
      [fm.source_field || 'source']: `LeadHook - ${lead.sourceChannel || 'Results'} (${(lead.platform || 'direct').toUpperCase()})`,
      [fm.intent_field || 'intent_score']: p.intentScore,
      [fm.urgency_field || 'urgency']: p.urgency,
      [fm.budget_field || 'budget']: p.budget,
      [fm.notes_field || 'notes']: p.content,
      [fm.url_field || 'post_url']: p.postUrl,
      direct_message_url: lead.contactPoints?.directMessageUrl || p.postUrl,
      service_category: lead.serviceCategory || 'B2B Lead',
      audience_type: lead.audienceType || 'B2B',
      ai_pitch: lead.aiDraftOutreach?.message || '',
      dispatched_at: new Date().toISOString(),
      raw_id: lead.id,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'LeadHook-CRM-DirectConnector/2.0',
      ...(inHouse.custom_headers || {}),
    };

    if (inHouse.auth_type === 'bearer' && inHouse.auth_token) {
      headers['Authorization'] = `Bearer ${inHouse.auth_token.trim()}`;
    } else if (inHouse.auth_type === 'api_key' && inHouse.api_key_value) {
      const headerName = inHouse.api_key_header || 'X-API-Key';
      headers[headerName] = inHouse.api_key_value.trim();
    }

    const abortCtrl = new AbortController();
    const timeout = setTimeout(() => abortCtrl.abort(), 12000);

    const response = await fetch(inHouse.endpoint_url, {
      method: inHouse.http_method || 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: abortCtrl.signal,
    });

    clearTimeout(timeout);
    let snippet = '';
    let parsed: any = null;
    try {
      const txt = await response.text();
      snippet = txt.slice(0, 300);
      try {
        parsed = JSON.parse(txt);
      } catch {}
    } catch {}

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        message: `In-House CRM returned HTTP ${response.status} ${response.statusText}`,
        responseSnippet: snippet,
      };
    }

    const externalId =
      parsed?.id ||
      parsed?.lead_id ||
      parsed?.insertId ||
      parsed?.data?.id ||
      parsed?._id;

    return {
      success: true,
      statusCode: response.status,
      externalId: externalId ? String(externalId) : undefined,
      message: `Lead successfully synced to In-House CRM! (HTTP ${response.status})`,
      responseSnippet: snippet,
    };
  }

  // 2. Salesforce CRM Dispatcher (REST API or Native Web-to-Lead)
  private async sendToSalesforce(
    lead: SocialDemandLead,
    sf: CrmConfig['salesforce']
  ): Promise<{
    success: boolean;
    externalId?: string;
    message: string;
    statusCode?: number;
    responseSnippet?: string;
  }> {
    const p = extractLeadProperties(lead);
    const rating = p.urgency === 'Immediate' ? 'Hot' : 'Warm';

    // Mode A: Salesforce Web-to-Lead (Standard native form post - zero OAuth token required)
    if (sf.mode === 'web_to_lead') {
      if (!sf.oid || sf.oid.trim().length < 8) {
        throw new Error('Salesforce Organization ID (OID) is required for Web-to-Lead mode. Found in SF Setup -> Company Information.');
      }

      const postUrl = sf.web_to_lead_url || 'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8';
      const formParams = new URLSearchParams();
      formParams.append('oid', sf.oid.trim());
      formParams.append('first_name', p.firstName);
      formParams.append('last_name', p.lastName);
      formParams.append('company', p.company);
      formParams.append('email', p.email);
      if (p.phone) formParams.append('phone', p.phone);
      formParams.append('lead_source', sf.lead_source || 'LeadHook Social Demand Radar');
      formParams.append('rating', rating);
      formParams.append('description', `[Intent Score: ${p.intentScore}%] ${lead.postTitle || ''}\n\nNeed: ${p.specificNeed}\nBudget: ${p.budget}\nPost: ${p.postUrl}\n\nSnippet:\n${p.content}`);

      const abortCtrl = new AbortController();
      const timeout = setTimeout(() => abortCtrl.abort(), 12000);

      const response = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'LeadHook-Salesforce-Connector/2.0',
        },
        body: formParams.toString(),
        signal: abortCtrl.signal,
      });

      clearTimeout(timeout);
      if (response.ok || response.status === 302 || response.status === 200) {
        return {
          success: true,
          statusCode: response.status,
          message: `Lead successfully submitted to Salesforce Web-to-Lead queue! (Org ID: ${sf.oid.trim()})`,
        };
      }

      return {
        success: false,
        statusCode: response.status,
        message: `Salesforce Web-to-Lead rejected with HTTP ${response.status}`,
      };
    }

    // Mode B: Salesforce REST API
    if (!sf.instance_url || !sf.access_token) {
      throw new Error('Salesforce REST API requires Instance URL (e.g., https://yourinstance.my.salesforce.com) and Access Token.');
    }

    const cleanInstanceUrl = sf.instance_url.replace(/\/+$/, '');
    const objectType = sf.lead_object || 'Lead';
    const restUrl = `${cleanInstanceUrl}/services/data/v58.0/sobjects/${objectType}`;

    const sfPayload: Record<string, any> = {
      FirstName: p.firstName,
      LastName: p.lastName,
      Company: p.company,
      Email: p.email,
      LeadSource: sf.lead_source || 'LeadHook Social Demand Radar',
      Rating: rating,
      Description: `Intent Score: ${p.intentScore}%\nUrgency: ${p.urgency}\nNeed: ${p.specificNeed}\nBudget: ${p.budget}\nSource URL: ${p.postUrl}\n\nContent:\n${p.content}`,
    };

    if (p.phone) sfPayload.Phone = p.phone;
    if (p.location) sfPayload.City = p.location;

    const abortCtrl = new AbortController();
    const timeout = setTimeout(() => abortCtrl.abort(), 12000);

    const response = await fetch(restUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sf.access_token.trim()}`,
      },
      body: JSON.stringify(sfPayload),
      signal: abortCtrl.signal,
    });

    clearTimeout(timeout);
    let snippet = '';
    let parsed: any = null;
    try {
      const txt = await response.text();
      snippet = txt.slice(0, 300);
      try {
        parsed = JSON.parse(txt);
      } catch {}
    } catch {}

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        message: `Salesforce REST API error: HTTP ${response.status} - ${snippet}`,
        responseSnippet: snippet,
      };
    }

    const externalId = parsed?.id || (Array.isArray(parsed) ? parsed[0]?.id : undefined);
    return {
      success: true,
      statusCode: response.status,
      externalId,
      message: `Lead created in Salesforce! (Record ID: ${externalId || 'SF-Lead'})`,
      responseSnippet: snippet,
    };
  }

  // 3. HubSpot CRM Dispatcher
  private async sendToHubSpot(
    lead: SocialDemandLead,
    hubspot: CrmConfig['hubspot']
  ): Promise<{
    success: boolean;
    externalId?: string;
    message: string;
    statusCode?: number;
    responseSnippet?: string;
  }> {
    if (!hubspot.access_token) {
      throw new Error('HubSpot Private App Access Token is required (format: pat-na1-...).');
    }

    const p = extractLeadProperties(lead);
    const email = p.email || `prospect_${Date.now()}@socialdemand.lead`;

    const hsPayload = {
      properties: {
        email,
        firstname: p.firstName,
        lastname: p.lastName,
        company: p.company,
        phone: p.phone,
        website: p.postUrl,
        lifecyclestage: hubspot.lifecycle_stage || 'lead',
        hs_lead_status: hubspot.lead_status || 'OPEN_DEAL',
        notes_last_contacted: `Intent Score: ${p.intentScore}% | Category: ${lead.serviceCategory || 'Lead'}`,
      },
    };

    const abortCtrl = new AbortController();
    const timeout = setTimeout(() => abortCtrl.abort(), 12000);

    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hubspot.access_token.trim()}`,
      },
      body: JSON.stringify(hsPayload),
      signal: abortCtrl.signal,
    });

    clearTimeout(timeout);
    let snippet = '';
    let parsed: any = null;
    try {
      const txt = await response.text();
      snippet = txt.slice(0, 300);
      try {
        parsed = JSON.parse(txt);
      } catch {}
    } catch {}

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        message: `HubSpot API returned HTTP ${response.status} - ${snippet}`,
        responseSnippet: snippet,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      externalId: parsed?.id ? String(parsed.id) : undefined,
      message: `Contact created in HubSpot CRM! (ID: ${parsed?.id || 'HubSpot'})`,
      responseSnippet: snippet,
    };
  }

  // 4. Pipedrive CRM Dispatcher
  private async sendToPipedrive(
    lead: SocialDemandLead,
    pipedrive: CrmConfig['pipedrive']
  ): Promise<{
    success: boolean;
    externalId?: string;
    message: string;
    statusCode?: number;
    responseSnippet?: string;
  }> {
    if (!pipedrive.api_token || !pipedrive.company_domain) {
      throw new Error('Pipedrive requires API Token and Company Domain.');
    }

    const domain = pipedrive.company_domain.replace(/\.pipedrive\.com.*$/, '');
    const url = `https://${domain}.pipedrive.com/api/v1/persons?api_token=${pipedrive.api_token.trim()}`;

    const p = extractLeadProperties(lead);

    const payload = {
      name: p.name,
      email: p.email ? [{ value: p.email, primary: true }] : undefined,
      phone: p.phone ? [{ value: p.phone, primary: true }] : undefined,
      org_name: p.company,
    };

    const abortCtrl = new AbortController();
    const timeout = setTimeout(() => abortCtrl.abort(), 12000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortCtrl.signal,
    });

    clearTimeout(timeout);
    let snippet = '';
    let parsed: any = null;
    try {
      const txt = await response.text();
      snippet = txt.slice(0, 300);
      try {
        parsed = JSON.parse(txt);
      } catch {}
    } catch {}

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        message: `Pipedrive API error: HTTP ${response.status} - ${snippet}`,
        responseSnippet: snippet,
      };
    }

    const externalId = parsed?.data?.id ? String(parsed.data.id) : undefined;
    return {
      success: true,
      statusCode: response.status,
      externalId,
      message: `Lead person created in Pipedrive! (ID: ${externalId || 'Pipedrive'})`,
      responseSnippet: snippet,
    };
  }
}

export const globalCrmService = new CrmService();
