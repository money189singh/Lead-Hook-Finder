import {
  EmailVerificationStatus,
  EmailSyntaxStatus,
  EmailDomainStatus,
  EmailMxStatus,
  EmailDisposableStatus,
  EmailSmtpStatus,
  EmailCategory,
  EmailVerificationResult,
  EmailVerificationJobStatus,
  EmailVerifierStatusResponse,
} from '../../src/types';

export type {
  EmailVerificationStatus,
  EmailSyntaxStatus,
  EmailDomainStatus,
  EmailMxStatus,
  EmailDisposableStatus,
  EmailSmtpStatus,
  EmailCategory,
  EmailVerificationResult,
  EmailVerificationJobStatus,
  EmailVerifierStatusResponse,
};

export interface SyntaxCheckResult {
  valid: boolean;
  normalizedEmail: string;
  localPart: string;
  domain: string;
  error?: string;
}

export interface DnsCheckResult {
  domainStatus: EmailDomainStatus;
  mxStatus: EmailMxStatus;
  mxRecords: Array<{ exchange: string; priority: number }>;
  hasFallbackA: boolean;
  aRecords: string[];
  hasSpf?: boolean;
  spfRecord?: string;
  hasDmarc?: boolean;
  dmarcRecord?: string;
  mxProvider?: string;
  isCatchAll?: boolean;
  error?: string;
  latencyMs: number;
}

export interface DisposableAndRoleResult {
  isDisposable: boolean;
  disposableStatus: EmailDisposableStatus;
  isRoleAccount: boolean;
  roleDepartment?: string;
}

export interface SmtpProbeResult {
  smtpStatus: EmailSmtpStatus;
  banner?: string;
  code?: number;
  response?: string;
  error?: string;
  latencyMs?: number;
}

export interface VerificationOptions {
  checkSmtp?: boolean;
  smtpTimeoutMs?: number;
  dnsTimeoutMs?: number;
  forceReverify?: boolean;
}
