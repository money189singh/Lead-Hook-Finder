import React, { useState, useEffect } from 'react';
import {
  ScrapeJob,
  ScrapeSettings,
  WebsiteResult,
  VerificationLevel,
  CustomVerificationOptions,
  VerificationJobStatus,
  BusinessStatus,
  LeadEligibility,
  CreditUsageRecord,
  VerificationCreditSettings,
} from '../types';
import { VerifierDashboard } from '../components/verifier/VerifierDashboard';
import { VerifierControlBar } from '../components/verifier/VerifierControlBar';
import { VerificationStatusBadge } from '../components/verifier/VerificationStatusBadge';
import { VerificationDetailModal } from '../components/verifier/VerificationDetailModal';
import { CreditHistoryModal } from '../components/verifier/CreditHistoryModal';
import { VerifierRulesModal } from '../components/verifier/VerifierRulesModal';
import { VerifierImportModal } from '../components/verifier/VerifierImportModal';
import {
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  Download,
  PlusCircle,
  RefreshCw,
  Eye,
  ShieldCheck,
  Building2,
  ListFilter,
  SlidersHorizontal,
  FileUp,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';

interface BusinessVerifierPageProps {
  currentJob: ScrapeJob | null;
  settings: ScrapeSettings | null;
  onRefreshJob: () => void;
  onUpdateSettings?: (newSettings: Partial<ScrapeSettings>) => Promise<boolean | void>;
  onExportXlsx: () => void;
  onExportCsv: () => void;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const BusinessVerifierPage: React.FC<BusinessVerifierPageProps> = ({
  currentJob,
  settings,
  onRefreshJob,
  onUpdateSettings,
  onExportXlsx,
  onExportCsv,
  onShowToast,
}) => {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [verificationLevel, setVerificationLevel] = useState<VerificationLevel>('MEDIUM');
  const [customOptions, setCustomOptions] = useState<CustomVerificationOptions>({
    checkWebsite: true,
    checkGoogleMaps: true,
    checkSearch: true,
    checkGovernment: false,
    checkRecentReviews: false,
    checkSocialActivity: false,
    aiOnlyWhenUncertain: true,
  });

  const [jobStatus, setJobStatus] = useState<VerificationJobStatus | null>(null);
  const [creditHistory, setCreditHistory] = useState<CreditUsageRecord[]>([]);
  const [creditSettings, setCreditSettings] = useState<VerificationCreditSettings | null>(
    settings?.verification_credit_settings || null
  );

  // Modals
  const [inspectingBusiness, setInspectingBusiness] = useState<WebsiteResult | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const notify = (msg: string, type: 'success' | 'error' | 'info' | 'warning') => {
    if (onShowToast) onShowToast(msg, type);
    else alert(msg);
  };

  const handleClearWorkspace = async () => {
    if (!window.confirm('Are you sure you want to clear all businesses from the current verification workspace?')) return;
    try {
      await fetch('/api/verifier/clear', { method: 'POST' });
      onRefreshJob();
      setSelectedUrls(new Set());
      notify('Workspace cleared', 'info');
    } catch (err: any) {
      notify(`Failed to clear workspace: ${err.message}`, 'error');
    }
  };

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterEligibility, setFilterEligibility] = useState<string>('ALL');

  // Direct Input state
  const [activeViewMode, setActiveViewMode] = useState<'workspace' | 'direct_input'>('workspace');
  const [directInputUrls, setDirectInputUrls] = useState('');
  const [isAddingDirect, setIsAddingDirect] = useState(false);

  // Individual verification running map
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});

  // Poll status & fetch credits on mount
  const fetchCreditsAndStatus = async () => {
    try {
      const res = await fetch('/api/verifier/credits');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setCreditSettings(data.settings);
        if (data.history) setCreditHistory(data.history);
      }

      const stRes = await fetch('/api/verifier/status');
      if (stRes.ok) {
        const data = await stRes.json();
        if (data.status) {
          setJobStatus((prev) => {
            if (data.status.status === 'running' || (prev?.status === 'running' && data.status.status === 'completed')) {
              onRefreshJob();
            }
            return data.status;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching verifier status:', err);
    }
  };

  useEffect(() => {
    fetchCreditsAndStatus();
    const interval = setInterval(() => {
      fetchCreditsAndStatus();
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const websites = currentJob?.websites || [];

  // Filtered websites
  const filteredWebsites = websites.filter((w) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (w.company_name || '').toLowerCase().includes(q) || w.url.toLowerCase().includes(q);
    if (!nameMatch) return false;

    if (filterStatus !== 'ALL') {
      const vStatus = w.verification?.final_business_status;
      if (filterStatus === 'UNVERIFIED' && vStatus) return false;
      if (filterStatus !== 'UNVERIFIED' && vStatus !== filterStatus) return false;
    }

    if (filterEligibility !== 'ALL') {
      const elig = w.verification?.lead_eligibility;
      if (elig !== filterEligibility) return false;
    }

    return true;
  });

  const allSelected = filteredWebsites.length > 0 && filteredWebsites.every((w) => selectedUrls.has(w.url));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedUrls(new Set());
    } else {
      const next = new Set<string>();
      filteredWebsites.forEach((w) => next.add(w.url));
      setSelectedUrls(next);
    }
  };

  const toggleSelectOne = (url: string) => {
    const next = new Set(selectedUrls);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setSelectedUrls(next);
  };

  // Cost calculation
  const getCostPerBusiness = (): number => {
    if (verificationLevel === 'LOW') return creditSettings?.cost_per_level?.LOW ?? 0.5;
    if (verificationLevel === 'HIGH') return creditSettings?.cost_per_level?.HIGH ?? 2.0;
    if (verificationLevel === 'CUSTOM') {
      let c = 0;
      if (customOptions.checkWebsite) c += 0.2;
      if (customOptions.checkGoogleMaps) c += 0.3;
      if (customOptions.checkSearch) c += 0.5;
      if (customOptions.checkGovernment) c += 0.4;
      if (customOptions.aiOnlyWhenUncertain) c += 0.2;
      return Math.round(c * 10) / 10 || 1.0;
    }
    return creditSettings?.cost_per_level?.MEDIUM ?? 1.0;
  };

  // Actions
  const handleVerifyBatch = async (urls: string[]) => {
    if (urls.length === 0) return;
    const targets = websites
      .filter((w) => urls.includes(w.url))
      .map((w) => ({
        url: w.url,
        business_name: w.company_name || w.url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0],
        company_name: w.company_name,
        address: w.firmographics?.headquarters,
      }));

    try {
      const res = await fetch('/api/verifier/verify-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets,
          level: verificationLevel,
          customOptions,
        }),
      });
      if (res.ok) {
        notify(`Batch verification started for ${targets.length} business(es)...`, 'info');
        await fetchCreditsAndStatus();
        onRefreshJob();
      } else {
        const data = await res.json();
        notify(data.error || 'Failed to start batch verification', 'error');
      }
    } catch (err: any) {
      notify(`Error starting verification: ${err.message}`, 'error');
    }
  };

  const handleVerifySingle = async (business: WebsiteResult) => {
    const url = business.url;
    setVerifyingMap((prev) => ({ ...prev, [url]: true }));

    try {
      const res = await fetch('/api/verifier/verify-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: {
            url: business.url,
            business_name: business.company_name || business.url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0],
            company_name: business.company_name,
            address: business.firmographics?.headquarters,
          },
          level: verificationLevel,
          customOptions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchCreditsAndStatus();
        onRefreshJob();
        notify(`Verified ${business.company_name || business.url}: ${data.result?.final_business_status || 'DONE'}`, 'success');
      } else {
        const data = await res.json();
        notify(data.error || 'Failed to verify business', 'error');
      }
    } catch (err: any) {
      notify(`Verification error: ${err.message}`, 'error');
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [url]: false }));
    }
  };

  const handleAddCredits = async (amount: number) => {
    const res = await fetch('/api/verifier/credits/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.settings) setCreditSettings(data.settings);
      if (data.history) setCreditHistory(data.history);
    }
  };

  const handleSaveRules = async (
    newRules: any,
    newCredits: VerificationCreditSettings
  ) => {
    await onUpdateSettings({
      business_verifier_rules: newRules,
      verification_credit_settings: newCredits,
    });
    setCreditSettings(newCredits);
  };

  const handlePause = async () => {
    await fetch('/api/verifier/pause', { method: 'POST' });
    fetchCreditsAndStatus();
  };

  const handleResume = async () => {
    await fetch('/api/verifier/resume', { method: 'POST' });
    fetchCreditsAndStatus();
  };

  const handleStop = async () => {
    await fetch('/api/verifier/stop', { method: 'POST' });
    fetchCreditsAndStatus();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#155eef] dark:text-blue-400 flex items-center justify-center shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Business Verifier</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Import Businesses Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm shadow-[#155eef]/20 cursor-pointer active:scale-95"
          >
            <FileUp className="w-4 h-4" />
            <span>Import File / URLs</span>
          </button>

          {/* Export XLSX Button */}
          <button
            onClick={onExportXlsx}
            disabled={websites.length === 0}
            title={websites.length === 0 ? 'No businesses to export' : 'Export verified Excel spreadsheet'}
            className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100/80 text-[#155eef] border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <span>Export Excel</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={onExportCsv}
            disabled={websites.length === 0}
            title={websites.length === 0 ? 'No businesses to export' : 'Export verified CSV spreadsheet'}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 dark:bg-[#101730] dark:hover:bg-[#162044] dark:text-slate-300 dark:border-blue-900/30 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
            <span>Export CSV</span>
          </button>

          {/* Clear Workspace Button (if businesses exist) */}
          {websites.length > 0 && (
            <button
              onClick={handleClearWorkspace}
              title="Clear all businesses from workspace"
              className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 dark:bg-[#101730] dark:hover:bg-rose-950/30 dark:text-slate-400 dark:hover:text-rose-400 dark:border-blue-900/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Verifier Dashboard (Requirement #6) */}
      <VerifierDashboard
        status={jobStatus}
        creditSettings={creditSettings}
        totalCompaniesCount={websites.length}
        onOpenCreditHistory={() => setShowHistoryModal(true)}
        onOpenAddCredits={() => setShowHistoryModal(true)}
        onOpenRules={() => setShowRulesModal(true)}
      />

      {/* Verifier Control Bar (Requirement #1, #2, #3, #4) */}
      <VerifierControlBar
        selectedCount={selectedUrls.size}
        totalCount={websites.length}
        verificationLevel={verificationLevel}
        onSelectLevel={setVerificationLevel}
        customOptions={customOptions}
        onUpdateCustomOptions={setCustomOptions}
        availableCredits={creditSettings?.available_credits ?? 10000}
        costPerBusiness={getCostPerBusiness()}
        jobStatus={jobStatus}
        onVerifySelected={() => handleVerifyBatch(Array.from(selectedUrls))}
        onVerifyAll={() => handleVerifyBatch(websites.map((w) => w.url))}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onOpenAddCredits={() => setShowHistoryModal(true)}
      />

      {/* Main Table Section */}
      <div className="glass-card glass-reflection rounded-2xl overflow-hidden shadow-xs">
        {/* Table Filter & Search Header */}
        <div className="p-4 border-b border-blue-100/80 dark:border-blue-900/30 flex flex-wrap items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 dark:text-blue-400" />
            <input
              type="text"
              placeholder="Search by company or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-input rounded-xl pl-9 pr-4 py-2 text-xs"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="glass-input rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">OPEN (Operating)</option>
                <option value="TEMPORARILY CLOSED">TEMPORARILY CLOSED</option>
                <option value="PERMANENTLY CLOSED">PERMANENTLY CLOSED</option>
                <option value="UNCERTAIN">UNCERTAIN</option>
                <option value="UNVERIFIED">Unverified</option>
              </select>
            </div>

            {/* Lead Eligibility Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Eligibility:</span>
              <select
                value={filterEligibility}
                onChange={(e) => setFilterEligibility(e.target.value)}
                className="glass-input rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
              >
                <option value="ALL">All Eligibility</option>
                <option value="KEEP">KEEP</option>
                <option value="SKIP">SKIP</option>
                <option value="VERIFY">VERIFY</option>
              </select>
            </div>
          </div>
        </div>

        {/* Businesses List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-blue-100/80 dark:border-blue-900/30 bg-blue-50/40 dark:bg-[#101730]/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                  />
                </th>
                <th className="p-3.5">Company / Website</th>
                <th className="p-3.5">Google Maps</th>
                <th className="p-3.5">Website Health</th>
                <th className="p-3.5">Operating Status</th>
                <th className="p-3.5">Lead Eligibility</th>
                <th className="p-3.5">Last Verified</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/60 dark:divide-blue-950/30">
              {filteredWebsites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 px-4">
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-[#155eef] dark:text-blue-400 shadow-xs">
                        <Building2 className="w-7 h-7 opacity-80" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                          No businesses in verification workspace
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                          Import an Excel spreadsheet, CSV file, or list of URLs to verify business operating status, or run an initial scrape.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          onClick={() => setShowImportModal(true)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm shadow-[#155eef]/20 cursor-pointer"
                        >
                          <FileUp className="w-4 h-4" />
                          <span>Import File / URLs</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredWebsites.map((w) => {
                  const isSelected = selectedUrls.has(w.url);
                  const isVerifying = Boolean(verifyingMap[w.url]);
                  const v = w.verification;

                  return (
                    <tr
                      key={w.url}
                      className={`hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors ${
                        isSelected ? 'bg-blue-50/70 dark:bg-blue-950/40' : ''
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(w.url)}
                          className="rounded border-slate-300 text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                        />
                      </td>

                      {/* Company Name & URL */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {w.company_name || w.normalized_url}
                        </div>
                        <a
                          href={w.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#155eef] dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <span>{w.normalized_url || w.url}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>

                      {/* Google Maps Status */}
                      <td className="p-3.5">
                        {v?.google_maps_status ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {v.google_maps_status}
                            </span>
                            {v.google_maps_url && (
                              <div>
                                <a
                                  href={v.google_maps_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-[#155eef] dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  Maps Link <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Unchecked</span>
                        )}
                      </td>

                      {/* Website Health */}
                      <td className="p-3.5">
                        {v?.website_http_status ? (
                          <div className="space-y-0.5 text-[11px]">
                            <span
                              className={`font-bold ${
                                v.website_http_status === 200
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              HTTP {v.website_http_status}
                            </span>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {v.website_last_modified || 'No modified header'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>

                      {/* Operating Status & Confidence */}
                      <td className="p-3.5">
                        <VerificationStatusBadge
                          status={v?.final_business_status}
                          confidence={v?.status_confidence}
                        />
                      </td>

                      {/* Lead Eligibility */}
                      <td className="p-3.5">
                        {v?.lead_eligibility ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              v.lead_eligibility === 'KEEP'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30'
                                : v.lead_eligibility === 'SKIP'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30'
                                : 'bg-blue-50 text-[#155eef] border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30'
                            }`}
                          >
                            {v.lead_eligibility}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>

                      {/* Last Verified */}
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        {v?.last_verified ? (
                          <div>
                            <div>{v.last_verified}</div>
                            {v.credits_used !== undefined && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                {v.credits_used} creds used
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Inspect Evidence Button */}
                          <button
                            onClick={() => setInspectingBusiness(w)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#155eef] border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/40 transition-colors cursor-pointer"
                            title="Inspect Verification Evidence & Logs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* VERIFY NOW (Requirement #1) */}
                          <button
                            disabled={isVerifying}
                            onClick={() => handleVerifySingle(w)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              isVerifying
                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-[#155eef] hover:bg-blue-700 text-white shadow-xs active:scale-95'
                            }`}
                          >
                            {isVerifying ? (
                              <span className="flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Checking
                              </span>
                            ) : (
                              'VERIFY NOW'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Detail Modal */}
      {inspectingBusiness && (
        <VerificationDetailModal
          business={inspectingBusiness}
          onClose={() => setInspectingBusiness(null)}
          onVerifyNow={handleVerifySingle}
        />
      )}

      {/* Credit History & Top-up Modal */}
      {showHistoryModal && (
        <CreditHistoryModal
          records={creditHistory}
          availableCredits={creditSettings?.available_credits ?? 10000}
          totalCreditsUsed={creditSettings?.total_credits_used ?? 0}
          onClose={() => setShowHistoryModal(false)}
          onAddCredits={handleAddCredits}
        />
      )}

      {/* Verification Rules Modal */}
      {showRulesModal && settings?.business_verifier_rules && creditSettings && (
        <VerifierRulesModal
          rules={settings.business_verifier_rules}
          creditSettings={creditSettings}
          onClose={() => setShowRulesModal(false)}
          onSave={handleSaveRules}
        />
      )}

      {/* Business Verifier Import Modal */}
      <VerifierImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          onRefreshJob();
          fetchCreditsAndStatus();
        }}
        showToast={notify}
      />
    </div>
  );
};
