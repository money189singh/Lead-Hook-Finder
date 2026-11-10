/**
 * Supported NVIDIA NIM Models & Configurations
 * Allows easy expansion of future NVIDIA models without rewriting the application.
 */

export interface NvidiaModelDefinition {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsJsonFormat: boolean;
  recommendedFor: ('decision_makers' | 'firmographics' | 'extraction' | 'classification' | 'reasoning')[];
}

export const NVIDIA_MODELS: Record<string, NvidiaModelDefinition> = {
  'openai/gpt-oss-20b': {
    id: 'openai/gpt-oss-20b',
    name: 'OpenAI GPT-OSS 20B (NVIDIA NIM Hosted)',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsJsonFormat: true,
    recommendedFor: ['decision_makers', 'firmographics', 'extraction', 'classification', 'reasoning'],
  },
  'meta/llama-3.2-11b-vision-instruct': {
    id: 'meta/llama-3.2-11b-vision-instruct',
    name: 'Meta Llama 3.2 11B Vision Instruct',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsJsonFormat: true,
    recommendedFor: ['extraction', 'classification'],
  },
  'meta/llama-3.2-90b-vision-instruct': {
    id: 'meta/llama-3.2-90b-vision-instruct',
    name: 'Meta Llama 3.2 90B Vision Instruct',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsJsonFormat: true,
    recommendedFor: ['decision_makers', 'firmographics', 'reasoning'],
  },
  'meta/llama-3.3-70b-instruct': {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Meta Llama 3.3 70B Instruct',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsJsonFormat: true,
    recommendedFor: ['decision_makers', 'firmographics', 'extraction', 'reasoning'],
  },
  'nvidia/nemotron-4-340b-instruct': {
    id: 'nvidia/nemotron-4-340b-instruct',
    name: 'NVIDIA Nemotron-4 340B Instruct',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsJsonFormat: true,
    recommendedFor: ['decision_makers', 'reasoning', 'firmographics'],
  },
};

export const DEFAULT_NVIDIA_MODEL = 'openai/gpt-oss-20b';

export function getActiveNvidiaModel(): string {
  const envModel = (process.env.NVIDIA_MODEL || '').trim();
  if (envModel) {
    return envModel;
  }
  return DEFAULT_NVIDIA_MODEL;
}

export function getNvidiaModelDefinition(modelId?: string): NvidiaModelDefinition {
  const id = modelId || getActiveNvidiaModel();
  if (NVIDIA_MODELS[id]) {
    return NVIDIA_MODELS[id];
  }
  return {
    id,
    name: id,
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsJsonFormat: true,
    recommendedFor: ['extraction', 'classification'],
  };
}
