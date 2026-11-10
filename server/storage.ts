import fs from 'fs';
import path from 'path';
import { ScrapeSettings, HistoryItem, ScrapeJob, AiCredential, RoutingStrategy, ResearchConfig } from '../src/types';
import { globalAiRouter } from './ai/router';
import { PROVIDER_DEFINITIONS } from './ai/providers';
import { globalProxyPool, DEFAULT_PROXY_CONFIG } from './network/proxyPool';
import { globalAntiBotEngine, DEFAULT_ANTI_BOT_CONFIG } from './network/antiBot';
import { globalContentPruner, DEFAULT_PRUNING_CONFIG } from './ai/contentPruner';
import { DEFAULT_ICP_CONFIG } from './enrichment/icpScorer';
import {
  DEFAULT_CREDIT_SETTINGS,
  DEFAULT_VERIFIER_API_CONFIG,
  DEFAULT_BUSINESS_VERIFIER_RULES,
  DEFAULT_GOVFILES_CONFIG,
} from './verifier/defaults';
import { globalSqlStorage } from './db/sqlStorage';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');

// Ensure directories exist
function ensureDirs() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(JOBS_DIR)) {
      fs.mkdirSync(JOBS_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create data directories on disk, using memory fallback:', err);
  }
}

export const DEFAULT_PRIORITY_ROLES = [
  'Owner',
  'Co-Owner',
  'Founder',
  'Co-Founder',
  'CEO',
  'Chief Executive Officer',
  'President',
  'Managing Partner',
  'Senior Partner',
  'Equity Partner',
  'Partner',
  'Principal',
  'Managing Director',
  'Executive Director',
  'General Counsel',
  'Managing Attorney',
  'Attorney',
  'Lawyer',
  'Director',
  'General Manager',
  'Operations Manager',
  'Finance Manager',
  'Vice President',
  'Head of Operations',
  'Business Development Manager'
];

export const DEFAULT_GENERIC_PATTERNS = [
  'info@',
  'contact@',
  'hello@',
  'admin@',
  'support@',
  'sales@',
  'marketing@',
  'office@',
  'enquiries@',
  'inquiries@',
  'billing@',
  'accounts@',
  'press@',
  'help@',
  'team@',
  'hr@'
];

export const DEFAULT_AI_RULES = `Extract only publicly available business contact information from the supplied website content.

Prioritize decision makers and senior business contacts.

Never guess names, roles, emails or phone numbers.

Never create an email address from a person's name.

Only associate an email with a person when the website explicitly connects them or the page structure clearly associates them.

Keep generic company emails separate.

Always return the source URL.

Do not create duplicate contacts.`;

export function generateDefaultCredentials(existingGeminiKey?: string): AiCredential[] {
  const geminiKey = existingGeminiKey || process.env.GEMINI_API_KEY || '';
  const hasGemini = Boolean(geminiKey && geminiKey.trim().length > 5);

  const creds: AiCredential[] = [
    // 1. Google Gemini (Global)
    {
      id: 'cred-gemini-1',
      provider: 'gemini',
      name: 'Google Gemini Flash Lite (Default)',
      apiKey: geminiKey,
      model: 'gemini-3.1-flash-lite',
      baseUrl: 'https://generativelanguage.googleapis.com',
      priority: 1,
      enabled: hasGemini,
      status: hasGemini ? 'active' : 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
    // 2. Alibaba Qwen (Chinese)
    {
      id: 'cred-qwen-1',
      provider: 'qwen',
      name: 'Alibaba Qwen (Singapore)',
      apiKey: '',
      model: 'qwen-plus',
      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      region: 'ap-southeast-1',
      priority: 2,
      enabled: false,
      status: 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
    // 3. DeepSeek (Chinese)
    {
      id: 'cred-deepseek-1',
      provider: 'deepseek',
      name: 'DeepSeek Chat',
      apiKey: '',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
      priority: 3,
      enabled: false,
      status: 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
    // 4. Moonshot Kimi (Chinese)
    {
      id: 'cred-kimi-1',
      provider: 'kimi',
      name: 'Moonshot Kimi V1',
      apiKey: '',
      model: 'moonshot-v1-8k',
      baseUrl: 'https://api.moonshot.cn/v1',
      priority: 4,
      enabled: false,
      status: 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
    // 5. Zhipu GLM (Chinese)
    {
      id: 'cred-glm-1',
      provider: 'glm',
      name: 'Zhipu GLM-4 Flash (Free)',
      apiKey: '',
      model: 'glm-4-flash',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      priority: 5,
      enabled: false,
      status: 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
    // 6. MiniMax (Chinese)
    {
      id: 'cred-minimax-1',
      provider: 'minimax',
      name: 'MiniMax abab 6.5s',
      apiKey: '',
      model: 'abab6.5s-chat',
      baseUrl: 'https://api.minimax.chat/v1',
      priority: 6,
      enabled: false,
      status: 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
    // 7. OpenAI (Global)
    {
      id: 'cred-openai-1',
      provider: 'openai',
      name: 'OpenAI GPT-4o Mini',
      apiKey: '',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      priority: 7,
      enabled: false,
      status: 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
    // 8. Anthropic Claude (Global)
    {
      id: 'cred-claude-1',
      provider: 'claude',
      name: 'Anthropic Claude 3.5 Haiku',
      apiKey: '',
      model: 'claude-3-5-haiku-20241022',
      baseUrl: 'https://api.anthropic.com/v1',
      priority: 8,
      enabled: false,
      status: 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    },
  ];

  return creds;
}

export const DEFAULT_RESEARCH_CONFIG: ResearchConfig = {
  openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
  has_openrouter_key: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.length > 5),
  model: 'meta-llama/llama-3.3-70b-instruct',
  search_provider: 'auto',
  enabled: true,
  max_search_results: 15,
  cache_ttl_hours: 24,
};

export const DEFAULT_SETTINGS: ScrapeSettings = {
  gemini_api_key: '',
  has_key: false,
  ai_providers: generateDefaultCredentials(),
  routing_strategy: 'auto',
  max_pages: 30,
  max_contacts: 10,
  smart_discovery: true,
  concurrency: 3,
  request_delay_ms: 1000,
  timeout_ms: 15000,
  retry_count: 2,
  priority_roles: DEFAULT_PRIORITY_ROLES,
  generic_email_patterns: DEFAULT_GENERIC_PATTERNS,
  ai_agent_rules: DEFAULT_AI_RULES,
  theme: 'dark',
  proxy_config: DEFAULT_PROXY_CONFIG,
  anti_bot_config: DEFAULT_ANTI_BOT_CONFIG,
  pruning_config: DEFAULT_PRUNING_CONFIG,
  icp_config: DEFAULT_ICP_CONFIG,
  verification_credit_settings: DEFAULT_CREDIT_SETTINGS,
  verification_api_config: DEFAULT_VERIFIER_API_CONFIG,
  business_verifier_rules: DEFAULT_BUSINESS_VERIFIER_RULES,
  govfiles_config: DEFAULT_GOVFILES_CONFIG,
  research_config: DEFAULT_RESEARCH_CONFIG,
  suppressed_domains: [],
  suppressed_emails: [],
  outbound_webhook: {
    enabled: false,
    url: '',
    secret_header: '',
    filter_mode: 'all_leads',
  },
};

let memorySettings: ScrapeSettings = { ...DEFAULT_SETTINGS };
let memoryHistory: HistoryItem[] = [];
let memoryJobs: Map<string, ScrapeJob> = new Map();

// Initialize the global router & engines
export function syncRouterWithSettings(settings: ScrapeSettings): void {
  if (settings.ai_providers && settings.ai_providers.length > 0) {
    globalAiRouter.setCredentials(settings.ai_providers);
  }
  if (settings.routing_strategy) {
    globalAiRouter.setStrategy(settings.routing_strategy);
  }
  if (settings.proxy_config) {
    globalProxyPool.updateConfig(settings.proxy_config);
  }
  if (settings.anti_bot_config) {
    globalAntiBotEngine.updateConfig(settings.anti_bot_config);
  }
  if (settings.pruning_config) {
    globalContentPruner.updateConfig(settings.pruning_config);
  }
}

export function getSettings(): ScrapeSettings {
  ensureDirs();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      const apiKey = data.gemini_api_key || process.env.GEMINI_API_KEY || '';

      let providers = Array.isArray(data.ai_providers) && data.ai_providers.length > 0
        ? data.ai_providers
        : generateDefaultCredentials(apiKey);

      // Make sure Gemini provider has key if gemini_api_key is set
      if (apiKey && apiKey.length > 5) {
        const geminiCred = providers.find((p: AiCredential) => p.provider === 'gemini');
        if (geminiCred && !geminiCred.apiKey) {
          geminiCred.apiKey = apiKey;
          geminiCred.enabled = true;
          geminiCred.status = 'active';
        }
      }

      let loadedOpenRouterKey = (data.research_config?.openrouter_api_key || process.env.OPENROUTER_API_KEY || '').trim();
      if (loadedOpenRouterKey && !loadedOpenRouterKey.startsWith('sk-or-') && /^[0-9a-fA-F]{64}$/.test(loadedOpenRouterKey)) {
        loadedOpenRouterKey = `sk-or-v1-${loadedOpenRouterKey}`;
      }
      const researchConfig: ResearchConfig = {
        ...DEFAULT_RESEARCH_CONFIG,
        ...(data.research_config || {}),
        openrouter_api_key: loadedOpenRouterKey,
      };
      researchConfig.has_openrouter_key = Boolean(researchConfig.openrouter_api_key && researchConfig.openrouter_api_key.length > 5);

      const settings: ScrapeSettings = {
        ...DEFAULT_SETTINGS,
        ...data,
        gemini_api_key: apiKey,
        has_key: Boolean(apiKey && apiKey.trim().length > 5) || providers.some((p: AiCredential) => p.enabled && p.apiKey),
        ai_providers: providers,
        routing_strategy: data.routing_strategy || 'auto',
        research_config: researchConfig,
      };

      syncRouterWithSettings(settings);
      return settings;
    }
  } catch (err) {
    console.error('Error reading settings file:', err);
  }

  const envKey = process.env.GEMINI_API_KEY || '';
  const providers = generateDefaultCredentials(envKey);
  const settings: ScrapeSettings = {
    ...memorySettings,
    gemini_api_key: envKey,
    has_key: Boolean(envKey && envKey.trim().length > 5),
    ai_providers: providers,
    routing_strategy: 'auto',
  };

  syncRouterWithSettings(settings);
  return settings;
}

export function saveSettings(newSettings: Partial<ScrapeSettings>): ScrapeSettings {
  ensureDirs();
  const current = getSettings();
  const updated: ScrapeSettings = {
    ...current,
    ...newSettings,
  };

  // Sync Gemini key if modified
  if (newSettings.gemini_api_key !== undefined) {
    updated.gemini_api_key = newSettings.gemini_api_key.trim();
    // Also update Gemini credential if present
    if (updated.ai_providers) {
      const geminiCred = updated.ai_providers.find((p) => p.provider === 'gemini');
      if (geminiCred) {
        geminiCred.apiKey = updated.gemini_api_key;
        if (updated.gemini_api_key.length > 5) {
          geminiCred.enabled = true;
          geminiCred.status = 'active';
        }
      }
    }
  }

  // Sync research_config if modified, preserving real OpenRouter key if masked
  if (newSettings.research_config) {
    const existingResearch = current.research_config || DEFAULT_RESEARCH_CONFIG;
    let submittedKey = newSettings.research_config.openrouter_api_key;
    if (!submittedKey || submittedKey.includes('••••')) {
      submittedKey = existingResearch.openrouter_api_key || process.env.OPENROUTER_API_KEY || '';
    }
    let cleanKey = (submittedKey || '').trim();
    if (cleanKey && !cleanKey.startsWith('sk-or-') && /^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      cleanKey = `sk-or-v1-${cleanKey}`;
    }
    updated.research_config = {
      ...DEFAULT_RESEARCH_CONFIG,
      ...existingResearch,
      ...newSettings.research_config,
      openrouter_api_key: cleanKey,
      has_openrouter_key: Boolean(cleanKey && cleanKey.length > 5),
    };
  }

  // Check if any provider has an active key
  const hasActiveKey =
    Boolean(updated.gemini_api_key && updated.gemini_api_key.length > 5) ||
    Boolean(updated.ai_providers?.some((p) => p.enabled && p.apiKey && p.apiKey.trim().length > 5));
  updated.has_key = hasActiveKey;

  memorySettings = { ...updated };
  syncRouterWithSettings(updated);

  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings to file:', err);
  }

  return updated;
}

export function getHistory(): HistoryItem[] {
  ensureDirs();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading history:', err);
  }
  return memoryHistory;
}

export function saveHistoryItem(item: HistoryItem, job?: ScrapeJob): void {
  ensureDirs();
  try {
    const history = getHistory();
    const filtered = history.filter((h) => h.id !== item.id);
    const updated = [item, ...filtered].slice(0, 50); // Keep last 50
    memoryHistory = updated;
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(updated, null, 2), 'utf-8');

    if (job) {
      memoryJobs.set(job.id, job);
      const jobFile = path.join(JOBS_DIR, `${job.id}.json`);
      fs.writeFileSync(jobFile, JSON.stringify(job, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error saving history item:', err);
  }
}

export function getJobById(id: string): ScrapeJob | null {
  ensureDirs();
  if (memoryJobs.has(id)) {
    return memoryJobs.get(id)!;
  }
  try {
    const jobFile = path.join(JOBS_DIR, `${id}.json`);
    if (fs.existsSync(jobFile)) {
      const job = JSON.parse(fs.readFileSync(jobFile, 'utf-8'));
      memoryJobs.set(id, job);
      return job;
    }
  } catch (err) {
    console.error('Error reading job file:', err);
  }
  return null;
}

export function deleteHistoryItem(id: string): boolean {
  ensureDirs();
  try {
    const history = getHistory();
    const updated = history.filter((h) => h.id !== id);
    memoryHistory = updated;
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(updated, null, 2), 'utf-8');

    memoryJobs.delete(id);
    const jobFile = path.join(JOBS_DIR, `${id}.json`);
    if (fs.existsSync(jobFile)) {
      fs.unlinkSync(jobFile);
    }
    return true;
  } catch (err) {
    console.error('Error deleting history item:', err);
    return false;
  }
}

export function saveJob(job: ScrapeJob): void {
  ensureDirs();
  try {
    memoryJobs.set(job.id, job);
    const jobFile = path.join(JOBS_DIR, `${job.id}.json`);
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2), 'utf-8');

    const history = getHistory();
    const existing = history.find((h) => h.id === job.id);
    if (existing) {
      existing.contacts_found = job.contacts.length;
      existing.completed_websites = job.websites.filter((w) => w.status === 'Completed').length;
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    }

    // Sync to SQLite and Cloud Files Storage if contacts exist
    if (job.contacts && job.contacts.length > 0) {
      try {
        globalSqlStorage.storeDataset({
          id: `file_crawl_${job.id}`,
          tool: 'Website Scraper',
          search_name: job.websites?.[0]?.url ? `${job.websites[0].url} (+${Math.max(0, job.websites.length - 1)} sites)` : 'Website Contact Crawl',
          created_at: job.created_at || new Date().toISOString(),
          records: job.contacts,
          tags: ['Website Scraper', 'Direct Contacts', `${job.contacts.length} Contacts`],
        });
      } catch {}
    }
  } catch (err) {
    console.error('Error saving job:', err);
  }
}

export const storage = {
  getSettings,
  saveSettings,
  getHistory,
  saveHistoryItem,
  getJobById,
  deleteHistoryItem,
  saveJob,
};


