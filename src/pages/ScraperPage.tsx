import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Globe,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Zap,
  Terminal,
  ChevronDown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Server,
  Percent,
  Layers,
  Settings,
} from 'lucide-react';
import { ScrapeJob, ScrapeSettings } from '../types';
import { IcpAndExtractionRulesPanel } from '../components/enrichment/IcpAndExtractionRulesPanel';
import { TestPreviewModal } from '../components/enrichment/TestPreviewModal';
import { TestSuiteModal } from '../components/enrichment/TestSuiteModal';
import { LookalikeFinderModal } from '../components/discovery/LookalikeFinderModal';

interface ScraperPageProps {
  currentJob: ScrapeJob | null;
  settings: ScrapeSettings | null;
  onStartScrape: (urls: string[], jobSettings?: Partial<ScrapeSettings>) => Promise<void>;
  onPauseScrape: () => Promise<void>;
  onResumeScrape: () => Promise<void>;
  onStopScrape: () => Promise<void>;
  onUpdateSettings?: (newSettings: Partial<ScrapeSettings>) => Promise<boolean | void>;
  onNavigateToResults: () => void;
  onNavigateToSettings?: () => void;
}

export const ScraperPage: React.FC<ScraperPageProps> = ({
  currentJob,
  settings,
  onStartScrape,
  onPauseScrape,
  onResumeScrape,
  onStopScrape,
  onUpdateSettings,
  onNavigateToResults,
  onNavigateToSettings,
}) => {
  const [urlsInput, setUrlsInput] = useState('');
  const [maxPages, setMaxPages] = useState<number>(settings?.max_pages || 10);
  const [smartDiscovery, setSmartDiscovery] = useState<boolean>(settings?.smart_discovery !== false);
  const [concurrency, setConcurrency] = useState<number>(settings?.concurrency || 3);
  const [maxContacts, setMaxContacts] = useState<number>(settings?.max_contacts || 2);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [showTestPreviewModal, setShowTestPreviewModal] = useState<boolean>(false);
  const [showTestSuiteModal, setShowTestSuiteModal] = useState<boolean>(false);
  const [showLookalikeModal, setShowLookalikeModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Sync settings if updated externally
  useEffect(() => {
    if (settings) {
      setMaxPages(settings.max_pages || 10);
      setSmartDiscovery(settings.smart_discovery !== false);
      setConcurrency(settings.concurrency || 3);
      setMaxContacts(settings.max_contacts || 2);
    }
  }, [settings]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [currentJob?.logs, autoScroll]);

  // Parse and count URLs
  const rawUrls = urlsInput
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  const uniqueUrls: string[] = Array.from<string>(
    new Set(
      rawUrls.map((u) => {
        let clean = u;
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          clean = `https://${clean}`;
        }
        return clean.replace(/\/+$/, '');
      })
    )
  );

  const isRunning = currentJob?.status === 'running';
  const isPaused = currentJob?.status === 'paused';
  const isFinished = currentJob?.status === 'completed' || currentJob?.status === 'stopped';

  const handleStart = async () => {
    if (uniqueUrls.length === 0) return;
    await onStartScrape(uniqueUrls, {
      max_pages: maxPages,
      smart_discovery: smartDiscovery,
      concurrency,
      max_contacts: maxContacts,
    });
  };

  const handleClear = () => {
    setUrlsInput('');
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const extractedUrls: string[] = [];

      let websiteColIndex = -1;

      // Check header
      if (lines.length > 0) {
        const headerCols = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
        websiteColIndex = headerCols.findIndex(
          (h) => h.includes('website') || h.includes('url') || h.includes('domain') || h.includes('site')
        );
      }

      for (let i = websiteColIndex !== -1 ? 1 : 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map((c) => c.trim().replace(/['"]/g, ''));

        if (websiteColIndex !== -1 && cols[websiteColIndex]) {
          extractedUrls.push(cols[websiteColIndex]);
        } else {
          // Find first column looking like a domain or URL
          const match = cols.find((c) => c.includes('.') && (c.startsWith('http') || c.startsWith('www') || !c.includes(' ')));
          if (match) {
            extractedUrls.push(match);
          }
        }
      }

      if (extractedUrls.length > 0) {
        setUrlsInput((prev) => (prev ? `${prev}\n${extractedUrls.join('\n')}` : extractedUrls.join('\n')));
      }

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // Filter logs
  const filteredLogs = (currentJob?.logs || []).filter((l) => {
    if (logFilter === 'all') return true;
    return l.type === logFilter;
  });

  return (
    <div id="scraper-page" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Input Section */}
      <div className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
              Company Website URLs
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              id="scraper-url-count-badge"
              className="px-2.5 py-1 rounded-xl bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-mono"
            >
              {rawUrls.length} total • <span className="text-[#155eef] dark:text-blue-400 font-semibold">{uniqueUrls.length} unique</span>
            </span>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCsvUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <button
              id="scraper-find-lookalikes-btn"
              type="button"
              onClick={() => setShowLookalikeModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#155eef] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Find Lookalikes</span>
            </button>

            <button
              id="scraper-import-csv-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
              <span>Import CSV</span>
            </button>

            {onNavigateToSettings && (
              <button
                id="scraper-open-settings-btn"
                type="button"
                onClick={onNavigateToSettings}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#101730] dark:hover:bg-[#162044] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800/40 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            id="scraper-urls-textarea"
            rows={7}
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            disabled={isRunning}
            placeholder={`Paste one website URL per line\n\nExample:\nhttps://abcsecurity.ae\nhttps://xyzsecurity.com\nhttps://example.com\nstripe.com`}
            className="w-full p-4 glass-input rounded-xl text-xs font-mono placeholder-slate-400 dark:placeholder-slate-600 leading-relaxed disabled:opacity-60"
          />
        </div>

        {/* Parameters & Options Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50/40 dark:bg-[#101730]/40 rounded-xl border border-blue-100/70 dark:border-blue-900/30 text-xs">
          {/* Max Pages */}
          <div className="space-y-1.5">
            <label className="text-slate-600 dark:text-slate-400 font-medium">Max Pages / Company:</label>
            <select
              id="scraper-max-pages-select"
              value={maxPages}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxPages(val);
                onUpdateSettings?.({ max_pages: val });
              }}
              disabled={isRunning}
              className="w-full px-2.5 py-1.5 glass-input rounded-lg font-medium"
            >
              <option value={5}>5 pages</option>
              <option value={10}>10 pages</option>
              <option value={20}>20 pages</option>
              <option value={30}>30 pages</option>
            </select>
          </div>

          {/* Concurrency */}
          <div className="space-y-1.5">
            <label className="text-slate-600 dark:text-slate-400 font-medium">Concurrency (Parallel Sites):</label>
            <select
              id="scraper-concurrency-select"
              value={concurrency}
              onChange={(e) => {
                const val = Number(e.target.value);
                setConcurrency(val);
                onUpdateSettings?.({ concurrency: val });
              }}
              disabled={isRunning}
              className="w-full px-2.5 py-1.5 glass-input rounded-lg font-medium"
            >
              <option value={1}>1 website</option>
              <option value={3}>3 websites</option>
              <option value={5}>5 websites</option>
              <option value={10}>10 websites</option>
            </select>
          </div>

          {/* Max Contacts */}
          <div className="space-y-1.5">
            <label className="text-slate-600 dark:text-slate-400 font-medium">Max Contacts / Company:</label>
            <select
              id="scraper-max-contacts-select"
              value={maxContacts}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxContacts(val);
                onUpdateSettings?.({ max_contacts: val });
              }}
              disabled={isRunning}
              className="w-full px-2.5 py-1.5 glass-input rounded-lg font-medium"
            >
              <option value={1}>Top 1 Contact</option>
              <option value={2}>Top 2 Contacts</option>
              <option value={3}>Top 3 Contacts</option>
              <option value={5}>Top 5 Contacts</option>
              <option value={10}>Top 10 Contacts</option>
              <option value={0}>Unlimited</option>
            </select>
          </div>

          {/* Smart Discovery Toggle */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                id="scraper-smart-discovery-checkbox"
                type="checkbox"
                checked={smartDiscovery}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSmartDiscovery(checked);
                  onUpdateSettings?.({ smart_discovery: checked });
                }}
                disabled={isRunning}
                className="w-4 h-4 rounded border-blue-300 text-[#155eef] focus:ring-0 focus:ring-offset-0 bg-white dark:bg-[#101730]"
              />
              <span className="text-slate-800 dark:text-slate-200 font-medium">Smart page discovery</span>
            </label>
          </div>
        </div>

        {/* Strict ICP Filters & Custom AI Agent Rules Panel */}
        <IcpAndExtractionRulesPanel
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onOpenTestPreview={() => setShowTestPreviewModal(true)}
          onOpenTestSuite={() => setShowTestSuiteModal(true)}
          disabled={isRunning}
        />

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            {!isRunning && !isPaused && (
              <button
                key="scraper-action-start"
                id="scraper-start-btn"
                type="button"
                onClick={handleStart}
                disabled={uniqueUrls.length === 0}
                className="px-5 py-2.5 rounded-lg bg-[#155eef] hover:bg-[#155eef]/90 disabled:opacity-40 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Scraping</span>
              </button>
            )}

            {isRunning && (
              <button
                key="scraper-action-pause"
                id="scraper-pause-btn"
                type="button"
                onClick={onPauseScrape}
                className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}

            {isPaused && (
              <button
                key="scraper-action-resume"
                id="scraper-resume-btn"
                type="button"
                onClick={onResumeScrape}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Resume</span>
              </button>
            )}

            {(isRunning || isPaused) && (
              <button
                key="scraper-action-stop"
                id="scraper-stop-btn"
                type="button"
                onClick={onStopScrape}
                className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            )}

            <button
              key="scraper-action-clear"
              id="scraper-clear-btn"
              type="button"
              onClick={handleClear}
              disabled={isRunning}
              className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear</span>
            </button>
          </div>

          {currentJob && (currentJob.contacts_found > 0 || (currentJob.contacts && currentJob.contacts.length > 0)) && (
            <button
              id="scraper-view-results-btn"
              type="button"
              onClick={onNavigateToResults}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>View {currentJob.contacts_found || currentJob.contacts?.length || 0} Extracted Contacts</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Scraping Progress Panel (Section 7) */}
      {currentJob && (
        <div
          id="scraper-live-progress-panel"
          className="glass-card rounded-2xl p-6 space-y-5 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100/70 dark:border-blue-900/30 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isRunning ? 'bg-emerald-500 animate-ping' : isPaused ? 'bg-amber-500' : 'bg-[#155eef]'
                  }`}
                />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Live Scraping Progress</h3>
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                    isRunning
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                      : isPaused
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800'
                      : 'bg-blue-100 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40'
                  }`}
                >
                  {currentJob.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Progress:{' '}
                <span className="font-mono text-slate-900 dark:text-white font-semibold">
                  {currentJob.completed_websites + currentJob.failed_websites} / {currentJob.total_websites} websites
                </span>
              </p>
            </div>

            {currentJob.current_status_text && (
              <div className="px-3 py-1.5 bg-blue-50/70 border border-blue-200/80 dark:bg-blue-950/40 dark:border-blue-800/40 rounded-xl text-xs text-[#155eef] dark:text-blue-300 font-medium">
                Current status: <span className="font-semibold text-blue-950 dark:text-white">{currentJob.current_status_text}</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-blue-100/50 dark:bg-blue-950/40 rounded-full overflow-hidden border border-blue-100 dark:border-blue-900/30">
            <div
              className="h-full bg-gradient-to-r from-[#155eef] to-cyan-500 transition-all duration-300"
              style={{
                width: `${
                  currentJob.total_websites > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((currentJob.completed_websites + currentJob.failed_websites) /
                            currentJob.total_websites) *
                            100
                        )
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Current Target URLs & Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active URLs */}
            <div className="p-4 bg-blue-50/40 dark:bg-[#101730]/40 rounded-xl border border-blue-100/70 dark:border-blue-900/30 space-y-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Current website:</span>
                <span className="font-mono text-slate-900 dark:text-white truncate block font-medium">
                  {currentJob.current_website || 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Current page:</span>
                <span className="font-mono text-[#155eef] dark:text-blue-400 truncate block font-medium">
                  {currentJob.current_page || 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Active AI Provider:</span>
                <span className="font-mono text-blue-600 dark:text-blue-300 font-semibold truncate block">
                  {currentJob.active_provider || 'Multi-Provider Router (Auto-Failover)'}
                </span>
              </div>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-white dark:bg-[#101730]/60 rounded-xl border border-blue-100/70 dark:border-blue-900/30 text-center shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Discovered</span>
                <span className="text-base font-bold text-slate-900 dark:text-white font-mono">{currentJob.pages_discovered}</span>
              </div>
              <div className="p-3 bg-white dark:bg-[#101730]/60 rounded-xl border border-blue-100/70 dark:border-blue-900/30 text-center shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Crawled</span>
                <span className="text-base font-bold text-[#155eef] dark:text-blue-400 font-mono">{currentJob.pages_crawled}</span>
              </div>
              <div className="p-3 bg-white dark:bg-[#101730]/60 rounded-xl border border-blue-100/70 dark:border-blue-900/30 text-center shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Contacts</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {currentJob.contacts_found || currentJob.contacts?.length || 0}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-[#101730]/60 rounded-xl border border-blue-100/70 dark:border-blue-900/30 text-center shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold block">Emails</span>
                <span className="text-base font-bold text-[#155eef] dark:text-blue-400 font-mono">{currentJob.emails_found}</span>
              </div>
            </div>
          </div>

          {/* High-Throughput Queue & Smart Token Pruning Live Strip */}
          <div className="p-3.5 bg-blue-50/50 dark:bg-[#101730]/60 rounded-xl border border-blue-100/80 dark:border-blue-900/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Layers className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                <span className="text-slate-500 dark:text-slate-400">Task Queue:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {currentJob.queue_metrics
                    ? `${currentJob.queue_metrics.activeWorkers} active / ${currentJob.queue_metrics.pendingTasks} pending`
                    : `${concurrency} workers (polite queue)`}
                </span>
              </div>

              {currentJob.queue_metrics && currentJob.queue_metrics.throughputPerMinute > 0 && (
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-slate-500 dark:text-slate-400">Throughput:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {currentJob.queue_metrics.throughputPerMinute} domains/min
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                <span className="text-slate-500 dark:text-slate-400">Proxy Shield:</span>
                <span className="font-mono font-semibold text-[#155eef] dark:text-blue-300">
                  {settings?.proxy_config?.enabled ? 'Rotating Pool' : 'Direct IP'}
                </span>
              </div>

              {currentJob.pruning_stats && currentJob.pruning_stats.rawBytesTotal > 0 && (
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Percent className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                  <span className="text-slate-500 dark:text-slate-400">Token Reduction:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    -{currentJob.pruning_stats.percentSaved}% (~{currentJob.pruning_stats.tokensEstimatedSaved.toLocaleString()} tokens saved)
                  </span>
                </div>
              )}
            </div>

            {currentJob.pruning_stats?.schemaEntitiesExtracted ? (
              <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded bg-blue-100 text-[#155eef] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                ⚡ {currentJob.pruning_stats.schemaEntitiesExtracted} Schema.org entities harvested
              </span>
            ) : null}
          </div>

          {/* Live Terminal Activity Log */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Live Activity Log</h4>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {/* Filter chips */}
                <div className="flex items-center gap-1 bg-white dark:bg-[#0a0f1d] p-1 rounded-xl border border-blue-100 dark:border-blue-900/30 text-[11px]">
                  {(['all', 'info', 'success', 'warning', 'error'] as const).map((t) => (
                    <button
                      key={`scraper-filter-${t}`}
                      type="button"
                      onClick={() => setLogFilter(t)}
                      className={`px-2 py-0.5 rounded-lg capitalize font-medium cursor-pointer transition-colors ${
                        logFilter === t
                          ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400 text-[11px]">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-white dark:bg-[#101730] border-blue-300 text-[#155eef]"
                  />
                  <span>Auto-scroll</span>
                </label>
              </div>
            </div>

            <div
              ref={logContainerRef}
              id="scraper-activity-log-container"
              className="h-64 overflow-y-auto p-4 bg-slate-900 dark:bg-[#070b14] border border-blue-900/30 rounded-xl font-mono text-xs space-y-1.5 shadow-inner"
            >
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => {
                  const logType = (typeof log === 'object' && log !== null ? (log.type || (log as any).level) : 'info') || 'info';
                  const typeColors: Record<string, string> = {
                    info: 'text-slate-300',
                    success: 'text-emerald-400',
                    warning: 'text-amber-400',
                    error: 'text-rose-400',
                  };
                  const colorClass = typeColors[logType] || 'text-slate-300';
                  const logId = typeof log === 'object' && log !== null && log.id ? log.id : `log-${index}`;
                  const logMsg = typeof log === 'string' ? log : (Array.isArray(log?.message) ? log.message.join(' ') : String(log?.message ?? ''));
                  const timeLabel = (typeof log === 'object' && log !== null ? (log.timestamp || (log as any).timeStr) : '') || '';

                  return (
                    <div key={`scraper-log-row-${logId}-${index}`} className="flex items-start gap-2.5 leading-relaxed">
                      {timeLabel && <span className="text-slate-500 select-none shrink-0">{String(timeLabel)}</span>}
                      <span className={`${colorClass} break-all`}>{logMsg}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 italic py-8 text-center">No logs matching filter</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Test & Verification Modals */}
      <TestPreviewModal
        isOpen={showTestPreviewModal}
        onClose={() => setShowTestPreviewModal(false)}
        defaultUrl={uniqueUrls.length > 0 ? uniqueUrls[0] : ''}
        settings={settings}
      />

      <TestSuiteModal
        isOpen={showTestSuiteModal}
        onClose={() => setShowTestSuiteModal(false)}
      />

      <LookalikeFinderModal
        isOpen={showLookalikeModal}
        onClose={() => setShowLookalikeModal(false)}
        initialSeedDomains={uniqueUrls.map((u) => u.replace(/^https?:\/\//, '')).slice(0, 5)}
        onQueueDomains={async (urls, startImmediately) => {
          const combined = Array.from(new Set([...uniqueUrls, ...urls]));
          setUrlsInput(combined.join('\n'));
          if (startImmediately) {
            await onStartScrape(urls, {
              max_pages: maxPages,
              smart_discovery: smartDiscovery,
              concurrency,
              max_contacts: maxContacts,
            });
          }
        }}
      />
    </div>
  );
};
