import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  NvidiaChatCompletionRequest,
  NvidiaChatCompletionResponse,
  NvidiaGenerateOptions,
  NvidiaExtractOptions,
  NvidiaClassifyOptions,
  NvidiaAnalyzeOptions,
  NvidiaCacheEntry,
  NvidiaHealthStatus,
} from './nvidiaTypes';
import { getActiveNvidiaModel, getNvidiaModelDefinition } from './nvidiaModels';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const CACHE_DIR = path.join(process.cwd(), 'data', 'nvidia_cache');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');

export class NvidiaClient {
  private apiKey: string = '';
  private defaultModel: string;
  private cache: Map<string, NvidiaCacheEntry> = new Map();
  private lastStatus: 'ok' | 'rate_limited' | 'error' = 'ok';
  private lastError?: string;
  private lastUsedAt?: string;
  private cooldownUntil: number = 0;

  constructor() {
    this.defaultModel = getActiveNvidiaModel();
    this.ensureDirs();
    this.loadCache();
    this.refreshApiKey();
  }

  public isCircuitBroken(): boolean {
    return Date.now() < this.cooldownUntil;
  }

  public tripCircuitBreaker(cooldownMs: number = 15 * 60 * 1000, reason?: string): void {
    this.cooldownUntil = Date.now() + cooldownMs;
    this.lastStatus = 'error';
    if (reason) this.lastError = reason;
  }

  public resetCircuitBreaker(): void {
    this.cooldownUntil = 0;
    this.lastStatus = 'ok';
    this.lastError = undefined;
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
    } catch {
      // Non-fatal, silent handling
    }
  }

  private loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const entries: NvidiaCacheEntry[] = JSON.parse(raw);
        for (const entry of entries) {
          this.cache.set(entry.contentHash, entry);
        }
      }
    } catch {
      // Non-fatal, silent cache fallback
    }
  }

  private saveCache() {
    try {
      this.ensureDirs();
      const entries = Array.from(this.cache.values());
      // Keep cache bounded to 2000 entries
      if (entries.length > 2000) {
        entries.sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime());
        entries.length = 2000;
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch {
      // Non-fatal, silent
    }
  }

  private refreshApiKey(): string {
    this.apiKey = (process.env.NVIDIA_API_KEY || '').trim();
    return this.apiKey;
  }

  public isConfigured(): boolean {
    const key = this.refreshApiKey();
    if (!key) return false;

    // Strict validation: Reject placeholders and dummy values
    const lower = key.toLowerCase();
    if (
      lower.includes('my_nvidia') ||
      lower.includes('your_') ||
      lower.includes('placeholder') ||
      lower.includes('dummy') ||
      lower.includes('example') ||
      lower === 'none' ||
      !key.startsWith('nvapi-')
    ) {
      return false;
    }

    // Automatically check circuit breaker cooldown
    if (this.isCircuitBroken()) {
      return false;
    }

    return true;
  }

  /**
   * Generates a stable deterministic content hash for caching
   */
  private generateContentHash(content: string, model: string, promptVersion: string): string {
    return crypto
      .createHash('sha256')
      .update(`${model}:${promptVersion}:${content.trim()}`)
      .digest('hex');
  }

  /**
   * Core chat completion with timeout, retry, exponential backoff, circuit breaker, and silent failover
   */
  public async chatCompletion(
    request: NvidiaChatCompletionRequest,
    options: { timeoutMs?: number; maxRetries?: number } = {}
  ): Promise<NvidiaChatCompletionResponse> {
    if (this.isCircuitBroken()) {
      throw new Error('NVIDIA NIM circuit breaker active. Cooling down.');
    }

    const apiKey = this.refreshApiKey();
    if (!apiKey || !this.isConfigured()) {
      throw new Error(
        'NVIDIA API key is not configured or invalid. Please provide a valid nvapi-* key.'
      );
    }

    // Fast-fail timeout threshold (default 8000ms, max 1 retry)
    const timeoutMs = options.timeoutMs || 8000;
    const maxRetries = options.maxRetries ?? 1;
    let attempt = 0;
    let delayMs = 1000;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        this.lastUsedAt = new Date().toISOString();
        const response = await fetch(NVIDIA_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'LeadHook-Cloud-Worker/1.0',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          const data: NvidiaChatCompletionResponse = await response.json();
          this.lastStatus = 'ok';
          this.lastError = undefined;
          return data;
        }

        // Rate limit 429: Immediately trip circuit breaker and fail fast without burning retry budget
        if (response.status === 429) {
          this.tripCircuitBreaker(15 * 60 * 1000, 'NVIDIA API rate limit (429)');
          throw new Error('NVIDIA API rate limit exceeded (429). Cooling down.');
        }

        // Server error 5xx: Retry once with short backoff, then trip breaker
        if (response.status >= 500 && attempt <= maxRetries) {
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs *= 2;
          continue;
        }

        const errText = await response.text();
        this.tripCircuitBreaker(10 * 60 * 1000, `HTTP ${response.status}: ${errText.slice(0, 100)}`);
        throw new Error(`NVIDIA API error (HTTP ${response.status}): ${errText}`);
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          // Timeout: Trip circuit breaker for 15 minutes so subsequent calls fall back immediately
          this.tripCircuitBreaker(15 * 60 * 1000, `NVIDIA API request timed out after ${timeoutMs}ms.`);
          throw new Error(`NVIDIA API request timed out after ${timeoutMs}ms.`);
        }

        if (attempt > maxRetries) {
          this.tripCircuitBreaker(10 * 60 * 1000, err.message);
          throw err;
        }

        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      }
    }

    this.tripCircuitBreaker(10 * 60 * 1000, 'NVIDIA API request failed after retry.');
    throw new Error('NVIDIA API request failed after retry.');
  }

  /**
   * General text/code generation
   */
  public async nvidiaGenerate(options: NvidiaGenerateOptions): Promise<string> {
    const model = options.model || getActiveNvidiaModel();
    const promptVersion = options.promptVersion || 'v1';
    const content = `${options.systemPrompt || ''}\n${options.prompt}`;

    // Cache check
    if (options.useCache !== false) {
      const hash = this.generateContentHash(content, model, promptVersion);
      const cached = this.cache.get(hash);
      if (cached) {
        cached.hitCount = (cached.hitCount || 0) + 1;
        return cached.result;
      }
    }

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system' as const, content: options.systemPrompt });
    }
    messages.push({ role: 'user' as const, content: options.prompt });

    const request: NvidiaChatCompletionRequest = {
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048,
    };

    if (options.jsonMode) {
      const modelDef = getNvidiaModelDefinition(model);
      if (modelDef.supportsJsonFormat) {
        request.response_format = { type: 'json_object' };
      }
    }

    const res = await this.chatCompletion(request, {
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
    });

    const choice = res.choices?.[0];
    let text = choice?.message?.content || '';
    if (!text && choice?.message?.reasoning) {
      // If the model only returned reasoning due to token cut-off or reasoning-only format
      text = choice.message.reasoning;
    }

    // Cache result
    if (options.useCache !== false && text) {
      const hash = this.generateContentHash(content, model, promptVersion);
      this.cache.set(hash, {
        contentHash: hash,
        model,
        promptVersion,
        result: text,
        cachedAt: new Date().toISOString(),
        hitCount: 1,
      });
      this.saveCache();
    }

    return text;
  }

  /**
   * Extracts structured JSON objects from difficult or unstructured page text
   */
  public async nvidiaExtract<T = any>(options: NvidiaExtractOptions<T>): Promise<T> {
    const model = options.model || getActiveNvidiaModel();
    const promptVersion = options.promptVersion || 'extract_v1';
    const content = `${options.schemaDescription}\n${options.text}`;

    // Cache check
    if (options.useCache !== false) {
      const hash = this.generateContentHash(content, model, promptVersion);
      const cached = this.cache.get(hash);
      if (cached) {
        cached.hitCount = (cached.hitCount || 0) + 1;
        return cached.result as T;
      }
    }

    const systemPrompt =
      options.systemPrompt ||
      `You are an expert enterprise data extraction engine.
Extract data strictly following the required schema description.
Output valid JSON only. Do not wrap in conversational chatter.`;

    const userPrompt = `Extract the structured information from the following text based on this schema:
${options.schemaDescription}
${options.exampleJson ? `\nExample output JSON format:\n${options.exampleJson}` : ''}

Source Content:
"""
${options.text.slice(0, 16000)}
"""

JSON Result:`;

    const raw = await this.nvidiaGenerate({
      model,
      systemPrompt,
      prompt: userPrompt,
      temperature: options.temperature ?? 0.1,
      maxTokens: options.maxTokens ?? 3000,
      jsonMode: true,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      useCache: false, // will cache parsed result below
    });

    const parsed = this.cleanAndParseJson(raw);
    const result = options.validator ? options.validator(parsed) : parsed;

    // Cache parsed result
    if (options.useCache !== false) {
      const hash = this.generateContentHash(content, model, promptVersion);
      this.cache.set(hash, {
        contentHash: hash,
        model,
        promptVersion,
        result,
        cachedAt: new Date().toISOString(),
        hitCount: 1,
      });
      this.saveCache();
    }

    return result as T;
  }

  /**
   * Classify text into one of several categories
   */
  public async nvidiaClassify(options: NvidiaClassifyOptions): Promise<string> {
    const model = options.model || getActiveNvidiaModel();
    const promptVersion = options.promptVersion || 'classify_v1';
    const content = `${options.categories.join(',')}\n${options.text}`;

    if (options.useCache !== false) {
      const hash = this.generateContentHash(content, model, promptVersion);
      const cached = this.cache.get(hash);
      if (cached) {
        cached.hitCount = (cached.hitCount || 0) + 1;
        return cached.result;
      }
    }

    const systemPrompt = `You are a high-speed text classification engine. Select EXACTLY ONE category from the provided list. Return only the exact category name.`;
    const userPrompt = `Categories:
${options.categories.map((c) => `- ${c}`).join('\n')}

${options.context ? `Context: ${options.context}\n` : ''}
Text to classify:
"""
${options.text.slice(0, 4000)}
"""

Selected Category:`;

    const result = (
      await this.nvidiaGenerate({
        model,
        systemPrompt,
        prompt: userPrompt,
        temperature: options.temperature ?? 0.0,
        maxTokens: 50,
        useCache: false,
      })
    ).trim();

    // Match best category
    let matched = options.categories.find(
      (c) => c.toLowerCase() === result.toLowerCase() || result.toLowerCase().includes(c.toLowerCase())
    );
    if (!matched) matched = options.categories[0];

    if (options.useCache !== false) {
      const hash = this.generateContentHash(content, model, promptVersion);
      this.cache.set(hash, {
        contentHash: hash,
        model,
        promptVersion,
        result: matched,
        cachedAt: new Date().toISOString(),
        hitCount: 1,
      });
      this.saveCache();
    }

    return matched;
  }

  /**
   * Analyze company or decision-maker aspects
   */
  public async nvidiaAnalyze(options: NvidiaAnalyzeOptions): Promise<Record<string, string>> {
    const model = options.model || getActiveNvidiaModel();
    const promptVersion = options.promptVersion || 'analyze_v1';
    const content = `${options.questionsOrAspects.join(';')}\n${options.content}`;

    if (options.useCache !== false) {
      const hash = this.generateContentHash(content, model, promptVersion);
      const cached = this.cache.get(hash);
      if (cached) {
        cached.hitCount = (cached.hitCount || 0) + 1;
        return cached.result;
      }
    }

    const schemaDescription = `Return a JSON object with keys for each aspect: ${options.questionsOrAspects.join(', ')}`;
    const result = await this.nvidiaExtract({
      model,
      systemPrompt: options.systemPrompt,
      text: options.content,
      schemaDescription,
      temperature: options.temperature ?? 0.2,
      useCache: false,
    });

    if (options.useCache !== false) {
      const hash = this.generateContentHash(content, model, promptVersion);
      this.cache.set(hash, {
        contentHash: hash,
        model,
        promptVersion,
        result,
        cachedAt: new Date().toISOString(),
        hitCount: 1,
      });
      this.saveCache();
    }

    return result;
  }

  /**
   * Extracts clean JSON from model markdown block or raw text
   */
  private cleanAndParseJson(text: string): any {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      clean = match[0];
    }
    try {
      return JSON.parse(clean);
    } catch {
      // Attempt escape fix
      try {
        const fixed = clean.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
      } catch {
        throw new Error(`Failed to parse NVIDIA response as JSON: ${text.slice(0, 200)}...`);
      }
    }
  }

  public getHealth(): NvidiaHealthStatus {
    return {
      isConfigured: this.isConfigured(),
      model: getActiveNvidiaModel(),
      endpoint: NVIDIA_API_URL,
      cacheEntriesCount: this.cache.size,
      lastUsedAt: this.lastUsedAt,
      lastStatus: this.lastStatus,
      lastError: this.lastError,
    };
  }

  public clearCache(): void {
    this.cache.clear();
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
    } catch {}
  }
}

export const globalNvidiaClient = new NvidiaClient();

// Clean standalone exports as requested in Phase 1
export const nvidiaGenerate = (opts: NvidiaGenerateOptions) => globalNvidiaClient.nvidiaGenerate(opts);
export const nvidiaExtract = <T = any>(opts: NvidiaExtractOptions<T>) => globalNvidiaClient.nvidiaExtract<T>(opts);
export const nvidiaClassify = (opts: NvidiaClassifyOptions) => globalNvidiaClient.nvidiaClassify(opts);
export const nvidiaAnalyze = (opts: NvidiaAnalyzeOptions) => globalNvidiaClient.nvidiaAnalyze(opts);
