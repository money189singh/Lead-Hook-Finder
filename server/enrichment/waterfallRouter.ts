import { Router } from 'express';
import { globalWaterfallEnricher } from './waterfallEnricher';
import { VerificationEngine } from '../emailVerifier/verificationEngine';
import { crawlerEngine } from '../crawler';
import { saveJob } from '../storage';
import { interpretNaturalLanguageFilter } from './nlFilterService';

export const waterfallRouter = Router();

// POST /api/waterfall/nl-filter
waterfallRouter.post('/nl-filter', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Natural language query is required' });
    }
    const spec = await interpretNaturalLanguageFilter(query);
    res.json({ success: true, filter: spec });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to parse natural language filter' });
  }
});

// POST /api/waterfall/enrich
waterfallRouter.post('/enrich', async (req, res) => {
  try {
    const contact = req.body;
    if (!contact) {
      return res.status(400).json({ error: 'Contact data is required' });
    }

    const result = await globalWaterfallEnricher.enrichContact(contact);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/waterfall/enrich-batch
waterfallRouter.post('/enrich-batch', async (req, res) => {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Array of contacts is required' });
    }

    const limited = contacts.slice(0, 50);
    const results = await Promise.all(
      limited.map(async (c) => {
        const wf = await globalWaterfallEnricher.enrichContact(c);
        const targetEmail = (wf.enrichedFields.verified_email || c.professional_email || c.email || '').trim().toLowerCase();
        let emailVer = undefined;
        if (targetEmail && targetEmail.includes('@')) {
          try {
            emailVer = await VerificationEngine.verifyEmail(
              targetEmail,
              {
                company_id: c.website,
                company_name: c.company_name,
                source_url: c.source_url || c.website,
                email_category: 'professional_personal',
              },
              { checkSmtp: false }
            );
          } catch {}
        }
        return {
          ...wf,
          email_verification: emailVer,
        };
      })
    );

    // Persist enriched fields back into the active job if available
    const currentJob = crawlerEngine.getCurrentJob();
    if (currentJob) {
      const byId = new Map(results.map((r) => [r.contactId, r]));
      const applyEnrichment = (c: any) => {
        const match = byId.get(c.id);
        if (!match) return;
        if (match.enrichedFields.verified_email && !c.professional_email) {
          c.professional_email = match.enrichedFields.verified_email;
          c.email = match.enrichedFields.verified_email;
          c.association_status = c.association_status === 'explicit' ? 'explicit' : 'inferred';
        }
        if (match.enrichedFields.direct_phone && !c.phone) {
          c.phone = match.enrichedFields.direct_phone;
          c.phone_type = match.enrichedFields.phone_type;
        }
        if (match.enrichedFields.linkedin_url && !c.linkedin_url) {
          c.linkedin_url = match.enrichedFields.linkedin_url;
        }
        if (match.enrichedFields.tech_stack && match.enrichedFields.tech_stack.length > 0) {
          c.tech_stack = match.enrichedFields.tech_stack;
        }
        if (match.email_verification) {
          c.email_verification = match.email_verification;
        }
        c.confidence_score = Math.max(c.confidence_score || 0, match.confidence || 92);
      };

      for (const c of currentJob.contacts || []) applyEnrichment(c);
      for (const w of currentJob.websites || []) {
        for (const c of w.contacts || []) applyEnrichment(c);
      }
      crawlerEngine.syncJobAggregates();
      saveJob(currentJob);
    }

    res.json({ results, enrichedCount: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

