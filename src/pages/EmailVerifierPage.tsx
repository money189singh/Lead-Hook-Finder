import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Mail,
  RefreshCw,
  Clock,
  RotateCcw,
  Sparkles,
  Server,
  Zap,
  Play,
  Copy,
  Check,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  ListFilter,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import {
  ScrapeJob,
  EmailVerificationResult,
  EmailVerificationStatus,
  EmailVerifierStatusResponse,
} from '../types';
import { EmailVerificationActionBar } from '../components/emailVerifier/EmailVerificationActionBar';
import { EmailVerificationBadge } from '../components/emailVerifier/EmailVerificationBadge';
import { EmailVerificationDetailModal } from '../components/emailVerifier/EmailVerificationDetailModal';
import { auth } from '../lib/firebase';
import { firestoreService } from '../lib/firestoreService';

interface EmailVerifierPageProps {
  currentJob: ScrapeJob | null;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToScraper?: () => void;
}

export const EmailVerifierPage: React.FC<EmailVerifierPageProps> = ({
  currentJob,
  onShowToast,
  onNavigateToScraper,
}) => {
  // Modes: 'scraped' (emails from current/recent crawl) vs 'custom' (instant live single/batch verifier)
  const [activeMode, setActiveMode] = useState<'scraped' | 'custom'>('scraped');

  // Custom tool input
  const [customInputText, setCustomInputText] = useState('');
  const [customIncludeSmtp, setCustomIncludeSmtp] = useState(false);
  const [isVerifyingCustom, setIsVerifyingCustom] = useState(false);
  const [customResults, setCustomResults] = useState<EmailVerificationResult[]>([]);

  // Scraped leads state
  const [verificationMap, setVerificationMap] = useState<Record<string, EmailVerificationResult>>({});
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<EmailVerificationStatus | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isVerifyingBulk, setIsVerifyingBulk] = useState(false);
  const [bulkJobProgress, setBulkJobProgress] = useState<{ percent: number; text: string; jobId?: string }>({
    percent: 0,
    text: '',
  });

  // Diagnostics modal
  const [inspectingResult, setInspectingResult] = useState<{ email: string; result?: EmailVerificationResult | null } | null>(null);

  // Server health / SMTP status
  const [smtpServerStatus, setSmtpServerStatus] = useState<EmailVerifierStatusResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pagination for scraped view
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 1. Fetch server verifier health & SMTP capabilities
  useEffect(() => {
    fetch('/api/email-verifier/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: EmailVerifierStatusResponse | null) => {
        if (data) setSmtpServerStatus(data);
      })
      .catch((e) => console.warn('[EmailVerifier Status Check]:', e));

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // 2. Extract unique emails from currentJob
  const extractedEmails = useMemo(() => {
    const list: Array<{
      id: string;
      email: string;
      type: string;
      company_name: string;
      website: string;
      person_name: string;
      role: string;
      source_url: string;
      email_verification?: EmailVerificationResult;
    }> = [];
    const seen = new Set<string>();

    for (const c of currentJob?.contacts || []) {
      if (c.professional_email && !seen.has(c.professional_email.toLowerCase())) {
        const norm = c.professional_email.toLowerCase().trim();
        seen.add(norm);
        list.push({
          id: `em_${c.id}_prof`,
          email: c.professional_email,
          type: 'Professional Personal Email',
          company_name: c.company_name,
          website: c.website,
          person_name: c.full_name || '—',
          role: c.role || 'Professional',
          source_url: c.source_url || c.website,
          email_verification: verificationMap[norm] || c.email_verification,
        });
      } else if (c.email && !seen.has(c.email.toLowerCase())) {
        const norm = c.email.toLowerCase().trim();
        seen.add(norm);
        list.push({
          id: `em_${c.id}`,
          email: c.email,
          type: c.email_type,
          company_name: c.company_name,
          website: c.website,
          person_name: c.full_name || '—',
          role: c.role || 'Professional',
          source_url: c.source_url || c.website,
          email_verification: verificationMap[norm] || c.email_verification,
        });
      }

      if (c.company_generic_emails) {
        for (const genEm of c.company_generic_emails) {
          const norm = genEm.toLowerCase().trim();
          if (!seen.has(norm)) {
            seen.add(norm);
            list.push({
              id: `em_${c.id}_gen_${genEm}`,
              email: genEm,
              type: 'Generic Business Email',
              company_name: c.company_name,
              website: c.website,
              person_name: 'Company Inboxes',
              role: 'General Inboxes',
              source_url: c.source_url || c.website,
              email_verification: verificationMap[norm],
            });
          }
        }
      }
    }

    for (const w of currentJob?.websites || []) {
      if (w.generic_emails) {
        for (const genEm of w.generic_emails) {
          const norm = genEm.toLowerCase().trim();
          if (!seen.has(norm)) {
            seen.add(norm);
            list.push({
              id: `em_site_${w.url}_${genEm}`,
              email: genEm,
              type: 'Generic Business Email',
              company_name: w.company_name || w.normalized_url,
              website: w.url,
              person_name: 'Company Inboxes',
              role: 'General Inboxes',
              source_url: w.url,
              email_verification: verificationMap[norm],
            });
          }
        }
      }
    }

    return list;
  }, [currentJob, verificationMap]);

  // 3. Hydrate cache from server & Firestore
  useEffect(() => {
    const emailsToHydrate = extractedEmails.map((item) => item.email).filter(Boolean);
    if (emailsToHydrate.length === 0) return;

    let isMounted = true;

    fetch('/api/email-verifier/cache-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emailsToHydrate }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.cached) return;
        setVerificationMap((prev) => ({
          ...prev,
          ...data.cached,
        }));
      })
      .catch((e) => console.warn('[EmailVerifier Cache Hydration]:', e));

    if (auth.currentUser?.uid) {
      firestoreService
        .getUserVerifiedEmails(auth.currentUser.uid)
        .then((fsMap) => {
          if (!isMounted || !fsMap) return;
          setVerificationMap((prev) => ({
            ...prev,
            ...fsMap,
          }));
        })
        .catch((e) => console.warn('[Firestore Verified Emails Hydration]:', e));
    }

    return () => {
      isMounted = false;
    };
  }, [extractedEmails.length, auth.currentUser?.uid]);

  // Counts for scraped view
  const scrapedCounts = useMemo(() => {
    let validCount = 0;
    let invalidCount = 0;
    let riskyCount = 0;
    let unknownCount = 0;
    let unverifiedCount = 0;

    for (const item of extractedEmails) {
      const st = item.email_verification?.verification_status;
      if (st === 'Valid') validCount++;
      else if (st === 'Invalid') invalidCount++;
      else if (st === 'Risky') riskyCount++;
      else if (st === 'Unknown') unknownCount++;
      else unverifiedCount++;
    }

    return {
      validCount,
      invalidCount,
      riskyCount,
      unknownCount,
      unverifiedCount,
      total: extractedEmails.length,
    };
  }, [extractedEmails]);

  // Filtered scraped emails
  const filteredScrapedEmails = useMemo(() => {
    return extractedEmails.filter((item) => {
      if (statusFilter !== 'All') {
        const itemStatus = item.email_verification?.verification_status || 'Not checked';
        if (itemStatus !== statusFilter) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.email.toLowerCase().includes(term) ||
          item.company_name.toLowerCase().includes(term) ||
          item.person_name.toLowerCase().includes(term) ||
          item.role.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [extractedEmails, statusFilter, searchTerm]);

  // Paginated scraped emails
  const totalPages = Math.ceil(filteredScrapedEmails.length / pageSize) || 1;
  const paginatedScrapedEmails = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredScrapedEmails.slice(start, start + pageSize);
  }, [filteredScrapedEmails, currentPage, pageSize]);

  // Handle single custom email verification or batch verification from textarea
  const handleVerifyCustomInput = async () => {
    if (!customInputText.trim()) {
      onShowToast('Please enter one or more email addresses to verify.', 'warning');
      return;
    }

    // Split by commas, newlines, spaces, semicolons
    const rawList = customInputText
      .split(/[\n,\s;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawList.length === 0) {
      onShowToast('No valid email strings detected in the input.', 'warning');
      return;
    }

    setIsVerifyingCustom(true);
    try {
      const res = await fetch('/api/email-verifier/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: rawList,
          options: { checkSmtp: customIncludeSmtp, forceReverify: true },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification failed');
      }

      const data = await res.json();
      const results: EmailVerificationResult[] = data.results || [];

      // Prepend to custom results
      setCustomResults((prev) => {
        const seen = new Set(results.map((r) => r.normalized_email));
        return [...results, ...prev.filter((p) => !seen.has(p.normalized_email))];
      });

      // Update global map
      setVerificationMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[r.normalized_email] = r;
          next[r.email.toLowerCase().trim()] = r;
        }
        return next;
      });

      if (auth.currentUser?.uid) {
        firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, results).catch(console.warn);
      }

      onShowToast(
        `Successfully verified ${results.length} email(s): ${results.filter((r) => r.verification_status === 'Valid').length} valid, ${results.filter((r) => r.verification_status === 'Invalid').length} invalid`,
        'success'
      );
    } catch (err: any) {
      onShowToast(err?.message || 'Verification error', 'error');
    } finally {
      setIsVerifyingCustom(false);
    }
  };

  // Scraped bulk handlers
  const handleVerifySelectedScraped = async (checkSmtp: boolean) => {
    const list = Array.from(selectedEmails);
    if (list.length === 0) {
      onShowToast('Please select at least one email to verify.', 'warning');
      return;
    }

    setIsVerifyingBulk(true);
    setBulkJobProgress({ percent: 10, text: `Verifying ${list.length} selected email(s)...` });

    try {
      const itemsToVerify = list.map((em: string) => {
        const matched = extractedEmails.find((it) => it.email.toLowerCase() === em.toLowerCase());
        return {
          email: em,
          company_id: matched?.website,
          company_name: matched?.company_name,
          source_url: matched?.source_url || matched?.website,
          email_category: matched?.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
        };
      });

      const res = await fetch('/api/email-verifier/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: itemsToVerify,
          options: { checkSmtp, forceReverify: true },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification failed');
      }

      const data = await res.json();
      const results: EmailVerificationResult[] = data.results || [];

      setVerificationMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[r.normalized_email] = r;
          next[r.email.toLowerCase().trim()] = r;
        }
        return next;
      });

      if (auth.currentUser?.uid) {
        firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, results).catch(console.warn);
      }

      onShowToast(`Verified ${results.length} email(s) successfully!`, 'success');
      setSelectedEmails(new Set());
    } catch (err: any) {
      onShowToast(err?.message || 'Error verifying selected emails', 'error');
    } finally {
      setIsVerifyingBulk(false);
      setBulkJobProgress({ percent: 0, text: '' });
    }
  };

  const handleVerifyUnverifiedScraped = async (checkSmtp: boolean) => {
    const unverifiedItems = extractedEmails
      .filter((it) => !it.email_verification || it.email_verification.verification_status === 'Not checked')
      .map((it) => ({
        email: it.email,
        company_id: it.website,
        company_name: it.company_name,
        source_url: it.source_url || it.website,
        email_category: it.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
      }));

    if (unverifiedItems.length === 0) {
      onShowToast('All scraped emails in this job have already been verified!', 'info');
      return;
    }

    setIsVerifyingBulk(true);
    setBulkJobProgress({ percent: 5, text: `Starting job for ${unverifiedItems.length} unverified emails...` });

    try {
      const res = await fetch('/api/email-verifier/verify-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedEmails: unverifiedItems,
          options: { checkSmtp },
          concurrency: 6,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start bulk verification');
      }

      const data = await res.json();
      if (!data.jobId) {
        onShowToast(data.message || 'All emails are already cached and up to date', 'info');
        setIsVerifyingBulk(false);
        return;
      }

      const jobId = data.jobId;
      setBulkJobProgress({ percent: 15, text: `Verification job ${jobId} running...`, jobId });

      const poll = async () => {
        try {
          const jobRes = await fetch(`/api/email-verifier/jobs/${jobId}`);
          if (!jobRes.ok) return;
          const jobData = await jobRes.json();
          const j = jobData.job;
          if (!j) return;

          const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
          setBulkJobProgress({
            percent: Math.max(10, Math.min(100, pct)),
            text: `Processed ${j.processed}/${j.total} emails${j.current_email ? ` (${j.current_email})` : ''}`,
            jobId,
          });

          if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setIsVerifyingBulk(false);

            if (j.status === 'completed') {
              const resList: EmailVerificationResult[] = j.results || [];
              setVerificationMap((prev) => {
                const next = { ...prev };
                for (const r of resList) {
                  next[r.normalized_email] = r;
                  next[r.email.toLowerCase().trim()] = r;
                }
                return next;
              });

              if (auth.currentUser?.uid) {
                firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, resList).catch(console.warn);
              }

              onShowToast(
                `Completed verification: ${j.valid_count} valid, ${j.invalid_count} invalid, ${j.risky_count} risky`,
                'success'
              );
            } else if (j.status === 'cancelled') {
              onShowToast('Verification job cancelled.', 'info');
            } else {
              onShowToast(j.error || 'Verification job failed', 'error');
            }
          }
        } catch (e: any) {
          console.warn('[Poll Error]:', e);
        }
      };

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(poll, 1200);
    } catch (err: any) {
      setIsVerifyingBulk(false);
      onShowToast(err?.message || 'Error starting unverified emails job', 'error');
    }
  };

  const handleReverifyAllScraped = async (checkSmtp: boolean) => {
    const allItems = extractedEmails.map((it) => ({
      email: it.email,
      company_id: it.website,
      company_name: it.company_name,
      source_url: it.source_url || it.website,
      email_category: it.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
    }));

    if (allItems.length === 0) {
      onShowToast('No scraped emails found to verify.', 'warning');
      return;
    }

    setIsVerifyingBulk(true);
    setBulkJobProgress({ percent: 5, text: `Queuing re-verification of all ${allItems.length} emails...` });

    try {
      const res = await fetch('/api/email-verifier/verify-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedEmails: allItems,
          options: { checkSmtp, forceReverify: true },
          concurrency: 6,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start reverification');
      }

      const data = await res.json();
      const jobId = data.jobId;
      if (!jobId) {
        onShowToast('Re-verification complete.', 'info');
        setIsVerifyingBulk(false);
        return;
      }

      setBulkJobProgress({ percent: 15, text: `Reverifying ${allItems.length} emails...`, jobId });

      const poll = async () => {
        try {
          const jobRes = await fetch(`/api/email-verifier/jobs/${jobId}`);
          if (!jobRes.ok) return;
          const jobData = await jobRes.json();
          const j = jobData.job;
          if (!j) return;

          const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
          setBulkJobProgress({
            percent: Math.max(10, Math.min(100, pct)),
            text: `Processed ${j.processed}/${j.total} emails${j.current_email ? ` (${j.current_email})` : ''}`,
            jobId,
          });

          if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setIsVerifyingBulk(false);

            if (j.status === 'completed') {
              const resList: EmailVerificationResult[] = j.results || [];
              setVerificationMap((prev) => {
                const next = { ...prev };
                for (const r of resList) {
                  next[r.normalized_email] = r;
                  next[r.email.toLowerCase().trim()] = r;
                }
                return next;
              });

              if (auth.currentUser?.uid) {
                firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, resList).catch(console.warn);
              }

              onShowToast(
                `Re-verified ${resList.length} emails (${j.valid_count} valid, ${j.invalid_count} invalid, ${j.risky_count} risky)`,
                'success'
              );
            } else if (j.status === 'cancelled') {
              onShowToast('Verification job cancelled.', 'info');
            } else {
              onShowToast(j.error || 'Verification job failed', 'error');
            }
          }
        } catch (e: any) {
          console.warn('[Poll Error]:', e);
        }
      };

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(poll, 1200);
    } catch (err: any) {
      setIsVerifyingBulk(false);
      onShowToast(err?.message || 'Error reverifying emails', 'error');
    }
  };

  const handleRetryUnknownScraped = async (checkSmtp: boolean) => {
    const unknownItems = extractedEmails
      .filter((it) => it.email_verification?.verification_status === 'Unknown')
      .map((it) => ({
        email: it.email,
        company_id: it.website,
        company_name: it.company_name,
        source_url: it.source_url || it.website,
        email_category: it.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
      }));

    if (unknownItems.length === 0) {
      onShowToast('No emails with "Unknown" or temporary failure status found.', 'info');
      return;
    }

    setIsVerifyingBulk(true);
    setBulkJobProgress({ percent: 10, text: `Retrying ${unknownItems.length} unknown email(s)...` });

    try {
      const res = await fetch('/api/email-verifier/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: unknownItems,
          options: { checkSmtp, forceReverify: true, dnsTimeoutMs: 8000 },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Retry failed');
      }

      const data = await res.json();
      const results: EmailVerificationResult[] = data.results || [];

      setVerificationMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[r.normalized_email] = r;
          next[r.email.toLowerCase().trim()] = r;
        }
        return next;
      });

      if (auth.currentUser?.uid) {
        firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, results).catch(console.warn);
      }

      onShowToast(`Retried ${results.length} email(s) successfully!`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Error retrying unknown emails', 'error');
    } finally {
      setIsVerifyingBulk(false);
      setBulkJobProgress({ percent: 0, text: '' });
    }
  };

  const handleSingleEmailVerify = async (email: string, checkSmtp = false) => {
    try {
      const matched = extractedEmails.find((it) => it.email.toLowerCase() === email.toLowerCase());
      const res = await fetch('/api/email-verifier/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          metadata: {
            company_id: matched?.website,
            company_name: matched?.company_name,
            source_url: matched?.source_url || matched?.website,
            email_category: matched?.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
          },
          options: { checkSmtp, forceReverify: true },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to verify email');
      }

      const data = await res.json();
      const result: EmailVerificationResult = data.result;

      setVerificationMap((prev) => ({
        ...prev,
        [result.normalized_email]: result,
        [email.toLowerCase().trim()]: result,
      }));

      // Update in custom list if present
      setCustomResults((prev) =>
        prev.map((item) => (item.normalized_email === result.normalized_email ? result : item))
      );

      if (inspectingResult && inspectingResult.email.toLowerCase() === email.toLowerCase()) {
        setInspectingResult({ email, result });
      }

      if (auth.currentUser?.uid) {
        firestoreService.saveUserVerifiedEmail(auth.currentUser.uid, result).catch(console.warn);
      }

      onShowToast(`Verified ${email}: ${result.verification_status}`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || `Failed to verify ${email}`, 'error');
    }
  };

  const handleCancelJob = async () => {
    if (!bulkJobProgress.jobId) return;
    try {
      await fetch(`/api/email-verifier/cancel/${bulkJobProgress.jobId}`, { method: 'POST' });
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setIsVerifyingBulk(false);
      setBulkJobProgress({ percent: 0, text: '' });
      onShowToast('Verification job cancelled.', 'info');
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  const handleCopyEmail = (email: string, id: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    onShowToast(`Copied ${email} to clipboard!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export clean list containing only valid and deliverable emails
  const handleExportCleanDeliverables = () => {
    const validItems = extractedEmails.filter(
      (item) => item.email_verification?.verification_status === 'Valid'
    );
    if (validItems.length === 0) {
      onShowToast('No verified valid emails found to export. Run verification first.', 'warning');
      return;
    }

    const headers = ['Email', 'Company', 'Website', 'Contact Name', 'Role', 'Status', 'Score', 'Mail Provider'];
    const rows = validItems.map((item) => [
      `"${item.email.replace(/"/g, '""')}"`,
      `"${(item.company_name || '').replace(/"/g, '""')}"`,
      `"${(item.website || '').replace(/"/g, '""')}"`,
      `"${(item.person_name || '').replace(/"/g, '""')}"`,
      `"${(item.role || '').replace(/"/g, '""')}"`,
      `"${item.email_verification?.verification_status || 'Valid'}"`,
      `"${item.email_verification?.deliverability_score || 95}"`,
      `"${(item.email_verification?.mail_provider || 'Direct MX').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadhook_clean_deliverable_emails_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Exported ${validItems.length} deliverable emails to CSV!`, 'success');
  };

  // Export complete audit report including invalid, risky, and DNS diagnostics
  const handleExportFullAudit = () => {
    if (extractedEmails.length === 0) {
      onShowToast('No emails available to export.', 'warning');
      return;
    }

    const headers = [
      'Email',
      'Status',
      'Deliverability Score',
      'Reason',
      'Mail Provider',
      'MX Records',
      'SPF Status',
      'DMARC Status',
      'Catch-All',
      'Disposable',
      'Company',
      'Website',
      'Contact Name',
      'Role',
    ];

    const rows = extractedEmails.map((item) => {
      const v = item.email_verification;
      return [
        `"${item.email.replace(/"/g, '""')}"`,
        `"${v?.verification_status || 'Not checked'}"`,
        `"${v?.deliverability_score ?? '—'}"`,
        `"${(v?.verification_reason || 'Pending verification').replace(/"/g, '""')}"`,
        `"${(v?.mail_provider || '—').replace(/"/g, '""')}"`,
        `"${(v?.mx_records?.join('; ') || '—').replace(/"/g, '""')}"`,
        `"${v?.dns_records?.has_spf ? 'Pass' : 'Missing'}"`,
        `"${v?.dns_records?.has_dmarc ? 'Pass' : 'Missing'}"`,
        `"${v?.is_catch_all ? 'Yes' : 'No'}"`,
        `"${v?.is_disposable ? 'Yes' : 'No'}"`,
        `"${(item.company_name || '').replace(/"/g, '""')}"`,
        `"${(item.website || '').replace(/"/g, '""')}"`,
        `"${(item.person_name || '').replace(/"/g, '""')}"`,
        `"${(item.role || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadhook_email_audit_full_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Exported full email audit for ${extractedEmails.length} addresses!`, 'success');
  };

  // Copy all valid emails to clipboard
  const handleCopyAllValid = () => {
    const validEmails = extractedEmails
      .filter((item) => item.email_verification?.verification_status === 'Valid')
      .map((it) => it.email.trim());

    if (validEmails.length === 0) {
      onShowToast('No verified valid emails found to copy.', 'warning');
      return;
    }

    navigator.clipboard.writeText(validEmails.join('\n'));
    onShowToast(`Copied ${validEmails.length} valid email(s) to clipboard!`, 'success');
  };

  // Handle file drop or upload into custom verifier
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Extract all email regex matches from file
      const foundEmails = Array.from(
        new Set(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
      );

      if (foundEmails.length === 0) {
        onShowToast('No valid email patterns found in the uploaded file.', 'warning');
        return;
      }

      setCustomInputText((prev) => (prev ? `${prev}\n${foundEmails.join('\n')}` : foundEmails.join('\n')));
      onShowToast(`Imported ${foundEmails.length} email addresses from ${file.name}!`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card rounded-2xl p-6 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#155eef] to-blue-700 text-white shadow-sm shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Self-Hosted Email Verifier
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40">
                  Zero Credits • 100% Free
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center bg-blue-50/60 dark:bg-[#0f1424] p-1 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs">
          <button
            type="button"
            onClick={() => setActiveMode('scraped')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeMode === 'scraped'
                ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Scraped Leads ({extractedEmails.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('custom')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeMode === 'custom'
                ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Instant Single & Bulk Tester</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Scraped Leads Verification Hub */}
      {activeMode === 'scraped' && (
        <div className="space-y-4">
          {extractedEmails.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-blue-200 dark:border-blue-900/50 bg-white/50 dark:bg-[#101730]/50 space-y-3">
              <Mail className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No extracted emails in current workspace
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Run a crawl in the Scraper to extract email addresses, or switch to the{' '}
                <button
                  type="button"
                  onClick={() => setActiveMode('custom')}
                  className="text-[#155eef] dark:text-cyan-400 font-semibold underline cursor-pointer"
                >
                  Instant Single & Bulk Tester
                </button>{' '}
                to verify any list of emails on demand.
              </p>
              {onNavigateToScraper && (
                <button
                  type="button"
                  onClick={onNavigateToScraper}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Go to Scraper</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Action Toolbar */}
              <EmailVerificationActionBar
                totalEmails={scrapedCounts.total}
                selectedCount={selectedEmails.size}
                unverifiedCount={scrapedCounts.unverifiedCount}
                validCount={scrapedCounts.validCount}
                invalidCount={scrapedCounts.invalidCount}
                riskyCount={scrapedCounts.riskyCount}
                unknownCount={scrapedCounts.unknownCount}
                currentFilter={statusFilter}
                onFilterChange={(st) => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                onVerifySelected={handleVerifySelectedScraped}
                onVerifyUnverified={handleVerifyUnverifiedScraped}
                onReverifyAll={handleReverifyAllScraped}
                onRetryUnknown={handleRetryUnknownScraped}
                isVerifying={isVerifyingBulk}
                progressPercent={bulkJobProgress.percent}
                progressText={bulkJobProgress.text}
                onCancelJob={handleCancelJob}
                smtpStatus={smtpServerStatus}
              />

              {/* Scraped Emails Table */}
              <div className="glass-card rounded-2xl border border-blue-100/80 dark:border-blue-900/30 overflow-hidden shadow-xs">
                {/* Search Bar & Export Actions Toolbar */}
                <div className="p-4 border-b border-blue-100/60 dark:border-blue-900/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search email, contact name, or company..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/40 bg-white dark:bg-[#101730] text-slate-800 dark:text-slate-200 text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#155eef]"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCopyAllValid}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Copy all valid emails to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Valid</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCleanDeliverables}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Export clean deliverable list for outbound email campaigns"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Export Deliverable CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportFullAudit}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-[#155eef] dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Export full RFC, DNS, and deliverability audit report"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Full Audit</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-blue-50/70 dark:bg-[#0f1424]/90 text-[#155eef] dark:text-blue-300 uppercase text-[10px] tracking-wider border-b border-blue-100 dark:border-blue-900/30 select-none">
                      <tr>
                        <th className="py-3 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={
                              paginatedScrapedEmails.length > 0 &&
                              paginatedScrapedEmails.every((item) => selectedEmails.has(item.email.toLowerCase().trim()))
                            }
                            onChange={() => {
                              const pageEmails = paginatedScrapedEmails.map((it) => it.email.toLowerCase().trim());
                              const allSelected = pageEmails.every((em) => selectedEmails.has(em));
                              setSelectedEmails((prev) => {
                                const next = new Set(prev);
                                if (allSelected) {
                                  pageEmails.forEach((em) => next.delete(em));
                                } else {
                                  pageEmails.forEach((em) => next.add(em));
                                }
                                return next;
                              });
                            }}
                            className="rounded border-slate-300 dark:border-slate-700 text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                            title="Select/Deselect All on Current Page"
                          />
                        </th>
                        <th className="py-3 px-4">Email Address</th>
                        <th className="py-3 px-4">Contact / Name</th>
                        <th className="py-3 px-4">Role & Function</th>
                        <th className="py-3 px-4">Company</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Verification Status</th>
                        <th className="py-3 px-4">Last Checked</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100/60 dark:divide-blue-900/30">
                      {paginatedScrapedEmails.length > 0 ? (
                        paginatedScrapedEmails.map((item) => {
                          const isSelected = selectedEmails.has(item.email.toLowerCase().trim());
                          const verification = item.email_verification;
                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
                                isSelected ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''
                              }`}
                            >
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const clean = item.email.toLowerCase().trim();
                                    setSelectedEmails((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(clean)) next.delete(clean);
                                      else next.add(clean);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-slate-300 dark:border-slate-700 text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-[#155eef] dark:text-cyan-300 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  <span>{item.email}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyEmail(item.email, item.id)}
                                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded text-slate-400 hover:text-[#155eef] transition-colors cursor-pointer"
                                    title="Copy Email Address"
                                  >
                                    {copiedId === item.id ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-800 dark:text-slate-300 whitespace-nowrap font-medium">
                                {item.person_name}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                {item.role}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <span>{item.company_name}</span>
                                  {item.website && (
                                    <a
                                      href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-slate-400 hover:text-[#155eef]"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {item.type}
                                </span>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <EmailVerificationBadge
                                  result={verification}
                                  status={verification?.verification_status || 'Not checked'}
                                  onClick={() =>
                                    setInspectingResult({
                                      email: item.email,
                                      result: verification || null,
                                    })
                                  }
                                />
                              </td>
                              <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                                {verification?.last_checked_at ? (
                                  <span title={new Date(verification.last_checked_at).toLocaleString()}>
                                    {new Date(verification.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ) : (
                                  <span className="italic text-slate-400">Never</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSingleEmailVerify(item.email)}
                                    className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Verify this address"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>{verification ? 'Re-verify' : 'Verify'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setInspectingResult({
                                        email: item.email,
                                        result: verification || null,
                                      })
                                    }
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] cursor-pointer"
                                    title="View Diagnostics"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                            No emails matched the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-[#0f1424]/60 text-xs text-slate-500 dark:text-slate-400">
                    <div>
                      Page <span className="font-semibold text-slate-900 dark:text-white">{currentPage}</span> of{' '}
                      <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101730] disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101730] disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mode 2: Instant Single & Bulk Email Tester */}
      {activeMode === 'custom' && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-blue-100/80 dark:border-blue-900/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#155eef]" />
                  <span>Verify Custom Emails (Single, Bulk, or CSV Upload)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Paste emails or upload a CSV/TXT file. Instant RFC syntax, DNS MX, disposable, and SMTP validation with zero credits.
                </p>
              </div>

              {/* Upload CSV/TXT button */}
              <div>
                <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-[#155eef]" />
                  <span>Upload CSV / TXT</span>
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <textarea
              rows={4}
              value={customInputText}
              onChange={(e) => setCustomInputText(e.target.value)}
              placeholder="e.g.&#10;sales@google.com&#10;alex@github.com&#10;fake.lead@nonexistent-domain-12345.com&#10;temp@mailinator.com&#10;(or drag and drop a .csv file here)"
              className="w-full p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-white dark:bg-[#101730] text-slate-900 dark:text-white font-mono text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#155eef]/40"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <label
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 select-none cursor-pointer"
                title="Attempts direct port 25 probing if environment permits"
              >
                <input
                  type="checkbox"
                  checked={customIncludeSmtp}
                  onChange={(e) => setCustomIncludeSmtp(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-[#155eef] focus:ring-[#155eef]"
                />
                <span>Include live SMTP port 25 probe (if available)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCustomInputText(
                      'sales@google.com\nalex@github.com\ncontact@microsoft.com\ntempuser@mailinator.com\nbad..syntax@invalid\nlead@thisdomain-definitely-does-not-exist-999.com'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Load Example Addresses
                </button>

                <button
                  type="button"
                  onClick={handleVerifyCustomInput}
                  disabled={isVerifyingCustom || !customInputText.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-xs shadow-xs disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-all"
                >
                  {isVerifyingCustom ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Verify Emails Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Table for Custom Run */}
          {customResults.length > 0 && (
            <div className="glass-card rounded-2xl border border-blue-100/80 dark:border-blue-900/30 overflow-hidden shadow-xs space-y-3">
              <div className="p-4 border-b border-blue-100/60 dark:border-blue-900/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    Verification Results ({customResults.length})
                  </span>
                  <span className="text-slate-500">
                    ({customResults.filter((r) => r.verification_status === 'Valid').length} Valid,{' '}
                    {customResults.filter((r) => r.verification_status === 'Invalid').length} Invalid,{' '}
                    {customResults.filter((r) => r.verification_status === 'Risky').length} Risky)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const headers = ['Email', 'Status', 'Score', 'Mail Provider', 'SPF', 'DMARC', 'CatchAll', 'Disposable', 'LatencyMs'];
                      const rows = customResults.map((r) => [
                        `"${r.email.replace(/"/g, '""')}"`,
                        `"${r.verification_status}"`,
                        `"${r.deliverability_score ?? '—'}"`,
                        `"${(r.mail_provider || '—').replace(/"/g, '""')}"`,
                        `"${r.dns_records?.has_spf ? 'Pass' : 'Missing'}"`,
                        `"${r.dns_records?.has_dmarc ? 'Pass' : 'Missing'}"`,
                        `"${r.is_catch_all ? 'Yes' : 'No'}"`,
                        `"${r.is_disposable ? 'Yes' : 'No'}"`,
                        `"${r.dns_records?.lookup_latency_ms || 0}"`,
                      ]);
                      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `leadhook_custom_verified_${Date.now()}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      onShowToast(`Exported ${customResults.length} custom verified emails!`, 'success');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomResults([])}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer px-2 py-1"
                  >
                    Clear Results
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-blue-50/70 dark:bg-[#0f1424]/90 text-[#155eef] dark:text-blue-300 uppercase text-[10px] tracking-wider border-b border-blue-100 dark:border-blue-900/30 select-none">
                    <tr>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">Deliverability Status</th>
                      <th className="py-3 px-4">Deliverability Score</th>
                      <th className="py-3 px-4">Mail Host / Provider</th>
                      <th className="py-3 px-4">Security (SPF/DMARC)</th>
                      <th className="py-3 px-4">Catch-All</th>
                      <th className="py-3 px-4">Account Type</th>
                      <th className="py-3 px-4">Latency</th>
                      <th className="py-3 px-4 text-center">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100/60 dark:divide-blue-900/30">
                    {customResults.map((r, idx) => (
                      <tr key={`custom_${idx}_${r.normalized_email}`} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#155eef] dark:text-cyan-300 whitespace-nowrap">
                          {r.email}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <EmailVerificationBadge
                            result={r}
                            status={r.verification_status}
                            onClick={() => setInspectingResult({ email: r.email, result: r })}
                          />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                (r.deliverability_score ?? (r.verification_status === 'Valid' ? 95 : 0)) >= 80
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : (r.deliverability_score ?? (r.verification_status === 'Valid' ? 95 : 0)) >= 50
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {r.deliverability_score ?? (r.verification_status === 'Valid' ? 95 : 0)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({r.bounce_probability || (r.verification_status === 'Valid' ? '< 2%' : '> 95%')})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                            {r.mx_provider ||
                              (r.verification_details?.mx_records && r.verification_details.mx_records.length > 0
                                ? r.verification_details.mx_records[0].exchange
                                : 'None')}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                                r.has_spf !== false
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                              }`}
                              title={r.spf_record || 'SPF'}
                            >
                              SPF
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                                r.has_dmarc !== false
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                              }`}
                              title={r.dmarc_record || 'DMARC'}
                            >
                              DMARC
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {r.is_catch_all ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Catch-All
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">Clean</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {r.is_disposable ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              Disposable
                            </span>
                          ) : r.is_role_account || r.verification_details?.is_role_account ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {r.verification_details?.role_department || 'Role'}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400 text-[11px]">Personal / Direct</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                          {r.verification_details?.latency_ms !== undefined ? `${r.verification_details.latency_ms}ms` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setInspectingResult({ email: r.email, result: r })}
                            className="px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[#155eef] dark:text-blue-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Inspect Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diagnostics Modal */}
      {inspectingResult && (
        <EmailVerificationDetailModal
          email={inspectingResult.email}
          result={
            inspectingResult.result ||
            verificationMap[inspectingResult.email.toLowerCase().trim()] ||
            null
          }
          onClose={() => setInspectingResult(null)}
          onReverify={(em) => handleSingleEmailVerify(em, true)}
        />
      )}
    </div>
  );
};
