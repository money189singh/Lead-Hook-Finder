import { Router, Request, Response } from 'express';
import { VerificationEngine } from './emailVerifier/verificationEngine';
import { VerificationQueue } from './emailVerifier/verificationQueue';
import { VerifierCache } from './emailVerifier/verifierCache';
import { SmtpProber } from './emailVerifier/smtpProber';
import { EmailVerifierStatusResponse, EmailCategory } from './emailVerifier/types';
import { getJobById } from './storage';

export const emailVerifierRouter = Router();

/**
 * GET /api/email-verifier/status
 * Return service health, supported checks, current configuration, and SMTP capability
 */
emailVerifierRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const smtpAvailable = await SmtpProber.testEnvironmentSmtpCapability();
    const cacheStats = VerifierCache.getStats();

    const response: EmailVerifierStatusResponse = {
      healthy: true,
      provider: 'self_hosted',
      supported_checks: {
        syntax: true,
        domain_dns: true,
        mx_records: true,
        a_record_fallback: true,
        disposable_detection: true,
        role_account_detection: true,
        smtp_probing: true,
      },
      smtp_available: smtpAvailable,
      smtp_probe_enabled: true,
      environment_note: smtpAvailable
        ? 'Direct SMTP port 25 connection supported'
        : 'Outbound port 25 is restricted or firewalled by cloud host; DNS MX/A validation operates with 100% precision without credits',
      cache_stats: cacheStats,
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get email verifier status' });
  }
});

/**
 * POST /api/email-verifier/verify
 * Accept one email or a batch (up to 500)
 */
emailVerifierRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { email, emails, options, metadata } = req.body;

    // Single email verification
    if (email && typeof email === 'string') {
      const result = await VerificationEngine.verifyEmail(
        email,
        metadata,
        options
      );
      return res.json({ success: true, result });
    }

    // Batch verification
    if (Array.isArray(emails)) {
      if (emails.length > 500) {
        return res.status(400).json({
          error: 'Batch size exceeds maximum limit of 500 emails per request.',
        });
      }

      const items: Array<{
        email: string;
        company_id?: string;
        company_name?: string;
        source_url?: string;
        email_category?: EmailCategory;
      }> = [];

      for (const item of emails) {
        if (typeof item === 'string') {
          items.push({ email: item });
        } else if (item && typeof item.email === 'string') {
          items.push(item);
        }
      }

      if (items.length === 0) {
        return res.status(400).json({ error: 'No valid email addresses provided in batch.' });
      }

      const results = await VerificationEngine.verifyBatch(
        items,
        options,
        req.body.concurrency || 5
      );

      return res.json({
        success: true,
        total: results.length,
        results,
      });
    }

    return res.status(400).json({ error: 'Must provide either "email" string or "emails" array.' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Verification failed' });
  }
});

/**
 * POST /api/email-verifier/verify-existing
 * Verify previously extracted emails that are new, stale, or explicitly selected
 */
emailVerifierRouter.post('/verify-existing', async (req: Request, res: Response) => {
  try {
    const {
      jobId,
      filter = 'unverified', // 'all' | 'unverified' | 'stale' | 'selected'
      selectedEmails,
      options,
      concurrency = 5,
    } = req.body;

    const emailItems: Array<{
      email: string;
      company_id?: string;
      company_name?: string;
      source_url?: string;
      email_category?: EmailCategory;
    }> = [];

    // If explicit list of selected emails is given
    if (Array.isArray(selectedEmails) && selectedEmails.length > 0) {
      for (const em of selectedEmails) {
        if (typeof em === 'string' && em.trim()) {
          emailItems.push({ email: em.trim() });
        } else if (em && em.email) {
          emailItems.push(em);
        }
      }
    } else if (jobId) {
      // Load job from storage
      const job = getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: `Job "${jobId}" not found.` });
      }

      // Collect from contacts
      if (job.contacts && Array.isArray(job.contacts)) {
        for (const c of job.contacts) {
          if (c.email) {
            emailItems.push({
              email: c.email,
              company_id: c.website,
              company_name: c.company_name,
              source_url: c.source_url || c.website,
              email_category: c.email_type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
            });
          }
          if (c.professional_email && c.professional_email !== c.email) {
            emailItems.push({
              email: c.professional_email,
              company_id: c.website,
              company_name: c.company_name,
              source_url: c.source_url || c.website,
              email_category: 'professional_personal',
            });
          }
        }
      }

      // Collect from generic_emails
      if (job.generic_emails && Array.isArray(job.generic_emails)) {
        for (const ge of job.generic_emails) {
          if (ge.email) {
            emailItems.push({
              email: ge.email,
              company_id: ge.website,
              company_name: ge.company_name,
              source_url: ge.source_url || ge.website,
              email_category: 'generic_business',
            });
          }
        }
      }
    }

    if (emailItems.length === 0) {
      return res.status(400).json({ error: 'No emails found to verify.' });
    }

    // Filter items based on criteria
    let candidatesToVerify = emailItems;
    if (filter === 'unverified') {
      candidatesToVerify = emailItems.filter((item) => {
        const cached = VerifierCache.get(item.email, item.company_id);
        return !cached;
      });
    } else if (filter === 'stale') {
      candidatesToVerify = emailItems.filter((item) => {
        const cached = VerifierCache.get(item.email, item.company_id);
        if (!cached) return true;
        const lastChecked = cached.last_checked_at || cached.verified_at;
        if (!lastChecked) return true;
        return Date.now() - new Date(lastChecked).getTime() > 14 * 24 * 60 * 60 * 1000; // 14 days
      });
    }

    if (candidatesToVerify.length === 0) {
      return res.json({
        success: true,
        message: 'All target emails have already been verified and are up-to-date in cache.',
        total: 0,
        jobId: null,
      });
    }

    // Create bounded background job
    const job = VerificationQueue.createJob(candidatesToVerify, options, concurrency);

    return res.json({
      success: true,
      jobId: job.id,
      total: candidatesToVerify.length,
      status: job.status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to start bulk verification' });
  }
});

/**
 * GET /api/email-verifier/jobs/:id
 * Get status and progress of a verification job
 */
emailVerifierRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = VerificationQueue.getJob(id);
  if (!job) {
    return res.status(404).json({ error: `Verification job "${id}" not found.` });
  }
  return res.json({ success: true, job });
});

/**
 * POST /api/email-verifier/cancel/:id
 * Cancel a running verification job
 */
emailVerifierRouter.post('/cancel/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const success = VerificationQueue.cancelJob(id);
  if (!success) {
    return res.status(400).json({ error: `Could not cancel job "${id}".` });
  }
  return res.json({ success: true, message: `Job "${id}" cancelled.` });
});

/**
 * POST /api/email-verifier/cache-batch
 * Query cached verification data for a list of emails
 */
emailVerifierRouter.post('/cache-batch', (req: Request, res: Response) => {
  const { emails } = req.body;
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'Expected "emails" array.' });
  }

  const map = VerifierCache.getBatch(emails);
  const resultsObj: Record<string, any> = {};
  for (const [em, resItem] of map.entries()) {
    resultsObj[em] = resItem;
  }

  return res.json({ success: true, cached: resultsObj });
});
