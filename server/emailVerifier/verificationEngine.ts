import { SyntaxValidator } from './syntaxValidator';
import { DnsValidator } from './dnsValidator';
import { DisposableAndRoleDetector } from './disposableDetector';
import { SmtpProber } from './smtpProber';
import { VerifierCache } from './verifierCache';
import { DeliverabilityChecker } from './deliverabilityChecker';
import {
  EmailVerificationResult,
  VerificationOptions,
  EmailCategory,
  EmailSmtpStatus,
} from './types';

export class VerificationEngine {
  private static readonly CONSUMER_PROVIDERS = new Set([
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'ymail.com',
    'rocketmail.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'msn.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'aol.com',
    'aim.com',
    'protonmail.com',
    'proton.me',
    'zoho.com',
    'mail.com',
    'gmx.com',
    'gmx.net',
    'tutanota.com',
    'tuta.io',
    'fastmail.com',
  ]);

  /**
   * Infer email category if not explicitly supplied from extraction evidence
   */
  public static inferCategory(
    localPart: string,
    domain: string,
    isRole: boolean,
    explicitCategory?: EmailCategory
  ): EmailCategory {
    if (explicitCategory) return explicitCategory;
    const cleanDomain = domain.toLowerCase().trim();
    if (this.CONSUMER_PROVIDERS.has(cleanDomain)) {
      return 'personal_provider';
    }
    if (isRole) {
      return 'generic_business';
    }
    return 'professional_personal';
  }

  /**
   * Verify a single email address executing all verification stages in order:
   * A. Syntax validation
   * B. Domain & DNS validation (MX + A/AAAA fallback)
   * C. Disposable & Role-address detection
   * D. SMTP probing (safe & configurable)
   */
  public static async verifyEmail(
    rawEmail: string,
    metadata?: {
      company_id?: string;
      company_name?: string;
      source_url?: string;
      email_category?: EmailCategory;
    },
    options?: VerificationOptions
  ): Promise<EmailVerificationResult> {
    const startTime = Date.now();
    const nowIso = new Date().toISOString();

    // 1. Initial syntax validation & normalization
    const syntax = SyntaxValidator.validate(rawEmail);
    const normalizedEmail = syntax.normalizedEmail || (rawEmail || '').trim().toLowerCase();

    // Check cache unless explicitly requested to bypass
    if (!options?.forceReverify) {
      const cached = VerifierCache.get(normalizedEmail, metadata?.company_id);
      if (cached) {
        // Return cached result with current metadata if newly provided
        return {
          ...cached,
          company_id: metadata?.company_id || cached.company_id,
          company_name: metadata?.company_name || cached.company_name,
          source_url: metadata?.source_url || cached.source_url,
          email_category: metadata?.email_category || cached.email_category,
        };
      }
    }

    // A. Syntax check failed -> Immediate Invalid
    if (!syntax.valid) {
      const invalidResult: EmailVerificationResult = {
        email: rawEmail || '',
        normalized_email: normalizedEmail,
        company_id: metadata?.company_id,
        company_name: metadata?.company_name,
        source_url: metadata?.source_url,
        email_category: metadata?.email_category || 'unknown',
        verification_status: 'Invalid',
        syntax_status: 'invalid',
        domain_status: 'unknown',
        mx_status: 'missing',
        disposable_status: 'clean',
        smtp_status: 'skipped',
        verification_provider: 'self_hosted',
        verified_at: nowIso,
        last_checked_at: nowIso,
        verification_error: syntax.error,
        verification_details: {
          reason: `Syntax validation failed: ${syntax.error}`,
          is_role_account: false,
          latency_ms: Date.now() - startTime,
        },
      };

      VerifierCache.set(invalidResult);
      return invalidResult;
    }

    // B. Domain and DNS validation
    const dnsResult = await DnsValidator.validate(syntax.domain, options?.dnsTimeoutMs);

    // C. Disposable and Role detection
    const dispResult = DisposableAndRoleDetector.check(syntax.localPart, syntax.domain);
    const category = this.inferCategory(
      syntax.localPart,
      syntax.domain,
      dispResult.isRoleAccount,
      metadata?.email_category
    );

    // D. SMTP probing stage (optional/configurable)
    let smtpResult: {
      smtpStatus: EmailSmtpStatus;
      error?: string;
      code?: number;
      banner?: string;
      response?: string;
      latencyMs: number;
    } = {
      smtpStatus: 'skipped',
      error: undefined,
      code: undefined,
      banner: undefined,
      response: undefined,
      latencyMs: 0,
    };

    const shouldProbeSmtp = Boolean(options?.checkSmtp) && dnsResult.domainStatus === 'valid' && !dispResult.isDisposable;

    if (shouldProbeSmtp) {
      const targetHost = dnsResult.mxRecords.length > 0 ? dnsResult.mxRecords[0].exchange : syntax.domain;
      const probeRes = await SmtpProber.probe(syntax.normalizedEmail, targetHost, options?.smtpTimeoutMs);
      smtpResult = {
        smtpStatus: probeRes.smtpStatus,
        error: probeRes.error,
        code: probeRes.code,
        banner: probeRes.banner,
        response: probeRes.response,
        latencyMs: probeRes.latencyMs || 0,
      };
    }

    // E. Execute deep BounceBan-grade deliverability evaluation
    const deliverability = await DeliverabilityChecker.evaluate({
      email: rawEmail,
      localPart: syntax.localPart,
      domain: syntax.domain,
      syntaxValid: syntax.valid,
      dnsResult,
      dispResult,
    });

    const isConsumer = this.CONSUMER_PROVIDERS.has(syntax.domain.toLowerCase().trim());

    const result: EmailVerificationResult = {
      email: rawEmail,
      normalized_email: syntax.normalizedEmail,
      company_id: metadata?.company_id,
      company_name: metadata?.company_name,
      source_url: metadata?.source_url,
      email_category: category,
      verification_status: deliverability.deliverabilityStatus,
      syntax_status: 'valid',
      domain_status: dnsResult.domainStatus,
      mx_status: dnsResult.mxStatus,
      disposable_status: dispResult.disposableStatus,
      smtp_status: smtpResult.smtpStatus,
      verification_provider: 'self_hosted',
      verified_at: nowIso,
      last_checked_at: nowIso,
      verification_error: deliverability.deliverabilityStatus === 'Invalid' ? deliverability.reason : undefined,
      deliverability_score: deliverability.deliverabilityScore,
      bounce_probability: deliverability.bounceProbability,
      is_catch_all: deliverability.isCatchAll,
      is_disposable: dispResult.isDisposable,
      is_role_account: dispResult.isRoleAccount,
      is_free_provider: isConsumer,
      mx_provider: dnsResult.mxProvider,
      has_spf: dnsResult.hasSpf,
      has_dmarc: dnsResult.hasDmarc,
      spf_record: dnsResult.spfRecord,
      dmarc_record: dnsResult.dmarcRecord,
      mailbox_status: deliverability.mailboxStatus,
      diagnostic_factors: deliverability.diagnosticFactors,
      verification_details: {
        reason: deliverability.reason,
        mx_records: dnsResult.mxRecords,
        has_fallback_a: dnsResult.hasFallbackA,
        a_records: dnsResult.aRecords,
        is_role_account: dispResult.isRoleAccount,
        role_department: dispResult.roleDepartment,
        smtp_banner: smtpResult.banner,
        smtp_code: smtpResult.code,
        smtp_response: smtpResult.response,
        latency_ms: Date.now() - startTime,
        deliverability_score: deliverability.deliverabilityScore,
        bounce_probability: deliverability.bounceProbability,
        is_catch_all: deliverability.isCatchAll,
        mx_provider: dnsResult.mxProvider,
        has_spf: dnsResult.hasSpf,
        has_dmarc: dnsResult.hasDmarc,
      },
    };

    // Store in cache
    VerifierCache.set(result);
    return result;
  }

  /**
   * Batch verify emails with deduplication and bounded concurrency
   */
  public static async verifyBatch(
    items: Array<{
      email: string;
      company_id?: string;
      company_name?: string;
      source_url?: string;
      email_category?: EmailCategory;
    }>,
    options?: VerificationOptions,
    concurrency: number = 5,
    onProgress?: (processed: number, total: number, currentEmail: string) => void
  ): Promise<EmailVerificationResult[]> {
    // 1. Deduplicate by normalized email + company_id
    const uniqueMap = new Map<string, typeof items[0]>();
    for (const item of items) {
      if (!item || !item.email) continue;
      const key = VerifierCache.makeKey(item.email.trim().toLowerCase(), item.company_id);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    const uniqueList = Array.from(uniqueMap.values());
    const results: EmailVerificationResult[] = [];
    let processedCount = 0;
    const total = uniqueList.length;

    // Worker pool
    const queue = [...uniqueList];
    const workers: Promise<void>[] = [];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        try {
          const res = await this.verifyEmail(
            item.email,
            {
              company_id: item.company_id,
              company_name: item.company_name,
              source_url: item.source_url,
              email_category: item.email_category,
            },
            options
          );
          results.push(res);
        } catch (err: any) {
          // Fallback if unexpected error occurs
          results.push({
            email: item.email,
            normalized_email: item.email.trim().toLowerCase(),
            company_id: item.company_id,
            company_name: item.company_name,
            source_url: item.source_url,
            email_category: item.email_category || 'unknown',
            verification_status: 'Unknown',
            syntax_status: 'valid',
            domain_status: 'error',
            mx_status: 'missing',
            disposable_status: 'clean',
            smtp_status: 'unavailable',
            verification_provider: 'self_hosted',
            verified_at: new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
            verification_error: err?.message || 'Verification exception',
          });
        }

        processedCount++;
        if (onProgress) {
          onProgress(processedCount, total, item.email);
        }
      }
    };

    const workerCount = Math.max(1, Math.min(concurrency, total));
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    return results;
  }
}
