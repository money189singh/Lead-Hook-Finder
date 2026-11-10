import { ModelCapability, ProviderGroup, ProviderType } from './types';

export interface ProviderDefinition {
  id: ProviderType;
  name: string;
  group: ProviderGroup;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  supportsModelDiscovery: boolean;
  supportsJsonMode: boolean;
  supportsRegions?: boolean;
  regions?: { id: string; name: string; baseUrl: string }[];
  recommendedModels: ModelCapability[];
  docsUrl: string;
}

export const QWEN_REGIONS = [
  {
    id: 'ap-southeast-1',
    name: 'Singapore (International)',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'cn-beijing',
    name: 'China Beijing (Mainland)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'cn-hongkong',
    name: 'Hong Kong (China)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'us-east-1',
    name: 'US Virginia (North America)',
    baseUrl: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'ap-northeast-1',
    name: 'Japan Tokyo (Asia East)',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'custom',
    name: 'Custom Regional Endpoint',
    baseUrl: '',
  },
];

export const PROVIDER_DEFINITIONS: Record<ProviderType, ProviderDefinition> = {
  // --- CHINESE PROVIDERS ---
  qwen: {
    id: 'qwen',
    name: 'Alibaba Qwen / Model Studio',
    group: 'chinese',
    description: 'DashScope Model Studio with regional endpoints, Qwen 2.5, Coder & Multimodal models',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    supportsRegions: true,
    regions: QWEN_REGIONS,
    recommendedModels: [
      { id: 'qwen-plus', name: 'Qwen Plus (Balanced & Fast)', supportsJson: true, supportsStructuredOutput: true, tier: 'standard' },
      { id: 'qwen-turbo', name: 'Qwen Turbo (Ultra High Speed)', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'qwen-max', name: 'Qwen Max (Flagship Quality)', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
      { id: 'qwen2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
      { id: 'qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', supportsJson: true, supportsStructuredOutput: true, tier: 'standard' },
      { id: 'qwen-vl-plus', name: 'Qwen VL Plus (Multimodal)', supportsJson: true, supportsStructuredOutput: true, supportsVision: true, tier: 'standard' },
    ],
    docsUrl: 'https://help.aliyun.com/document_detail/2712195.html',
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    group: 'chinese',
    description: 'High-performance, cost-effective reasoning & chat models with OpenAI-compatible API',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    recommendedModels: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
    ],
    docsUrl: 'https://platform.deepseek.com/api-docs/',
  },

  kimi: {
    id: 'kimi',
    name: 'Moonshot Kimi',
    group: 'chinese',
    description: 'Moonshot AI high-context window models with structured data output',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    recommendedModels: [
      { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', supportsJson: true, supportsStructuredOutput: true, tier: 'standard' },
      { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
      { id: 'kimi-latest', name: 'Kimi Latest', supportsJson: true, supportsStructuredOutput: true, tier: 'standard' },
    ],
    docsUrl: 'https://platform.moonshot.cn/docs',
  },

  glm: {
    id: 'glm',
    name: 'Zhipu GLM',
    group: 'chinese',
    description: 'Zhipu AI BigModel platform featuring GLM-4 Flash (Free) and high-accuracy extraction',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    recommendedModels: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash (Free Tier)', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'free' },
      { id: 'glm-4-air', name: 'GLM-4 Air (Fast & Cost Efficient)', supportsJson: true, supportsStructuredOutput: true, tier: 'low_cost' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus (High Precision)', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
      { id: 'glm-4', name: 'GLM-4 Standard', supportsJson: true, supportsStructuredOutput: true, tier: 'standard' },
    ],
    docsUrl: 'https://open.bigmodel.cn/dev/api',
  },

  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    group: 'chinese',
    description: 'MiniMax text intelligence and abab series models',
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    recommendedModels: [
      { id: 'abab6.5s-chat', name: 'MiniMax abab 6.5s Chat', supportsJson: true, supportsStructuredOutput: true, tier: 'standard' },
      { id: 'MiniMax-Text-01', name: 'MiniMax Text 01', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
    ],
    docsUrl: 'https://www.minimaxi.com/document/platform',
  },

  custom_chinese: {
    id: 'custom_chinese',
    name: 'Other Chinese Provider',
    group: 'chinese',
    description: 'Custom Chinese AI provider offering an OpenAI-compatible REST API',
    defaultBaseUrl: '',
    defaultModel: '',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    recommendedModels: [],
    docsUrl: '',
  },

  // --- GLOBAL PROVIDERS ---
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    group: 'global',
    description: 'Google DeepMind state-of-the-art multimodal and high-speed extraction engine',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-3.1-flash-lite',
    supportsModelDiscovery: false,
    supportsJsonMode: true,
    recommendedModels: [
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (High Quota & Ultra Fast)', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Deep Precision)', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning)', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
    ],
    docsUrl: 'https://ai.google.dev/',
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    group: 'global',
    description: 'Official OpenAI GPT-4o, GPT-4o mini, and reasoning models',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    recommendedModels: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost Efficient)', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'gpt-4o', name: 'GPT-4o (High Performance)', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
      { id: 'o3-mini', name: 'o3-mini (Reasoning)', supportsJson: true, supportsStructuredOutput: true, tier: 'standard' },
    ],
    docsUrl: 'https://platform.openai.com/docs',
  },

  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    group: 'global',
    description: 'Anthropic Claude 3.5 Sonnet & Haiku with exceptional comprehension',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    supportsModelDiscovery: false,
    supportsJsonMode: true,
    recommendedModels: [
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast & Affordable)', supportsJson: true, supportsStructuredOutput: true, isFreeOrLowCost: true, tier: 'low_cost' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State of the Art)', supportsJson: true, supportsStructuredOutput: true, tier: 'flagship' },
    ],
    docsUrl: 'https://docs.anthropic.com/',
  },

  custom_openai: {
    id: 'custom_openai',
    name: 'Custom OpenAI-Compatible',
    group: 'custom',
    description: 'Any self-hosted (vLLM, Ollama, LocalAI) or third-party OpenAI-compatible API gateway',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: '',
    supportsModelDiscovery: true,
    supportsJsonMode: true,
    recommendedModels: [],
    docsUrl: '',
  },
};
