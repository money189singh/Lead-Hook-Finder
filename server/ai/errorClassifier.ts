import { StandardErrorCode } from './types';

export interface ClassifiedError {
  code: StandardErrorCode;
  message: string;
  statusCode?: number;
  retryable: boolean;
  cooldownSeconds?: number;
}

export function classifyAiError(error: any, statusCode?: number): ClassifiedError {
  const status = statusCode || error?.status || error?.statusCode;
  const rawMsg = String(error?.message || error?.error?.message || error || '').toLowerCase();

  // 1. RATE_LIMIT (429)
  if (
    status === 429 ||
    rawMsg.includes('rate limit') ||
    rawMsg.includes('too many requests') ||
    rawMsg.includes('requests per minute') ||
    rawMsg.includes('tokens per minute') ||
    rawMsg.includes('tpm') ||
    rawMsg.includes('rpm') ||
    rawMsg.includes('throttled')
  ) {
    return {
      code: 'RATE_LIMIT',
      message: error?.message || 'Rate limit exceeded (HTTP 429)',
      statusCode: 429,
      retryable: true,
      cooldownSeconds: 60, // 60s cooldown
    };
  }

  // 2. QUOTA EXHAUSTED
  if (
    rawMsg.includes('quota') ||
    rawMsg.includes('insufficient_quota') ||
    rawMsg.includes('balance') ||
    rawMsg.includes('credit') ||
    rawMsg.includes('arrears') ||
    rawMsg.includes('run out of') ||
    rawMsg.includes('exceeded your current quota') ||
    rawMsg.includes('account deactivated') ||
    rawMsg.includes('free tier limit') ||
    rawMsg.includes('billing')
  ) {
    return {
      code: 'QUOTA',
      message: error?.message || 'Account quota or balance exhausted',
      statusCode: status || 402,
      retryable: false,
      cooldownSeconds: 3600, // 1 hour cooldown or disabled
    };
  }

  // 3. AUTH (401, 403)
  if (
    status === 401 ||
    status === 403 ||
    rawMsg.includes('unauthorized') ||
    rawMsg.includes('invalid api key') ||
    rawMsg.includes('authentication') ||
    rawMsg.includes('forbidden') ||
    rawMsg.includes('access denied') ||
    rawMsg.includes('permission')
  ) {
    return {
      code: 'AUTH',
      message: error?.message || 'Authentication failed: Invalid API key or access denied',
      statusCode: status || 401,
      retryable: false,
    };
  }

  // 4. INVALID_MODEL (404)
  if (
    status === 404 ||
    rawMsg.includes('model not found') ||
    rawMsg.includes('invalid model') ||
    rawMsg.includes('model does not exist') ||
    rawMsg.includes('does not support') ||
    rawMsg.includes('model_not_found')
  ) {
    return {
      code: 'INVALID_MODEL',
      message: error?.message || 'Specified model ID was not found or is unavailable for this API key',
      statusCode: status || 404,
      retryable: false,
    };
  }

  // 5. REQUEST_TOO_LARGE (413)
  if (
    status === 413 ||
    rawMsg.includes('too large') ||
    rawMsg.includes('maximum context length') ||
    rawMsg.includes('token limit exceeded')
  ) {
    return {
      code: 'REQUEST_TOO_LARGE',
      message: error?.message || 'Content exceeded model context limit',
      statusCode: status || 413,
      retryable: false,
    };
  }

  // 6. TIMEOUT (408)
  if (
    status === 408 ||
    rawMsg.includes('timeout') ||
    rawMsg.includes('timed out') ||
    rawMsg.includes('abort')
  ) {
    return {
      code: 'TIMEOUT',
      message: error?.message || 'Request timed out waiting for AI response',
      statusCode: status || 408,
      retryable: true,
      cooldownSeconds: 15,
    };
  }

  // 7. SERVER_ERROR (500, 502, 503, 504)
  if (status && status >= 500 && status < 600) {
    return {
      code: 'SERVER_ERROR',
      message: error?.message || `AI Provider server error (HTTP ${status})`,
      statusCode: status,
      retryable: true,
      cooldownSeconds: 30,
    };
  }

  // 8. NETWORK_ERROR
  if (
    rawMsg.includes('econnrefused') ||
    rawMsg.includes('enotfound') ||
    rawMsg.includes('network') ||
    rawMsg.includes('fetch failed')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message: error?.message || 'Network connectivity error reaching AI endpoint',
      statusCode: 0,
      retryable: true,
      cooldownSeconds: 20,
    };
  }

  return {
    code: 'UNKNOWN',
    message: error?.message || 'Unknown error occurred during AI processing',
    statusCode: status || 0,
    retryable: false,
  };
}
