import { GoogleGenAI } from '@google/genai';
import { getSettings } from '../storage';
import { globalNvidiaClient } from './nvidia/nvidiaClient';
import { DiscoveryJob } from '../discovery/types';
import { ActivityLog } from '../../src/types';

export interface AiRetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  providerName?: 'gemini' | 'nvidia' | 'auto';
  job?: DiscoveryJob;
  taskLabel?: string;
  onRetry?: (attempt: number, maxRetries: number, delayMs: number, reason: string) => void;
}

export class AiResilienceService {
  private static instance: AiResilienceService;

  public static getInstance(): AiResilienceService {
    if (!AiResilienceService.instance) {
      AiResilienceService.instance = new AiResilienceService();
    }
    return AiResilienceService.instance;
  }

  /**
   * Determine if an error is a rate limit (HTTP 429 / RESOURCE_EXHAUSTED)
   */
  public isRateLimit(err: any): boolean {
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
      msg.includes('too many requests') ||
      msg.includes('exceeded your current quota')
    );
  }

  /**
   * Determine if an error is a timeout
   */
  public isTimeout(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || '').toLowerCase();
    return (
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ESOCKETTIMEDOUT' ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('deadline exceeded')
    );
  }

  /**
   * Determine if an error is a transient server error (5xx / network disconnect)
   */
  public isTransient(err: any): boolean {
    if (!err) return false;
    const status = err.status || err.statusCode;
    const msg = String(err.message || '').toLowerCase();

    return (
      (typeof status === 'number' && status >= 500 && status < 600) ||
      err.code === 'ECONNRESET' ||
      err.code === 'EAI_AGAIN' ||
      err.code === 'ENOTFOUND' ||
      msg.includes('service unavailable') ||
      msg.includes('bad gateway') ||
      msg.includes('server error') ||
      msg.includes('demand') ||
      msg.includes('spikes in demand') ||
      msg.includes('unavailable')
    );
  }

  /**
   * Parse recommended wait time from error message or header
   */
  public extractRetryAfterMs(err: any, defaultMs: number): number {
    try {
      const msg = String(err?.message || '');
      // E.g. "Please retry after 8 seconds" or "retry-after: 5"
      const matchSeconds = msg.match(/retry(?:-after|\s+after)\s*:?\s*(\d+)\s*(?:s|seconds)?/i);
      if (matchSeconds && matchSeconds[1]) {
        const sec = parseInt(matchSeconds[1], 10);
        if (sec > 0 && sec <= 60) return sec * 1000;
      }
    } catch {}
    return defaultMs;
  }

  /**
   * Executes an asynchronous operation with adaptive exponential backoff, jitter,
   * rate limit handling, and strict timeouts.
   */
  public async executeWithRetry<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: AiRetryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 4;
    const timeoutMs = options.timeoutMs ?? 30000;
    const baseDelayMs = options.baseDelayMs ?? 2500;
    const maxDelayMs = options.maxDelayMs ?? 20000;
    const taskLabel = options.taskLabel || 'AI Discovery Operation';

    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new Error(`Timeout: ${taskLabel} exceeded ${timeoutMs}ms limit.`));
      }, timeoutMs);

      try {
        const result = await operation(controller.signal);
        clearTimeout(timeoutId);
        return result;
      } catch (err: any) {
        clearTimeout(timeoutId);

        const isRateLimited = this.isRateLimit(err);
        const isTimedOut = this.isTimeout(err);
        const isTransientErr = this.isTransient(err);
        const rawMsg = String(err?.message || '');
        const isDailyQuota =
          rawMsg.includes('GenerateRequestsPerDay') ||
          rawMsg.includes('free_tier_requests') ||
          rawMsg.includes('exceeded your current quota');

        const isRetryable = (!isDailyQuota && isRateLimited) || isTimedOut || isTransientErr;

        if (!isRetryable || attempt > maxRetries) {
          throw err;
        }

        // Compute intelligent backoff delay
        let delayMs = baseDelayMs * Math.pow(2, attempt - 1);

        // For rate limits, apply a minimum 5-second backoff
        if (isRateLimited) {
          delayMs = Math.max(delayMs, 5000);
          delayMs = this.extractRetryAfterMs(err, delayMs);
        }

        // Full jitter (0 - 1500ms) to avoid thundering herd problem
        const jitter = Math.floor(Math.random() * 1500);
        delayMs = Math.min(maxDelayMs, delayMs + jitter);

        const reason = isRateLimited
          ? 'Rate limit / Quota throttle'
          : isTimedOut
          ? 'Request timeout'
          : 'Transient server error';

        // Inform calling job if provided
        if (options.job) {
          this.notifyJob(
            options.job,
            `${taskLabel}: ${reason}. Auto-retrying in ${(delayMs / 1000).toFixed(1)}s (Attempt ${attempt}/${maxRetries})...`,
            'warning'
          );
        }

        if (options.onRetry) {
          options.onRetry(attempt, maxRetries, delayMs, reason);
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error(`${taskLabel} failed after ${maxRetries} retry attempts.`);
  }

  /**
   * Safe Gemini Content Generation with automatic fallback between flash-lite and flash models,
   * plus full rate limit & timeout resilience.
   */
  public async generateWithGemini(
    params: {
      prompt: string;
      systemInstruction?: string;
      preferredModel?: 'gemini-3.1-flash-lite' | 'gemini-3.8-flash';
      responseMimeType?: string;
      responseSchema?: any;
      temperature?: number;
      tools?: any[];
      job?: DiscoveryJob;
      taskLabel?: string;
    }
  ): Promise<string> {
    const settings = getSettings();
    const apiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-discovery',
        },
      },
    });

    // Multi-Model Fallback Ladder:
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    // Helper to attempt model execution with timeout signal
    const callModel = async (model: string, signal: AbortSignal, toolsList?: any[]) => {
      const config: any = {
        temperature: params.temperature ?? 0.3,
      };

      if (params.systemInstruction) {
        config.systemInstruction = params.systemInstruction;
      }
      if (params.responseMimeType) {
        config.responseMimeType = params.responseMimeType;
      }
      if (params.responseSchema) {
        config.responseSchema = params.responseSchema;
      }
      if (toolsList && toolsList.length > 0) {
        config.tools = toolsList;
      }

      const res = await ai.models.generateContent({
        model,
        contents: params.prompt,
        config,
      });

      return res.text || '';
    };

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      try {
        const text = await this.executeWithRetry(
          (signal) => callModel(model, signal, params.tools),
          {
            maxRetries: 1,
            timeoutMs: 25000,
            baseDelayMs: 1500,
            job: params.job,
            taskLabel: `${params.taskLabel || 'Gemini Query'} [${model}]`,
          }
        );
        if (text && text.trim().length > 0) {
          return text;
        }
      } catch {
        // Escalate silently to next candidate model
      }
    }

    return '';
  }

  /**
   * Dual Provider AI Execution:
   * Uses Gemini as the high-speed primary engine, and seamlessly falls back to Nvidia NIM
   * only if Gemini encounters quota limits and Nvidia is explicitly configured and healthy.
   */
  public async extractWithDualProvider<T = any>(
    params: {
      text: string;
      schemaDescription: string;
      systemPrompt?: string;
      exampleJson?: string;
      job?: DiscoveryJob;
      taskLabel?: string;
    }
  ): Promise<T | null> {
    const taskLabel = params.taskLabel || 'AI Prospect Extraction';

    // 1. Primary: High-speed Google Gemini
    try {
      const prompt = `Extract structured data based on this schema:
${params.schemaDescription}
${params.exampleJson ? `Example JSON format:\n${params.exampleJson}` : ''}

Source Content:
"""
${params.text.slice(0, 12000)}
"""

Return strict valid JSON only.`;

      const geminiText = await this.generateWithGemini({
        prompt,
        systemInstruction: params.systemPrompt || 'You are an expert sales prospect extraction engine. Output strict JSON only.',
        responseMimeType: 'application/json',
        job: params.job,
        taskLabel: `${taskLabel} (Gemini Primary)`,
      });

      if (geminiText) {
        return JSON.parse(geminiText) as T;
      }
    } catch {
      // Primary Gemini encountered an error (e.g. rate limit); proceed to secondary fallback
    }

    // 2. Secondary: Nvidia NIM (only if configured with a real nvapi-* key and healthy)
    if (globalNvidiaClient.isConfigured()) {
      try {
        const result = await globalNvidiaClient.nvidiaExtract<T>({
          text: params.text,
          schemaDescription: params.schemaDescription,
          systemPrompt: params.systemPrompt,
          exampleJson: params.exampleJson,
          timeoutMs: 8000,
          maxRetries: 1,
        });

        if (result) return result;
      } catch (nvidiaErr: any) {
        // Fast-fail: Trip circuit breaker for 15 minutes to avoid hanging subsequent calls
        globalNvidiaClient.tripCircuitBreaker(15 * 60 * 1000, nvidiaErr.message);
      }
    }

    return null;
  }

  /**
   * Universal Dual-Provider Text / JSON generation:
   * Dynamically handles Gemini and Nvidia NIM with clean, silent failovers.
   */
  public async generateWithDualProvider(params: {
    prompt: string;
    systemInstruction?: string;
    preferredProvider?: 'gemini' | 'nvidia' | 'auto';
    temperature?: number;
    jsonMode?: boolean;
    job?: DiscoveryJob;
    taskLabel?: string;
  }): Promise<string> {
    const taskLabel = params.taskLabel || 'AI Generation';
    const hasNvidia = globalNvidiaClient.isConfigured();
    // Default to Google Gemini (High speed, reliable native integration)
    const preferred = params.preferredProvider || 'gemini';

    // Strategy 1: Explicit Nvidia preference (only if configured and healthy)
    if (preferred === 'nvidia' && hasNvidia) {
      try {
        const nvidiaText = await globalNvidiaClient.nvidiaGenerate({
          prompt: params.prompt,
          systemPrompt: params.systemInstruction,
          jsonMode: params.jsonMode,
          temperature: params.temperature ?? 0.3,
          timeoutMs: 8000,
          maxRetries: 1,
        });
        if (nvidiaText && nvidiaText.trim().length > 0) {
          return nvidiaText;
        }
      } catch (nvidiaErr: any) {
        globalNvidiaClient.tripCircuitBreaker(15 * 60 * 1000, nvidiaErr.message);
      }
    }

    // Strategy 2: Google Gemini (Primary standard path)
    try {
      return await this.generateWithGemini({
        prompt: params.prompt,
        systemInstruction: params.systemInstruction,
        responseMimeType: params.jsonMode ? 'application/json' : undefined,
        temperature: params.temperature ?? 0.3,
        job: params.job,
        taskLabel: `${taskLabel} (Gemini)`,
      });
    } catch (geminiErr: any) {
      // Strategy 3: If Gemini failed and Nvidia hasn't been tried yet and is healthy
      if (preferred !== 'nvidia' && hasNvidia && globalNvidiaClient.isConfigured()) {
        try {
          const nvidiaFallback = await globalNvidiaClient.nvidiaGenerate({
            prompt: params.prompt,
            systemPrompt: params.systemInstruction,
            jsonMode: params.jsonMode,
            temperature: params.temperature ?? 0.3,
            timeoutMs: 8000,
            maxRetries: 1,
          });
          if (nvidiaFallback && nvidiaFallback.trim().length > 0) {
            return nvidiaFallback;
          }
        } catch (nvidiaFailoverErr: any) {
          globalNvidiaClient.tripCircuitBreaker(15 * 60 * 1000, nvidiaFailoverErr.message);
        }
      }

      throw geminiErr;
    }
  }

  private notifyJob(job: DiscoveryJob, message: string, type: 'info' | 'warning' | 'error' = 'info') {
    if (!job.logs) job.logs = [];
    job.currentStepText = message;
    const log: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      message: `[AI Resilience] ${message}`,
      type,
    };
    job.logs.unshift(log);
    if (job.logs.length > 80) job.logs.length = 80;
  }
}

export const globalAiResilience = AiResilienceService.getInstance();
