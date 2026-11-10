import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { InboundWebhookLog, Contact } from '../../src/types';
import { globalTechDetector } from '../techDetector/techDetectorEngine';
import { globalWaterfallEnricher } from '../enrichment/waterfallEnricher';
import { saveHistoryItem } from '../storage';

export const inboundRouter = Router();

const DATA_DIR = path.join(process.cwd(), 'data');
const INBOUND_LOGS_FILE = path.join(DATA_DIR, 'inbound_logs.json');

function getInboundLogs(): InboundWebhookLog[] {
  try {
    if (fs.existsSync(INBOUND_LOGS_FILE)) {
      const raw = fs.readFileSync(INBOUND_LOGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

function saveInboundLog(log: InboundWebhookLog) {
  try {
    const logs = getInboundLogs();
    logs.unshift(log);
    fs.writeFileSync(INBOUND_LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
  } catch {}
}

// POST /api/inbound/webhook - Ingest from any external tool (Typeform, landing page, custom script)
inboundRouter.post('/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const url = body.url || body.website || body.domain || '';
    const company = body.company_name || body.company || (url ? new URL(url.startsWith('http') ? url : `https://${url}`).hostname : 'Inbound Prospect');
    const name = body.name || body.full_name || 'Inbound Lead';
    const email = body.email || body.work_email || '';
    const phone = body.phone || '';

    const newContact: Partial<Contact> = {
      id: `inbound_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company_name: company,
      website: url,
      full_name: name,
      first_name: name.split(' ')[0] || name,
      last_name: name.split(' ').slice(1).join(' ') || 'Prospect',
      role: body.role || body.title || 'Inbound Prospect',
      email,
      phone,
      source_url: url || 'Inbound Webhook',
      status: 'verified',
      icp_score: 90,
    };

    // Auto-enrich if website is present
    if (url) {
      try {
        const enriched = await globalWaterfallEnricher.enrichContact(newContact);
        newContact.tech_stack = enriched.enrichedFields.tech_stack;
        newContact.phone_type = enriched.enrichedFields.phone_type;
        if (!newContact.email) newContact.email = enriched.enrichedFields.verified_email;
      } catch {}
    }

    // Save to historical dataset
    try {
      const now = new Date().toISOString();
      const histId = `inbound_${Date.now()}`;
      const histItem = {
        id: histId,
        date: now,
        total_websites: 1,
        completed_websites: 1,
        failed_websites: 0,
        contacts_found: 1,
        emails_found: newContact.email ? 1 : 0,
        websites_summary: [
          {
            domain: url || 'inbound-source.local',
            company: company,
            status: 'Completed',
            contacts: 1,
          },
        ],
      };
      const jobItem: any = {
        id: histId,
        created_at: now,
        completed_at: now,
        total_websites: 1,
        total_contacts: 1,
        websites: [
          {
            url: url || 'https://inbound-source.local',
            normalized_url: url || 'https://inbound-source.local',
            company_name: company,
            status: 'Completed',
            contacts_found: 1,
            pages_crawled: 1,
            technologies: newContact.tech_stack,
          },
        ],
        contacts: [newContact as Contact],
        logs: [
          {
            timestamp: now,
            time: new Date().toLocaleTimeString(),
            message: `Lead ingested from inbound webhook: ${company} (${name})`,
            type: 'info',
          },
        ],
      };
      saveHistoryItem(histItem, jobItem);
    } catch {}

    const log: InboundWebhookLog = {
      id: `log_${Date.now()}`,
      receivedAt: new Date().toISOString(),
      source: 'webhook',
      targetUrl: url,
      companyName: company,
      contactsFound: 1,
      status: 'processed',
      payloadSummary: `${name} (${email || phone || 'No contact point'})`,
    };
    saveInboundLog(log);

    res.json({
      success: true,
      message: 'Inbound lead ingested and enriched successfully!',
      lead: newContact,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/inbound/quick-capture - Used by Chrome Extension & Bookmarklet
inboundRouter.post('/quick-capture', async (req, res) => {
  try {
    const { url, title, pageText } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const company = title ? title.split(/[-–|]/)[0].trim() : domain;

    // Run tech detector on this URL
    const techResult = await globalTechDetector.detectUrl(url);

    // Run waterfall enrichment
    const contactDraft: Partial<Contact> = {
      id: `capture_${Date.now()}`,
      company_name: company,
      website: url,
      full_name: `${company} Leadership`,
      role: 'Executive / Decision Maker',
      email: '',
      phone: '',
      source_url: url,
      status: 'verified',
      icp_score: 88,
    };

    const enriched = await globalWaterfallEnricher.enrichContact(contactDraft);
    contactDraft.email = enriched.enrichedFields.verified_email;
    contactDraft.phone = enriched.enrichedFields.direct_phone;
    contactDraft.phone_type = enriched.enrichedFields.phone_type;
    contactDraft.tech_stack = techResult.technologies.map((t) => t.name);
    contactDraft.linkedin_url = enriched.enrichedFields.linkedin_url;

    // Save to results table
    const now = new Date().toISOString();
    try {
      const histId = `chrome_${Date.now()}`;
      const histItem = {
        id: histId,
        date: now,
        total_websites: 1,
        completed_websites: 1,
        failed_websites: 0,
        contacts_found: 1,
        emails_found: contactDraft.email ? 1 : 0,
        websites_summary: [
          {
            domain: url ? new URL(url.startsWith('http') ? url : `https://${url}`).hostname : 'chrome-capture.local',
            company: company,
            status: 'Completed',
            contacts: 1,
          },
        ],
      };
      const jobItem: any = {
        id: histId,
        created_at: now,
        completed_at: now,
        total_websites: 1,
        total_contacts: 1,
        websites: [
          {
            url,
            normalized_url: url,
            company_name: company,
            status: 'Completed',
            contacts_found: 1,
            pages_crawled: 1,
            technologies: contactDraft.tech_stack,
          },
        ],
        contacts: [contactDraft as Contact],
        logs: [
          {
            timestamp: now,
            time: new Date().toLocaleTimeString(),
            message: `Captured from Chrome Extension: ${company}`,
            type: 'info',
          },
        ],
      };
      saveHistoryItem(histItem, jobItem);
    } catch {}

    const log: InboundWebhookLog = {
      id: `log_${Date.now()}`,
      receivedAt: now,
      source: 'chrome_extension',
      targetUrl: url,
      companyName: company,
      contactsFound: 1,
      status: 'processed',
      payloadSummary: `Quick Captured ${company} (${contactDraft.tech_stack.length} technologies detected)`,
    };
    saveInboundLog(log);

    res.json({
      success: true,
      message: `Quick Capture succeeded for ${company}!`,
      contact: contactDraft,
      technologies: techResult.technologies,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/inbound/logs
inboundRouter.get('/logs', (req, res) => {
  try {
    const logs = getInboundLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inbound/bookmarklet-code - Returns ready-to-drag browser bookmarklet
inboundRouter.get('/bookmarklet-code', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const bookmarklet = `javascript:(function(){
    var url = window.location.href;
    var title = document.title;
    var btn = document.createElement('div');
    btn.innerHTML = '⚡ Sending to LeadHook...';
    btn.style.cssText = 'position:fixed;top:20px;right:20px;background:#155eef;color:#fff;padding:12px 20px;border-radius:10px;font-family:sans-serif;font-size:14px;font-weight:bold;z-index:999999;box-shadow:0 4px 15px rgba(0,0,0,0.3);';
    document.body.appendChild(btn);
    fetch('${protocol}://${host}/api/inbound/quick-capture', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ url: url, title: title })
    }).then(function(r){ return r.json(); })
    .then(function(data){
      btn.style.background = '#10b981';
      btn.innerHTML = '✓ Added to LeadHook (' + (data.technologies ? data.technologies.length : 0) + ' techs detected)';
      setTimeout(function(){ btn.remove(); }, 3500);
    }).catch(function(e){
      btn.style.background = '#ef4444';
      btn.innerHTML = '❌ Capture failed: ' + e.message;
      setTimeout(function(){ btn.remove(); }, 4000);
    });
  })();`;

  res.json({
    bookmarklet: bookmarklet.replace(/\s+/g, ' ').trim(),
  });
});
