export type ProviderGroup = 'global' | 'chinese' | 'custom';

export type ProviderType =
  | 'qwen'
  | 'deepseek'
  | 'kimi'
  | 'glm'
  | 'minimax'
  | 'custom_chinese'
  | 'gemini'
  | 'openai'
  | 'claude'
  | 'custom_openai';

export type RoutingStrategy =
  | 'auto'
  | 'manual'
  | 'free_first'
  | 'low_cost_first'
  | 'fastest'
  | 'highest_quality';

export type CredentialStatus =
  | 'active'
  | 'cooldown'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'auth_error'
  | 'invalid_model'
  | 'disabled';

export type StandardErrorCode =
  | 'RATE_LIMIT'
  | 'QUOTA'
  | 'AUTH'
  | 'INVALID_MODEL'
  | 'REQUEST_TOO_LARGE'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface ModelCapability {
  id: string;
  name: string;
  contextWindow?: number;
  supportsJson: boolean;
  supportsStructuredOutput: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
  isFreeOrLowCost?: boolean;
  tier?: 'free' | 'low_cost' | 'standard' | 'flagship';
}

export interface AiCredential {
  id: string;
  provider: ProviderType;
  name: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  region?: string; // For Qwen: 'ap-southeast-1', 'cn-beijing', 'cn-hongkong', 'us-east-1', 'ap-northeast-1', 'custom'
  workspaceId?: string; // For Alibaba Model Studio
  priority: number; // 1 = highest
  enabled: boolean;
  status: CredentialStatus;
  cooldownUntil?: number; // epoch ms
  lastError?: {
    code: StandardErrorCode;
    message: string;
    timestamp: string;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rateLimits429: number;
    quotaErrors: number;
    totalLatencyMs: number;
    averageLatencyMs: number;
    lastUsed?: string;
  };
}

export interface FailoverEvent {
  id: string;
  timestamp: string;
  timeStr: string;
  level: 'info' | 'success' | 'warning' | 'error';
  provider: string;
  model?: string;
  credentialId?: string;
  message: string;
  companyUrl?: string;
}

export interface ExtractionTaskMetadata {
  provider: ProviderType;
  providerName: string;
  model: string;
  attempts: number;
  latencyMs: number;
  timestamp: string;
  status: 'success' | 'fallback_success' | 'failed';
  errorCodes?: StandardErrorCode[];
}
