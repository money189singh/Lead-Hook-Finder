import fs from 'fs';
import path from 'path';
import {
  DiscoveredProspect,
  GoogleSheetsColumnMapping,
  GoogleSheetsSyncStats,
  RecurringSchedule,
} from '../../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SHEETS_DIR = path.join(DATA_DIR, 'sheets');
const TOKENS_FILE = path.join(SHEETS_DIR, 'google_tokens.json');
const ROW_MAPPINGS_FILE = path.join(SHEETS_DIR, 'row_mappings.json');

export interface GoogleAuthTokenStore {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // unix ms
  email?: string;
  name?: string;
  connectedAt: string;
}

export interface SheetRowRecord {
  scheduleId: string;
  spreadsheetId: string;
  sheetName: string;
  rowNumber: number;
  domain: string;
  companyName: string;
  lastSyncedAt: string;
}

export const DEFAULT_COLUMN_MAPPING: GoogleSheetsColumnMapping = {
  companyNameColumn: 'Company',
  websiteColumn: 'Website',
  locationColumn: 'Location',
  countryColumn: 'Country',
  stateColumn: 'State',
  cityColumn: 'City',
  employeesColumn: 'Employees',
  foundedColumn: 'Founded',
  industryColumn: 'Industry',
  revenueColumn: 'Revenue',
  genericEmailColumn: 'Generic Email',
  namedContactColumn: 'Named Contact',
  decisionMakerColumn: 'Decision Maker',
  decisionMakerTitleColumn: 'Decision Maker Title',
  decisionMakerEmailColumn: 'Decision Maker Email',
  phoneColumn: 'Phone',
  sourceUrlColumn: 'Source URL',
  verificationStatusColumn: 'Verification Status',
  lastScrapedColumn: 'Last Scraped',
};

export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export class GoogleSheetsEngine {
  private tokens: Map<string, GoogleAuthTokenStore> = new Map();
  // key: `${spreadsheetId}:${sheetName}:${domain}` -> SheetRowRecord
  private rowMappings: Map<string, SheetRowRecord> = new Map();

  constructor() {
    this.ensureDirs();
    this.loadState();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(SHEETS_DIR)) fs.mkdirSync(SHEETS_DIR, { recursive: true });
    } catch (e: any) {
      console.warn('[GoogleSheetsEngine] Error ensuring dirs:', e.message);
    }
  }

  private loadState() {
    try {
      this.ensureDirs();
      if (fs.existsSync(TOKENS_FILE)) {
        const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
        const list: { key: string; token: GoogleAuthTokenStore }[] = JSON.parse(raw);
        for (const item of list) {
          this.tokens.set(item.key, item.token);
        }
      }

      if (fs.existsSync(ROW_MAPPINGS_FILE)) {
        const raw = fs.readFileSync(ROW_MAPPINGS_FILE, 'utf-8');
        const list: { key: string; record: SheetRowRecord }[] = JSON.parse(raw);
        for (const item of list) {
          this.rowMappings.set(item.key, item.record);
        }
      }
    } catch (e: any) {
      console.warn('[GoogleSheetsEngine] Error loading state:', e.message);
    }
  }

  private saveTokens() {
    try {
      this.ensureDirs();
      const list = Array.from(this.tokens.entries()).map(([key, token]) => ({ key, token }));
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn('[GoogleSheetsEngine] Error saving tokens:', e.message);
    }
  }

  private saveRowMappings() {
    try {
      this.ensureDirs();
      const list = Array.from(this.rowMappings.entries()).map(([key, record]) => ({ key, record }));
      fs.writeFileSync(ROW_MAPPINGS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn('[GoogleSheetsEngine] Error saving row mappings:', e.message);
    }
  }

  /**
   * Save or update Google OAuth tokens for background cloud worker execution
   */
  public saveUserTokens(email: string, accessToken: string, refreshToken?: string, expiresInSeconds: number = 3600, name?: string) {
    const key = email.toLowerCase().trim() || 'default';
    const existing = this.tokens.get(key) || this.tokens.get('default');
    const store: GoogleAuthTokenStore = {
      accessToken,
      refreshToken: refreshToken || existing?.refreshToken,
      expiresAt: Date.now() + (expiresInSeconds - 60) * 1000,
      email: email || existing?.email || 'User Account',
      name: name || existing?.name,
      connectedAt: existing?.connectedAt || new Date().toISOString(),
    };
    this.tokens.set(key, store);
    this.tokens.set('default', store); // default fallback for offline scheduler
    this.saveTokens();
    return store;
  }

  /**
   * Get active token (with refresh if needed)
   */
  public async getValidAccessToken(email?: string): Promise<string | null> {
    const key = email ? email.toLowerCase().trim() : 'default';
    let store = this.tokens.get(key) || this.tokens.get('default');
    if (!store) {
      // Check if any token exists
      const first = Array.from(this.tokens.values())[0];
      if (first) store = first;
    }

    if (!store) return null;

    // Check expiry
    if (Date.now() < store.expiresAt) {
      return store.accessToken;
    }

    // Refresh if refreshToken available
    if (store.refreshToken) {
      try {
        const refreshed = await this.refreshAccessToken(store.refreshToken);
        if (refreshed?.accessToken) {
          store.accessToken = refreshed.accessToken;
          store.expiresAt = Date.now() + ((refreshed.expiresIn || 3600) - 60) * 1000;
          this.saveTokens();
          return store.accessToken;
        }
      } catch (err: any) {
        console.warn('[GoogleSheetsEngine] Refresh token failed:', err.message);
      }
    }

    return store.accessToken; // Attempt with existing token if refresh not possible
  }

  private async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          accessToken: data.access_token,
          expiresIn: data.expires_in || 3600,
        };
      }
    } catch {}
    return null;
  }

  public getConnectionStatus(email?: string) {
    const key = email ? email.toLowerCase().trim() : 'default';
    const store = this.tokens.get(key) || this.tokens.get('default') || Array.from(this.tokens.values())[0];
    if (!store || !store.accessToken) {
      return { connected: false };
    }
    return {
      connected: true,
      email: store.email,
      name: store.name,
      connectedAt: store.connectedAt,
      isExpired: Date.now() >= store.expiresAt,
    };
  }

  public disconnect(email?: string) {
    if (email) {
      this.tokens.delete(email.toLowerCase().trim());
    } else {
      this.tokens.clear();
    }
    this.saveTokens();
    return { success: true };
  }

  /**
   * List spreadsheets accessible to the connected Google account
   */
  public async listSpreadsheets(email?: string): Promise<{ id: string; name: string; modifiedTime?: string }[]> {
    const token = await this.getValidAccessToken(email);
    if (!token) {
      throw new Error('Google Sheets is not connected. Please authenticate with Google first.');
    }

    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=50`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Drive API error (${res.status})`);
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      modifiedTime: f.modifiedTime,
    }));
  }

  /**
   * Get worksheets (sheets) in a spreadsheet
   */
  public async getSpreadsheetDetails(spreadsheetId: string, email?: string): Promise<{
    id: string;
    title: string;
    sheets: { sheetId: number; title: string; index: number; rowCount?: number; columnCount?: number }[];
  }> {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    const token = await this.getValidAccessToken(email);
    if (!token) {
      throw new Error('Google Sheets is not connected. Please authenticate with Google first.');
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=spreadsheetId,properties.title,sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Sheets API error (${res.status})`);
    }

    const data = await res.json();
    const sheets = (data.sheets || []).map((s: any) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      index: s.properties.index,
      rowCount: s.properties.gridProperties?.rowCount,
      columnCount: s.properties.gridProperties?.columnCount,
    }));

    return {
      id: data.spreadsheetId,
      title: data.properties?.title || 'Untitled Spreadsheet',
      sheets,
    };
  }

  /**
   * Create a new spreadsheet
   */
  public async createSpreadsheet(title: string, sheetTitle: string = 'Leads', email?: string): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    sheetId: number;
    title: string;
  }> {
    const token = await this.getValidAccessToken(email);
    if (!token) {
      throw new Error('Google Sheets is not connected. Please authenticate with Google first.');
    }

    const body = {
      properties: { title: title.trim() || 'LeadHook Scraped Leads' },
      sheets: [
        {
          properties: {
            title: sheetTitle.trim() || 'Leads',
            gridProperties: { rowCount: 1000, columnCount: 26 },
          },
        },
      ],
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create spreadsheet (${res.status})`);
    }

    const data = await res.json();
    const sheetId = data.sheets?.[0]?.properties?.sheetId || 0;
    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
      sheetId,
      title: data.properties?.title,
    };
  }

  /**
   * Create a new worksheet tab inside an existing spreadsheet
   */
  public async createWorksheet(spreadsheetId: string, sheetTitle: string, email?: string): Promise<{ sheetId: number; title: string }> {
    const token = await this.getValidAccessToken(email);
    if (!token) throw new Error('Google Sheets is not connected.');

    const body = {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetTitle.trim(),
              gridProperties: { rowCount: 1000, columnCount: 26 },
            },
          },
        },
      ],
    };

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create worksheet (${res.status})`);
    }

    const data = await res.json();
    const sheetProps = data.replies?.[0]?.addSheet?.properties;
    return {
      sheetId: sheetProps?.sheetId || 0,
      title: sheetProps?.title || sheetTitle,
    };
  }

  /**
   * Synchronize an array of discovered prospects to the schedule's assigned Google Sheet.
   *
   * Core Guarantees:
   * 1. Header Row Preservation: If empty, writes configured columns. If present, aligns values to existing headers.
   * 2. Idempotent Deduplication: Updates existing row by normalized domain/company matching; appends only new records.
   * 3. Non-Destructive Update: Existing high-value fields (e.g. valid phone/email) are never overwritten by empty data.
   * 4. Batch Efficiency: Uses Google Sheets API batchUpdate & append operations rather than single-cell calls.
   */
  public async syncScheduleProspectsToSheet(
    schedule: RecurringSchedule,
    prospects: DiscoveredProspect[]
  ): Promise<GoogleSheetsSyncStats> {
    const spreadsheetId = schedule.googleSpreadsheetId;
    const sheetName = schedule.googleSheetName || 'Leads';

    const stats: GoogleSheetsSyncStats = {
      status: 'Syncing',
      spreadsheetId,
      spreadsheetName: schedule.googleSpreadsheetName,
      sheetName,
      recordsAdded: 0,
      recordsUpdated: 0,
      totalSynced: 0,
      lastSyncedAt: new Date().toISOString(),
      spreadsheetUrl: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : undefined,
    };

    if (!schedule.googleSheetsEnabled || !spreadsheetId) {
      stats.status = 'Completed';
      return stats;
    }

    if (!prospects || prospects.length === 0) {
      stats.status = 'Completed';
      return stats;
    }

    const token = await this.getValidAccessToken(schedule.connectedUserEmail);
    if (!token) {
      stats.status = 'Authentication Required';
      stats.error = 'Google authorization required. Please reconnect your Google account in Schedule settings.';
      return stats;
    }

    try {
      // Step 1: Read existing content in the sheet (up to 30 columns)
      const range = `'${sheetName}'!A1:AD2000`;
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const readRes = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!readRes.ok) {
        if (readRes.status === 401 || readRes.status === 403) {
          stats.status = 'Authentication Required';
          stats.error = `Google authorization error (${readRes.status}). Reconnection required.`;
          return stats;
        }
        const err = await readRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to read Google Sheet (${readRes.status})`);
      }

      const readData = await readRes.json();
      const existingRows: string[][] = readData.values || [];

      // Step 2: Establish Header Mapping
      const mapping = { ...DEFAULT_COLUMN_MAPPING, ...(schedule.googleSheetsMapping || {}) };
      let headers: string[] = [];

      const configuredHeaders = [
        mapping.companyNameColumn || 'Company',
        mapping.websiteColumn || 'Website',
        mapping.decisionMakerColumn || 'Decision Maker',
        mapping.decisionMakerTitleColumn || 'Decision Maker Title',
        mapping.decisionMakerEmailColumn || 'Decision Maker Email',
        mapping.genericEmailColumn || 'Generic Email',
        mapping.phoneColumn || 'Phone',
        mapping.industryColumn || 'Industry',
        mapping.locationColumn || 'Location',
        mapping.countryColumn || 'Country',
        mapping.stateColumn || 'State',
        mapping.cityColumn || 'City',
        mapping.employeesColumn || 'Employees',
        mapping.foundedColumn || 'Founded',
        mapping.revenueColumn || 'Revenue',
        mapping.namedContactColumn || 'Named Contact',
        mapping.verificationStatusColumn || 'Verification Status',
        mapping.sourceUrlColumn || 'Source URL',
        mapping.lastScrapedColumn || 'Last Scraped',
      ];

      if (existingRows.length === 0 || existingRows[0].length === 0) {
        // Sheet is empty — write headers
        headers = configuredHeaders;
        await this.writeHeaderRow(spreadsheetId, sheetName, headers, token);
      } else {
        // Use existing headers
        headers = existingRows[0].map((h) => (h || '').trim());
      }

      // Step 3: Index existing rows by normalized domain & company name to prevent duplicates
      // domain -> { rowIndex (1-based), rowValues }
      const domainToRow = new Map<string, { rowIndex: number; row: string[] }>();
      const companyToRow = new Map<string, { rowIndex: number; row: string[] }>();

      const domainColIdx = headers.findIndex((h) => /website|domain|url/i.test(h));
      const companyColIdx = headers.findIndex((h) => /company|business|name/i.test(h));

      for (let r = 1; r < existingRows.length; r++) {
        const row = existingRows[r];
        const rowDomain = domainColIdx >= 0 && row[domainColIdx] ? this.normalizeDomain(row[domainColIdx]) : '';
        const rowComp = companyColIdx >= 0 && row[companyColIdx] ? row[companyColIdx].toLowerCase().trim() : '';

        if (rowDomain) {
          domainToRow.set(rowDomain, { rowIndex: r + 1, row });
        }
        if (rowComp) {
          companyToRow.set(rowComp, { rowIndex: r + 1, row });
        }
      }

      // Step 4: Separate into Updates vs New Rows
      const rowsToUpdate: { range: string; values: string[][] }[] = [];
      const rowsToAppend: string[][] = [];

      for (const prospect of prospects) {
        const normDomain = this.normalizeDomain(prospect.domain || prospect.website);
        const normComp = (prospect.companyName || '').toLowerCase().trim();

        const existingMatch = (normDomain && domainToRow.get(normDomain)) || (normComp && companyToRow.get(normComp));

        if (existingMatch) {
          // Merge non-empty fields with existing values (preserves high-confidence existing data)
          const mergedRow = this.mergeProspectRow(headers, existingMatch.row, prospect, mapping);
          const rowNum = existingMatch.rowIndex;
          const endColLetter = this.getColumnLetter(headers.length);
          rowsToUpdate.push({
            range: `'${sheetName}'!A${rowNum}:${endColLetter}${rowNum}`,
            values: [mergedRow],
          });
          stats.recordsUpdated++;

          // Record in row mappings
          this.rowMappings.set(`${spreadsheetId}:${sheetName}:${normDomain}`, {
            scheduleId: schedule.id,
            spreadsheetId,
            sheetName,
            rowNumber: rowNum,
            domain: normDomain,
            companyName: prospect.companyName,
            lastSyncedAt: new Date().toISOString(),
          });
        } else {
          // Brand new record -> build row according to headers
          const newRow = this.buildProspectRow(headers, prospect, mapping);
          rowsToAppend.push(newRow);
          stats.recordsAdded++;
        }
      }

      // Step 5: Execute Batch Updates (if any)
      if (rowsToUpdate.length > 0) {
        // Chunk batch updates to max 100 per request
        const chunks = this.chunkArray(rowsToUpdate, 100);
        for (const chunk of chunks) {
          const batchBody = {
            valueInputOption: 'USER_ENTERED',
            data: chunk,
          };
          const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batchBody),
          });
          if (!updateRes.ok) {
            console.warn('[GoogleSheetsEngine] Batch update warning:', await updateRes.text());
          }
        }
      }

      // Step 6: Execute Batch Append (if any new rows)
      if (rowsToAppend.length > 0) {
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const appendRes = await fetch(appendUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: rowsToAppend }),
        });

        if (!appendRes.ok) {
          const err = await appendRes.json().catch(() => ({}));
          console.warn('[GoogleSheetsEngine] Append warning:', err);
        } else {
          const appendData = await appendRes.json();
          // Save row mapping from updated range if available
          const updatedRange = appendData.updates?.updatedRange;
          if (updatedRange) {
            this.recordAppendedRowMappings(schedule.id, spreadsheetId, sheetName, updatedRange, rowsToAppend, headers);
          }
        }
      }

      this.saveRowMappings();
      stats.totalSynced = stats.recordsAdded + stats.recordsUpdated;
      stats.status = 'Completed';
      return stats;
    } catch (err: any) {
      console.error('[GoogleSheetsEngine] Sync error:', err);
      stats.status = 'Failed';
      stats.error = err.message || 'Unexpected sync failure';
      return stats;
    }
  }

  private async writeHeaderRow(spreadsheetId: string, sheetName: string, headers: string[], token: string) {
    const endCol = this.getColumnLetter(headers.length);
    const range = `'${sheetName}'!A1:${endCol}1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [headers] }),
    });

    // Format header row bold with subtle background
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: { startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true, fontSize: 10 },
                    backgroundColor: { red: 0.94, green: 0.96, blue: 1.0 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
          ],
        }),
      });
    } catch {}
  }

  private buildProspectRow(
    headers: string[],
    p: DiscoveredProspect,
    mapping: GoogleSheetsColumnMapping
  ): string[] {
    const row: string[] = [];
    const valuesMap = this.getProspectValuesMap(p, mapping);
    const cleanDom = this.normalizeDomain(p.domain || p.website) || '';
    const primaryEmail = p.email || p.decisionMakerEmail || p.genericEmail || '';

    for (const header of headers) {
      const hNorm = header.toLowerCase().trim();
      let matchedVal = '';

      for (const [colName, val] of Object.entries(valuesMap)) {
        if (hNorm === colName.toLowerCase().trim() || hNorm.includes(colName.toLowerCase().trim())) {
          matchedVal = val;
          break;
        }
      }

      // Fallback heuristics based on common column names (only real data)
      if (!matchedVal) {
        if (hNorm.includes('company') || hNorm.includes('business')) matchedVal = p.companyName || '';
        else if (hNorm.includes('web') || hNorm.includes('url')) matchedVal = p.website || (cleanDom ? `https://${cleanDom}` : '');
        else if (hNorm.includes('decision maker title') || hNorm.includes('dm title')) matchedVal = p.jobTitle || '';
        else if (hNorm.includes('decision maker email') || hNorm.includes('dm email')) matchedVal = p.decisionMakerEmail || (p.emailType?.toLowerCase().includes('personal') ? p.email || '' : '');
        else if (hNorm.includes('generic email')) matchedVal = p.genericEmail || (p.emailType?.toLowerCase().includes('generic') ? p.email || '' : '');
        else if (hNorm.includes('decision maker') || hNorm.includes('leader')) matchedVal = p.personName || '';
        else if (hNorm.includes('email')) matchedVal = primaryEmail;
        else if (hNorm.includes('phone')) matchedVal = p.phone || '';
        else if (hNorm.includes('industry')) matchedVal = p.industry || '';
        else if (hNorm.includes('location') || hNorm.includes('address')) matchedVal = p.location || [p.city, p.state, p.country].filter(Boolean).join(', ') || '';
        else if (hNorm.includes('employee')) matchedVal = p.employeeCount || '';
        else if (hNorm.includes('founded')) matchedVal = p.foundedYear || '';
        else if (hNorm.includes('verification') || hNorm.includes('status')) matchedVal = p.verificationStatus || 'Verified company';
      }

      row.push(matchedVal);
    }

    return row;
  }

  private mergeProspectRow(
    headers: string[],
    existingRow: string[],
    p: DiscoveredProspect,
    mapping: GoogleSheetsColumnMapping
  ): string[] {
    const newRow = this.buildProspectRow(headers, p, mapping);
    const merged: string[] = [];

    for (let i = 0; i < headers.length; i++) {
      const existingVal = (existingRow[i] || '').trim();
      const newVal = (newRow[i] || '').trim();

      // Rule: Do not overwrite good existing value with empty value
      if (newVal) {
        merged.push(newVal);
      } else {
        merged.push(existingVal);
      }
    }

    return merged;
  }

  private getProspectValuesMap(p: DiscoveredProspect, mapping: GoogleSheetsColumnMapping): Record<string, string> {
    const rawDom = p.domain || (p.website ? p.website.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '') : '');
    const cleanDom = this.normalizeDomain(rawDom) || rawDom || '';

    const isExplicitlyGeneric = p.emailType?.toLowerCase().includes('generic');
    const isExplicitlyPersonal = p.emailType?.toLowerCase().includes('personal') || p.emailType?.toLowerCase().includes('professional');

    const genericEmail = p.genericEmail || (isExplicitlyGeneric ? p.email || '' : '');
    const decisionMakerEmail = p.decisionMakerEmail || (isExplicitlyPersonal ? p.email || '' : '');
    const primaryEmail = p.email || decisionMakerEmail || genericEmail || '';

    return {
      [mapping.companyNameColumn || 'Company']: p.companyName || '',
      [mapping.websiteColumn || 'Website']: p.website || (cleanDom ? `https://${cleanDom}` : ''),
      [mapping.locationColumn || 'Location']: p.location || [p.city, p.state, p.country].filter(Boolean).join(', ') || '',
      [mapping.countryColumn || 'Country']: p.country || '',
      [mapping.stateColumn || 'State']: p.state || '',
      [mapping.cityColumn || 'City']: p.city || '',
      [mapping.employeesColumn || 'Employees']: p.employeeCount || '',
      [mapping.foundedColumn || 'Founded']: p.foundedYear || '',
      [mapping.industryColumn || 'Industry']: p.industry || '',
      [mapping.revenueColumn || 'Revenue']: p.revenue || '',
      [mapping.genericEmailColumn || 'Generic Email']: genericEmail,
      [mapping.namedContactColumn || 'Named Contact']: p.personName || '',
      [mapping.decisionMakerColumn || 'Decision Maker']: p.personName || '',
      [mapping.decisionMakerTitleColumn || 'Decision Maker Title']: p.jobTitle || '',
      [mapping.decisionMakerEmailColumn || 'Decision Maker Email']: decisionMakerEmail,
      [mapping.phoneColumn || 'Phone']: p.phone || '',
      [mapping.sourceUrlColumn || 'Source URL']: p.sourceUrl || (p.sourceUrls && p.sourceUrls[0]) || '',
      [mapping.verificationStatusColumn || 'Verification Status']: p.verificationStatus || 'Verified company',
      [mapping.lastScrapedColumn || 'Last Scraped']: new Date().toISOString().split('T')[0],
    };
  }

  private recordAppendedRowMappings(
    scheduleId: string,
    spreadsheetId: string,
    sheetName: string,
    updatedRange: string,
    rows: string[][],
    headers: string[]
  ) {
    try {
      const match = updatedRange.match(/!A(\d+):/);
      if (match) {
        const startRow = parseInt(match[1], 10);
        const domainIdx = headers.findIndex((h) => /website|domain|url/i.test(h));
        const compIdx = headers.findIndex((h) => /company|business|name/i.test(h));

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = startRow + i;
          const domain = domainIdx >= 0 ? this.normalizeDomain(row[domainIdx]) : '';
          const comp = compIdx >= 0 ? row[compIdx] : '';

          if (domain) {
            this.rowMappings.set(`${spreadsheetId}:${sheetName}:${domain}`, {
              scheduleId,
              spreadsheetId,
              sheetName,
              rowNumber: rowNum,
              domain,
              companyName: comp,
              lastSyncedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch {}
  }

  private normalizeDomain(input?: string): string {
    if (!input) return '';
    let clean = input.trim().toLowerCase();
    clean = clean.replace(/^https?:\/\//i, '');
    clean = clean.replace(/:\d+$/, '');
    clean = clean.split('/')[0].split('?')[0].split('#')[0];
    clean = clean.replace(/^www\./i, '');
    return clean.replace(/\.+$/, '');
  }

  private getColumnLetter(colIndex: number): string {
    let temp = '';
    let letter = '';
    while (colIndex > 0) {
      temp = ((colIndex - 1) % 26) + temp;
      letter = String.fromCharCode(65 + ((colIndex - 1) % 26)) + letter;
      colIndex = Math.floor((colIndex - 1) / 26);
    }
    return letter || 'A';
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  }
}

export const globalGoogleSheetsEngine = new GoogleSheetsEngine();
