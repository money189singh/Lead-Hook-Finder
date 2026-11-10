import {
  BusinessStatus,
  StatusConfidence,
  LeadEligibility,
  VerificationLevel,
  CustomVerificationOptions,
  VerificationResult,
  BusinessVerifierRules,
  VerificationTrace,
} from '../../src/types';
import { globalWebsiteChecker, WebsiteCheckResult } from './websiteChecker';
import { globalGoogleMapsVerifier, GoogleMapsCheckResult } from './googleMaps';
import { globalSearchVerifier, SearchVerificationResult } from './searchChecker';
import { globalGovernmentVerifier } from './govChecker';
import { globalGovFilesVerifier, GovFilesCheckResult } from './govFiles';
import { globalAiVerifier } from './aiVerifier';

export interface VerificationExecutionInput {
  business_name: string;
  url: string;
  address?: string;
  phone?: string;
  city?: string;
  state?: string;
  zip?: string;
  level: VerificationLevel;
  custom_options?: CustomVerificationOptions;
  rules?: BusinessVerifierRules;
  govfiles_enabled?: boolean;
  api_keys?: {
    google_maps?: string;
    search_1?: string;
    search_2?: string;
    govfiles?: string;
    gov_1?: string;
  };
  onProgressStep?: (stepText: string) => void;
}

export class VerificationRuleEngine {
  /**
   * Executes the Cost-Efficient Verification Ladder with real Google Maps, Website, GovFiles, Search, and AI checks
   */
  public async executeVerificationLadder(
    input: VerificationExecutionInput,
    creditsUsed: number
  ): Promise<{
    result: VerificationResult;
    apiUsageCounts: {
      google_maps_calls: number;
      search_calls: number;
      gov_calls: number;
      govfiles_calls: number;
      ai_calls: number;
      api_errors: number;
      fallback_events: number;
    };
  }> {
    const apiCounts = {
      google_maps_calls: 0,
      search_calls: 0,
      gov_calls: 0,
      govfiles_calls: 0,
      ai_calls: 0,
      api_errors: 0,
      fallback_events: 0,
    };

    const statusSources: string[] = [];
    const evidenceNotes: string[] = [];

    const now = new Date();
    const lastVerified = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;

    const { level, custom_options } = input;

    // Determine what checks should run based on Level and Custom Options
    const shouldCheckWebsite =
      level === 'LOW' || level === 'MEDIUM' || level === 'HIGH' || Boolean(custom_options?.checkWebsite);

    const shouldCheckGoogleMaps =
      level === 'LOW' || level === 'MEDIUM' || level === 'HIGH' || Boolean(custom_options?.checkGoogleMaps);

    const shouldCheckSearch =
      level === 'MEDIUM' || level === 'HIGH' || Boolean(custom_options?.checkSearch);

    // GovFiles / Government check enabled for HIGH, or custom, or default enabled
    const shouldCheckGovFiles =
      input.govfiles_enabled !== false &&
      (level === 'HIGH' || Boolean(custom_options?.checkGovernment));

    const allowAiInterpretation =
      level === 'MEDIUM' || level === 'HIGH' || Boolean(custom_options?.aiOnlyWhenUncertain);

    // Initialize Verification Trace
    const trace: VerificationTrace = {
      google_maps: { status: shouldCheckGoogleMaps ? 'CHECKED' : 'SKIPPED' },
      website: { status: shouldCheckWebsite ? 'CHECKED' : 'SKIPPED' },
      website_last_modified: { status: 'NOT FOUND' },
      website_activity: { status: shouldCheckWebsite ? 'CHECKED' : 'SKIPPED' },
      govfiles: { status: shouldCheckGovFiles ? 'CHECKED' : 'SKIPPED' },
      search: { status: shouldCheckSearch ? 'CHECKED' : 'SKIPPED' },
      ai: { status: 'NOT USED' },
    };

    let websiteResult: WebsiteCheckResult | undefined;
    let mapsResult: GoogleMapsCheckResult | undefined;
    let searchResult: SearchVerificationResult | undefined;
    let govFilesResult: GovFilesCheckResult | undefined;

    // ── 1. STEP 1: Website Health & Content Recency Check ──
    if (shouldCheckWebsite) {
      input.onProgressStep?.('✓ Checking website status and last updated dates...');
      websiteResult = await globalWebsiteChecker.checkWebsite(input.url);
      statusSources.push('Website HTTP/Content');
      evidenceNotes.push(`Website: ${websiteResult.website_status} (${websiteResult.website_activity_evidence})`);

      trace.website = {
        status: 'CHECKED',
        timestamp: new Date().toISOString().slice(11, 19),
        detail: `HTTP ${websiteResult.website_http_status} (${websiteResult.website_status})${websiteResult.is_secure_ssl ? ' [SSL]' : ''}`,
      };

      if (websiteResult.latest_website_content_date !== 'UNKNOWN') {
        trace.website_last_modified = {
          status: 'FOUND',
          timestamp: new Date().toISOString().slice(11, 19),
          detail: `${websiteResult.latest_website_content_date} (Source: ${websiteResult.website_date_source})`,
        };
      } else if (websiteResult.website_last_modified !== 'UNKNOWN') {
        trace.website_last_modified = {
          status: 'FOUND',
          timestamp: new Date().toISOString().slice(11, 19),
          detail: `${websiteResult.website_last_modified} (Source: HTTP Last-Modified)`,
        };
      } else {
        trace.website_last_modified = {
          status: 'NOT FOUND',
          detail: 'No reliable content date found on site (copyright excluded)',
        };
      }

      trace.website_activity = {
        status: 'CHECKED',
        detail: websiteResult.website_activity_evidence,
      };
    }

    // ── 2. STEP 2: Google Maps / Places Operational Status Check ──
    if (shouldCheckGoogleMaps) {
      input.onProgressStep?.('✓ Checking Google Maps / Places operational status...');
      apiCounts.google_maps_calls += 1;

      // Extract state hint if available from address
      const stateHint = input.state || globalGovernmentVerifier.detectUsState(input.address, input.phone);

      mapsResult = await globalGoogleMapsVerifier.verifyBusiness(
        input.business_name,
        input.url,
        input.address,
        input.phone,
        input.city,
        stateHint,
        input.zip,
        input.api_keys?.google_maps
      );

      if (mapsResult.lookup_status === 'ERROR') {
        apiCounts.api_errors += 1;
      }
      if (mapsResult.fallback_occurred) {
        apiCounts.fallback_events += 1;
      }

      trace.google_maps = {
        status: mapsResult.lookup_status === 'FOUND' ? 'FOUND' : mapsResult.lookup_status === 'ERROR' ? 'ERROR' : 'NOT FOUND',
        timestamp: new Date().toISOString().slice(11, 19),
        detail: mapsResult.google_maps_found
          ? `${mapsResult.status} (Match: ${mapsResult.match_confidence}, ${mapsResult.provider_used})`
          : mapsResult.evidence,
      };

      if (mapsResult.google_maps_found) {
        statusSources.push(`Google Maps (${mapsResult.provider_used})`);
        evidenceNotes.push(mapsResult.evidence);
      }
    }

    // ── 3. STEP 3: Government Verification (GovFiles) ──
    if (shouldCheckGovFiles) {
      input.onProgressStep?.('✓ Checking GovFiles government registry...');
      apiCounts.gov_calls += 1;
      apiCounts.govfiles_calls += 1;

      const stateHint = input.state || globalGovernmentVerifier.detectUsState(input.address, input.phone);

      govFilesResult = await globalGovFilesVerifier.searchCompany(
        input.business_name,
        stateHint,
        input.api_keys?.govfiles
      );

      if (govFilesResult.status === 'ERROR') {
        apiCounts.api_errors += 1;
      }

      trace.govfiles = {
        status: govFilesResult.status === 'FOUND' ? 'FOUND' : govFilesResult.status === 'ERROR' ? 'ERROR' : 'NOT FOUND',
        timestamp: new Date().toISOString().slice(11, 19),
        detail: govFilesResult.evidence,
      };

      if (govFilesResult.government_entity_found) {
        statusSources.push(govFilesResult.government_source || 'GovFiles');
        evidenceNotes.push(govFilesResult.evidence);
      }
    }

    // ── 4. STEP 4: Search Verification (MEDIUM & HIGH) ──
    if (shouldCheckSearch) {
      input.onProgressStep?.('✓ Checking web search reviews and activity...');
      apiCounts.search_calls += 1;
      searchResult = await globalSearchVerifier.verifyBusiness(
        input.business_name,
        input.url,
        input.address,
        level === 'HIGH' ? 'HIGH' : 'MEDIUM',
        {
          search1Key: input.api_keys?.search_1,
          search2Key: input.api_keys?.search_2,
        }
      );

      trace.search = {
        status: 'CHECKED',
        timestamp: new Date().toISOString().slice(11, 19),
        detail: searchResult.evidence_summary,
      };

      statusSources.push(`Search Index (${searchResult.provider_used})`);
      evidenceNotes.push(`Search: ${searchResult.evidence_summary}`);
    }

    // ── 5. DECISIVE DETERMINISTIC CLASSIFICATION ──
    input.onProgressStep?.('✓ Applying deterministic rules to synthesize status...');

    let finalStatus: BusinessStatus = 'UNCERTAIN';
    let confidence: StatusConfidence = 'LOW';
    let needsAiSynthesis = false;

    // Rule 1: Google explicitly reports PERMANENTLY CLOSED (strong evidence)
    if (
      mapsResult &&
      mapsResult.status === 'PERMANENTLY CLOSED' &&
      (mapsResult.match_confidence === 'Exact match' || mapsResult.match_confidence === 'High confidence')
    ) {
      finalStatus = 'PERMANENTLY CLOSED';
      confidence = 'HIGH';
      evidenceNotes.push('Decisive: Google Maps explicitly lists listing as PERMANENTLY CLOSED.');
    }
    // Rule 2: Google explicitly reports TEMPORARILY CLOSED
    else if (
      mapsResult &&
      mapsResult.status === 'TEMPORARILY CLOSED' &&
      (mapsResult.match_confidence === 'Exact match' || mapsResult.match_confidence === 'High confidence')
    ) {
      finalStatus = 'TEMPORARILY CLOSED';
      confidence = 'HIGH';
      evidenceNotes.push('Decisive: Google Maps explicitly lists listing as TEMPORARILY CLOSED.');
    }
    // Rule 3: Explicit closure banners on official website
    else if (websiteResult && websiteResult.closure_signals_detected.length > 0) {
      finalStatus = 'PERMANENTLY CLOSED';
      confidence = 'HIGH';
      evidenceNotes.push(`Decisive: Closure notice detected on company website: "${websiteResult.closure_signals_detected[0]}"`);
    }
    // Rule 4: GovFiles corporate entity dissolved/revoked + website offline or closure found
    else if (
      govFilesResult &&
      govFilesResult.status === 'FOUND' &&
      govFilesResult.government_entity_found &&
      (govFilesResult.government_entity_status === 'DISSOLVED' ||
        govFilesResult.government_entity_status === 'TERMINATED' ||
        govFilesResult.government_entity_status === 'REVOKED') &&
      websiteResult?.website_status === 'OFFLINE'
    ) {
      finalStatus = 'PERMANENTLY CLOSED';
      confidence = 'HIGH';
      evidenceNotes.push(`GovFiles reports entity is ${govFilesResult.government_entity_status} and official website is OFFLINE.`);
    }
    // Rule 5: Google Maps OPEN + Website WORKING + matching information
    else if (
      mapsResult &&
      mapsResult.status === 'OPEN' &&
      (mapsResult.match_confidence === 'Exact match' || mapsResult.match_confidence === 'High confidence') &&
      websiteResult?.website_status === 'WORKING'
    ) {
      finalStatus = 'OPEN';
      confidence = 'HIGH';
      evidenceNotes.push('Google Maps verified operational with matching business name and active website.');
    }
    // Rule 6: Google Maps OPEN + GovFiles ACTIVE
    else if (
      mapsResult &&
      mapsResult.status === 'OPEN' &&
      govFilesResult &&
      govFilesResult.status === 'FOUND' &&
      govFilesResult.government_entity_found &&
      govFilesResult.government_entity_status === 'ACTIVE'
    ) {
      finalStatus = 'OPEN';
      confidence = 'HIGH';
      evidenceNotes.push('Google Maps operational listing corroborated by active GovFiles state registration.');
    }
    // Rule 7: Website WORKING with recent verified content date (within last 24 months)
    else if (
      websiteResult?.website_status === 'WORKING' &&
      websiteResult.latest_website_content_date !== 'UNKNOWN' &&
      new Date(websiteResult.latest_website_content_date).getFullYear() >= 2024
    ) {
      finalStatus = 'OPEN';
      confidence = 'HIGH';
      evidenceNotes.push(`Active website with verified recent content timestamp (${websiteResult.latest_website_content_date} from ${websiteResult.website_date_source}).`);
    }
    // Rule 8: Website WORKING without negative signals
    else if (
      websiteResult?.website_status === 'WORKING' &&
      (!mapsResult || mapsResult.status !== 'PERMANENTLY CLOSED') &&
      (!searchResult || searchResult.status !== 'CLOSURE_INDICATOR_FOUND')
    ) {
      finalStatus = 'OPEN';
      confidence = 'MEDIUM';
      evidenceNotes.push('Website actively responding HTTP 200 with valid SSL and contact points.');
    }
    // Ambiguous / Conflicting cases:
    else if (
      (websiteResult?.website_status === 'WORKING' && searchResult?.status === 'CLOSURE_INDICATOR_FOUND') ||
      (govFilesResult && govFilesResult.government_entity_status === 'DISSOLVED' && websiteResult?.website_status === 'WORKING') ||
      (websiteResult?.website_status === 'OFFLINE' && mapsResult?.status === 'OPEN')
    ) {
      // Direct conflict between sources
      needsAiSynthesis = true;
    }
    // Insufficient evidence (website offline and no Maps/Gov confirmation) -> UNCERTAIN (do NOT mark permanently closed!)
    else if (websiteResult?.website_status === 'OFFLINE' || websiteResult?.website_status === 'ERROR') {
      finalStatus = 'UNCERTAIN';
      confidence = 'LOW';
      evidenceNotes.push('Website is offline/unreachable and no conclusive closure record found. Marked UNCERTAIN per verification rules.');
    } else {
      needsAiSynthesis = true;
    }

    // ── 6. STEP 6: AI Evidence Synthesis (Only when conflicting or ambiguous) ──
    if (needsAiSynthesis && allowAiInterpretation) {
      input.onProgressStep?.('✓ Analyzing ambiguous evidence with AI synthesizer...');
      apiCounts.ai_calls += 1;

      const aiOutput = await globalAiVerifier.interpretEvidence({
        business_name: input.business_name,
        domain: input.url,
        address: input.address,
        google_status: mapsResult?.status,
        google_match: mapsResult?.match_confidence,
        website_status: websiteResult?.website_status,
        website_http_status: websiteResult?.website_http_status,
        recent_content_date: websiteResult?.latest_website_content_date,
        closure_signals: websiteResult?.closure_signals_detected,
        latest_review_date: mapsResult?.user_ratings_total ? `${mapsResult.rating || 0} stars` : undefined,
        government_status: govFilesResult?.government_entity_status,
        search_evidence: searchResult?.evidence_summary,
        user_rules: input.rules?.ai_usage_rules,
      });

      finalStatus = aiOutput.status;
      confidence = aiOutput.confidence;
      statusSources.push('AI Evidence Synthesizer');
      evidenceNotes.push(`AI Analysis: ${aiOutput.reasoning} (${aiOutput.evidence_summary})`);

      trace.ai = {
        status: 'USED',
        timestamp: new Date().toISOString().slice(11, 19),
        detail: `Classified as ${finalStatus} (${confidence} confidence)`,
      };
    } else {
      trace.ai = {
        status: 'NOT USED',
        detail: 'Deterministic verification rules were decisive',
      };
    }

    input.onProgressStep?.(`→ Final status: ${finalStatus}`);

    return {
      result: this.assembleResult({
        input,
        creditsUsed,
        lastVerified,
        finalStatus,
        confidence,
        evidenceNotes,
        statusSources,
        trace,
        websiteResult,
        mapsResult,
        searchResult,
        govFilesResult,
      }),
      apiUsageCounts: apiCounts,
    };
  }

  private assembleResult(params: {
    input: VerificationExecutionInput;
    creditsUsed: number;
    lastVerified: string;
    finalStatus: BusinessStatus;
    confidence: StatusConfidence;
    evidenceNotes: string[];
    statusSources: string[];
    trace: VerificationTrace;
    websiteResult?: WebsiteCheckResult;
    mapsResult?: GoogleMapsCheckResult;
    searchResult?: SearchVerificationResult;
    govFilesResult?: GovFilesCheckResult;
  }): VerificationResult {
    const {
      input,
      creditsUsed,
      lastVerified,
      finalStatus,
      confidence,
      evidenceNotes,
      statusSources,
      trace,
      websiteResult,
      mapsResult,
      searchResult,
      govFilesResult,
    } = params;

    // Requirement #13: Lead Eligibility
    // OPEN → KEEP
    // TEMPORARILY CLOSED → SKIP
    // PERMANENTLY CLOSED → SKIP
    // UNCERTAIN → VERIFY
    let leadEligibility: LeadEligibility = 'VERIFY';
    if (finalStatus === 'OPEN') leadEligibility = 'KEEP';
    else if (finalStatus === 'TEMPORARILY CLOSED' || finalStatus === 'PERMANENTLY CLOSED') leadEligibility = 'SKIP';
    else leadEligibility = 'VERIFY';

    // Requirement #14: Reverification Intervals
    // OPEN → 30 days
    // UNCERTAIN → 7 days
    // TEMPORARILY CLOSED → 14 days
    // PERMANENTLY CLOSED → no automatic recheck
    const nextDateObj = new Date();
    let nextVerificationDate = 'No automatic recheck';

    const intervals = input.rules?.reverification_intervals || {
      open_days: 30,
      uncertain_days: 7,
      temporarily_closed_days: 14,
      permanently_closed_days: 0,
    };

    if (finalStatus === 'OPEN') {
      nextDateObj.setDate(nextDateObj.getDate() + (intervals.open_days || 30));
      nextVerificationDate = nextDateObj.toISOString().slice(0, 10);
    } else if (finalStatus === 'UNCERTAIN') {
      nextDateObj.setDate(nextDateObj.getDate() + (intervals.uncertain_days || 7));
      nextVerificationDate = nextDateObj.toISOString().slice(0, 10);
    } else if (finalStatus === 'TEMPORARILY CLOSED') {
      nextDateObj.setDate(nextDateObj.getDate() + (intervals.temporarily_closed_days || 14));
      nextVerificationDate = nextDateObj.toISOString().slice(0, 10);
    } else if (finalStatus === 'PERMANENTLY CLOSED') {
      nextVerificationDate = 'None (Closed permanently)';
    }

    return {
      business_name: input.business_name,
      url: input.url,
      google_maps_found: mapsResult?.google_maps_found || false,
      google_maps_status: mapsResult?.status || 'Not checked',
      google_maps_match: mapsResult?.match_confidence || 'None',
      google_maps_url: mapsResult?.maps_url,
      google_maps_business_name: mapsResult?.business_name,
      google_maps_address: mapsResult?.formatted_address,
      google_maps_phone: mapsResult?.phone,
      google_maps_website: mapsResult?.website,
      search_verification: searchResult?.status || 'Not performed',
      search_evidence: searchResult?.evidence_summary,
      website_status: websiteResult?.website_status || 'UNKNOWN',
      website_http_status: websiteResult?.website_http_status || 0,
      website_last_modified: websiteResult?.website_last_modified || 'UNKNOWN',
      latest_website_content_date: websiteResult?.latest_website_content_date || 'UNKNOWN',
      website_date_source: websiteResult?.website_date_source || 'UNKNOWN',
      website_activity_evidence: websiteResult?.website_activity_evidence || '',
      latest_review_date: mapsResult?.user_ratings_total ? `${mapsResult.rating || 0}★ (${mapsResult.user_ratings_total} reviews)` : undefined,
      latest_activity_date: websiteResult?.latest_website_content_date !== 'UNKNOWN' ? websiteResult?.latest_website_content_date : undefined,
      activity_evidence: searchResult?.evidence_summary || websiteResult?.website_activity_evidence,
      government_entity_found: govFilesResult?.government_entity_found || false,
      government_entity_name: govFilesResult?.legal_business_name,
      government_legal_name: govFilesResult?.legal_business_name,
      government_entity_id: govFilesResult?.entity_id,
      government_entity_type: govFilesResult?.entity_type,
      government_entity_status: govFilesResult?.government_entity_status || 'NOT FOUND',
      government_last_filing_date: govFilesResult?.last_filing_date,
      government_source: govFilesResult?.government_source,
      government_verification_date: govFilesResult?.government_verification_date,
      final_business_status: finalStatus,
      status_confidence: confidence,
      status_evidence: evidenceNotes.join(' | '),
      status_sources: Array.from(new Set(statusSources)),
      verification_trace: trace,
      last_verified: lastVerified,
      next_verification_date: nextVerificationDate,
      verification_level: input.level,
      credits_used: creditsUsed,
      lead_eligibility: leadEligibility,
    };
  }
}

export const globalVerificationRuleEngine = new VerificationRuleEngine();
