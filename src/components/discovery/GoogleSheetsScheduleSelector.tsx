import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Table,
  Columns,
  Layers,
  ArrowRight,
  Sparkles,
  Link2,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import appletConfig from '../../../firebase-applet-config.json';
import { GoogleSheetsColumnMapping } from '../../types';

interface GoogleSheetsScheduleSelectorProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  spreadsheetId?: string;
  spreadsheetName?: string;
  sheetId?: number;
  sheetName?: string;
  columnMapping?: Partial<GoogleSheetsColumnMapping>;
  onSelectDestination: (data: {
    spreadsheetId: string;
    spreadsheetName: string;
    sheetId: number;
    sheetName: string;
    columnMapping?: Partial<GoogleSheetsColumnMapping>;
    connectedUserEmail?: string;
  }) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const GoogleSheetsScheduleSelector: React.FC<GoogleSheetsScheduleSelectorProps> = ({
  enabled,
  onToggleEnabled,
  spreadsheetId,
  spreadsheetName,
  sheetId,
  sheetName,
  columnMapping,
  onSelectDestination,
  onShowToast,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Selection mode: 'browse' (from drive), 'manual' (paste link/ID)
  const [selectionMode, setSelectionMode] = useState<'browse' | 'manual'>('browse');
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [isValidatingManual, setIsValidatingManual] = useState(false);

  // Spreadsheets list & Worksheets
  const [spreadsheets, setSpreadsheets] = useState<{ id: string; name: string }[]>([]);
  const [worksheets, setWorksheets] = useState<{ sheetId: number; title: string }[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isLoadingWorksheets, setIsLoadingWorksheets] = useState(false);

  // Creation modals / inline states
  const [showCreateSpreadsheet, setShowCreateSpreadsheet] = useState(false);
  const [newSpreadsheetTitle, setNewSpreadsheetTitle] = useState('LeadHook Scraped Leads');
  const [newWorksheetTitle, setNewWorksheetTitle] = useState('Leads');
  const [isCreatingSpreadsheet, setIsCreatingSpreadsheet] = useState(false);

  const [showCreateWorksheet, setShowCreateWorksheet] = useState(false);
  const [newTabTitle, setNewTabTitle] = useState('');
  const [isCreatingTab, setIsCreatingTab] = useState(false);

  // Column Mapping Drawer
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [mapping, setMapping] = useState<GoogleSheetsColumnMapping>({
    companyNameColumn: columnMapping?.companyNameColumn || 'Company',
    websiteColumn: columnMapping?.websiteColumn || 'Website',
    locationColumn: columnMapping?.locationColumn || 'Location',
    countryColumn: columnMapping?.countryColumn || 'Country',
    stateColumn: columnMapping?.stateColumn || 'State',
    cityColumn: columnMapping?.cityColumn || 'City',
    employeesColumn: columnMapping?.employeesColumn || 'Employees',
    foundedColumn: columnMapping?.foundedColumn || 'Founded',
    industryColumn: columnMapping?.industryColumn || 'Industry',
    revenueColumn: columnMapping?.revenueColumn || 'Revenue',
    genericEmailColumn: columnMapping?.genericEmailColumn || 'Generic Email',
    namedContactColumn: columnMapping?.namedContactColumn || 'Named Contact',
    decisionMakerColumn: columnMapping?.decisionMakerColumn || 'Decision Maker',
    decisionMakerTitleColumn: columnMapping?.decisionMakerTitleColumn || 'Decision Maker Title',
    decisionMakerEmailColumn: columnMapping?.decisionMakerEmailColumn || 'Decision Maker Email',
    phoneColumn: columnMapping?.phoneColumn || 'Phone',
    sourceUrlColumn: columnMapping?.sourceUrlColumn || 'Source URL',
    verificationStatusColumn: columnMapping?.verificationStatusColumn || 'Verification Status',
    lastScrapedColumn: columnMapping?.lastScrapedColumn || 'Last Scraped',
  });

  // Check connection status on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/sheets/status');
      if (res.ok) {
        const data = await res.json();
        const active = data.connected && !data.isExpired;
        setIsConnected(active);
        if (data.email) {
          setConnectedEmail(data.email);
        }
        if (active) {
          loadSpreadsheets(data.email);
        } else if (data.connected && data.isExpired) {
          setApiError('Your Google authorization session has expired. Click "Reconnect Google Account" below to restore live sync.');
        }
      }
    } catch (e) {
      console.warn('Failed to check Google Sheets connection:', e);
    }
  };

  const handleConnectGoogle = async () => {
    setIsAuthenticating(true);
    setApiError(null);
    const clientId = (appletConfig as any)?.oAuthClientId;

    // 1. Prefer Google Identity Services (GIS) token client with official provisioned OAuth Client ID
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && clientId) {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
          prompt: 'consent',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.error('GIS Error:', tokenResponse);
              onShowToast(tokenResponse.error_description || tokenResponse.error || 'Google authorization cancelled', 'error');
              setIsAuthenticating(false);
              return;
            }

            const accessToken = tokenResponse.access_token;
            let userEmail = connectedEmail || 'moneysinghgtme@gmail.com';
            let userName = 'Google User';

            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (userInfoRes.ok) {
                const u = await userInfoRes.json();
                userEmail = u.email || userEmail;
                userName = u.name || userName;
              }
            } catch (err) {
              console.warn('Could not fetch userinfo:', err);
            }

            // Save token on backend so the background worker can use it even when offline
            const connectRes = await fetch('/api/sheets/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                name: userName,
                accessToken,
                expiresIn: tokenResponse.expires_in || 3600,
              }),
            });

            if (!connectRes.ok) {
              throw new Error('Failed to register Google authorization with worker.');
            }

            setIsConnected(true);
            setConnectedEmail(userEmail);
            setApiError(null);
            onShowToast(`Google account authorized: ${userEmail}`, 'success');
            await loadSpreadsheets(userEmail);
            setIsAuthenticating(false);
          },
        });
        tokenClient.requestAccessToken();
        return;
      } catch (gisErr: any) {
        console.warn('GIS init error, falling back to Firebase popup:', gisErr);
      }
    }

    // 2. Fallback to Firebase popup
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) {
        throw new Error('Could not obtain Google OAuth access token. Please grant permissions.');
      }

      const connectRes = await fetch('/api/sheets/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: result.user.email,
          name: result.user.displayName,
          accessToken,
          expiresIn: 3600,
        }),
      });

      if (!connectRes.ok) {
        throw new Error('Failed to register Google authorization with worker.');
      }

      setIsConnected(true);
      setConnectedEmail(result.user.email || 'Connected Account');
      setApiError(null);
      onShowToast(`Google account connected: ${result.user.email}`, 'success');
      await loadSpreadsheets(result.user.email || undefined);
    } catch (err: any) {
      console.error('Google Auth error:', err);
      onShowToast(err.message || 'Google authentication was cancelled or failed.', 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loadSpreadsheets = async (email?: string) => {
    setIsLoadingSheets(true);
    setApiError(null);
    try {
      const query = email ? `?email=${encodeURIComponent(email)}` : '';
      const res = await fetch(`/api/sheets/spreadsheets${query}`);
      if (res.ok) {
        const data = await res.json();
        setSpreadsheets(data.spreadsheets || []);
        // If current spreadsheetId exists, load its worksheets
        if (spreadsheetId) {
          loadWorksheets(spreadsheetId, email);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || 'Failed to list spreadsheets';
        setApiError(msg);
      }
    } catch (e: any) {
      console.warn('Error loading spreadsheets:', e.message);
      setApiError(e.message);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const loadWorksheets = async (sheetFileId: string, email?: string) => {
    setIsLoadingWorksheets(true);
    try {
      const query = email ? `?email=${encodeURIComponent(email)}` : '';
      const res = await fetch(`/api/sheets/spreadsheet/${encodeURIComponent(sheetFileId)}${query}`);
      if (res.ok) {
        const data = await res.json();
        const sheets = (data.sheets || []).map((s: any) => ({
          sheetId: s.sheetId,
          title: s.title,
        }));
        setWorksheets(sheets);

        // Auto select first worksheet if not yet selected
        if (!sheetName && sheets.length > 0) {
          const selectedSheet = spreadsheets.find((s) => s.id === sheetFileId);
          onSelectDestination({
            spreadsheetId: sheetFileId,
            spreadsheetName: selectedSheet?.name || spreadsheetName || data.title || 'Spreadsheet',
            sheetId: sheets[0].sheetId,
            sheetName: sheets[0].title,
            columnMapping: mapping,
            connectedUserEmail: email || connectedEmail,
          });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setApiError(errData.error || 'Failed to load worksheet tabs');
      }
    } catch (e: any) {
      console.warn('Error loading worksheets:', e.message);
      setApiError(e.message);
    } finally {
      setIsLoadingWorksheets(false);
    }
  };

  const handleSpreadsheetSelect = (selectedId: string) => {
    const selected = spreadsheets.find((s) => s.id === selectedId);
    if (!selected) return;

    loadWorksheets(selectedId, connectedEmail);

    onSelectDestination({
      spreadsheetId: selected.id,
      spreadsheetName: selected.name,
      sheetId: 0,
      sheetName: 'Leads',
      columnMapping: mapping,
      connectedUserEmail: connectedEmail,
    });
  };

  const handleWorksheetSelect = (selectedTitle: string) => {
    const ws = worksheets.find((w) => w.title === selectedTitle);
    onSelectDestination({
      spreadsheetId: spreadsheetId || '',
      spreadsheetName: spreadsheetName || 'Spreadsheet',
      sheetId: ws?.sheetId ?? 0,
      sheetName: selectedTitle,
      columnMapping: mapping,
      connectedUserEmail: connectedEmail,
    });
  };

  const handleConnectManualSpreadsheet = async () => {
    if (!manualSheetInput.trim()) return;
    setIsValidatingManual(true);
    setApiError(null);
    try {
      let cleanId = manualSheetInput.trim();
      const match = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanId = match[1];
      }

      const query = connectedEmail ? `?email=${encodeURIComponent(connectedEmail)}` : '';
      const res = await fetch(`/api/sheets/spreadsheet/${encodeURIComponent(cleanId)}${query}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not access spreadsheet. Please ensure it exists and your account has access.');
      }

      const details = await res.json();
      const sheetTitleFound = details.title || 'Connected Spreadsheet';
      const parsedSheets = (details.sheets || []).map((s: any) => ({
        sheetId: s.sheetId,
        title: s.title,
      }));

      // Add to spreadsheets list
      setSpreadsheets((prev) => {
        const exists = prev.some((s) => s.id === cleanId);
        if (exists) return prev;
        return [{ id: cleanId, name: sheetTitleFound }, ...prev];
      });
      setWorksheets(parsedSheets);

      const targetTab = parsedSheets.length > 0 ? parsedSheets[0].title : 'Leads';
      const targetTabId = parsedSheets.length > 0 ? parsedSheets[0].sheetId : 0;

      onSelectDestination({
        spreadsheetId: cleanId,
        spreadsheetName: sheetTitleFound,
        sheetId: targetTabId,
        sheetName: targetTab,
        columnMapping: mapping,
        connectedUserEmail: connectedEmail,
      });

      onShowToast(`Connected spreadsheet: "${sheetTitleFound}"`, 'success');
      setSelectionMode('browse');
    } catch (err: any) {
      onShowToast(err.message, 'error');
      setApiError(err.message);
    } finally {
      setIsValidatingManual(false);
    }
  };

  const handleCreateNewSpreadsheet = async () => {
    if (!newSpreadsheetTitle.trim()) return;
    setIsCreatingSpreadsheet(true);
    setApiError(null);
    try {
      const res = await fetch('/api/sheets/create-spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSpreadsheetTitle.trim(),
          sheetTitle: newWorksheetTitle.trim() || 'Leads',
          email: connectedEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create spreadsheet');
      }

      const created = await res.json();
      onShowToast(`Created Google Sheet: "${created.title}"`, 'success');
      setShowCreateSpreadsheet(false);

      // Select newly created spreadsheet and worksheet
      setSpreadsheets((prev) => [{ id: created.spreadsheetId, name: created.title }, ...prev]);
      setWorksheets([{ sheetId: created.sheetId, title: newWorksheetTitle.trim() || 'Leads' }]);

      onSelectDestination({
        spreadsheetId: created.spreadsheetId,
        spreadsheetName: created.title,
        sheetId: created.sheetId,
        sheetName: newWorksheetTitle.trim() || 'Leads',
        columnMapping: mapping,
        connectedUserEmail: connectedEmail,
      });
    } catch (err: any) {
      setApiError(err.message);
      onShowToast(err.message, 'error');
    } finally {
      setIsCreatingSpreadsheet(false);
    }
  };

  const handleCreateNewTab = async () => {
    if (!spreadsheetId || !newTabTitle.trim()) return;
    setIsCreatingTab(true);
    try {
      const res = await fetch('/api/sheets/create-worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId,
          sheetTitle: newTabTitle.trim(),
          email: connectedEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create worksheet tab');
      }

      const created = await res.json();
      onShowToast(`Created Worksheet tab: "${created.title}"`, 'success');
      setShowCreateWorksheet(false);
      setNewTabTitle('');

      setWorksheets((prev) => [...prev, { sheetId: created.sheetId, title: created.title }]);
      onSelectDestination({
        spreadsheetId,
        spreadsheetName: spreadsheetName || 'Spreadsheet',
        sheetId: created.sheetId,
        sheetName: created.title,
        columnMapping: mapping,
        connectedUserEmail: connectedEmail,
      });
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsCreatingTab(false);
    }
  };

  return (
    <div className="p-4.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/10 space-y-4">
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h5 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
              <span>Google Sheets Auto-Sync</span>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Official API
              </span>
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Export and append this schedule&apos;s newly discovered leads directly to a Google Sheet assigned to this specific schedule.
            </p>
          </div>
        </div>

        {/* Yes / No Toggle Pill Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => onToggleEnabled(true)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              enabled
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Yes</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleEnabled(false)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              !enabled
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>No</span>
          </button>
        </div>
      </div>

      {/* When Disabled Notice */}
      {!enabled && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
          This schedule will store verified leads exclusively in LeadHook database.
        </div>
      )}

      {/* When Enabled: Setup Section */}
      {enabled && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Step 1: Google Account Connection Status */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {isConnected ? (
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Google Account
                </span>
                <span className="font-semibold text-xs text-slate-900 dark:text-white truncate block">
                  {isConnected ? connectedEmail || 'Connected ✓' : 'Not Connected'}
                </span>
              </div>
            </div>

            <div className="shrink-0">
              {isConnected ? (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                >
                  Switch Account
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isAuthenticating}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuthenticating ? 'animate-spin' : ''}`} />
                  <span>{isAuthenticating ? 'Connecting...' : 'Connect Google Account'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Spreadsheet & Worksheet Selection */}
          {isConnected && (
            <div className="space-y-3.5">
              {/* API Alert Banner if authorization is needed */}
              {apiError && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-900 dark:text-amber-100">
                        Google Sheets Authorization Required
                      </div>
                      <div className="text-[11px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">
                        {apiError.includes('not been used')
                          ? 'Please click "Authorize Google Sheets" to grant official Sheets & Drive permissions.'
                          : apiError}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={isAuthenticating}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{isAuthenticating ? 'Authorizing...' : 'Authorize Google Sheets'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectionMode('manual')}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Paste Link</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode switch: Browse Drive vs Paste URL/ID */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-2">
                <div className="flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectionMode('browse')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      selectionMode === 'browse'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Choose from Drive</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('manual')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      selectionMode === 'manual'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Paste Link / ID</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadSpreadsheets(connectedEmail)}
                    disabled={isLoadingSheets}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingSheets ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateSpreadsheet(!showCreateSpreadsheet)}
                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Create New Sheet</span>
                  </button>
                </div>
              </div>

              {/* Mode: Manual Link / ID */}
              {selectionMode === 'manual' && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>Google Spreadsheet Link or ID</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">e.g. docs.google.com/spreadsheets/d/.../edit</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualSheetInput}
                      onChange={(e) => setManualSheetInput(e.target.value)}
                      placeholder="Paste https://docs.google.com/spreadsheets/d/... or ID"
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleConnectManualSpreadsheet}
                      disabled={isValidatingManual || !manualSheetInput.trim()}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isValidatingManual ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>Load Tabs</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode: Browse from Drive Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Spreadsheet Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Table className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Select Spreadsheet</span>
                    </label>
                  </div>

                  <div className="relative">
                    <select
                      value={spreadsheetId || ''}
                      onChange={(e) => handleSpreadsheetSelect(e.target.value)}
                      disabled={isLoadingSheets}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                    >
                      <option value="">
                        {isLoadingSheets
                          ? 'Loading spreadsheets from Google...'
                          : spreadsheets.length === 0
                          ? '-- No spreadsheets found (Create new or paste link) --'
                          : '-- Choose destination spreadsheet --'}
                      </option>
                      {spreadsheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Worksheet Tab Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Select Worksheet (Tab)</span>
                    </label>
                    {spreadsheetId && (
                      <button
                        type="button"
                        onClick={() => setShowCreateWorksheet(!showCreateWorksheet)}
                        className="text-[11px] font-semibold text-[#155eef] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Tab</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <select
                      value={sheetName || ''}
                      onChange={(e) => handleWorksheetSelect(e.target.value)}
                      disabled={!spreadsheetId || isLoadingWorksheets}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs disabled:opacity-60"
                    >
                      {!spreadsheetId ? (
                        <option value="">Select a spreadsheet first</option>
                      ) : isLoadingWorksheets ? (
                        <option value="">Loading worksheet tabs...</option>
                      ) : worksheets.length === 0 ? (
                        <option value="Leads">Leads (Default tab)</option>
                      ) : (
                        worksheets.map((w) => (
                          <option key={w.sheetId} value={w.title}>
                            {w.title}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Create Spreadsheet Panel */}
          {showCreateSpreadsheet && (
            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create New Google Spreadsheet</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Spreadsheet Name
                  </label>
                  <input
                    type="text"
                    value={newSpreadsheetTitle}
                    onChange={(e) => setNewSpreadsheetTitle(e.target.value)}
                    placeholder="e.g. California Leads 2026"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Initial Worksheet Tab Name
                  </label>
                  <input
                    type="text"
                    value={newWorksheetTitle}
                    onChange={(e) => setNewWorksheetTitle(e.target.value)}
                    placeholder="e.g. Law Firms"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateSpreadsheet(false)}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewSpreadsheet}
                  disabled={isCreatingSpreadsheet || !newSpreadsheetTitle.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingSpreadsheet ? 'Creating...' : 'Create & Select'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Create Worksheet Tab Panel */}
          {showCreateWorksheet && (
            <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 space-y-3 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Worksheet Tab</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTabTitle}
                  onChange={(e) => setNewTabTitle(e.target.value)}
                  placeholder="e.g. Q4 Growth Targets"
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateNewTab}
                  disabled={isCreatingTab || !newTabTitle.trim()}
                  className="px-3.5 py-1.5 bg-[#155eef] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
                >
                  {isCreatingTab ? 'Adding...' : 'Add Tab'}
                </button>
              </div>
            </div>
          )}

          {/* Destination Preview Card */}
          {spreadsheetId && sheetName && (
            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                  Google Sheets Destination
                </span>
                <button
                  type="button"
                  onClick={() => setShowColumnMapping(!showColumnMapping)}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Columns className="w-3 h-3" />
                  <span>{showColumnMapping ? 'Hide Column Mapping' : 'Customize Column Mapping'}</span>
                  {showColumnMapping ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              <div className="font-mono text-xs text-slate-800 dark:text-slate-200 pl-1 space-y-0.5">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                  <Table className="w-3.5 h-3.5" />
                  <span>{spreadsheetName || spreadsheetId}</span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 pl-4 flex items-center gap-1.5">
                  <span>└──</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{sheetName}</span>
                </div>
              </div>
            </div>
          )}

          {/* Column Mapping Section */}
          {showColumnMapping && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h6 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Columns className="w-3.5 h-3.5 text-[#155eef]" />
                    <span>Column Mapping Configuration</span>
                  </h6>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Map LeadHook lead fields to your Google Sheet column headers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMapping({
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
                    });
                    onShowToast('Reset to default column mapping', 'info');
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                {[
                  { key: 'companyNameColumn', label: 'Company Name' },
                  { key: 'websiteColumn', label: 'Website URL' },
                  { key: 'decisionMakerColumn', label: 'Decision Maker' },
                  { key: 'decisionMakerTitleColumn', label: 'Decision Maker Title' },
                  { key: 'decisionMakerEmailColumn', label: 'Decision Maker Email' },
                  { key: 'genericEmailColumn', label: 'Generic Email' },
                  { key: 'phoneColumn', label: 'Phone Number' },
                  { key: 'industryColumn', label: 'Industry' },
                  { key: 'locationColumn', label: 'Location' },
                  { key: 'employeesColumn', label: 'Employees' },
                  { key: 'foundedColumn', label: 'Founded Year' },
                  { key: 'verificationStatusColumn', label: 'Verification Status' },
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {field.label}
                    </span>
                    <input
                      type="text"
                      value={(mapping as any)[field.key] || ''}
                      onChange={(e) => {
                        const updated = { ...mapping, [field.key]: e.target.value };
                        setMapping(updated);
                        if (spreadsheetId && sheetName) {
                          onSelectDestination({
                            spreadsheetId,
                            spreadsheetName: spreadsheetName || 'Spreadsheet',
                            sheetId: sheetId ?? 0,
                            sheetName,
                            columnMapping: updated,
                            connectedUserEmail: connectedEmail,
                          });
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
