import React, { useState } from 'react';
import {
  Cpu,
  Search,
  CheckCircle2,
  ExternalLink,
  Layers,
  BarChart3,
  Database,
  Cloud,
  CreditCard,
  Send,
  Shield,
  Activity,
  Globe,
  RefreshCw,
  Sparkles,
  Download,
  Copy,
  Check,
  ListPlus,
} from 'lucide-react';
import { DetectedTechnology, TechStackResult } from '../types';

interface TechDetectorPageProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToResults?: () => void;
}

export const TechDetectorPage: React.FC<TechDetectorPageProps> = ({
  onShowToast,
  onNavigateToResults,
}) => {
  const [urlInput, setUrlInput] = useState('https://shopify.com');
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<TechStackResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedTech, setCopiedTech] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrlsInput, setBatchUrlsInput] = useState('stripe.com\nshopify.com\nlinear.app\nhubspot.com');
  const [batchResults, setBatchResults] = useState<TechStackResult[]>([]);
  const [isBatchScanning, setIsBatchScanning] = useState(false);

  const handleDetect = async (targetUrl?: string) => {
    const raw = (targetUrl || urlInput).trim();
    if (!raw) {
      onShowToast('Please enter a website URL or domain', 'warning');
      return;
    }

    setIsDetecting(true);
    setResult(null);

    try {
      const res = await fetch('/api/tech/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: raw }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Tech detection failed');
      }

      const data: TechStackResult = await res.json();
      setResult(data);
      onShowToast(`Detected ${data.technologies.length} technologies on ${data.domain}!`, 'success');
    } catch (e: any) {
      onShowToast(e.message || 'Detection failed', 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleBatchDetect = async () => {
    const urls = batchUrlsInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 2);

    if (urls.length === 0) {
      onShowToast('Enter at least one domain to scan', 'warning');
      return;
    }

    setIsBatchScanning(true);
    setBatchResults([]);

    try {
      const res = await fetch('/api/tech/batch-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) throw new Error('Batch scan failed');
      const data = await res.json();
      setBatchResults(data.results || []);
      onShowToast(`Successfully analyzed ${data.results?.length || 0} domains!`, 'success');
    } catch (e: any) {
      onShowToast(e.message || 'Batch detection failed', 'error');
    } finally {
      setIsBatchScanning(false);
    }
  };

  const categories = [
    { id: 'all', label: 'All Technologies' },
    { id: 'analytics', label: 'Analytics & CDP', icon: BarChart3 },
    { id: 'crm', label: 'CRM & Engagement', icon: Database },
    { id: 'cms', label: 'CMS & Frameworks', icon: Globe },
    { id: 'payments', label: 'Payments & Billing', icon: CreditCard },
    { id: 'cloud', label: 'Cloud & Infrastructure', icon: Cloud },
    { id: 'marketing', label: 'Marketing & Ads', icon: Send },
    { id: 'security', label: 'Security & Monitoring', icon: Shield },
  ];

  const filteredTech = result
    ? result.technologies.filter((t) => (selectedCategory === 'all' ? true : t.category === selectedCategory))
    : [];

  const handleCopyTechNames = () => {
    if (!result) return;
    const names = result.technologies.map((t) => t.name).join(', ');
    navigator.clipboard.writeText(names);
    setCopiedTech(true);
    onShowToast('Technology stack copied to clipboard!', 'success');
    setTimeout(() => setCopiedTech(false), 2000);
  };

  const handleExportCsv = () => {
    if (!result) return;
    const headers = 'Technology,Category,Confidence,Description\n';
    const rows = result.technologies
      .map((t) => `"${t.name}","${t.category}","${t.confidence * 100}%","${t.description || ''}"`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `tech-stack-${result.domain}.csv`;
    a.click();
    URL.revokeObjectURL(u);
    onShowToast('Exported tech stack CSV', 'success');
  };

  return (
    <div id="tech-detector-page" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-cyan-200/80 dark:border-cyan-900/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-600 via-teal-600 to-blue-600 text-white shadow-md">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Website Tech Stack & Tooling Detector
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40">
                BuiltWith / Wappalyzer Engine
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setBatchMode(!batchMode)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ListPlus className="w-3.5 h-3.5 text-cyan-500" />
            <span>{batchMode ? 'Switch to Single URL' : 'Batch Domain Scanner'}</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Single URL Inspector */}
      {!batchMode && (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDetect();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter domain or URL (e.g. stripe.com, shopify.com, linear.app, datadoghq.com)..."
                className="w-full pl-10 pr-4 py-3 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={isDetecting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
            >
              {isDetecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scanning Stack...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Tech Stack</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-semibold text-slate-400">Quick Scan Presets:</span>
            {['stripe.com', 'shopify.com', 'linear.app', 'hubspot.com', 'datadoghq.com', 'airbnb.com', 'netflix.com'].map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setUrlInput(preset);
                    handleDetect(preset);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-mono transition cursor-pointer"
                >
                  {preset}
                </button>
              )
            )}
          </div>

          {/* Output Display */}
          {result && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{result.domain}</span>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-cyan-600 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="text-xs text-slate-500">
                      Uncovered <strong className="text-cyan-600 dark:text-cyan-400">{result.technologies.length}</strong> active tools &bull; Scanned {new Date(result.analyzedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyTechNames}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedTech ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTech ? 'Copied' : 'Copy All'}</span>
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
                {categories.map((cat) => {
                  const count = cat.id === 'all'
                    ? result.technologies.length
                    : result.technologies.filter((t) => t.category === cat.id).length;
                  const isActive = selectedCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? 'bg-cyan-200 dark:bg-cyan-800 text-cyan-800 dark:text-cyan-200'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Grid of Tech Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTech.map((tech) => (
                  <div
                    key={tech.name}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-cyan-300 dark:hover:border-cyan-800/80 transition-all space-y-2 shadow-2xs group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500/10 transition">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {tech.name}
                          </div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                            {tech.category}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                        {Math.round(tech.confidence * 100)}% Match
                      </span>
                    </div>

                    {tech.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {tech.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Batch Domain Scanner */}
      {batchMode && (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Batch Domain Tech Stack Detection
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste up to 15 domains (one per line) to analyze their software stacks in parallel.
            </p>
          </div>

          <textarea
            rows={5}
            value={batchUrlsInput}
            onChange={(e) => setBatchUrlsInput(e.target.value)}
            placeholder="stripe.com&#10;shopify.com&#10;linear.app"
            className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <button
            onClick={handleBatchDetect}
            disabled={isBatchScanning}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer transition"
          >
            {isBatchScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isBatchScanning ? 'Analyzing Domains...' : 'Run Batch Analysis'}</span>
          </button>

          {batchResults.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Batch Detection Results ({batchResults.length} Domains)
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {batchResults.map((b) => (
                  <div key={b.domain} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/40">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{b.domain}</span>
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">
                          ({b.technologies.length} tools)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {b.technologies.slice(0, 6).map((t) => (
                          <span key={t.name} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                            {t.name}
                          </span>
                        ))}
                        {b.technologies.length > 6 && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{b.technologies.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
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
