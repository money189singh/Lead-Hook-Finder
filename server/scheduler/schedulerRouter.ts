import { Router } from 'express';
import { globalSchedulerEngine } from './schedulerEngine';
import { globalDiscoveryLedger } from '../discovery/ledger';
import { globalCronjobOrgService } from './cronjobOrgService';

export const schedulerRouter = Router();

// List all schedules
schedulerRouter.get('/', (req, res) => {
  try {
    const schedules = globalSchedulerEngine.getAllSchedules();
    const runs = globalSchedulerEngine.getAllRuns();
    res.json({ schedules, runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new recurring schedule
schedulerRouter.post('/', (req, res) => {
  try {
    const {
      name,
      cadence,
      timeOfDayUtc,
      customHours,
      targetCount,
      criteria,
      enabled,
      autoEnrichWebsite,
      startImmediately,
      googleSheetsEnabled,
      googleSpreadsheetId,
      googleSpreadsheetName,
      googleSheetId,
      googleSheetName,
      googleSheetsMapping,
      connectedUserEmail,
    } = req.body;
    if (!name || !criteria) {
      return res.status(400).json({ error: 'Schedule name and criteria are required.' });
    }

    const schedule = globalSchedulerEngine.createSchedule({
      name,
      cadence: cadence || 'daily',
      timeOfDayUtc: timeOfDayUtc || '08:00',
      customHours,
      targetCount: targetCount || 20,
      criteria,
      enabled: enabled !== undefined ? enabled : true,
      autoEnrichWebsite: autoEnrichWebsite ?? true,
      startImmediately: Boolean(startImmediately),
      googleSheetsEnabled: Boolean(googleSheetsEnabled),
      googleSpreadsheetId,
      googleSpreadsheetName,
      googleSheetId,
      googleSheetName,
      googleSheetsMapping,
      connectedUserEmail,
    });

    res.status(201).json({ schedule });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update schedule
schedulerRouter.put('/:id', (req, res) => {
  try {
    const updated = globalSchedulerEngine.updateSchedule(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }
    res.json({ schedule: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete schedule
schedulerRouter.delete('/:id', (req, res) => {
  try {
    const ok = globalSchedulerEngine.deleteSchedule(req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle schedule enable/disable
schedulerRouter.post('/:id/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const updated = globalSchedulerEngine.toggleSchedule(req.params.id, enabled);
    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }
    res.json({ schedule: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run schedule immediately (test trigger)
schedulerRouter.post('/:id/run-now', async (req, res) => {
  try {
    const waitForCompletion = req.body?.waitForCompletion !== false;
    const schedule = globalSchedulerEngine.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    let runLog;
    if (waitForCompletion) {
      runLog = await globalSchedulerEngine.executeScheduleAndWait(schedule);
    } else {
      runLog = await globalSchedulerEngine.triggerScheduleNow(req.params.id);
    }

    res.json({ success: true, runLog, schedule: globalSchedulerEngine.getSchedule(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Autonomous 24/7 Cloud Webhook Cron Tick (GET & POST)
// Pinned by external free cron services (e.g. cron-job.org, EasyCron, Cloud Scheduler, GitHub Actions)
// Wakes up serverless Cloud Run instance and executes due recurring discovery pipelines
schedulerRouter.all('/cron-tick', async (req, res) => {
  try {
    const userAgent = req.get('user-agent') || 'external-cron';
    globalCronjobOrgService.recordPing(userAgent);

    const force = req.query.force === 'true' || req.body?.force === true;
    const scheduleId = (req.query.scheduleId as string) || req.body?.scheduleId;
    const result = await globalSchedulerEngine.handleCronTick({ force, scheduleId });
    res.json(result);
  } catch (err: any) {
    console.error('[Scheduler] Cron tick error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PUBLIC_FALLBACK_HOST = 'ais-dev-puycp3nkzzx4cfa5xngg32-574176551840.asia-southeast1.run.app';

export function getPublicWebhookUrl(req?: any): string {
  if (!req) return `https://${PUBLIC_FALLBACK_HOST}/api/scheduler/cron-tick`;
  const host = req.get('host') || '';
  const forwardedHost = req.get('x-forwarded-host') || '';

  // If running in development container where host is localhost, resolve to external public domain
  if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
    if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
      const proto = req.get('x-forwarded-proto') || 'https';
      return `${proto}://${forwardedHost}/api/scheduler/cron-tick`;
    }
    return `https://${PUBLIC_FALLBACK_HOST}/api/scheduler/cron-tick`;
  }

  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'https');
  return `${proto}://${host}/api/scheduler/cron-tick`;
}

// cron-job.org 1-Click Integration Endpoints
schedulerRouter.get('/cronjob-org', (req, res) => {
  try {
    const webhookUrl = getPublicWebhookUrl(req);
    const status = globalCronjobOrgService.getStatus(webhookUrl);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

schedulerRouter.post('/cronjob-org/connect', async (req, res) => {
  try {
    const { apiKey, cadenceMinutes, title } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a valid cron-job.org API Key.' });
    }

    const webhookUrl = getPublicWebhookUrl(req);

    const result = await globalCronjobOrgService.connectWithApiKey({
      apiKey,
      webhookUrl,
      cadenceMinutes: Number(cadenceMinutes) || 60,
      title: title || 'LeadHook 24/7 Autopilot Scraper',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to connect to cron-job.org' });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

schedulerRouter.post('/cronjob-org/disconnect', async (req, res) => {
  try {
    const result = await globalCronjobOrgService.disconnect();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

schedulerRouter.post('/cronjob-org/test-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required.' });
    }
    const val = await globalCronjobOrgService.validateApiKey(apiKey);
    res.json(val);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cloud Webhook Configuration & Status
schedulerRouter.get('/cloud-webhook-info', (req, res) => {
  try {
    const webhookUrl = getPublicWebhookUrl(req);
    const schedules = globalSchedulerEngine.getAllSchedules();
    const enabledSchedules = schedules.filter((s) => s.enabled);
    const nextDue = enabledSchedules.map((s) => s.nextRunAt).sort()[0] || null;

    res.json({
      webhookUrl,
      serverTimeUtc: new Date().toISOString(),
      activeSchedulesCount: enabledSchedules.length,
      nextScheduledRunAt: nextDue,
      cronCadenceRecommendation: 'Every 1 Hour (0 * * * *)',
      status: 'active',
      endpoints: {
        cronTick: webhookUrl,
        testTrigger: `${webhookUrl}?force=true`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get runs for a schedule or all runs
schedulerRouter.get('/runs', (req, res) => {
  try {
    const scheduleId = req.query.scheduleId as string | undefined;
    const runs = globalSchedulerEngine.getAllRuns(scheduleId);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Historical seen ledger endpoints
schedulerRouter.get('/ledger/stats', (req, res) => {
  try {
    const stats = globalDiscoveryLedger.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

schedulerRouter.post('/ledger/clear', (req, res) => {
  try {
    globalDiscoveryLedger.clear();
    res.json({ success: true, message: 'Discovery historical ledger reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
