import { ResearchConfig } from './types';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
  plugins?: Array<{ id: string; max_results?: number; search_prompt?: string }>;
}

export interface OpenRouterChatResponse {
  id?: string;
  model?: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      annotations?: any[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    code: number | string;
    message: string;
    metadata?: any;
  };
}

export class OpenRouterClient {
  private baseUrl = 'https://openrouter.ai/api/v1';
  private hasInsufficientCredits: boolean = false;

  /**
   * Reset credit status (e.g. if user updates API key)
   */
  public resetCreditStatus() {
    this.hasInsufficientCredits = false;
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  public async createChatCompletion(
    config: ResearchConfig,
    messages: OpenRouterMessage[],
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      enableWebPlugin?: boolean;
      searchPrompt?: string;
    }
  ): Promise<{
    content: string;
    model: string;
    tokens?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    annotations?: any[];
    raw: OpenRouterChatResponse;
  }> {
    if (this.hasInsufficientCredits) {
      const err: any = new Error('OpenRouter account has insufficient credits.');
      err.code = 'INSUFFICIENT_CREDITS';
      throw err;
    }
    let apiKey = (config.openrouter_api_key || process.env.OPENROUTER_API_KEY || '').trim();
    if (apiKey && !apiKey.startsWith('sk-or-') && /^[0-9a-fA-F]{64}$/.test(apiKey)) {
      apiKey = `sk-or-v1-${apiKey}`;
    }

    if (!apiKey) {
      const err: any = new Error('OpenRouter API key is missing. Please configure OPENROUTER_API_KEY in server settings.');
      err.code = 'MISSING_API_KEY';
      throw err;
    }

    let model = options?.model || config.model || 'meta-llama/llama-3.3-70b-instruct';
    const isOnline = Boolean(options?.enableWebPlugin || model.endsWith(':online'));
    if (options?.enableWebPlugin && !model.endsWith(':online')) {
      model = `${model}:online`;
    }

    const requestBody: OpenRouterChatRequest = {
      model,
      messages,
      temperature: options?.temperature !== undefined ? options.temperature : 0.1,
      max_tokens: options?.max_tokens || 3500,
    };

    // Only add response_format when not using :online (some online providers reject json_object schema)
    if (!isOnline) {
      requestBody.response_format = { type: 'json_object' };
    }

    if (options?.enableWebPlugin && !model.endsWith(':online')) {
      requestBody.plugins = [
        {
          id: 'web',
          max_results: 5,
          search_prompt: options.searchPrompt,
        },
      ];
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'https://leadhook.app',
      'X-Title': 'LeadHook Company Research',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === 'AbortError';
      const err: any = new Error(
        isTimeout ? 'OpenRouter request timed out after 45 seconds.' : `OpenRouter network error: ${fetchErr.message}`
      );
      err.code = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
      throw err;
    }

    clearTimeout(timeoutId);

    let data: OpenRouterChatResponse;
    try {
      data = (await res.json()) as OpenRouterChatResponse;
    } catch (parseErr: any) {
      const err: any = new Error(`OpenRouter returned invalid JSON response (HTTP ${res.status}).`);
      err.code = 'MALFORMED_RESPONSE';
      throw err;
    }

    if (!res.ok || data.error) {
      const errMessage = data.error?.message || `OpenRouter returned HTTP error ${res.status}`;
      const err: any = new Error(errMessage);

      if (res.status === 401 || res.status === 403) {
        err.code = 'AUTH_ERROR';
      } else if (res.status === 402 || /quota|credit|balance/i.test(errMessage)) {
        err.code = 'QUOTA_EXHAUSTED';
      } else if (res.status === 404 || /model.*not found|unsupported model/i.test(errMessage)) {
        err.code = 'UNSUPPORTED_MODEL';
      } else if (res.status === 429 || /rate limit/i.test(errMessage)) {
        err.code = 'RATE_LIMIT';
      } else {
        err.code = 'SERVER_ERROR';
      }
      throw err;
    }

    const choice = data.choices?.[0];
    if (!choice || !choice.message) {
      const err: any = new Error('OpenRouter response contained no choices or completion message.');
      err.code = 'INVALID_RESPONSE';
      throw err;
    }

    return {
      content: choice.message.content || '',
      model: data.model || model,
      tokens: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          }
        : undefined,
      annotations: choice.message.annotations,
      raw: data,
    };
  }

  /**
   * Test API key connectivity and model availability without running a full research task
   */
  public async testConnection(
    apiKey?: string,
    model?: string
  ): Promise<{
    success: boolean;
    model: string;
    latencyMs: number;
    message: string;
  }> {
    const key = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
    if (!key) {
      return {
        success: false,
        model: model || 'unspecified',
        latencyMs: 0,
        message: 'No API key provided or configured in environment',
      };
    }

    const testModel = model || 'meta-llama/llama-3.3-70b-instruct';
    const start = Date.now();

    try {
      const result = await this.createChatCompletion(
        { openrouter_api_key: key, model: testModel },
        [
          { role: 'system', content: 'You are a system health check agent. Return JSON.' },
          { role: 'user', content: 'Respond with: {"status": "ok", "provider": "openrouter"}' },
        ],
        { model: testModel, max_tokens: 50, temperature: 0 }
      );

      const latencyMs = Date.now() - start;
      return {
        success: true,
        model: result.model,
        latencyMs,
        message: `Successfully connected to OpenRouter model: ${result.model} (${latencyMs}ms)`,
      };
    } catch (err: any) {
      return {
        success: false,
        model: testModel,
        latencyMs: Date.now() - start,
        message: err.message || 'Failed to connect to OpenRouter',
      };
    }
  }

  /**
   * Search Google and public web via OpenRouter to retrieve firmographics (employee count, LinkedIn, founded year, leadership)
   */
  public async fetchCompanyGoogleSearchDetails(
    apiKey: string,
    companyName: string,
    domain?: string,
    website?: string,
    modelName?: string
  ): Promise<OpenRouterCompanyDetails | null> {
    if (this.hasInsufficientCredits) {
      return null;
    }

    const key = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
    if (!key) return null;

    const chosenModel = modelName || 'meta-llama/llama-3.3-70b-instruct:online';
    const onlineModel = chosenModel.endsWith(':online') ? chosenModel : `${chosenModel}:online`;

    const targetDesc = [
      companyName ? `Company: "${companyName}"` : '',
      domain ? `Domain: "${domain}"` : '',
      website ? `Website: "${website}"` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const systemPrompt = `You are a real-time corporate intelligence and Google search specialist.
Search Google and authoritative web sources (LinkedIn, company website, Crunchbase, official registries) for the target business.
You MUST output a single valid JSON block containing:
- "company_name": official corporate or brand name
- "employee_count": exact or most recent headcount estimate as string (e.g. "50", "200") or null
- "employee_range": headcount bracket (e.g. "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+")
- "founded_year": 4-digit year founded or established (e.g. "2017") or null
- "linkedin_url": official LinkedIn company page URL (e.g. "https://www.linkedin.com/company/...") or null
- "headquarters": primary office city, state/region, and country or null
- "description": 1-2 sentence overview of what the company does
- "decision_makers": array of key leadership/executives (e.g. [{"full_name": "Jane Doe", "role": "CEO", "linkedin_url": "https://linkedin.com/in/..."}])
Output ONLY the JSON object. Do not include introductory text.`;

    const userPrompt = `Search Google and return corporate facts for: ${targetDesc}`;

    try {
      const response = await this.createChatCompletion(
        { openrouter_api_key: key, model: onlineModel },
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { model: onlineModel, temperature: 0.1, max_tokens: 1500 }
      );

      let text = response.content.trim();
      const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeMatch && codeMatch[1]) {
        text = codeMatch[1].trim();
      } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          text = text.substring(firstBrace, lastBrace + 1);
        }
      }

      const parsed = JSON.parse(text);

      let empCountStr = '';
      if (parsed.employee_count !== undefined && parsed.employee_count !== null) {
        empCountStr = String(parsed.employee_count).trim();
      }
      let empRangeStr = parsed.employee_range ? String(parsed.employee_range).trim() : '';

      // Normalize employee tier
      let empTier = '';
      const countNum = parseInt(empCountStr.replace(/\D/g, ''), 10);
      if (!isNaN(countNum) && countNum > 0) {
        if (countNum <= 10) empTier = '1-10';
        else if (countNum <= 50) empTier = '11-50';
        else if (countNum <= 200) empTier = '51-200';
        else if (countNum <= 500) empTier = '201-500';
        else if (countNum <= 1000) empTier = '501-1000';
        else empTier = '1000+';
      } else if (empRangeStr) {
        if (/1\s*[-–]\s*10/i.test(empRangeStr)) empTier = '1-10';
        else if (/11\s*[-–]\s*50/i.test(empRangeStr)) empTier = '11-50';
        else if (/51\s*[-–]\s*200/i.test(empRangeStr)) empTier = '51-200';
        else if (/201\s*[-–]\s*500/i.test(empRangeStr)) empTier = '201-500';
        else if (/501\s*[-–]\s*1000/i.test(empRangeStr)) empTier = '501-1000';
        else if (/1000\+/i.test(empRangeStr) || /5000\+/i.test(empRangeStr)) empTier = '1000+';
      }

      let foundedStr = '';
      if (parsed.founded_year !== undefined && parsed.founded_year !== null) {
        const yr = String(parsed.founded_year).trim().replace(/\D/g, '');
        if (yr.length === 4 && parseInt(yr, 10) >= 1700 && parseInt(yr, 10) <= 2030) {
          foundedStr = yr;
        }
      }

      let linkedin = '';
      if (parsed.linkedin_url && typeof parsed.linkedin_url === 'string') {
        const cleanLi = parsed.linkedin_url.trim();
        if (cleanLi.includes('linkedin.com/')) {
          linkedin = cleanLi.startsWith('http') ? cleanLi : `https://${cleanLi}`;
        }
      }

      // Normalize decision makers
      const dms: Array<{ full_name: string; role: string; linkedin_url?: string }> = [];
      if (Array.isArray(parsed.decision_makers)) {
        for (const item of parsed.decision_makers) {
          if (typeof item === 'string') {
            const parts = item.split(/[:–—\-]/);
            if (parts.length >= 2) {
              dms.push({
                full_name: parts[0].trim(),
                role: parts.slice(1).join(' ').trim(),
              });
            } else if (item.trim()) {
              dms.push({
                full_name: item.trim(),
                role: 'Executive / Leader',
              });
            }
          } else if (item && typeof item === 'object') {
            const name = item.full_name || item.name || '';
            const role = item.role || item.title || 'Executive / Leader';
            if (name) {
              dms.push({
                full_name: String(name).trim(),
                role: String(role).trim(),
                linkedin_url: item.linkedin_url || item.linkedin || undefined,
              });
            }
          }
        }
      }

      return {
        company_name: parsed.company_name || companyName,
        employee_count: empCountStr || undefined,
        employee_range: empRangeStr || empTier || undefined,
        employee_tier: empTier || undefined,
        founded_year: foundedStr || undefined,
        linkedin_url: linkedin || undefined,
        headquarters: parsed.headquarters || undefined,
        location: parsed.headquarters || undefined,
        description: parsed.description || undefined,
        decision_makers: dms.length > 0 ? dms : undefined,
      };
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Insufficient credits') || msg.includes('never purchased credits') || msg.includes('402')) {
        this.hasInsufficientCredits = true;
        console.info(`[OpenRouterClient] OpenRouter has insufficient credits. Skipping further OpenRouter lookups.`);
      } else {
        console.warn(`[OpenRouterClient] fetchCompanyGoogleSearchDetails note for ${companyName}:`, msg.slice(0, 100));
      }
      return null;
    }
  }
}

export interface OpenRouterCompanyDetails {
  company_name?: string;
  employee_count?: string;
  employee_range?: string;
  employee_tier?: string;
  founded_year?: string;
  linkedin_url?: string;
  headquarters?: string;
  location?: string;
  description?: string;
  decision_makers?: Array<{
    full_name: string;
    role: string;
    linkedin_url?: string;
  }>;
}

export const globalOpenRouterClient = new OpenRouterClient();
