export * from '../../src/types';

export interface SearchRetrieverResult {
  title: string;
  url: string;
  snippet: string;
  source_type: 'official_site' | 'government_registry' | 'business_directory' | 'linkedin_public' | 'press_or_report' | 'general_web' | 'unknown';
  query_used: string;
}

export interface ResearchPromptContext {
  companyName: string;
  domain?: string;
  website?: string;
  location?: string;
  requestedFields?: string[];
  sources: SearchRetrieverResult[];
}

export interface RawResearchExtraction {
  company_identity?: {
    official_name?: string;
    website?: string;
    domain?: string;
    linkedin_url?: string;
    location?: string;
    industry?: string;
    source_url?: string;
    evidence?: string;
  };
  company_profile?: {
    what_it_does?: string;
    products_services?: string[];
    description?: string;
    business_category?: string;
    source_url?: string;
    evidence?: string;
  };
  firmographics?: {
    employee_count?: string;
    employee_range?: string;
    employee_count_type?: 'exact' | 'approximate' | 'range' | 'lower_bound' | 'upper_bound';
    founded_year?: string;
    incorporation_year?: string;
    count_source_url?: string;
    count_evidence?: string;
    founded_source_url?: string;
    founded_evidence?: string;
  };
  decision_makers?: {
    full_name: string;
    job_title: string;
    company_association: string;
    department?: string;
    profile_url?: string;
    is_company_page?: boolean;
    source_url: string;
    evidence_snippet: string;
  }[];
  tokens_used?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  raw_response?: string;
}

export interface ResearchCacheItem {
  key: string;
  domain: string;
  company_name: string;
  result: any;
  cached_at: string;
  expires_at: string;
}
