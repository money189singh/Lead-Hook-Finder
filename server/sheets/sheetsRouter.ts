import { Router } from 'express';
import { globalGoogleSheetsEngine, DEFAULT_COLUMN_MAPPING } from './sheetsEngine';
import { globalSchedulerEngine } from '../scheduler/schedulerEngine';

export const sheetsRouter = Router();

// GET /api/sheets/status - Check connection status
sheetsRouter.get('/status', (req, res) => {
  try {
    const email = req.query.email as string | undefined;
    const status = globalGoogleSheetsEngine.getConnectionStatus(email);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sheets/connect - Save Google OAuth tokens from frontend
sheetsRouter.post('/connect', (req, res) => {
  try {
    const { email, accessToken, refreshToken, expiresIn, name } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    const store = globalGoogleSheetsEngine.saveUserTokens(
      email || 'Google User',
      accessToken,
      refreshToken,
      expiresIn || 3600,
      name
    );

    res.json({ success: true, store: { email: store.email, connectedAt: store.connectedAt } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sheets/disconnect - Disconnect Google Account
sheetsRouter.post('/disconnect', (req, res) => {
  try {
    const email = req.body?.email as string | undefined;
    const result = globalGoogleSheetsEngine.disconnect(email);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sheets/spreadsheets - List user spreadsheets
sheetsRouter.get('/spreadsheets', async (req, res) => {
  try {
    const email = req.query.email as string | undefined;
    const list = await globalGoogleSheetsEngine.listSpreadsheets(email);
    res.json({ spreadsheets: list });
  } catch (err: any) {
    res.status(err.message.includes('not connected') ? 401 : 500).json({ error: err.message });
  }
});

// GET /api/sheets/spreadsheet/:id - Get sheets in spreadsheet
sheetsRouter.get('/spreadsheet/:id', async (req, res) => {
  try {
    const email = req.query.email as string | undefined;
    const details = await globalGoogleSheetsEngine.getSpreadsheetDetails(req.params.id, email);
    res.json(details);
  } catch (err: any) {
    res.status(err.message.includes('not connected') ? 401 : 500).json({ error: err.message });
  }
});

// POST /api/sheets/create-spreadsheet - Create new Google Sheet
sheetsRouter.post('/create-spreadsheet', async (req, res) => {
  try {
    const { title, sheetTitle, email } = req.body;
    const result = await globalGoogleSheetsEngine.createSpreadsheet(
      title || 'LeadHook Scraped Leads',
      sheetTitle || 'Leads',
      email
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sheets/create-worksheet - Create new worksheet tab
sheetsRouter.post('/create-worksheet', async (req, res) => {
  try {
    const { spreadsheetId, sheetTitle, email } = req.body;
    if (!spreadsheetId || !sheetTitle) {
      return res.status(400).json({ error: 'spreadsheetId and sheetTitle are required' });
    }
    const result = await globalGoogleSheetsEngine.createWorksheet(spreadsheetId, sheetTitle, email);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sheets/default-mapping - Get default column mapping
sheetsRouter.get('/default-mapping', (req, res) => {
  res.json({ mapping: DEFAULT_COLUMN_MAPPING });
});

// POST /api/sheets/sync-schedule/:scheduleId - Trigger on-demand sync of all leads to Google Sheets
sheetsRouter.post('/sync-schedule/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { accessToken } = req.body || {};
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const tokenToUse = accessToken || bearerToken;

    const syncStats = await globalSchedulerEngine.syncScheduleToGoogleSheets(scheduleId, tokenToUse);
    res.json({ success: syncStats.status === 'Completed', stats: syncStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

