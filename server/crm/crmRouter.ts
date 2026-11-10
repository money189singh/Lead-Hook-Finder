import { Router } from 'express';
import { globalCrmService } from './crmService';
import { globalSocialDemandRadarEngine } from '../socialRadar/socialRadarEngine';
import { crawlerEngine } from '../crawler';
import { getHistory, getJobById } from '../storage';

export const crmRouter = Router();

// GET /api/crm/config
crmRouter.get('/config', (req, res) => {
  try {
    const masked = globalCrmService.getMaskedConfig();
    res.json(masked);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/config
crmRouter.post('/config', (req, res) => {
  try {
    const updated = globalCrmService.saveConfig(req.body);
    res.json({
      success: true,
      message: 'CRM integration configuration saved successfully!',
      config: globalCrmService.getMaskedConfig(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/api-keys/generate
crmRouter.post('/api-keys/generate', (req, res) => {
  try {
    const name = String(req.body?.name || 'External CRM Integration').trim();
    const newKey = globalCrmService.generateApiKey(name);
    res.json({
      success: true,
      api_key: newKey,
      config: globalCrmService.getMaskedConfig(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/api-keys/revoke
crmRouter.post('/api-keys/revoke', (req, res) => {
  try {
    const id = String(req.body?.id || req.body?.key || '').trim();
    const removed = globalCrmService.revokeApiKey(id);
    res.json({
      success: removed,
      config: globalCrmService.getMaskedConfig(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/crm/external/leads - External CRM Pull Endpoint authenticated with LeadHook API Key
crmRouter.get('/external/leads', (req, res) => {
  try {
    const token =
      String(req.headers['x-api-key'] || req.headers['authorization'] || req.query.api_key || '').trim();
    const configuredKeys = globalCrmService.getConfig().leadhook_api_keys || [];
    if (configuredKeys.length > 0 && !globalCrmService.validateApiKey(token)) {
      return res.status(401).json({
        error: 'Unauthorized. Provide a valid LeadHook API key via X-API-Key header or ?api_key=lh_live_...',
      });
    }

    const activeJob = crawlerEngine.getCurrentJob();
    let contacts = activeJob?.contacts || [];
    if (contacts.length === 0) {
      const history = getHistory();
      if (history.length > 0) {
        const latestJob = getJobById(history[0].id);
        contacts = latestJob?.contacts || [];
      }
    }

    res.json({
      success: true,
      total: contacts.length,
      timestamp: new Date().toISOString(),
      leads: contacts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/test
crmRouter.post('/test', async (req, res) => {
  try {
    const override = req.body && Object.keys(req.body).length > 0 ? req.body : undefined;
    const result = await globalCrmService.testConnection(override);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/crm/send-lead
crmRouter.post('/send-lead', async (req, res) => {
  try {
    const { leadId, lead, provider } = req.body;

    let targetLead = lead;
    if (!targetLead && leadId) {
      const allLeads = globalSocialDemandRadarEngine.getLeads();
      targetLead = allLeads.find((l) => l.id === leadId);
    }

    if (!targetLead) {
      return res.status(400).json({ error: 'Lead data or valid leadId is required.' });
    }

    const result = await globalCrmService.sendLead(targetLead, provider);

    if (targetLead.id) {
      globalSocialDemandRadarEngine.updateLeadCrmSyncStatus(targetLead.id, {
        synced: result.success,
        provider: provider || globalCrmService.getConfig().active_provider,
        syncedAt: new Date().toISOString(),
        externalId: result.externalId,
        error: result.success ? undefined : result.message,
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/crm/send-bulk
crmRouter.post('/send-bulk', async (req, res) => {
  try {
    const { leadIds, leads, contacts, provider } = req.body || {};

    // If contacts array provided directly, or if syncing active scraper job contacts
    if (Array.isArray(contacts) && contacts.length > 0) {
      const bulkResult = await globalCrmService.syncContacts(contacts, 'LeadHook Results', provider);
      return res.json(bulkResult);
    }

    if (Array.isArray(leads) && leads.length > 0) {
      const bulkResult = await globalCrmService.bulkSendLeads(leads, provider);
      return res.json(bulkResult);
    }

    // Check active scraper job contacts first
    const activeJob = crawlerEngine.getCurrentJob();
    if (activeJob && Array.isArray(activeJob.contacts) && activeJob.contacts.length > 0 && !leadIds) {
      const bulkResult = await globalCrmService.syncContacts(
        activeJob.contacts,
        'LeadHook Website Scraper',
        provider
      );
      return res.json(bulkResult);
    }

    let leadsToSync = globalSocialDemandRadarEngine.getLeads();
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      leadsToSync = leadsToSync.filter((l) => leadIds.includes(l.id));
    }

    if (leadsToSync.length === 0) {
      return res.status(400).json({ error: 'No leads available to sync to CRM.' });
    }

    const bulkResult = await globalCrmService.bulkSendLeads(leadsToSync, provider);

    for (const item of bulkResult.results) {
      try {
        globalSocialDemandRadarEngine.updateLeadCrmSyncStatus(item.leadId, {
          synced: item.success,
          provider: provider || globalCrmService.getConfig().active_provider,
          syncedAt: new Date().toISOString(),
          externalId: item.externalId,
          error: item.success ? undefined : item.message,
        });
      } catch {}
    }

    res.json(bulkResult);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/crm/logs
crmRouter.get('/logs', (req, res) => {
  try {
    const logs = globalCrmService.getLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
