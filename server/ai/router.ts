import {
  AiCredential,
  ExtractionTaskMetadata,
  FailoverEvent,
  ProviderType,
  RoutingStrategy,
  StandardErrorCode,
} from './types';
import { executeAiExtraction, ExecuteExtractionOptions } from './adapter';
import { PROVIDER_DEFINITIONS } from './providers';
import { NormalizedResult } from './jsonNormalizer';

export interface ExtractionRequest {
  companyName: string;
  sourceUrl: string;
  pageContents: { url: string; title: string; text: string }[];
  maxContacts?: number;
  priorityRoles?: string[];
  customRules?: string;
  strictIcpConfig?: any;
}

export interface ExtractionResponse {
  result: NormalizedResult;
  metadata: ExtractionTaskMetadata;
}

export class AIRouter {
  private credentials: AiCredential[] = [];
  private strategy: RoutingStrategy = 'auto';
  private failoverLogs: FailoverEvent[] = [];
  private maxLogs = 200;

  constructor(initialCredentials?: AiCredential[], initialStrategy?: RoutingStrategy) {
    if (initialCredentials && initialCredentials.length > 0) {
      this.credentials = initialCredentials;
    }
    if (initialStrategy) {
      this.strategy = initialStrategy;
    }
  }

  public getCredentials(): AiCredential[] {
    // Refresh cooldown statuses if expired
    const now = Date.now();
    for (const cred of this.credentials) {
      if (cred.status === 'cooldown' && cred.cooldownUntil && cred.cooldownUntil <= now) {
        cred.status = 'active';
        cred.cooldownUntil = undefined;
      }
    }
    return this.credentials;
  }

  public setCredentials(credentials: AiCredential[]): void {
    this.credentials = credentials;
  }

  public getStrategy(): RoutingStrategy {
    return this.strategy;
  }

  public setStrategy(strategy: RoutingStrategy): void {
    this.strategy = strategy;
    this.logEvent('info', 'AI Router', `Routing strategy updated to "${strategy}"`);
  }

  public getFailoverLogs(): FailoverEvent[] {
    return this.failoverLogs;
  }

  public clearLogs(): void {
    this.failoverLogs = [];
  }

  public resetMetrics(): void {
    for (const cred of this.credentials) {
      cred.status = cred.enabled ? 'active' : 'disabled';
      cred.cooldownUntil = undefined;
      cred.metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      };
    }
    this.logEvent('info', 'AI Router', 'Reset all credential metrics and cooldown timers');
  }

  /**
   * Main router extraction orchestrator with transparent failover
   */
  public async extractContacts(request: ExtractionRequest): Promise<ExtractionResponse> {
    const candidates = this.selectOrderedCandidates();

    if (candidates.length === 0) {
      this.logEvent(
        'warning',
        'AI Router',
        `No active AI credentials available for ${request.companyName || request.sourceUrl}. Check AI Control Center.`,
        undefined,
        undefined,
        request.sourceUrl
      );
      // Return empty valid fallback result so crawler does not crash
      return {
        result: {
          company_name: request.companyName,
          contacts: [],
          isValid: true,
          error: 'No active AI providers configured or available',
        },
        metadata: {
          provider: 'custom_openai',
          providerName: 'None Configured',
          model: 'none',
          attempts: 0,
          latencyMs: 0,
          timestamp: new Date().toISOString(),
          status: 'failed',
          errorCodes: ['AUTH'],
        },
      };
    }

    let attempts = 0;
    const errorCodes: StandardErrorCode[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const cred = candidates[i];
      attempts++;
      const providerName = PROVIDER_DEFINITIONS[cred.provider]?.name || cred.provider;

      this.logEvent(
        'info',
        providerName,
        `Task attempt ${attempts}: Selected ${cred.name} (${cred.model}) for ${request.companyName || request.sourceUrl}`,
        cred.model,
        cred.id,
        request.sourceUrl
      );

      // Execute through adapter
      cred.metrics.totalRequests++;
      const execResult = await executeAiExtraction({
        credential: cred,
        companyName: request.companyName,
        sourceUrl: request.sourceUrl,
        pageContents: request.pageContents,
        maxContacts: request.maxContacts,
        priorityRoles: request.priorityRoles,
        customRules: request.customRules,
        strictIcpConfig: request.strictIcpConfig,
      });

      if (execResult.success && execResult.result) {
        // Success
        cred.metrics.successfulRequests++;
        cred.metrics.totalLatencyMs += execResult.latencyMs;
        cred.metrics.averageLatencyMs = Math.round(
          cred.metrics.totalLatencyMs / cred.metrics.successfulRequests
        );
        cred.metrics.lastUsed = new Date().toISOString();
        cred.status = 'active';

        const isFallback = attempts > 1;
        this.logEvent(
          'success',
          providerName,
          `${isFallback ? '[FAILOVER RECOVERY] ' : ''}Extraction successful via ${cred.name} in ${execResult.latencyMs}ms (${execResult.result.contacts.length} contacts extracted)`,
          cred.model,
          cred.id,
          request.sourceUrl
        );

        return {
          result: execResult.result,
          metadata: {
            provider: cred.provider,
            providerName,
            model: cred.model,
            attempts,
            latencyMs: execResult.latencyMs,
            timestamp: new Date().toISOString(),
            status: isFallback ? 'fallback_success' : 'success',
            errorCodes: errorCodes.length > 0 ? errorCodes : undefined,
          },
        };
      }

      // Handle Failure
      cred.metrics.failedRequests++;
      const err = execResult.error;
      const errorCode = (err?.code as StandardErrorCode) || 'UNKNOWN';
      errorCodes.push(errorCode);

      cred.lastError = {
        code: errorCode,
        message: err?.message || 'Unknown failure',
        timestamp: new Date().toISOString(),
      };

      // Status updates based on classified error
      if (errorCode === 'RATE_LIMIT') {
        cred.metrics.rateLimits429++;
        cred.status = 'cooldown';
        const cdSec = err?.classified?.cooldownSeconds || 60;
        cred.cooldownUntil = Date.now() + cdSec * 1000;
        this.logEvent(
          'warning',
          providerName,
          `Rate limit (429) encountered on ${cred.name}. Placed in cooldown for ${cdSec}s. Failover initiated.`,
          cred.model,
          cred.id,
          request.sourceUrl
        );
      } else if (errorCode === 'QUOTA') {
        cred.metrics.quotaErrors++;
        cred.status = 'quota_exhausted';
        cred.cooldownUntil = Date.now() + 3600 * 1000; // 1 hr
        this.logEvent(
          'error',
          providerName,
          `Quota/Credit exhausted on ${cred.name}. Deactivating for this batch. Failover initiated.`,
          cred.model,
          cred.id,
          request.sourceUrl
        );
      } else if (errorCode === 'AUTH') {
        cred.status = 'auth_error';
        cred.enabled = false;
        this.logEvent(
          'error',
          providerName,
          `Authentication failed (401/403) on ${cred.name}. Credential disabled.`,
          cred.model,
          cred.id,
          request.sourceUrl
        );
      } else if (errorCode === 'INVALID_MODEL') {
        cred.status = 'invalid_model';
        this.logEvent(
          'error',
          providerName,
          `Model ${cred.model} not available on ${cred.name}. Failover initiated.`,
          cred.model,
          cred.id,
          request.sourceUrl
        );
      } else {
        this.logEvent(
          'warning',
          providerName,
          `Error on ${cred.name} (${errorCode}: ${err?.message || 'failed'}). Failing over to next provider.`,
          cred.model,
          cred.id,
          request.sourceUrl
        );
      }

      // Continue loop to next candidate
    }

    // All available credentials failed
    this.logEvent(
      'error',
      'AI Router',
      `All ${attempts} AI provider candidates failed for ${request.companyName || request.sourceUrl}.`,
      undefined,
      undefined,
      request.sourceUrl
    );

    return {
      result: {
        company_name: request.companyName,
        contacts: [],
        isValid: false,
        error: `All AI extraction attempts failed (${errorCodes.join(', ')})`,
      },
      metadata: {
        provider: candidates[0]?.provider || 'custom_openai',
        providerName: 'All Providers Failed',
        model: 'failed',
        attempts,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        status: 'failed',
        errorCodes,
      },
    };
  }

  /**
   * Sort and filter candidates according to active strategy and health
   */
  private selectOrderedCandidates(): AiCredential[] {
    const now = Date.now();

    // 1. Filter enabled and not in active cooldown/auth_error
    const eligible = this.credentials.filter((c) => {
      if (!c.enabled) return false;
      if (c.status === 'auth_error' || c.status === 'invalid_model') return false;
      if (c.status === 'cooldown' && c.cooldownUntil && c.cooldownUntil > now) {
        return false;
      }
      if (c.status === 'quota_exhausted' && c.cooldownUntil && c.cooldownUntil > now) {
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      // If all are in cooldown, pick the one whose cooldown expires earliest as a recovery attempt
      const cooldownCandidates = this.credentials
        .filter((c) => c.enabled && c.status === 'cooldown')
        .sort((a, b) => (a.cooldownUntil || 0) - (b.cooldownUntil || 0));
      return cooldownCandidates.slice(0, 1);
    }

    // 2. Sort by strategy
    const sorted = [...eligible];

    switch (this.strategy) {
      case 'manual':
        // Strict priority asc (1, 2, 3...)
        sorted.sort((a, b) => a.priority - b.priority);
        break;

      case 'fastest':
        // Lowest average latency (with fallback to priority)
        sorted.sort((a, b) => {
          const latA = a.metrics.averageLatencyMs || 9999;
          const latB = b.metrics.averageLatencyMs || 9999;
          return latA - latB || a.priority - b.priority;
        });
        break;

      case 'free_first':
      case 'low_cost_first':
        // Prefer models known to be free/low-cost
        sorted.sort((a, b) => {
          const isLowCostA = isModelLowCost(a.model);
          const isLowCostB = isModelLowCost(b.model);
          if (isLowCostA && !isLowCostB) return -1;
          if (!isLowCostA && isLowCostB) return 1;
          return a.priority - b.priority;
        });
        break;

      case 'highest_quality':
        // Prefer flagship models
        sorted.sort((a, b) => {
          const isFlagshipA = isModelFlagship(a.model);
          const isFlagshipB = isModelFlagship(b.model);
          if (isFlagshipA && !isFlagshipB) return -1;
          if (!isFlagshipA && isFlagshipB) return 1;
          return a.priority - b.priority;
        });
        break;

      case 'auto':
      default:
        // Dynamic health weighting: prioritize high success rate, lowest error count, and priority
        sorted.sort((a, b) => {
          const rateLimitDiff = a.metrics.rateLimits429 - b.metrics.rateLimits429;
          if (rateLimitDiff !== 0) return rateLimitDiff;
          return a.priority - b.priority;
        });
        break;
    }

    return sorted;
  }

  private logEvent(
    level: 'info' | 'success' | 'warning' | 'error',
    provider: string,
    message: string,
    model?: string,
    credentialId?: string,
    companyUrl?: string
  ): void {
    const d = new Date();
    const timeStr = d.toTimeString().split(' ')[0];
    const event: FailoverEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: d.toISOString(),
      timeStr,
      level,
      provider,
      model,
      credentialId,
      message,
      companyUrl,
    };

    this.failoverLogs.unshift(event);
    if (this.failoverLogs.length > this.maxLogs) {
      this.failoverLogs.pop();
    }
  }
}

function isModelLowCost(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes('flash') ||
    m.includes('turbo') ||
    m.includes('mini') ||
    m.includes('deepseek-chat') ||
    m.includes('glm-4-flash') ||
    m.includes('haiku') ||
    m.includes('8k')
  );
}

function isModelFlagship(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes('max') ||
    m.includes('plus') ||
    m.includes('pro') ||
    m.includes('sonnet') ||
    m.includes('deepseek-reasoner') ||
    m.includes('gpt-4o') ||
    m.includes('72b')
  );
}

// Global Singleton Router Instance
export const globalAiRouter = new AIRouter();
