import { GoogleGenAI } from '@google/genai';
import { AiCredential, ModelCapability } from './types';
import { classifyAiError } from './errorClassifier';
import { normalizeAiExtraction, NormalizedResult } from './jsonNormalizer';

const EXTRACTION_SYSTEM_PROMPT = `You are a high-precision, multilingual commercial contact information, decision-maker discovery, and B2B firmographics extractor.
Your task is to analyze scraped website page content and extract publicly available business contacts, decision makers, professional emails, generic inboxes, and corporate intelligence.

Rules & Requirements:
1. Extract Company Intelligence & Firmographics:
   - "company_name": Official company or organization name.
   - "firmographics":
     - "industry": Primary commercial vertical/industry (e.g., "Legal Services", "B2B SaaS", "Corporate Law", "Healthcare", "Accounting").
     - "employee_count": Exact number of employees if explicitly stated (e.g., "45", "120"). Distinguish exact figures from ranges. If only a range or approximate figure is available, leave this empty.
     - "employee_tier": Standard company size range ("1-10", "11-50", "51-200", "201-500", "501-1000", "1000+").
     - "founded_year": Exact 4-digit founding year (e.g., "2012"). Distinguish founding year from incorporation, launch, rebranding, or acquisition year. Return empty string if no authentic evidence exists.
     - "location": Corporate headquarters address or city, state, country (e.g., "100 Montgomery St, San Francisco, CA, USA").
     - "headquarters": Primary headquarters city and state/country.
     - "country_code": International phone country calling code (e.g., "+1", "+44", "+971").
     - "offering_summary": Concise 1-2 sentence description of key services or products offered.
   - "generic_emails": Array of company-level generic inboxes found on the website (e.g., ["info@company.com", "contact@company.com", "office@company.com", "hello@company.com"]).
   - "departmental_emails": Array of departmental inboxes (e.g., ["sales@company.com", "billing@company.com", "press@company.com", "careers@company.com", "support@company.com"]).

2. Extract and Categorize Real People Contacts:
   - Extract actual people found in team, leadership, attorney, partner, management, or about sections.
   - Process multiple people on the same page independently.
   - "full_name": Real name of the person. NEVER create or invent a person's name from an email username (e.g., usergen@company.com or info@company.com must NEVER create a person named "Usergen" or "Info").
   - "first_name", "last_name": Parsed names.
   - "role": Real job title or role as stated on the page (e.g., "Managing Partner", "Director of Legal Services", "CEO", "Founder", "Senior Partner", "General Counsel").
   - "role_tier": Categorize each contact's role into one of:
     * "C-Suite / Executive" (CEO, Founder, Owner, Managing Partner, President, Managing Director)
     * "Sales & Marketing" (Head of Sales, CMO, Growth, Business Development)
     * "Procurement & Operations" (COO, Operations Director)
     * "Technical / Engineering" (CTO, VP Engineering, Tech Lead)
     * "Finance & Legal" (CFO, General Counsel, Senior Partner, Attorney, Legal Director)
     * "General Management" (Branch Manager, General Manager)
     * "Other Staff"
   - "professional_email": The explicit professional email associated with that person. If a person has NO direct email, leave this as empty string "". NEVER assign a company-level generic email (info@, contact@) as an individual person's professional email!
   - "association_status": "explicit" if the email is listed in their card/profile or clearly associated with their name; "inferred" if derived from strong nearby context; "none" if no direct email is found.
   - "confidence_score": 0 - 100 confidence score that the email and role belong to this exact person.
   - "phone": Direct or office phone number if listed.
   - "linkedin_url": Personal LinkedIn profile URL if explicitly found.
   - "source_url": URL of the page where the person was found.

3. Accuracy & Grounding Discipline:
   - Do NOT invent missing names, emails, phone numbers, employee counts, or founding years. Return unknown or empty values when evidence is unavailable.
   - If a person has no professional email, keep the person's name and title visible and leave professional email empty "".
   - If generic emails exist but no named people are found, populate "generic_emails" and do not invent artificial people.

4. Output format must STRICTLY be valid JSON matching this schema:
{
  "company_name": "Sierra Law Firm",
  "firmographics": {
    "industry": "Legal Services / Corporate Law",
    "employee_count": "35",
    "employee_tier": "11-50",
    "founded_year": "2012",
    "location": "New York, NY, USA",
    "headquarters": "New York, NY",
    "country_code": "+1",
    "offering_summary": "Corporate and litigation legal advisory services."
  },
  "generic_emails": ["info@sierralaw.com", "contact@sierralaw.com"],
  "departmental_emails": ["careers@sierralaw.com", "press@sierralaw.com"],
  "contacts": [
    {
      "first_name": "Salina",
      "last_name": "Sierra",
      "full_name": "Salina Sierra",
      "role": "Managing Partner",
      "role_tier": "C-Suite / Executive",
      "professional_email": "salina@sierralaw.com",
      "email": "salina@sierralaw.com",
      "association_status": "explicit",
      "confidence_score": 95,
      "phone": "+1 212 555 0188",
      "linkedin_url": "https://www.linkedin.com/in/salinasierra",
      "source_url": "https://sierralaw.com/about"
    }
  ]
}
Return ONLY the raw JSON object. Do not include markdown code block tags.`;

export interface ExecuteExtractionOptions {
  credential: AiCredential;
  companyName: string;
  sourceUrl: string;
  pageContents: { url: string; title: string; text: string }[];
  maxContacts?: number;
  priorityRoles?: string[];
  customRules?: string;
  strictIcpConfig?: any;
  timeoutMs?: number;
}

export function buildDynamicSystemPrompt(customRules?: string, strictIcpConfig?: any): string {
  let prompt = EXTRACTION_SYSTEM_PROMPT;

  if (customRules?.trim()) {
    prompt = `================================================================================
CRITICAL USER MANDATORY EXTRACTION RULES (HIGHEST PRIORITY - STRICT ENFORCEMENT):
The user has specified the following custom rules that MUST be strictly applied and take precedence over default behavior:
${customRules.trim()}

MANDATORY COMPLIANCE RULES:
1. Every rule above must directly dictate the extraction logic. Do NOT ignore or treat them as mere suggestions.
2. If the user specified "Find only company owners and founders":
   - Search specifically for Owner, Founder, Co-Founder, CEO, President, Managing Director, or Principal.
   - Do NOT return general employees, interns, or generic reception emails when owners/founders are requested.
   - If no company owner or founder is found in the text, return an empty contacts array [] or explicitly report that no owner was identified.
3. If the user specified "Professional personal email only":
   - Exclude generic email addresses (info@, contact@, hello@, support@, sales@, admin@, etc.).
   - Only return contacts with verified personal email addresses tied to real named individuals.
4. If employee count/size or industry filters are specified, accurately extract and verify these values from the text.
5. In your JSON output, include a "rule_evaluations" field auditing each active rule:
   "rule_evaluations": [
     { "rule": "<rule text>", "status": "FOLLOWED" | "FAILED" | "UNVERIFIED", "detail": "<exact evidence or reason>" }
   ]
================================================================================\n\n` + prompt;
  }

  return prompt;
}

export interface AdapterExecutionResult {
  success: boolean;
  result?: NormalizedResult;
  latencyMs: number;
  statusCode?: number;
  rawText?: string;
  error?: {
    code: string;
    message: string;
    classified: ReturnType<typeof classifyAiError>;
  };
}

export async function executeAiExtraction(
  options: ExecuteExtractionOptions
): Promise<AdapterExecutionResult> {
  const {
    credential,
    companyName,
    sourceUrl,
    pageContents,
    maxContacts = 2,
    priorityRoles = [],
    customRules,
    strictIcpConfig,
    timeoutMs = 12000,
  } = options;
  const startTime = Date.now();

  const systemPrompt = buildDynamicSystemPrompt(customRules, strictIcpConfig);
  const userPrompt = buildExtractionPrompt(companyName, sourceUrl, pageContents, maxContacts, priorityRoles, customRules);

  try {
    let rawText = '';
    let statusCode = 200;

    if (credential.provider === 'gemini') {
      rawText = await callGemini(credential, userPrompt, systemPrompt, timeoutMs);
    } else if (credential.provider === 'claude') {
      rawText = await callAnthropicClaude(credential, userPrompt, systemPrompt, timeoutMs);
    } else {
      // OpenAI-compatible format (Alibaba Qwen, DeepSeek, Moonshot Kimi, Zhipu GLM, MiniMax, OpenAI, Custom)
      const res = await callOpenAiCompatible(credential, userPrompt, systemPrompt, timeoutMs);
      rawText = res.text;
      statusCode = res.statusCode;
    }

    const latencyMs = Date.now() - startTime;
    const normalized = normalizeAiExtraction(rawText, companyName, sourceUrl);

    if (!normalized.isValid) {
      throw new Error(normalized.error || 'Failed to parse structured JSON from AI output');
    }

    return {
      success: true,
      result: normalized,
      latencyMs,
      statusCode,
      rawText,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const classified = classifyAiError(err, err?.statusCode);

    return {
      success: false,
      latencyMs,
      statusCode: err?.statusCode || classified.statusCode,
      error: {
        code: classified.code,
        message: classified.message,
        classified,
      },
    };
  }
}

/**
 * Call OpenAI-compatible REST endpoint (used for Qwen, DeepSeek, Kimi, GLM, MiniMax, OpenAI, Custom)
 */
async function callOpenAiCompatible(
  credential: AiCredential,
  prompt: string,
  systemPrompt: string,
  timeoutMs: number
): Promise<{ text: string; statusCode: number }> {
  let baseUrl = credential.baseUrl?.trim() || '';
  if (!baseUrl) {
    throw new Error(`Base URL is missing for provider ${credential.provider}`);
  }
  // Ensure no trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');

  const endpoint = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credential.apiKey.trim()}`,
  };

  // Alibaba DashScope workspace header if provided
  if (credential.workspaceId?.trim()) {
    headers['X-DashScope-WorkSpace'] = credential.workspaceId.trim();
  }

  // Request payload
  const body: any = {
    model: credential.model.trim(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 2500,
  };

  // Enable JSON mode for providers that natively support it
  if (
    credential.provider === 'qwen' ||
    credential.provider === 'deepseek' ||
    credential.provider === 'openai' ||
    credential.provider === 'kimi' ||
    credential.provider === 'glm'
  ) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const respData = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const errorMsg =
        respData?.error?.message ||
        respData?.message ||
        `HTTP ${resp.status} ${resp.statusText}`;
      const err: any = new Error(errorMsg);
      err.statusCode = resp.status;
      err.data = respData;
      throw err;
    }

    const choice = respData?.choices?.[0];
    const text = choice?.message?.content || '';

    if (!text) {
      throw new Error('Model returned empty response content');
    }

    return { text, statusCode: resp.status };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr: any = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutErr.statusCode = 408;
      throw timeoutErr;
    }
    throw err;
  }
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropicClaude(
  credential: AiCredential,
  prompt: string,
  systemPrompt: string,
  timeoutMs: number
): Promise<string> {
  let baseUrl = credential.baseUrl?.trim() || 'https://api.anthropic.com/v1';
  baseUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/messages`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': credential.apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: credential.model.trim() || 'claude-3-5-haiku-20241022',
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2500,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const err: any = new Error(data?.error?.message || `Anthropic HTTP ${resp.status}`);
      err.statusCode = resp.status;
      throw err;
    }

    const textContent = data?.content?.find((c: any) => c.type === 'text')?.text || '';
    if (!textContent) throw new Error('Anthropic Claude returned empty content');
    return textContent;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr: any = new Error('Anthropic request timed out');
      timeoutErr.statusCode = 408;
      throw timeoutErr;
    }
    throw err;
  }
}

/**
 * Call Google Gemini using @google/genai SDK
 */
async function callGemini(
  credential: AiCredential,
  prompt: string,
  systemPrompt: string,
  timeoutMs: number
): Promise<string> {
  const apiKey = credential.apiKey.trim() || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const ai = new GoogleGenAI({ apiKey });
  const rawModel = credential.model.trim();
  const modelName = rawModel && rawModel !== 'gemini-2.5-flash' ? rawModel : 'gemini-3.1-flash-lite';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nTask:\n${prompt}` }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    clearTimeout(timeoutId);

    const text = response.text || '';
    if (!text) {
      throw new Error('Gemini returned an empty text response');
    }
    return text;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr: any = new Error('Gemini request timed out');
      timeoutErr.statusCode = 408;
      throw timeoutErr;
    }
    const msg = err?.message || '';
    if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) && modelName !== 'gemini-3.1-flash-lite') {
      try {
        const fbResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nTask:\n${prompt}` }],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
        if (fbResponse.text) {
          return fbResponse.text;
        }
      } catch {
        // proceed with original error handling
      }
    }
    throw err;
  }
}

/**
 * Test credential connection with a fast, lightweight ping
 */
export async function testCredentialConnection(credential: AiCredential): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  statusCode?: number;
}> {
  const startTime = Date.now();
  try {
    if (credential.provider === 'gemini') {
      const apiKey = credential.apiKey.trim() || process.env.GEMINI_API_KEY || '';
      if (!apiKey) throw new Error('API key is missing');
      const ai = new GoogleGenAI({ apiKey });
      const resp = await ai.models.generateContent({
        model: credential.model.trim() || 'gemini-3.1-flash-lite',
        contents: 'Respond with exactly: {"status": "ok"}',
        config: { responseMimeType: 'application/json' },
      });
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        message: `Connected successfully (${latencyMs}ms)`,
      };
    }

    if (credential.provider === 'claude') {
      let baseUrl = credential.baseUrl?.trim() || 'https://api.anthropic.com/v1';
      baseUrl = baseUrl.replace(/\/+$/, '');
      const resp = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': credential.apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: credential.model.trim() || 'claude-3-5-haiku-20241022',
          messages: [{ role: 'user', content: 'Ping test. Say {"status":"ok"}' }],
          max_tokens: 50,
        }),
      });
      const latencyMs = Date.now() - startTime;
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d?.error?.message || `HTTP ${resp.status}`);
      }
      return { success: true, latencyMs, message: `Connected to Anthropic (${latencyMs}ms)` };
    }

    // OpenAI compatible
    let baseUrl = credential.baseUrl?.trim() || '';
    if (!baseUrl) throw new Error('Base URL is missing');
    baseUrl = baseUrl.replace(/\/+$/, '');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credential.apiKey.trim()}`,
    };
    if (credential.workspaceId?.trim()) {
      headers['X-DashScope-WorkSpace'] = credential.workspaceId.trim();
    }

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: credential.model.trim(),
        messages: [{ role: 'user', content: 'Ping test. Respond with {"status":"ok"}' }],
        max_tokens: 20,
      }),
    });

    const latencyMs = Date.now() - startTime;
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = data?.error?.message || data?.message || `HTTP ${resp.status}`;
      return { success: false, latencyMs, statusCode: resp.status, message: msg };
    }

    return {
      success: true,
      latencyMs,
      statusCode: resp.status,
      message: `Connected successfully (${latencyMs}ms)`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      statusCode: err?.statusCode || 0,
      message: err?.message || 'Connection test failed',
    };
  }
}

/**
 * Model discovery: calls GET {baseUrl}/models
 */
export async function discoverModelsFromProvider(
  credential: AiCredential
): Promise<{ success: boolean; models: ModelCapability[]; message?: string }> {
  let baseUrl = credential.baseUrl?.trim() || '';
  if (!baseUrl) {
    return { success: false, models: [], message: 'Base URL is required for model discovery' };
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${credential.apiKey.trim()}`,
  };
  if (credential.workspaceId?.trim()) {
    headers['X-DashScope-WorkSpace'] = credential.workspaceId.trim();
  }

  try {
    const resp = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers,
    });

    if (!resp.ok) {
      return {
        success: false,
        models: [],
        message: `Provider returned HTTP ${resp.status} on /models`,
      };
    }

    const data = await resp.json().catch(() => ({}));
    const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

    const models: ModelCapability[] = rawList.map((m: any) => {
      const id = m.id || m.name || String(m);
      const name = m.name || m.id || String(m);
      const isFreeOrLowCost = id.includes('flash') || id.includes('turbo') || id.includes('mini') || id.includes('free');
      return {
        id,
        name,
        supportsJson: true,
        supportsStructuredOutput: true,
        supportsVision: id.includes('vl') || id.includes('vision'),
        isFreeOrLowCost,
        tier: isFreeOrLowCost ? 'low_cost' : 'standard',
      };
    });

    return { success: true, models };
  } catch (err: any) {
    return {
      success: false,
      models: [],
      message: `Model discovery failed: ${err.message}`,
    };
  }
}

function buildExtractionPrompt(
  companyName: string,
  sourceUrl: string,
  pageContents: { url: string; title: string; text: string }[],
  maxContacts: number,
  priorityRoles: string[],
  customRules?: string
): string {
  let prompt = `Company Target: ${companyName || 'Unknown'}\nPrimary Website: ${sourceUrl}\n`;

  if (customRules?.trim()) {
    prompt += `\n*** ACTIVE USER MANDATORY EXTRACTION RULES ***\n${customRules.trim()}\nEnsure your extraction strictly follows every active rule listed above.\n\n`;
  }

  if (maxContacts > 0) {
    prompt += `Extract up to ${maxContacts} primary business contacts (prioritize top management, owners, and sales decision makers).\n`;
  } else {
    prompt += `Extract all relevant publicly available business contacts.\n`;
  }

  if (priorityRoles.length > 0) {
    prompt += `Priority Role Preferences:\n${priorityRoles.map((r) => ` - ${r}`).join('\n')}\n`;
  }

  prompt += `\n--- SCRAPED INTERNAL WEBPAGE CONTENTS ---\n`;

  for (let i = 0; i < pageContents.length; i++) {
    const page = pageContents[i];
    prompt += `\n[PAGE ${i + 1}] URL: ${page.url}\nTITLE: ${page.title}\nCONTENT SNIPPET:\n${page.text.slice(0, 5000)}\n`;
  }

  prompt += `\nExtract the verified contacts now in the specified JSON schema. Remember to include the rule_evaluations audit in your output.`;
  return prompt;
}
