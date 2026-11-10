import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { DetectedTechnology, TechStackResult } from '../../types';

interface TechStackDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onApplyToContact?: (techNames: string[]) => void;
}

export const TechStackDetectorModal: React.FC<TechStackDetectorModalProps> = ({
  isOpen,
  onClose,
  initialUrl = '',
  onShowToast,
  onApplyToContact,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<TechStackResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedTech, setCopiedTech] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const urlToUse = initialUrl || 'https://shopify.com';
      setUrlInput(urlToUse);
      if (initialUrl) {
        handleDetect(urlToUse);
      }
    }
  }, [isOpen, initialUrl]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="glass-card relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0c1322] border border-blue-200/80 dark:border-blue-900/40 shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Website Tech Stack & Tooling Detector
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40">
                  BuiltWith / Wappalyzer Engine
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>

        {/* Input Bar & Preset Chips */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDetect();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter domain or URL (e.g. stripe.com, shopify.com, datadoghq.com)..."
                className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={isDetecting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-all"
            >
              {isDetecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Stack...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze Tech Stack</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400 overflow-x-auto pb-1">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Quick Scan Presets:</span>
            {['stripe.com', 'shopify.com', 'linear.app', 'hubspot.com', 'datadoghq.com', 'airbnb.com'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setUrlInput(preset);
                  handleDetect(preset);
                }}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-mono transition shrink-0 cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isDetecting && (
            <div className="py-16 text-center space-y-3">
              <div className="relative w-12 h-12 mx-auto">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                <Cpu className="w-5 h-5 absolute inset-0 m-auto text-cyan-500 animate-pulse" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Fetching DOM signatures, script headers, CDNs, and pixel tags...
              </p>
            </div>
          )}

          {!isDetecting && !result && (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Cpu className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No Domain Analyzed Yet
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Type any company website above or pick a quick preset to instantly uncover their software, analytics, and infrastructure stack.
              </p>
            </div>
          )}

          {!isDetecting && result && (
            <>
              {/* Domain Summary Bar */}
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
                      Found <span className="font-semibold text-cyan-600 dark:text-cyan-400">{result.technologies.length}</span> tools & frameworks &bull; Scanned at {new Date(result.analyzedAt).toLocaleTimeString()}
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
                    <span>CSV</span>
                  </button>
                  {onApplyToContact && (
                    <button
                      onClick={() => {
                        const names = result.technologies.map((t) => t.name);
                        onApplyToContact(names);
                        onShowToast(`Saved ${names.length} tech tags to lead profile!`, 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply to Lead</span>
                    </button>
                  )}
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

              {/* Tech Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTech.map((tech) => (
                  <div
                    key={tech.name}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-cyan-300 dark:hover:border-cyan-800/80 transition-all space-y-2 shadow-2xs group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500/10">
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

              {filteredTech.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No technologies detected in this specific category for {result.domain}.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
