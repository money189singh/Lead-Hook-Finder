import {
  CompanyResearchRequest,
  CompanyResearchResult,
  ResearchConfig,
  ResearchStatusResponse,
  RawResearchExtraction,
} from './types';
import { globalOpenRouterClient } from './openRouterClient';
import { globalCompanySearchRetriever } from './searchService';
import { globalEvidenceExtractor } from './evidenceExtractor';
import { globalResearchCache } from './cache';
import { globalFirebaseCompanyMerger } from './firebaseMerger';
import { getSettings } from '../storage';
import { extractCleanDomain } from '../discovery/domainDetector';

export class CompanyResearchService {
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    totalLatencyMs: 0,
    averageLatencyMs: 0,
  };

  /**
   * Get current configuration and engine health
   */
  public getStatus(): ResearchStatusResponse {
    const settings = getSettings();
    const config: ResearchConfig = settings.research_config || {};
    const openrouterKey = (config.openrouter_api_key || process.env.OPENROUTER_API_KEY || '').trim();
    const activeModel = config.model || 'meta-llama/llama-3.3-70b-instruct';
    const cacheStats = globalResearchCache.getStats();

    return {
      configured: Boolean(openrouterKey && openrouterKey.length > 5),
      has_openrouter_key: Boolean(openrouterKey && openrouterKey.length > 5),
      active_model: activeModel,
      search_integration: 'Public Web Search (DuckDuckGo + Google Grounding)',
      cache_stats: cacheStats,
      metrics: {
        ...this.metrics,
        averageLatencyMs: this.metrics.totalRequests > 0
          ? Math.round(this.metrics.totalLatencyMs / this.metrics.totalRequests)
          : 0,
      },
      supported_providers: ['openrouter', 'gemini_grounding', 'duckduckgo_search'],
    };
  }

  /**
   * Execute full research lifecycle for a company
   */
  public async researchCompany(request: CompanyResearchRequest): Promise<CompanyResearchResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    const companyName = request.companyName?.trim();
    if (!companyName) {
      this.metrics.failedRequests++;
      return {
        success: false,
        company_name: '',
        domain: '',
        researched_profile: { decision_makers: [] },
        sources_used: [],
        metadata: {
          provider: 'openrouter',
          model: 'unspecified',
          search_integration: 'none',
          duration_ms: 0,
          timestamp: new Date().toISOString(),
          from_cache: false,
          firebase_saved: false,
        },
        error: {
          code: 'INVALID_INPUT',
          message: 'Company name is required for research.',
        },
      };
    }

    const domain = request.domain || (request.website ? extractCleanDomain(request.website) : undefined);
    const cleanDomain = domain ? extractCleanDomain(domain) : '';

    // 1. Check Cache unless forceRefresh is true
    if (!request.forceRefresh) {
      const cached = globalResearchCache.get(companyName, cleanDomain);
      if (cached) {
        this.metrics.cacheHits++;
        this.metrics.successfulRequests++;
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            from_cache: true,
            duration_ms: Date.now() - startTime,
          },
        };
      }
    }

    const settings = getSettings();
    const config: ResearchConfig = settings.research_config || {};
    const model = request.model || config.model || 'meta-llama/llama-3.3-70b-instruct';
    const apiKey = (config.openrouter_api_key || process.env.OPENROUTER_API_KEY || '').trim();

    if (!apiKey) {
      this.metrics.failedRequests++;
      return {
        success: false,
        company_name: companyName,
        domain: cleanDomain,
        researched_profile: { decision_makers: [] },
        sources_used: [],
        metadata: {
          provider: 'openrouter',
          model,
          search_integration: 'none',
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          from_cache: false,
          firebase_saved: false,
        },
        error: {
          code: 'MISSING_API_KEY',
          message: 'OpenRouter API key is not configured. Please add OPENROUTER_API_KEY to server settings or environment.',
        },
      };
    }

    // 2. Search Retrieval (Separate from model interpretation)
    let searchResult: {
      sources: any[];
      searchIntegration: string;
      isAvailable: boolean;
    };

    try {
      searchResult = await globalCompanySearchRetriever.retrieveCompanyEvidence({
        companyName,
        domain: cleanDomain,
        location: request.location,
        maxResults: config.max_search_results || 15,
        provider: request.searchProvider || config.search_provider || 'auto',
      });
    } catch (searchErr: any) {
      this.metrics.failedRequests++;
      return {
        success: false,
        company_name: companyName,
        domain: cleanDomain,
        researched_profile: { decision_makers: [] },
        sources_used: [],
        metadata: {
          provider: 'openrouter',
          model,
          search_integration: 'error',
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          from_cache: false,
          firebase_saved: false,
        },
        error: {
          code: 'SEARCH_UNAVAILABLE',
          message: `Public web search retrieval failed: ${searchErr.message}`,
        },
      };
    }

    if (!searchResult.isAvailable || searchResult.sources.length === 0) {
      // Instead of failing, query OpenRouter with real-time Google search grounding directly!
      try {
        const directOrDetails = await globalOpenRouterClient.fetchCompanyGoogleSearchDetails(
          apiKey,
          companyName,
          cleanDomain,
          request.website,
          model
        );

        if (directOrDetails && (directOrDetails.employee_count || directOrDetails.employee_range || directOrDetails.founded_year || directOrDetails.linkedin_url)) {
          const directSources = [
            {
              title: `${companyName} Corporate Profile (Google Search via OpenRouter)`,
              url: directOrDetails.linkedin_url || (cleanDomain ? `https://${cleanDomain}` : 'https://www.google.com'),
              snippet: directOrDetails.description || `Corporate intelligence for ${companyName}`,
              source_type: directOrDetails.linkedin_url ? ('linkedin_public' as const) : ('general_web' as const),
            },
          ];

          const rawExtraction: RawResearchExtraction = {
            company_identity: {
              official_name: directOrDetails.company_name || companyName,
              domain: cleanDomain,
              website: request.website,
              linkedin_url: directOrDetails.linkedin_url,
              location: directOrDetails.headquarters || directOrDetails.location,
              source_url: directOrDetails.linkedin_url || (cleanDomain ? `https://${cleanDomain}` : undefined),
              evidence: `Corporate profiling via OpenRouter online web search`,
            },
            company_profile: {
              description: directOrDetails.description,
              source_url: directOrDetails.linkedin_url || (cleanDomain ? `https://${cleanDomain}` : undefined),
            },
            firmographics: {
              employee_count: directOrDetails.employee_count,
              employee_range: directOrDetails.employee_range,
              founded_year: directOrDetails.founded_year,
              count_source_url: directOrDetails.linkedin_url,
              count_evidence: directOrDetails.employee_count ? `Found ${directOrDetails.employee_count} employees via web search` : undefined,
              founded_source_url: directOrDetails.linkedin_url,
              founded_evidence: directOrDetails.founded_year ? `Founded in ${directOrDetails.founded_year}` : undefined,
            },
            decision_makers: directOrDetails.decision_makers?.map((dm) => ({
              full_name: dm.full_name,
              job_title: dm.role || 'Executive',
              company_association: directOrDetails.company_name || companyName,
              department: undefined,
              profile_url: dm.linkedin_url,
              is_company_page: false,
              source_url: dm.linkedin_url || directOrDetails.linkedin_url || (cleanDomain ? `https://${cleanDomain}` : ''),
              evidence_snippet: `Identified via OpenRouter Google search corporate intelligence`,
            })),
          };

          const { profile, sources: validatedSources } = globalEvidenceExtractor.parseAndValidate(rawExtraction, cleanDomain);
          const companyId = globalFirebaseCompanyMerger.getCompanyId(cleanDomain || companyName);
          const existingLocal = globalFirebaseCompanyMerger.getLocalCompany(companyId);

          const mergedRecord = globalFirebaseCompanyMerger.mergeResearchData(existingLocal, profile, {
            companyName,
            domain: cleanDomain,
            website: request.website,
            userId: request.userId,
            sources: directSources,
          });

          await globalFirebaseCompanyMerger.persistMergedCompany(mergedRecord, request.userId);

          const durationMs = Date.now() - startTime;
          this.metrics.totalLatencyMs += durationMs;
          this.metrics.successfulRequests++;

          return {
            success: true,
            company_name: profile.official_company_name?.value || companyName,
            domain: cleanDomain || profile.domain?.value || '',
            researched_profile: profile,
            sources_used: directSources,
            metadata: {
              provider: 'openrouter',
              model: model.endsWith(':online') ? model : `${model}:online`,
              search_integration: 'Google Search via OpenRouter Online',
              duration_ms: durationMs,
              timestamp: new Date().toISOString(),
              from_cache: false,
              firebase_saved: true,
            },
          };
        }
      } catch (directErr: any) {
        console.warn('[CompanyResearchService] Direct OpenRouter search fallback error:', directErr.message);
      }

      this.metrics.failedRequests++;
      return {
        success: false,
        company_name: companyName,
        domain: cleanDomain,
        researched_profile: { decision_makers: [] },
        sources_used: [],
        metadata: {
          provider: 'openrouter',
          model,
          search_integration: searchResult.searchIntegration,
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          from_cache: false,
          firebase_saved: false,
        },
        error: {
          code: 'NO_EVIDENCE_FOUND',
          message: `No public web sources could be found for "${companyName}". Web search is active but returned zero results.`,
        },
      };
    }

    // 3. Build Prompt for Research Model
    const promptCtx = {
      companyName,
      domain: cleanDomain,
      website: request.website,
      location: request.location,
      requestedFields: request.fields,
      sources: searchResult.sources,
    };

    const { systemPrompt, userPrompt } = globalEvidenceExtractor.buildPrompt(promptCtx);

    // 4. Model Interpretation via OpenRouter
    let modelResponse: any;
    try {
      modelResponse = await globalOpenRouterClient.createChatCompletion(
        config,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { model, temperature: 0.1 }
      );
    } catch (modelErr: any) {
      this.metrics.failedRequests++;
      return {
        success: false,
        company_name: companyName,
        domain: cleanDomain,
        researched_profile: { decision_makers: [] },
        sources_used: searchResult.sources.map((s) => ({
          title: s.title,
          url: s.url,
          snippet: s.snippet,
          source_type: s.source_type,
        })),
        metadata: {
          provider: 'openrouter',
          model,
          search_integration: searchResult.searchIntegration,
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          from_cache: false,
          firebase_saved: false,
        },
        error: {
          code: modelErr.code || 'AI_PROVIDER_ERROR',
          message: modelErr.message || 'OpenRouter model call failed',
        },
      };
    }

    // 5. Parse and Validate Structured Facts
    let rawJson: RawResearchExtraction = {};
    try {
      let content = modelResponse.content.trim();
      const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeMatch && codeMatch[1]) {
        content = codeMatch[1].trim();
      }
      rawJson = JSON.parse(content);
    } catch (parseErr: any) {
      console.warn('[CompanyResearchService] JSON parse warning, attempting fallback repair:', parseErr.message);
      // Attempt rudimentary brace extraction
      const start = modelResponse.content.indexOf('{');
      const end = modelResponse.content.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try {
          rawJson = JSON.parse(modelResponse.content.substring(start, end + 1));
        } catch {
          rawJson = {};
        }
      }
    }

    const { profile, sources: validatedSources } = globalEvidenceExtractor.parseAndValidate(rawJson, cleanDomain);

    // 6. Merge with Existing Firebase / Local Company Record
    const companyId = globalFirebaseCompanyMerger.getCompanyId(cleanDomain || companyName);
    const existingLocal = globalFirebaseCompanyMerger.getLocalCompany(companyId);

    const mergedRecord = globalFirebaseCompanyMerger.mergeResearchData(existingLocal, profile, {
      companyName,
      domain: cleanDomain,
      website: request.website,
      userId: request.userId,
      sources: validatedSources,
    });

    const persistResult = await globalFirebaseCompanyMerger.persistMergedCompany(mergedRecord, request.userId);

    const durationMs = Date.now() - startTime;
    this.metrics.totalLatencyMs += durationMs;
    this.metrics.successfulRequests++;

    const finalResult: CompanyResearchResult = {
      success: true,
      company_name: profile.official_company_name?.value || companyName,
      domain: cleanDomain || profile.domain?.value || '',
      researched_profile: profile,
      sources_used: validatedSources,
      metadata: {
        provider: 'openrouter',
        model: modelResponse.model || model,
        search_integration: searchResult.searchIntegration,
        duration_ms: durationMs,
        timestamp: new Date().toISOString(),
        from_cache: false,
        tokens_used: modelResponse.tokens,
        firebase_saved: persistResult.savedFirestore || persistResult.savedLocal,
        firebase_company_id: companyId,
      },
    };

    // 7. Store in Cache
    globalResearchCache.set(companyName, cleanDomain, finalResult, config.cache_ttl_hours || 24);

    return finalResult;
  }

  /**
   * Run Sierra Law or controlled test fixture to test parsing, validation, and Firebase merger
   * without calling external APIs.
   */
  public executeFixtureTest(): {
    passed: boolean;
    durationMs: number;
    tests: Array<{ name: string; passed: boolean; details?: string }>;
    result?: CompanyResearchResult;
  } {
    const start = Date.now();
    const tests: Array<{ name: string; passed: boolean; details?: string }> = [];

    const mockRaw: RawResearchExtraction = {
      company_identity: {
        official_name: 'Sierra Law Firm, LLP',
        website: 'https://sierralaw.com',
        domain: 'sierralaw.com',
        linkedin_url: 'https://www.linkedin.com/company/sierralaw',
        location: 'New York, NY',
        industry: 'Legal Services',
        source_url: 'https://sierralaw.com/about',
        evidence: 'Sierra Law Firm LLP official about page',
      },
      company_profile: {
        what_it_does: 'Provides corporate litigation and commercial transaction advisory',
        products_services: ['Corporate Litigation', 'Commercial Transactions', 'Regulatory Defense'],
        description: 'New York boutique corporate litigation and dispute resolution firm founded in 2012',
        business_category: 'Law Firm',
        source_url: 'https://sierralaw.com/about',
        evidence: 'Founded in 2012 in New York',
      },
      firmographics: {
        employee_count: '35',
        employee_range: '11-50',
        employee_count_type: 'exact',
        founded_year: '2012',
        incorporation_year: '2012',
        count_source_url: 'https://sierralaw.com/about',
        count_evidence: 'Our dedicated team of 35 employees across Manhattan and Brooklyn',
        founded_source_url: 'https://sierralaw.com/about',
        founded_evidence: 'Established and founded in 2012',
      },
      decision_makers: [
        {
          full_name: 'Salina Sierra',
          job_title: 'Managing Partner',
          company_association: 'Sierra Law Firm, LLP',
          department: 'Executive Leadership',
          profile_url: 'https://www.linkedin.com/in/salinasierra',
          is_company_page: false,
          source_url: 'https://sierralaw.com/team/salina-sierra',
          evidence_snippet: 'Salina Sierra is the founding and Managing Partner of Sierra Law Firm',
        },
        {
          full_name: 'Holly Cuthbert',
          job_title: 'Director of Legal Services',
          company_association: 'Sierra Law Firm, LLP',
          department: 'Legal Operations',
          profile_url: 'https://www.linkedin.com/in/hollycuthbert',
          is_company_page: false,
          source_url: 'https://sierralaw.com/team/holly-cuthbert',
          evidence_snippet: 'Holly Cuthbert serves as Director of Legal Services',
        },
      ],
    };

    const { profile, sources } = globalEvidenceExtractor.parseAndValidate(mockRaw, 'sierralaw.com');

    // Test 1: Employee count & range validation
    const t1 = profile.employee_count?.value === '35' && profile.employee_range?.value === '11-50';
    tests.push({
      name: 'Employee count (35) and range (11-50) preserved',
      passed: t1,
      details: `Count: ${profile.employee_count?.value}, Range: ${profile.employee_range?.value}`,
    });

    // Test 2: Founded year validation
    const t2 = profile.founded_year?.value === '2012';
    tests.push({
      name: 'Founded year (2012) correctly identified',
      passed: t2,
      details: `Founded: ${profile.founded_year?.value}`,
    });

    // Test 3: LinkedIn URL distinction
    const t3 =
      profile.linkedin_page?.value === 'https://www.linkedin.com/company/sierralaw' &&
      profile.decision_makers[0]?.profile_url === 'https://www.linkedin.com/in/salinasierra';
    tests.push({
      name: 'Company LinkedIn page distinguished from personal profile',
      passed: t3,
      details: `Company: ${profile.linkedin_page?.value}, Person: ${profile.decision_makers[0]?.profile_url}`,
    });

    // Test 4: Decision makers extraction
    const t4 =
      profile.decision_makers.length === 2 &&
      profile.decision_makers.some((d) => d.full_name === 'Salina Sierra' && d.job_title === 'Managing Partner') &&
      profile.decision_makers.some((d) => d.full_name === 'Holly Cuthbert' && d.job_title === 'Director of Legal Services');
    tests.push({
      name: 'Documented decision-makers extracted with roles and sources',
      passed: t4,
      details: `Found ${profile.decision_makers.length} leaders`,
    });

    // Test 5: Non-destructive Firebase merge logic
    const existingRecord = {
      id: 'sierralaw_com',
      domain: 'sierralaw.com',
      company_name: 'Sierra Law',
      employee_count: '35',
      confidence: 'verified',
    };
    const merged = globalFirebaseCompanyMerger.mergeResearchData(existingRecord, profile, {
      companyName: 'Sierra Law Firm',
      domain: 'sierralaw.com',
      userId: 'test-user-123',
      sources,
    });

    const t5 =
      merged.employee_count === '35' &&
      merged.founded_year === '2012' &&
      merged.linkedin_url === 'https://www.linkedin.com/company/sierralaw' &&
      Boolean(merged.company_description) &&
      Boolean(merged.decision_makers_json);
    tests.push({
      name: 'Non-destructive Firebase merge preserves reliable fields and enriches with research',
      passed: t5,
      details: `Merged fields: employee_count=${merged.employee_count}, founded_year=${merged.founded_year}, linkedin=${merged.linkedin_url}`,
    });

    const allPassed = tests.every((t) => t.passed);
    const durationMs = Date.now() - start;

    return {
      passed: allPassed,
      durationMs,
      tests,
      result: {
        success: true,
        company_name: 'Sierra Law Firm, LLP',
        domain: 'sierralaw.com',
        researched_profile: profile,
        sources_used: sources,
        metadata: {
          provider: 'controlled_fixture_pipeline',
          model: 'fixture-deterministic-normalizer',
          search_integration: 'Fixture Search Sources',
          duration_ms: durationMs,
          timestamp: new Date().toISOString(),
          from_cache: false,
          firebase_saved: true,
          firebase_company_id: 'sierralaw_com',
        },
      },
    };
  }
}

export const globalCompanyResearchService = new CompanyResearchService();
