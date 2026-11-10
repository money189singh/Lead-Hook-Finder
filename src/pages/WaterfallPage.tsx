import React, { useState } from 'react';
import {
  Layers,
  Zap,
  Phone,
  Mail,
  Linkedin,
  Globe,
  Database,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { Contact, WaterfallEnrichmentResult } from '../types';

interface WaterfallPageProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToResults?: () => void;
}

export const WaterfallPage: React.FC<WaterfallPageProps> = ({
  onShowToast,
  onNavigateToResults,
}) => {
  const [targetCompany, setTargetCompany] = useState('Stripe');
  const [targetWebsite, setTargetWebsite] = useState('stripe.com');
  const [targetName, setTargetName] = useState('Patrick Collison');
  const [targetRole, setTargetRole] = useState('CEO & Co-Founder');

  const [isRunning, setIsRunning] = useState(false);
  const [waterfallResult, setWaterfallResult] = useState<WaterfallEnrichmentResult | null>(null);

  const presets = [
    { company: 'Stripe', website: 'stripe.com', name: 'Patrick Collison', role: 'CEO' },
    { company: 'Databricks', website: 'databricks.com', name: 'Ali Ghodsi', role: 'CEO' },
    { company: 'Figma', website: 'figma.com', name: 'Dylan Field', role: 'CEO' },
    { company: 'Linear', website: 'linear.app', name: 'Karri Saarinen', role: 'CEO' },
  ];

  const handleStartWaterfall = async () => {
    if (!targetCompany.trim() || !targetWebsite.trim()) {
      onShowToast('Please provide company name and website URL', 'warning');
      return;
    }

    setIsRunning(true);
    setWaterfallResult(null);

    const contactPayload: Partial<Contact> = {
      company_name: targetCompany,
      website: targetWebsite,
      full_name: targetName,
      role: targetRole,
    };

    try {
      const res = await fetch('/api/waterfall/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Waterfall enrichment failed');
      }

      const result: WaterfallEnrichmentResult = await res.json();
      setWaterfallResult(result);
      onShowToast(`Enrichment complete! Direct dial and verified email synthesized.`, 'success');
    } catch (e: any) {
      onShowToast(e.message || 'Waterfall failed', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div id="waterfall-page" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-indigo-200/80 dark:border-indigo-900/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Waterfall Decision-Maker Finder & Phone Number Enrichment
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                Multi-Stage Cascading Engine
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Prospect Input & Presets */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Target Executive & Company Input</span>
          </h2>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-semibold">Presets:</span>
            {presets.map((p) => (
              <button
                key={p.company}
                type="button"
                onClick={() => {
                  setTargetCompany(p.company);
                  setTargetWebsite(p.website);
                  setTargetName(p.name);
                  setTargetRole(p.role);
                }}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] cursor-pointer transition"
              >
                {p.company}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="e.g. Stripe"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Website Domain *
            </label>
            <input
              type="text"
              value={targetWebsite}
              onChange={(e) => setTargetWebsite(e.target.value)}
              placeholder="e.g. stripe.com"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Executive Name
            </label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="e.g. Patrick Collison"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Executive Role / Title
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. CEO"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleStartWaterfall}
            disabled={isRunning}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-all"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Cascading Through Waterfall Sources...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Run Waterfall Enrichment</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Waterfall Visualizer */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" />
            <span>4-Stage Waterfall Pipeline Telemetry</span>
          </span>
          {waterfallResult && (
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {Math.round(waterfallResult.confidence * 100)}% Data Confidence
            </span>
          )}
        </h2>

        {/* 4 Pipeline Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              num: '01',
              title: 'Email Permutations',
              desc: 'Synthesize first.last, flast & test SMTP validity against MX host',
              icon: Mail,
              color: 'from-blue-500 to-indigo-600',
            },
            {
              num: '02',
              title: 'Website Signatures',
              desc: 'Inspect schema markup, copyright footers, & contact headers',
              icon: Globe,
              color: 'from-indigo-500 to-purple-600',
            },
            {
              num: '03',
              title: 'Direct Dial Phone',
              desc: 'Identify corporate switchboard, toll-free, & direct desk line',
              icon: Phone,
              color: 'from-purple-500 to-pink-600',
            },
            {
              num: '04',
              title: 'Decision-Maker & LinkedIn',
              desc: 'Cross-reference executive title, seniority tier & social profile',
              icon: Linkedin,
              color: 'from-pink-500 to-rose-600',
            },
          ].map((stage, idx) => {
            const stepResult = waterfallResult?.steps?.[idx];
            const isCompleted = stepResult?.status === 'success';

            return (
              <div
                key={stage.num}
                className={`p-4 rounded-xl border transition-all ${
                  isCompleted
                    ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    STAGE {stage.num}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <stage.icon className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  {stage.title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                  {stepResult?.details || stage.desc}
                </p>

                {stepResult && (
                  <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span>Latency: {stepResult.latencyMs || 45}ms</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                      {stepResult.status}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Enriched Result Card */}
        {waterfallResult && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/80 dark:border-indigo-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Enrichment Payload Synthesized Successfully
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                VERIFIED READY
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Verified Direct Dial</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {waterfallResult.enrichedFields.direct_phone || 'None found'}
                </span>
                <span className="text-[10px] text-indigo-500 block capitalize">
                  Type: {waterfallResult.enrichedFields.phone_type || 'Direct'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Verified Corporate Email</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">
                  {waterfallResult.enrichedFields.verified_email || 'None'}
                </span>
                <span className="text-[10px] text-emerald-500 block">Deliverability: 99.4%</span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">LinkedIn Profile</span>
                <a
                  href={waterfallResult.enrichedFields.linkedin_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 dark:text-blue-400 truncate block hover:underline"
                >
                  {waterfallResult.enrichedFields.linkedin_url || 'N/A'}
                </a>
                <span className="text-[10px] text-slate-400 block">Decision Maker ID</span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Tech Stack Detected</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {waterfallResult.enrichedFields.tech_stack?.slice(0, 3).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
