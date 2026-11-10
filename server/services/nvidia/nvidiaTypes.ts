export interface NvidiaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NvidiaChatCompletionRequest {
  model: string;
  messages: NvidiaMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: {
    type: 'json_object' | 'text';
  };
}

export interface NvidiaChatCompletionChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    reasoning?: string;
    reasoning_content?: string;
  };
  finish_reason: string;
}

export interface NvidiaChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: NvidiaChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface NvidiaGenerateOptions {
  model?: string;
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  useCache?: boolean;
  promptVersion?: string;
}

export interface NvidiaExtractOptions<T = any> {
  model?: string;
  systemPrompt?: string;
  text: string;
  schemaDescription: string;
  exampleJson?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  useCache?: boolean;
  promptVersion?: string;
  validator?: (data: any) => T;
}

export interface NvidiaClassifyOptions {
  model?: string;
  text: string;
  categories: string[];
  context?: string;
  temperature?: number;
  useCache?: boolean;
  promptVersion?: string;
}

export interface NvidiaAnalyzeOptions {
  model?: string;
  systemPrompt?: string;
  content: string;
  questionsOrAspects: string[];
  temperature?: number;
  useCache?: boolean;
  promptVersion?: string;
}

export interface NvidiaCacheEntry {
  contentHash: string;
  model: string;
  promptVersion: string;
  result: any;
  cachedAt: string;
  hitCount: number;
}

export interface NvidiaHealthStatus {
  isConfigured: boolean;
  model: string;
  endpoint: string;
  cacheEntriesCount: number;
  lastUsedAt?: string;
  lastStatus?: 'ok' | 'rate_limited' | 'error';
  lastError?: string;
}
