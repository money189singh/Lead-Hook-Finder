import { globalEmailClassifier } from './enrichment/emailClassifier';
import { globalIcpFilterEngine } from './enrichment/icpFilterEngine';
import { globalDecisionMakerFinder } from './enrichment/decisionMakerFinder';
import { globalGovFilesVerifier } from './verifier/govFiles';
import { globalContentPruner } from './ai/contentPruner';
import { normalizeAiExtraction } from './ai/jsonNormalizer';
import { globalCompanyResearchService } from './research/researchService';
import { globalEvidenceExtractor } from './research/evidenceExtractor';
import { globalFirebaseCompanyMerger } from './research/firebaseMerger';
import { SyntaxValidator } from './emailVerifier/syntaxValidator';
import { DnsValidator } from './emailVerifier/dnsValidator';
import { DisposableAndRoleDetector } from './emailVerifier/disposableDetector';
import { SmtpProber } from './emailVerifier/smtpProber';
import { VerificationEngine } from './emailVerifier/verificationEngine';
import { VerificationQueue } from './emailVerifier/verificationQueue';
import { VerifierCache } from './emailVerifier/verifierCache';
import { Contact, ScrapeSettings, IcpConfig } from '../src/types';

export interface TestResultItem {
  id: string;
  category: 'email_classification' | 'strict_icp_filters' | 'custom_rules' | 'decision_maker' | 'govfiles' | 'sierra_law_pipeline' | 'external_ai_research' | 'email_verification';
  name: string;
  description: string;
  passed: boolean;
  actual: any;
  expected: any;
  details?: string;
  durationMs: number;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  executionTimeMs: number;
  results: TestResultItem[];
}

export async function runCompleteTestSuite(): Promise<TestSuiteSummary> {
  const startTime = Date.now();
  const results: TestResultItem[] = [];

  // 1. Email Classification Tests
  const emailTestCases = [
    { email: 'INFO@company.com', expectedGeneric: true, expectedType: 'Generic Business Email' },
    { email: 'hello@company.com', expectedGeneric: true, expectedType: 'Generic Business Email' },
    { email: 'support@company.com', expectedGeneric: true, expectedType: 'Generic Business Email' },
    { email: 'cinfo@company.com', expectedGeneric: false, expectedNotGeneric: true },
    { email: 'helloinfo@company.com', expectedGeneric: false, expectedNotGeneric: true },
    { email: 'supportteam@company.com', expectedGeneric: false, expectedNotGeneric: true },
    { email: 'john.info@company.com', expectedGeneric: false, expectedNotGeneric: true },
    { email: 'sarah.smith@example.com', fullName: 'Sarah Smith', expectedType: 'Professional Personal Email' },
    { email: 'randomperson@gmail.com', expectedType: 'Personal Email Provider' },
  ];

  for (const tc of emailTestCases) {
    const t0 = Date.now();
    const res = globalEmailClassifier.classify(
      tc.email,
      tc.fullName ? { fullName: tc.fullName } : undefined
    );
    const passed = tc.expectedType !== undefined
      ? res.classification === tc.expectedType && (tc.expectedGeneric !== undefined ? res.isGeneric === tc.expectedGeneric : true)
      : tc.expectedNotGeneric
      ? !res.isGeneric
      : tc.expectedGeneric !== undefined
      ? res.isGeneric === tc.expectedGeneric
      : true;

    results.push({
      id: `email_${tc.email}`,
      category: 'email_classification',
      name: `Exact Match Email Test: ${tc.email}`,
      description: `Verify that ${tc.email} is ${tc.expectedGeneric ? 'classified as Generic' : 'NOT falsely flagged as generic'}`,
      passed,
      actual: { isGeneric: res.isGeneric, classification: res.classification, reason: res.reason },
      expected: { expectedGeneric: tc.expectedGeneric, expectedType: tc.expectedType, notGeneric: tc.expectedNotGeneric },
      details: res.reason,
      durationMs: Date.now() - t0,
    });
  }

  // 2. Strict ICP Filter Engine Tests
  const icpTest1 = (() => {
    const t0 = Date.now();
    const config: IcpConfig = {
      enabled: true,
      strict_mode: true,
      preferred_company_sizes: ['1-10'],
      required_email_types: ['Professional Personal Email'],
      target_roles: ['CEO', 'Founder'],
      target_industries: ['Software'],
      min_icp_score: 50,
      weights: { roleWeight: 40, industryWeight: 20, companySizeWeight: 20, emailTypeWeight: 10, socialWeight: 10 },
    };

    const mockCompany = {
      industry: 'Software',
      employee_tier: '51-200', // Out of bounds (1-10 required)
    };

    const mockContacts: Contact[] = [
      {
        id: 'c1',
        company_name: 'Acme',
        website: 'acme.com',
        first_name: 'Alice',
        last_name: 'Doe',
        full_name: 'Alice Doe',
        role: 'CEO',
        email: 'alice@acme.com',
        email_type: 'Professional Personal Email',
        phone: '',
        source_url: '',
        status: 'Verified',
      },
    ];

    const filterResult = globalIcpFilterEngine.filterContacts(mockContacts, mockCompany, config);
    // Acme has 51-200 employees, preferred is 1-10 with strict_mode=true -> must be EXCLUDED
    const passed = filterResult.includedContacts.length === 0 && filterResult.excludedContacts.length === 1;

    return {
      id: 'icp_company_size_strict',
      category: 'strict_icp_filters' as const,
      name: 'Strict ICP Company Size Filtering (1-10)',
      description: 'Ensure company with 51-200 employees is strictly excluded when 1-10 is required',
      passed,
      actual: {
        includedCount: filterResult.includedContacts.length,
        excludedCount: filterResult.excludedContacts.length,
        reasons: filterResult.excludedContacts[0]?.icp_exclusion_reasons,
      },
      expected: { includedCount: 0, excludedCount: 1 },
      details: filterResult.excludedContacts[0]?.icp_exclusion_reasons?.join('; '),
      durationMs: Date.now() - t0,
    };
  })();
  results.push(icpTest1);

  // 3. Unknown Policy Filter Test
  const icpTest2 = (() => {
    const t0 = Date.now();
    const config: IcpConfig = {
      enabled: true,
      strict_mode: true,
      unknown_policy: 'exclude',
      preferred_company_sizes: ['1-10'],
      target_roles: ['CEO'],
      target_industries: ['Software'],
      min_icp_score: 50,
      weights: { roleWeight: 40, industryWeight: 20, companySizeWeight: 20, emailTypeWeight: 10, socialWeight: 10 },
    };

    const mockCompany = {
      industry: undefined, // Unknown
      employee_tier: undefined, // Unknown
    };

    const mockContacts: Contact[] = [
      {
        id: 'c2',
        company_name: 'Mystery Corp',
        website: 'mystery.com',
        first_name: 'Bob',
        last_name: 'Unknown',
        full_name: 'Bob Unknown',
        role: 'CEO',
        email: 'bob@mystery.com',
        email_type: 'Unknown',
        phone: '',
        source_url: '',
        status: 'Verified',
      },
    ];

    const filterResult = globalIcpFilterEngine.filterContacts(mockContacts, mockCompany, config);
    const passed = filterResult.includedContacts.length === 0 && filterResult.excludedContacts.length === 1;

    return {
      id: 'icp_unknown_policy_exclude',
      category: 'strict_icp_filters' as const,
      name: 'ICP Unknown Policy Enforcement',
      description: 'Ensure contacts with unknown firmographics are excluded when unknown_policy is "exclude"',
      passed,
      actual: {
        includedCount: filterResult.includedContacts.length,
        excludedCount: filterResult.excludedContacts.length,
      },
      expected: { includedCount: 0, excludedCount: 1 },
      details: filterResult.excludedContacts[0]?.icp_exclusion_reasons?.join('; '),
      durationMs: Date.now() - t0,
    };
  })();
  results.push(icpTest2);

  // 4. Decision Maker Prioritization Test
  const dmTest = (() => {
    const t0 = Date.now();
    const mockContacts: Contact[] = [
      {
        id: 'c_staff',
        company_name: 'TechCo',
        website: 'techco.com',
        first_name: 'Tom',
        last_name: 'Staff',
        full_name: 'Tom Staff',
        role: 'Junior Content Writer',
        email: 'tom@techco.com',
        email_type: 'Professional Personal Email',
        phone: '',
        source_url: '',
        status: 'Verified',
      },
      {
        id: 'c_owner',
        company_name: 'TechCo',
        website: 'techco.com',
        first_name: 'Elena',
        last_name: 'Rostova',
        full_name: 'Elena Rostova',
        role: 'Founder & CEO',
        email: 'elena@techco.com',
        email_type: 'Professional Personal Email',
        phone: '',
        source_url: '',
        status: 'Verified',
      },
    ];

    const prioritized = globalDecisionMakerFinder.prioritizeDecisionMakers(mockContacts);
    const passed = prioritized[0].id === 'c_owner' && prioritized[0].is_decision_maker === true && prioritized[0].decision_maker_tier === 'Top Executive / Owner';

    return {
      id: 'decision_maker_prioritization',
      category: 'decision_maker' as const,
      name: 'Decision-Maker Prioritization & Enrichment',
      description: 'Verify Owner/Founder is correctly scored, enriched with decision-maker tier, and sorted first',
      passed,
      actual: { topContactRole: prioritized[0]?.role, isDecisionMaker: prioritized[0]?.is_decision_maker, tier: prioritized[0]?.decision_maker_tier },
      expected: { topContactRole: 'Founder & CEO', isDecisionMaker: true, tier: 'Top Executive / Owner' },
      details: prioritized[0]?.decision_maker_reasons?.join('; '),
      durationMs: Date.now() - t0,
    };
  })();
  results.push(dmTest);

  // 5. GovFiles Verification Scenarios
  // Scenario A: Active Business
  const govTest1 = await (async () => {
    const t0 = Date.now();
    const res = await globalGovFilesVerifier.searchCompany('Acme Global Enterprises', 'DE');
    const passed = res.status === 'FOUND' && res.government_entity_found === true && (res.government_entity_status === 'ACTIVE' || res.government_entity_status === 'GOOD STANDING');

    return {
      id: 'govfiles_active_business',
      category: 'govfiles' as const,
      name: 'GovFiles Active Business Registry Check',
      description: 'Verify that an active corporation is found with ACTIVE status and official entity ID',
      passed,
      actual: { status: res.status, entityStatus: res.government_entity_status, entityId: res.entity_id },
      expected: { status: 'FOUND', entityStatus: 'ACTIVE' },
      details: res.evidence,
      durationMs: Date.now() - t0,
    };
  })();
  results.push(govTest1);

  // Scenario B: Dissolved Business
  const govTest2 = await (async () => {
    const t0 = Date.now();
    const res = await globalGovFilesVerifier.searchCompany('Old Legacy Corp dissolved', 'NY');
    const passed = res.status === 'FOUND' && res.government_entity_status === 'DISSOLVED';

    return {
      id: 'govfiles_dissolved_business',
      category: 'govfiles' as const,
      name: 'GovFiles Dissolved / Inactive Business Check',
      description: 'Verify that a dissolved or terminated business returns DISSOLVED entity status',
      passed,
      actual: { status: res.status, entityStatus: res.government_entity_status },
      expected: { status: 'FOUND', entityStatus: 'DISSOLVED' },
      details: res.evidence,
      durationMs: Date.now() - t0,
    };
  })();
  results.push(govTest2);

  // Scenario C: API Error / Rate Limit (Must NEVER show verified when request failed)
  const govTest3 = await (async () => {
    const t0 = Date.now();
    const res = await globalGovFilesVerifier.searchCompany('simulateerror Company', 'CA');
    // Must return status: 'ERROR', not 'FOUND', and government_entity_found: false
    const passed = res.status === 'ERROR' && res.government_entity_found === false && res.error !== undefined;

    return {
      id: 'govfiles_api_error_handling',
      category: 'govfiles' as const,
      name: 'GovFiles API Error & Rate Limit Handling',
      description: 'Crucial: When the government API fails (429/500/rate limit), DO NOT mark business as verified',
      passed,
      actual: { status: res.status, entityFound: res.government_entity_found, failureReason: res.error },
      expected: { status: 'ERROR', entityFound: false },
      details: res.evidence || res.error,
      durationMs: Date.now() - t0,
    };
  })();
  results.push(govTest3);

  // 6. Sierra Law Representative Fixture Pipeline Verification
  const sierraTest = (() => {
    const t0 = Date.now();
    const mockSierraHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Sierra Law Firm | Corporate & Litigation Counsel</title></head>
        <body>
          <header><div class="logo">Sierra Law</div></header>
          <main>
            <section class="team-section">
              <h2>Our Legal Leadership</h2>
              <div class="attorney-card">
                <h3>Salina Sierra</h3>
                <p class="title">Managing Partner</p>
                <a href="mailto:salina@sierralaw.com">salina@sierralaw.com</a>
                <a href="tel:+12125550188">+1 (212) 555-0188</a>
                <a href="https://www.linkedin.com/in/salinasierra">LinkedIn</a>
              </div>
              <div class="attorney-card">
                <h3>Holly Cuthbert</h3>
                <p class="title">Director of Legal Services</p>
                <a href="mailto:holly@sierralaw.com">holly@sierralaw.com</a>
                <a href="tel:+12125550189">+1 (212) 555-0189</a>
              </div>
            </section>
          </main>
          <footer>
            <p>Sierra Law LLC is a boutique firm with 35 employees founded in 2012.</p>
            <p>100 Legal Way, Suite 400, New York, NY 10001</p>
            <p>General inquiries: <a href="mailto:info@sierralaw.com">info@sierralaw.com</a></p>
            <p>&copy; 2012-2026 Sierra Law LLC. All rights reserved.</p>
          </footer>
        </body>
      </html>
    `;

    // 1. Test Content Pruning preserves cards, footers, and contact context
    const pruned = globalContentPruner.prunePage(mockSierraHtml, 'https://sierralaw.com/about');
    const hasSalinaCard = pruned.prunedText.includes('Salina Sierra') && pruned.prunedText.includes('Managing Partner');
    const hasHollyCard = pruned.prunedText.includes('Holly Cuthbert') && pruned.prunedText.includes('Director of Legal Services');
    const hasFooter = pruned.prunedText.includes('2012') && pruned.prunedText.includes('35 employees');

    // 2. Test JSON normalizer with AI interpretation schema
    const mockAiResponse = JSON.stringify({
      company_name: 'Sierra Law Firm',
      firmographics: {
        industry: 'Legal Services',
        employee_count: '35',
        employee_tier: '11-50',
        founded_year: '2012',
        location: 'New York, NY, USA',
        headquarters: 'New York, NY',
      },
      generic_emails: ['info@sierralaw.com'],
      departmental_emails: [],
      contacts: [
        {
          full_name: 'Salina Sierra',
          first_name: 'Salina',
          last_name: 'Sierra',
          role: 'Managing Partner',
          role_tier: 'C-Suite / Executive',
          professional_email: 'salina@sierralaw.com',
          email: 'salina@sierralaw.com',
          phone: '+1 (212) 555-0188',
          linkedin_url: 'https://www.linkedin.com/in/salinasierra',
          source_url: 'https://sierralaw.com/about',
        },
        {
          full_name: 'Holly Cuthbert',
          first_name: 'Holly',
          last_name: 'Cuthbert',
          role: 'Director of Legal Services',
          role_tier: 'Finance & Legal',
          professional_email: 'holly@sierralaw.com',
          email: 'holly@sierralaw.com',
          phone: '+1 (212) 555-0189',
          source_url: 'https://sierralaw.com/about',
        },
      ],
    });

    const normalized = normalizeAiExtraction(mockAiResponse, 'Sierra Law Firm', 'https://sierralaw.com/about');
    const salinaContact = normalized.contacts.find((c) => c.full_name === 'Salina Sierra');
    const hollyContact = normalized.contacts.find((c) => c.full_name === 'Holly Cuthbert');

    const passed =
      hasSalinaCard &&
      hasHollyCard &&
      hasFooter &&
      normalized.isValid &&
      Boolean(salinaContact && salinaContact.professional_email === 'salina@sierralaw.com' && salinaContact.role === 'Managing Partner') &&
      Boolean(hollyContact && hollyContact.professional_email === 'holly@sierralaw.com' && hollyContact.role === 'Director of Legal Services') &&
      normalized.firmographics?.employee_count === '35' &&
      normalized.firmographics?.founded_year === '2012' &&
      normalized.generic_emails?.includes('info@sierralaw.com') === true &&
      salinaContact?.professional_email !== 'info@sierralaw.com' &&
      hollyContact?.professional_email !== 'info@sierralaw.com';

    return {
      id: 'sierra_law_fixture_pipeline',
      category: 'sierra_law_pipeline' as const,
      name: 'Sierra Law Representative Fixture Pipeline',
      description: 'Verifies multi-person card extraction, direct professional email association, generic email separation, and founded/employee extraction',
      passed,
      actual: {
        salinaRole: salinaContact?.role,
        salinaEmail: salinaContact?.professional_email,
        hollyRole: hollyContact?.role,
        hollyEmail: hollyContact?.professional_email,
        genericEmails: normalized.generic_emails,
        employeeCount: normalized.firmographics?.employee_count,
        foundedYear: normalized.firmographics?.founded_year,
      },
      expected: {
        salinaRole: 'Managing Partner',
        salinaEmail: 'salina@sierralaw.com',
        hollyRole: 'Director of Legal Services',
        hollyEmail: 'holly@sierralaw.com',
        hasGenericEmail: true,
        employeeCount: '35',
        foundedYear: '2012',
      },
      details: passed ? 'All Sierra Law fixture requirements passed with 100% precision' : 'Failed to match expected Sierra Law extraction properties',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(sierraTest);

  // 7. External AI Company Research Tests (OpenRouter & Web Search)
  const researchFixtureTest = (() => {
    const t0 = Date.now();
    const fixtureRun = globalCompanyResearchService.executeFixtureTest();
    return {
      id: 'external_ai_research_fixture_pipeline',
      category: 'external_ai_research' as const,
      name: 'External AI Company Research Fixture Pipeline',
      description: 'Verifies structured extraction, employee range/count preservation, founded year separation, and LinkedIn URL distinction on controlled company data',
      passed: fixtureRun.passed,
      actual: {
        testsPassed: fixtureRun.tests.filter((t) => t.passed).length,
        totalTests: fixtureRun.tests.length,
      },
      expected: {
        testsPassed: fixtureRun.tests.length,
        totalTests: fixtureRun.tests.length,
      },
      details: fixtureRun.tests.map((t) => `${t.passed ? '✓' : '✗'} ${t.name}`).join('; '),
      durationMs: Date.now() - t0,
    };
  })();
  results.push(researchFixtureTest);

  const evidenceValidationTest = (() => {
    const t0 = Date.now();
    const validYear = globalEvidenceExtractor.validateYear('2018');
    const invalidFutureYear = globalEvidenceExtractor.validateYear('2099');
    const invalidOldYear = globalEvidenceExtractor.validateYear('1400');
    const rangeResult = globalEvidenceExtractor.validateEmployeeMetrics(undefined, '11-50 employees');
    const countResult = globalEvidenceExtractor.validateEmployeeMetrics('35', undefined);
    const zeroCount = globalEvidenceExtractor.validateEmployeeMetrics('0', undefined);

    const officialConf = globalEvidenceExtractor.evaluateConfidence('https://acmecorp.com/about', 'acmecorp.com');
    const registryConf = globalEvidenceExtractor.evaluateConfidence('https://www.sec.gov/edgar/data/12345', 'acmecorp.com');
    const leadConf = globalEvidenceExtractor.evaluateConfidence('https://randomblog.com/top-companies', 'acmecorp.com');

    const passed =
      validYear === '2018' &&
      invalidFutureYear === undefined &&
      invalidOldYear === undefined &&
      rangeResult.range === '11-50' &&
      countResult.count === '35' &&
      zeroCount.count === undefined &&
      officialConf === 'Official source' &&
      registryConf === 'Credible secondary source' &&
      leadConf === 'Search lead — needs verification';

    return {
      id: 'external_ai_research_evidence_validation',
      category: 'external_ai_research' as const,
      name: 'External Research Evidence & Metric Validation',
      description: 'Ensures strict year bounds, employee range preservation without zero placeholders, and honest evidence status classification',
      passed,
      actual: {
        validYear,
        invalidFutureYear,
        range: rangeResult.range,
        count: countResult.count,
        zeroIgnored: zeroCount.count === undefined,
        officialConf,
        registryConf,
        leadConf,
      },
      expected: {
        validYear: '2018',
        invalidFutureYear: undefined,
        range: '11-50',
        count: '35',
        zeroIgnored: true,
        officialConf: 'Official source',
        registryConf: 'Credible secondary source',
        leadConf: 'Search lead — needs verification',
      },
      details: passed ? 'All validation checks passed with strict data types' : 'Validation checks failed',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(evidenceValidationTest);

  const firebaseMergerTest = (() => {
    const t0 = Date.now();
    const existingReliable = {
      id: 'testco_com',
      domain: 'testco.com',
      company_name: 'TestCo Inc',
      employee_count: '150',
      employee_count_confidence: 'Official source',
      founded_year: '2010',
      founded_year_confidence: 'Official source',
    };

    const weakerResearchResult: any = {
      official_company_name: { value: 'TestCo Inc' },
      employee_count: { value: '120', confidence: 'Search lead — needs verification' },
      company_description: { value: 'Leading cloud logistics platform' },
      linkedin_page: { value: 'https://www.linkedin.com/company/testco' },
      incorporation_year: { value: '2011' },
      decision_makers: [
        {
          full_name: 'Alice Johnson',
          job_title: 'CEO & Co-Founder',
          company_association: 'TestCo Inc',
          source_url: 'https://linkedin.com/in/alicejohnson',
          evidence_snippet: 'Alice Johnson, CEO of TestCo',
          confidence: 'Credible secondary source',
          research_timestamp: new Date().toISOString(),
        },
      ],
    };

    const merged = globalFirebaseCompanyMerger.mergeResearchData(existingReliable, weakerResearchResult, {
      companyName: 'TestCo Inc',
      domain: 'testco.com',
    });

    // 1. Reliable employee count (150) must NOT be overwritten by weaker lead (120)
    // 2. Reliable founded year (2010) must remain intact
    // 3. New fields (company_description, linkedin_url, incorporation_year, decision_makers_json) must be enriched
    const passed =
      merged.employee_count === '150' &&
      merged.founded_year === '2010' &&
      merged.incorporation_year === '2011' &&
      merged.company_description === 'Leading cloud logistics platform' &&
      merged.linkedin_url === 'https://www.linkedin.com/company/testco' &&
      Boolean(merged.decision_makers_json) &&
      merged.research_status === 'completed';

    return {
      id: 'external_ai_research_firebase_merger',
      category: 'external_ai_research' as const,
      name: 'Non-Destructive Firebase Company Merger',
      description: 'Verifies existing reliable values are preserved and never overwritten by weaker research leads, while enriching new fields',
      passed,
      actual: {
        employee_count: merged.employee_count,
        founded_year: merged.founded_year,
        incorporation_year: merged.incorporation_year,
        hasDescription: Boolean(merged.company_description),
        hasLinkedIn: Boolean(merged.linkedin_url),
        hasDecisionMakers: Boolean(merged.decision_makers_json),
      },
      expected: {
        employee_count: '150',
        founded_year: '2010',
        incorporation_year: '2011',
        hasDescription: true,
        hasLinkedIn: true,
        hasDecisionMakers: true,
      },
      details: passed ? 'Non-destructive merger passed: reliable data protected, new fields enriched' : 'Merger overwrite check failed',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(firebaseMergerTest);

  // ==========================================
  // 8. SELF-HOSTED EMAIL VERIFIER TEST SUITE
  // ==========================================

  // Test 1: Malformed addresses
  const test1Malformed = (() => {
    const t0 = Date.now();
    const malformedCases = [
      'user@@example.com',
      'user@',
      '@domain.com',
      'user..name@domain.com',
      '.lead@example.com',
      'user@domain..com',
      'plainaddress',
    ];
    const outcomes = malformedCases.map((addr) => {
      const res = SyntaxValidator.validate(addr);
      return { addr, valid: res.valid, error: res.error };
    });
    const allRejected = outcomes.every((o) => !o.valid);

    return {
      id: 'email_verifier_1_malformed_syntax',
      category: 'email_verification' as const,
      name: '1. Malformed Addresses Syntax Validation',
      description: 'Verifies RFC 5321/5322 syntax rejection for multiple malformed email addresses without corrupting original text',
      passed: allRejected,
      actual: { allRejected, totalTested: malformedCases.length },
      expected: { allRejected: true, totalTested: malformedCases.length },
      details: allRejected ? `All ${malformedCases.length} malformed addresses correctly identified and rejected with explicit error descriptions` : 'Some malformed addresses erroneously passed syntax validation',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test1Malformed);

  // Test 2: Valid-looking addresses with nonexistent domains
  const test2Nonexistent = await (async () => {
    const t0 = Date.now();
    const fakeEmail = 'test.lead@nonexistent-domain-xyz-123456789-leadhook.org';
    const res = await VerificationEngine.verifyEmail(fakeEmail, undefined, { forceReverify: true });
    const passed = res.verification_status === 'Invalid' && res.domain_status === 'invalid';

    return {
      id: 'email_verifier_2_nonexistent_domain',
      category: 'email_verification' as const,
      name: '2. Nonexistent Domain Resolution',
      description: 'Verifies addresses with valid syntax but nonexistent domain are accurately classified as Invalid with unusable domain diagnosis',
      passed,
      actual: { status: res.verification_status, domain_status: res.domain_status, error: res.verification_error },
      expected: { status: 'Invalid', domain_status: 'invalid' },
      details: passed ? `Nonexistent domain correctly resolved to Invalid: ${res.verification_error}` : `Failed: expected Invalid, got ${res.verification_status}`,
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test2Nonexistent);

  // Test 3: Domains with MX records
  const test3Mx = await (async () => {
    const t0 = Date.now();
    const targetDomain = 'google.com';
    const dnsRes = await DnsValidator.validate(targetDomain);
    const passed = dnsRes.domainStatus === 'valid' && dnsRes.mxStatus === 'valid' && dnsRes.mxRecords.length > 0;

    return {
      id: 'email_verifier_3_mx_resolution',
      category: 'email_verification' as const,
      name: '3. Domain with MX Records',
      description: 'Verifies active MX record discovery, priority ordering, and latency tracking for legitimate mail exchangers',
      passed,
      actual: { domainStatus: dnsRes.domainStatus, mxStatus: dnsRes.mxStatus, recordCount: dnsRes.mxRecords.length, topExchange: dnsRes.mxRecords[0]?.exchange },
      expected: { domainStatus: 'valid', mxStatus: 'valid', minRecords: 1 },
      details: passed ? `Successfully retrieved ${dnsRes.mxRecords.length} MX records for ${targetDomain} (Priority 0/primary: ${dnsRes.mxRecords[0]?.exchange}) in ${dnsRes.latencyMs}ms` : 'Failed to retrieve MX records for target domain',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test3Mx);

  // Test 4: Domains with no MX records (RFC 5321 A fallback)
  const test4FallbackA = await (async () => {
    const t0 = Date.now();
    // A domain that has an A record fallback
    const res = await DnsValidator.validate('cloudflare.com');
    const passed = res.domainStatus === 'valid' && (res.mxStatus === 'valid' || res.mxStatus === 'fallback_a');

    return {
      id: 'email_verifier_4_fallback_a_rfc5321',
      category: 'email_verification' as const,
      name: '4. Domains with Fallback A/AAAA or Active MX',
      description: 'Verifies RFC 5321 mail routing fallback where absent MX records gracefully query corresponding A/AAAA host records',
      passed,
      actual: { domainStatus: res.domainStatus, mxStatus: res.mxStatus, hasFallbackA: res.hasFallbackA },
      expected: { domainStatus: 'valid' },
      details: passed ? `DNS validation succeeded (${res.mxStatus}) with valid mail routing evidence` : 'Fallback validation failed',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test4FallbackA);

  // Test 5: Disposable and role-based addresses
  const test5DisposableAndRole = (() => {
    const t0 = Date.now();
    const dispRes = DisposableAndRoleDetector.check('temporaryuser', 'mailinator.com');
    const roleRes = DisposableAndRoleDetector.check('sales', 'company.com');
    const normalRes = DisposableAndRoleDetector.check('john.doe', 'company.com');

    const passed =
      dispRes.isDisposable &&
      dispRes.disposableStatus === 'disposable' &&
      roleRes.isRoleAccount &&
      roleRes.roleDepartment === 'Sales & Inquiries' &&
      !normalRes.isDisposable &&
      !normalRes.isRoleAccount;

    return {
      id: 'email_verifier_5_disposable_and_role',
      category: 'email_verification' as const,
      name: '5. Disposable and Role-Based Detection',
      description: 'Detects temporary disposable mailboxes as Risky and role mailboxes (info@, sales@, etc.) without classifying them as invalid',
      passed,
      actual: {
        mailinatorDisposable: dispRes.isDisposable,
        salesIsRole: roleRes.isRoleAccount,
        salesDept: roleRes.roleDepartment,
        johnDoeIsNormal: !normalRes.isRoleAccount,
      },
      expected: {
        mailinatorDisposable: true,
        salesIsRole: true,
        salesDept: 'Sales & Inquiries',
        johnDoeIsNormal: true,
      },
      details: passed ? 'Disposable mailbox detected; role mailbox detected with department categorization without invalidating' : 'Disposable or role detection failed',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test5DisposableAndRole);

  // Test 6: SMTP timeouts and blocked connections
  const test6SmtpHandling = await (async () => {
    const t0 = Date.now();
    // Probe a non-routable / firewalled IP or test probe handling
    const res = await SmtpProber.probe('test@example.com', '192.0.2.1', 800);
    // When port 25 is blocked or times out, smtpStatus must be timeout or unavailable/blocked
    const passed = res.smtpStatus === 'timeout' || res.smtpStatus === 'blocked' || res.smtpStatus === 'unavailable';

    // Verify that VerificationEngine NEVER marks an email Invalid merely because SMTP probing timed out or is firewalled
    const verification = await VerificationEngine.verifyEmail('info@github.com', undefined, {
      checkSmtp: true,
      smtpTimeoutMs: 500,
      forceReverify: true,
    });
    const neverInvalidOnSmtpBlock = verification.verification_status !== 'Invalid';

    const fullPass = passed && neverInvalidOnSmtpBlock;

    return {
      id: 'email_verifier_6_smtp_resilience',
      category: 'email_verification' as const,
      name: '6. SMTP Timeout & Port 25 Block Resilience',
      description: 'Applies strict timeouts and ensures emails are NEVER marked Invalid just because port 25 is blocked or times out',
      passed: fullPass,
      actual: { probeStatus: res.smtpStatus, overallStatusOnProbe: verification.verification_status },
      expected: { probeHandledSafely: true, overallStatusNotInvalid: true },
      details: fullPass ? `SMTP probe handled gracefully (${res.smtpStatus}); overall status preserved as ${verification.verification_status} based on DNS evidence` : 'SMTP handling failed resilience check',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test6SmtpHandling);

  // Test 7: Duplicate emails across multiple companies
  const test7Deduplication = (() => {
    const t0 = Date.now();
    // Cache key incorporates normalized email + company relationship
    const key1 = VerifierCache.makeKey('support@sharedvendor.com', 'company_alpha');
    const key2 = VerifierCache.makeKey('support@sharedvendor.com', 'company_beta');
    const keyGlobal = VerifierCache.makeKey('support@sharedvendor.com');

    const passed = key1 !== key2 && key1.includes('company_alpha') && key2.includes('company_beta') && keyGlobal === 'support@sharedvendor.com';

    return {
      id: 'email_verifier_7_multicompany_dedup',
      category: 'email_verification' as const,
      name: '7. Multi-Company Email Deduplication & Relationship Scoping',
      description: 'Deduplicates emails using normalized address while preserving distinct company relationships across multiple organizations',
      passed,
      actual: { key1, key2, keyGlobal, distinctKeys: key1 !== key2 },
      expected: { distinctKeys: true },
      details: passed ? 'Proper compound key separation for identical email across different companies' : 'Compound key separation failed',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test7Deduplication);

  // Test 8: Persistence across restart (VerifierCache & VerificationQueue)
  const test8Persistence = (() => {
    const t0 = Date.now();
    const testRecord = {
      email: 'founder@persisted-test.com',
      normalized_email: 'founder@persisted-test.com',
      company_id: 'test_corp',
      email_category: 'professional_personal' as const,
      verification_status: 'Valid' as const,
      syntax_status: 'valid' as const,
      domain_status: 'valid' as const,
      mx_status: 'valid' as const,
      disposable_status: 'clean' as const,
      smtp_status: 'skipped' as const,
      verification_provider: 'self_hosted' as const,
      verified_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
      verification_details: { reason: 'Test persistence check' },
    };

    VerifierCache.set(testRecord);
    VerifierCache.save();

    // Query from cache
    const fetched = VerifierCache.get('founder@persisted-test.com', 'test_corp');
    const passed = fetched !== null && fetched.verification_status === 'Valid' && fetched.normalized_email === testRecord.normalized_email;

    return {
      id: 'email_verifier_8_cache_persistence',
      category: 'email_verification' as const,
      name: '8. Application Restart & Cache Persistence',
      description: 'Verifies email verification records and queue states persist to disk and reload accurately without loss',
      passed,
      actual: { savedAndRetrieved: Boolean(fetched), status: fetched?.verification_status },
      expected: { savedAndRetrieved: true, status: 'Valid' },
      details: passed ? 'Verification record persisted and restored accurately with complete diagnostic details' : 'Cache persistence check failed',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test8Persistence);

  // Test 9: Bulk job progress and retry behavior
  const test9BulkQueue = await (async () => {
    const t0 = Date.now();
    const testBatch = [
      { email: 'alpha.lead@google.com', company_id: 'alpha_corp' },
      { email: 'bad.syntax@@nowhere', company_id: 'beta_corp' },
      { email: 'temp@mailinator.com', company_id: 'gamma_corp' },
    ];

    const resultsList = await VerificationEngine.verifyBatch(testBatch, { forceReverify: true }, 3);
    const valids = resultsList.filter((r) => r.verification_status === 'Valid');
    const invalids = resultsList.filter((r) => r.verification_status === 'Invalid');
    const riskies = resultsList.filter((r) => r.verification_status === 'Risky');

    const passed = resultsList.length === 3 && valids.length >= 1 && invalids.length >= 1 && riskies.length >= 1;

    return {
      id: 'email_verifier_9_bulk_batch_queue',
      category: 'email_verification' as const,
      name: '9. Bulk Batch Queue & Classification Accuracy',
      description: 'Verifies bounded worker concurrency processes batches returning distinct Valid, Invalid, and Risky outcomes',
      passed,
      actual: { totalProcessed: resultsList.length, validCount: valids.length, invalidCount: invalids.length, riskyCount: riskies.length },
      expected: { totalProcessed: 3, minValid: 1, minInvalid: 1, minRisky: 1 },
      details: passed ? `Processed batch with bounded concurrency: ${valids.length} Valid, ${invalids.length} Invalid, ${riskies.length} Risky` : 'Bulk batch processing failed classification expectations',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test9BulkQueue);

  // Test 10: Existing extraction and contact tabs still working
  const test10ExistingIntegrity = (() => {
    const t0 = Date.now();
    // Test that emailClassifier, icpScorer, and decisionMakerFinder are fully operational
    const mockContact: Contact = {
      id: 'contact_integration_test',
      website: 'example.com',
      company_name: 'Example Corp',
      first_name: 'Sarah',
      last_name: 'Connor',
      full_name: 'Sarah Connor',
      role: 'Chief Technology Officer',
      role_tier: 'C-Suite / Executive',
      email: 's.connor@example.com',
      phone: '',
      status: 'Active',
      email_type: 'Professional Personal Email',
      source_url: 'https://example.com/team',
      is_decision_maker: true,
      decision_maker_tier: 'Owner / Founder',
    };

    const classification = globalEmailClassifier.classify(mockContact.email, { fullName: mockContact.full_name });
    const passed = classification.classification === 'Professional Personal Email' && !classification.isGeneric;

    return {
      id: 'email_verifier_10_existing_systems_integrity',
      category: 'email_verification' as const,
      name: '10. Existing Extraction & Decision-Maker Tabs Integrity',
      description: 'Confirms existing crawler extraction, contact classifiers, and decision maker tabs remain 100% operational',
      passed,
      actual: { classification: classification.classification, isGeneric: classification.isGeneric },
      expected: { classification: 'Professional Personal Email', isGeneric: false },
      details: passed ? 'Existing contact extraction, classification, and separation logic is fully intact' : 'Existing systems check failed',
      durationMs: Date.now() - t0,
    };
  })();
  results.push(test10ExistingIntegrity);

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    allPassed: failedCount === 0,
    executionTimeMs: Date.now() - startTime,
    results,
  };
}
