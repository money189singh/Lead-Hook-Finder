import { Router } from 'express';
import * as XLSX from 'xlsx';
import { globalSocialDemandRadarEngine } from './socialRadarEngine';

export const socialRadarRouter = Router();

// GET /api/social-radar/leads
socialRadarRouter.get('/leads', (req, res) => {
  try {
    const { platform, audience, category, urgency, query, status } = req.query;
    const leads = globalSocialDemandRadarEngine.getLeads({
      platform: platform ? String(platform) : undefined,
      audience: audience ? String(audience) : undefined,
      category: category ? String(category) : undefined,
      urgency: urgency ? String(urgency) : undefined,
      query: query ? String(query) : undefined,
      status: status ? String(status) : undefined,
    });
    res.json(leads);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/social-radar/stats
socialRadarRouter.get('/stats', (req, res) => {
  try {
    const stats = globalSocialDemandRadarEngine.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social-radar/scan
socialRadarRouter.post('/scan', async (req, res) => {
  try {
    const { query, serviceCategory, audienceType, limit } = req.body;
    const result = await globalSocialDemandRadarEngine.runScan({
      query,
      serviceCategory,
      audienceType,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    let msg = err?.message || 'Failed to complete social demand scan';
    try {
      if (typeof msg === 'string' && msg.includes('"error":')) {
        const parsed = JSON.parse(msg);
        msg = parsed?.error?.message || msg;
      }
    } catch {}
    res.status(500).json({ error: msg });
  }
});

// POST /api/social-radar/ingest (Ingest and analyze a real post by URL or text)
socialRadarRouter.post('/ingest', async (req, res) => {
  try {
    const { url, text, platform, authorHint } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Post text or snippet is required' });
    }
    const lead = await globalSocialDemandRadarEngine.ingestSocialPost({
      url,
      text,
      platform,
      authorHint,
    });
    res.json(lead);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to ingest post' });
  }
});

// POST /api/social-radar/generate-pitch
socialRadarRouter.post('/generate-pitch', (req, res) => {
  try {
    const { leadId, channel } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'leadId is required' });
    }
    const targetChannel = channel === 'linkedin_msg' ? 'linkedin_msg' : channel === 'cold_email' ? 'cold_email' : 'reddit_dm';
    const pitch = globalSocialDemandRadarEngine.generatePitchForLead(leadId, targetChannel);
    res.json(pitch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/social-radar/leads/:id
socialRadarRouter.patch('/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['new', 'contacted', 'saved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required (new, contacted, saved, dismissed)' });
    }
    const updated = globalSocialDemandRadarEngine.updateLeadStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social-radar/export-xlsx
socialRadarRouter.post('/export-xlsx', (req, res) => {
  try {
    const filters = req.body || {};
    const leads = globalSocialDemandRadarEngine.getLeads(filters);

    const rows = leads.map((l) => ({
      Platform: l.platform.toUpperCase(),
      Channel: l.sourceChannel,
      Audience: l.audienceType,
      Category: l.serviceCategory,
      Urgency: l.demandDetails.urgency,
      'Intent Score (%)': l.demandDetails.buyingIntentScore,
      'Post Title': l.postTitle,
      'Post Snippet': l.postContent,
      Author: l.author.displayName,
      Username: l.author.username,
      Company: l.author.companyName || 'N/A',
      Role: l.author.role || 'Prospect',
      Location: l.author.location || 'Remote',
      Email: l.contactPoints.email || 'N/A',
      'Email Status': l.contactPoints.emailStatus || 'Unverified',
      Phone: l.contactPoints.phone || 'N/A',
      Budget: l.demandDetails.budget || 'Negotiable',
      'Post URL': l.postUrl,
      'Direct Message URL': l.contactPoints.directMessageUrl || l.postUrl,
      'Scraped At': l.scrapedAt,
      Status: l.status.toUpperCase(),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto col width
    const colWidths = [
      { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 24 }, { wch: 12 }, { wch: 15 },
      { wch: 40 }, { wch: 50 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
      { wch: 18 }, { wch: 28 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 45 },
      { wch: 45 }, { wch: 22 }, { wch: 12 },
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Social Demand Leads');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="social_demand_leads_${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for CSV escaping
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// POST or GET /api/social-radar/export-csv
const handleCsvExport = (req: any, res: any) => {
  try {
    const filters = req.method === 'POST' ? req.body || {} : req.query || {};
    const leads = globalSocialDemandRadarEngine.getLeads(filters);

    const headers = [
      'Platform',
      'Channel',
      'Audience',
      'Category',
      'Urgency',
      'Intent Score',
      'Post Title',
      'Post Snippet',
      'Author Name',
      'Username',
      'Company',
      'Role',
      'Location',
      'Email',
      'Email Status',
      'Phone',
      'Budget',
      'Post URL',
      'Direct Message URL',
      'Scraped At',
      'Status'
    ];

    const lines: string[] = [headers.join(',')];

    for (const l of leads) {
      const row = [
        escapeCsv(l.platform.toUpperCase()),
        escapeCsv(l.sourceChannel),
        escapeCsv(l.audienceType),
        escapeCsv(l.serviceCategory),
        escapeCsv(l.demandDetails.urgency),
        escapeCsv(`${l.demandDetails.buyingIntentScore}%`),
        escapeCsv(l.postTitle),
        escapeCsv(l.postContent),
        escapeCsv(l.author.displayName),
        escapeCsv(l.author.username),
        escapeCsv(l.author.companyName || ''),
        escapeCsv(l.author.role || ''),
        escapeCsv(l.author.location || 'Remote'),
        escapeCsv(l.contactPoints.email || ''),
        escapeCsv(l.contactPoints.emailStatus || 'Unverified'),
        escapeCsv(l.contactPoints.phone || ''),
        escapeCsv(l.demandDetails.budget || 'Negotiable'),
        escapeCsv(l.postUrl),
        escapeCsv(l.contactPoints.directMessageUrl || l.postUrl),
        escapeCsv(l.scrapedAt),
        escapeCsv(l.status.toUpperCase()),
      ];
      lines.push(row.join(','));
    }

    const csvContent = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="social_demand_leads_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

socialRadarRouter.get('/export-csv', handleCsvExport);
socialRadarRouter.post('/export-csv', handleCsvExport);

// POST /api/social-radar/webhook-push
// Pushes authentic leads directly to Zapier, Make, n8n, Slack, Discord, or any custom CRM webhook
socialRadarRouter.post('/webhook-push', async (req, res) => {
  try {
    const { webhookUrl, leadIds, filters, customPayloadKey } = req.body;
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return res.status(400).json({ error: 'A valid http/https webhook URL is required.' });
    }

    let leads = globalSocialDemandRadarEngine.getLeads(filters || {});
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      leads = leads.filter((l) => leadIds.includes(l.id));
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No matching leads found to dispatch.' });
    }

    const payload = {
      event: 'social_demand_leads_dispatched',
      source: 'LeadHook Social Demand Radar',
      timestamp: new Date().toISOString(),
      leadCount: leads.length,
      leads: leads.map((l) => ({
        id: l.id,
        platform: l.platform.toUpperCase(),
        sourceChannel: l.sourceChannel,
        audienceType: l.audienceType,
        serviceCategory: l.serviceCategory,
        urgency: l.demandDetails.urgency,
        buyingIntentScore: l.demandDetails.buyingIntentScore,
        postTitle: l.postTitle,
        postSnippet: l.postContent,
        author: {
          displayName: l.author.displayName,
          username: l.author.username,
          companyName: l.author.companyName,
          role: l.author.role,
          location: l.author.location,
          profileUrl: l.author.profileUrl,
        },
        contactPoints: {
          email: l.contactPoints.email,
          emailStatus: l.contactPoints.emailStatus,
          phone: l.contactPoints.phone,
          directMessageUrl: l.contactPoints.directMessageUrl,
        },
        budget: l.demandDetails.budget,
        postUrl: l.postUrl,
        aiPitchSubject: l.aiDraftOutreach?.subject,
        aiPitchMessage: l.aiDraftOutreach?.message,
      })),
    };

    const startTime = Date.now();
    const abortCtrl = new AbortController();
    const timeout = setTimeout(() => abortCtrl.abort(), 12000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LeadHook-Webhook-Dispatcher/2.0',
        'X-LeadHook-Event': 'social_demand_leads',
      },
      body: JSON.stringify(payload),
      signal: abortCtrl.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    let responseBodyText = '';
    try {
      responseBodyText = (await response.text()).slice(0, 500);
    } catch {}

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: `Remote webhook returned HTTP ${response.status} ${response.statusText}`,
        latencyMs,
        responseSnippet: responseBodyText,
      });
    }

    return res.json({
      success: true,
      message: `Successfully delivered ${leads.length} leads to external webhook!`,
      status: response.status,
      latencyMs,
      leadsDelivered: leads.length,
      responseSnippet: responseBodyText,
    });
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
    return res.status(500).json({
      success: false,
      error: isTimeout ? 'Webhook request timed out (12s limit)' : err.message || 'Webhook dispatch failed',
    });
  }
});

// POST /api/social-radar/push-to-results
// Transfers social leads into LeadHook's main Results / Leads table for verification and CRM workflows
socialRadarRouter.post('/push-to-results', async (req, res) => {
  try {
    const { leadIds } = req.body;
    let leads = globalSocialDemandRadarEngine.getLeads({});
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      leads = leads.filter((l) => leadIds.includes(l.id));
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No leads available to push.' });
    }

    // Dynamic import storage to avoid circular dependencies
    const { saveJob, saveHistoryItem } = await import('../storage');
    const jobId = `social_job_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const contacts = leads.map((l, idx) => ({
      id: `c_${jobId}_${idx + 1}`,
      company_name: l.author.companyName || l.author.displayName || 'Social Prospect',
      website: l.postUrl,
      first_name: l.author.displayName ? l.author.displayName.split(' ')[0] : l.author.username,
      last_name: l.author.displayName && l.author.displayName.split(' ').length > 1
        ? l.author.displayName.split(' ').slice(1).join(' ')
        : '',
      full_name: l.author.displayName || l.author.username,
      role: l.author.role || `${l.platform.toUpperCase()} Prospect`,
      email: l.contactPoints.email || '',
      email_type: (l.contactPoints.email ? 'Professional Personal Email' : 'Generic') as any,
      phone: l.contactPoints.phone || '',
      source_url: l.postUrl,
      status: 'Extracted',
      provider: 'Social Demand Radar',
      model: l.platform.toUpperCase(),
      identity_verified: true,
      identity_verification_evidence: `Active demand request on ${l.sourceChannel}`,
      is_decision_maker: true,
      decision_maker_tier: 'Decision Maker',
      decision_maker_score: l.demandDetails.buyingIntentScore,
      industry: l.serviceCategory,
      icp_filter_status: 'INCLUDED' as const,
      icp_score: l.demandDetails.buyingIntentScore,
      social_profiles: {
        linkedin: l.platform === 'linkedin' ? l.postUrl : undefined,
        twitter: l.platform === 'twitter' ? l.postUrl : undefined,
      },
    }));

    const job = {
      id: jobId,
      created_at: nowIso,
      status: 'completed' as const,
      total_websites: leads.length,
      completed_websites: leads.length,
      processing_websites: 0,
      failed_websites: 0,
      contacts_found: contacts.length,
      emails_found: contacts.filter((c) => !!c.email).length,
      pages_discovered: leads.length,
      pages_crawled: leads.length,
      websites: leads.map((l, i) => {
        const contactForSite = contacts[i];
        return {
          url: l.postUrl,
          normalized_url: l.postUrl,
          company_name: l.author.companyName || l.author.displayName || 'Social Prospect',
          status: 'Completed' as const,
          pages_discovered: 1,
          pages_crawled: 1,
          contacts_found: 1,
          emails_found: contactForSite?.email ? 1 : 0,
          contacts: contactForSite ? [contactForSite as any] : [],
        };
      }),
      contacts: contacts as any,
      logs: [
        {
          timestamp: nowIso,
          timeStr: new Date().toLocaleTimeString(),
          level: 'success' as const,
          message: `Imported ${contacts.length} verified social demand leads from ${leads[0]?.sourceChannel || 'Social Radar'}.`,
        },
      ],
    };

    saveJob(job as any);
    saveHistoryItem({
      id: jobId,
      date: nowIso,
      total_websites: leads.length,
      completed_websites: leads.length,
      failed_websites: 0,
      contacts_found: contacts.length,
      emails_found: contacts.filter((c) => !!c.email).length,
      websites_summary: leads.map((l) => ({
        domain: l.postUrl,
        company: l.author.companyName || l.author.displayName || 'Social Prospect',
        status: 'Completed',
        contacts: 1,
      })),
    });

    return res.json({
      success: true,
      jobId,
      importedCount: contacts.length,
      message: `Successfully transferred ${contacts.length} leads to Leads & Results!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to push leads to results' });
  }
});
