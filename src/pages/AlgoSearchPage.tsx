import React, { useState, useEffect, useRef } from 'react';
import {
  Wand2,
  Search,
  Building2,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
  Download,
  Sparkles,
  RefreshCw,
  Globe,
  Phone,
  Server,
  Zap,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ArrowRight,
  Target,
  Users,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { GlassTooltip } from '../components/glass/GlassTooltip';

export interface EmailPermutation {
  pattern: string;
  email: string;
  status: 'VERIFIED' | 'HIGH_CONFIDENCE' | 'PROBABLE' | 'INVALID' | 'RISKY';
  confidenceScore: number;
  smtpChecked?: boolean;
}

export interface AlgoDiscoveredLead {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  seniorityTier: 'C-Level' | 'Founder / Partner' | 'VP / Director' | 'Manager' | 'Executive';
  department: string;
  companyName: string;
  companyDomain: string;
  companyWebsite: string;
  primaryEmail: string;
  emailPattern: string;
  verificationStatus: '100% SMTP Verified' | 'High-Confidence Match' | 'Corporate Pattern Confirmed' | 'Deliverable';
  confidenceScore: number;
  mxProvider: string;
  hasMx: boolean;
  phone: string;
  linkedinUrl: string;
  permutations: EmailPermutation[];
  icpTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  fitScore: number;
  sourceUrl?: string;
  notes?: string;
}

export interface AlgoSearchJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped';
  created_at: string;
  updated_at: string;
  query: {
    companyName: string;
    domain: string;
    targetRole?: string;
    personName?: string;
    targetCount?: number;
  };
  currentStep: string;
  progressPercent: number;
  domainInfo: {
    domain: string;
    hasMx: boolean;
    mxProvider: string;
    primaryPattern?: string;
    isCatchAll?: boolean;
  };
  leads: AlgoDiscoveredLead[];
  logs: string[];
  error?: string;
}

interface AlgoSearchPageProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToResults?: () => void;
  onExportXlsx?: (datasetId?: string) => void;
}

export const AlgoSearchPage: React.FC<AlgoSearchPageProps> = ({
  onShowToast,
  onNavigateToResults,
  onExportXlsx,
}) => {
  // Input form state
  const [companyInput, setCompanyInput] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [personName, setPersonName] = useState('');
  const [targetCount, setTargetCount] = useState<number>(10);

  // Active Job State
  const [activeJob, setActiveJob] = useState<AlgoSearchJob | null>(null);
  const [allJobs, setAllJobs] = useState<AlgoSearchJob[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [expandedPermutationsLeadId, setExpandedPermutationsLeadId] = useState<string | null>(null);

  // Quick Sandbox Permutation Tester
  const [sandboxFirst, setSandboxFirst] = useState('Patrick');
  const [sandboxLast, setSandboxLast] = useState('Collison');
  const [sandboxDomain, setSandboxDomain] = useState('stripe.com');
  const [sandboxPermutations, setSandboxPermutations] = useState<EmailPermutation[]>([]);
  const [isGeneratingSandbox, setIsGeneratingSandbox] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);

  // Copied email feedback
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch past jobs on mount
  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/algo-search/jobs');
      if (res.ok) {
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          setAllJobs(data.jobs);
          if (!activeJob && data.jobs.length > 0) {
            setActiveJob(data.jobs[0]);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Polling active job
  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'running' && activeJob.status !== 'queued')) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/algo-search/job/${activeJob.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setActiveJob(data.job);
            if (data.job.status === 'completed') {
              clearInterval(pollIntervalRef.current!);
              onShowToast(
                `Algo Search completed! Discovered ${data.job.leads.length} verified leadership leads for ${data.job.query.companyName}.`,
                'success'
              );
              fetchJobs();
            } else if (data.job.status === 'failed') {
              clearInterval(pollIntervalRef.current!);
              onShowToast(`Algo Search notice: ${data.job.error || 'Execution encountered an error'}`, 'warning');
            }
          }
        }
      } catch {}
    }, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeJob?.id, activeJob?.status]);

  // Start Job
  const handleStartSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const queryTarget = companyInput.trim();
    if (!queryTarget) {
      onShowToast('Please provide a company name or domain (e.g. stripe.com or OpenAI).', 'warning');
      return;
    }

    setIsStarting(true);
    let domainParam = '';
    let companyParam = '';

    if (queryTarget.includes('.') && !queryTarget.includes(' ')) {
      domainParam = queryTarget;
    } else {
      companyParam = queryTarget;
    }

    try {
      const res = await fetch('/api/algo-search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyParam,
          domain: domainParam,
          targetRole: targetRole.trim() || undefined,
          personName: personName.trim() || undefined,
          targetCount: Number(targetCount) || 10,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start Algo Search');
      }

      const data = await res.json();
      if (data.job) {
        setActiveJob(data.job);
        onShowToast(`Started Algo Search engine for "${queryTarget}". Probing MX & X-Ray leadership...`, 'info');
        fetchJobs();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsStarting(false);
    }
  };

  // Stop Running Job
  const handleStopJob = async () => {
    if (!activeJob) return;
    try {
      const res = await fetch(`/api/algo-search/stop/${activeJob.id}`, { method: 'POST' });
      if (res.ok) {
        setActiveJob((prev) => (prev ? { ...prev, status: 'stopped', currentStep: 'Stopped by user' } : null));
        onShowToast('Algo Search job stopped.', 'info');
      }
    } catch {}
  };

  // Delete Job
  const handleDeleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/algo-search/job/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setAllJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (activeJob?.id === jobId) {
          const remaining = allJobs.filter((j) => j.id !== jobId);
          setActiveJob(remaining[0] || null);
        }
        onShowToast('Search run deleted from history.', 'info');
      }
    } catch {}
  };

  // Run Sandbox Permutations Calculator
  const handleRunSandbox = async () => {
    if (!sandboxDomain.trim()) {
      onShowToast('Domain is required for permutation sandbox.', 'warning');
      return;
    }
    setIsGeneratingSandbox(true);
    try {
      const res = await fetch('/api/algo-search/permutations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: sandboxFirst.trim(),
          lastName: sandboxLast.trim(),
          domain: sandboxDomain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSandboxPermutations(data.permutations || []);
      }
    } catch {}
    setIsGeneratingSandbox(false);
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    onShowToast(`Copied ${email} to clipboard!`, 'success');
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const leads = activeJob?.leads || [];
  const isRunning = activeJob?.status === 'running' || activeJob?.status === 'queued';

  return (
    <div id="algo-search-page" className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-blue-900/80 to-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden text-white backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-indigo-400/15 via-blue-400/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 font-bold">
                <Wand2 className="w-5 h-5 animate-pulse" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
                <span>Algo Search</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Apollo & Lusha Engine
                </span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-white/10 text-slate-200 border border-white/10">
                <Server className="w-3.5 h-3.5 text-blue-300" />
                <span>DNS MX Mail Probing</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-white/10 text-slate-200 border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Direct SMTP Handshake</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-white/10 text-slate-200 border border-white/10">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Zero Third-Party API Fees</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-white/10 text-slate-200 border border-white/10">
                <CheckCircle2 className="w-3.5 h-3.5 text-pink-300" />
                <span>SQLite Cloud Synced</span>
              </span>
            </div>
          </div>

          {/* Quick Sandbox Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 self-start lg:self-center">
            <button
              onClick={() => {
                setShowSandbox(!showSandbox);
                if (!showSandbox) handleRunSandbox();
              }}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Layers className="w-4 h-4 text-indigo-300" />
              <span>{showSandbox ? 'Hide Permutation Sandbox' : 'Test Permutation Formula'}</span>
            </button>

            {onNavigateToResults && (
              <button
                onClick={onNavigateToResults}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Stored File Datasets</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Permutation Formula Sandbox (Collapsible Calculator) */}
      {showSandbox && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Apollo 8-Formula Permutation Matrix Calculator
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Instant pattern generation for any individual executive
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                First Name
              </label>
              <input
                type="text"
                value={sandboxFirst}
                onChange={(e) => setSandboxFirst(e.target.value)}
                placeholder="Patrick"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={sandboxLast}
                onChange={(e) => setSandboxLast(e.target.value)}
                placeholder="Collison"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Company Domain
              </label>
              <input
                type="text"
                value={sandboxDomain}
                onChange={(e) => setSandboxDomain(e.target.value)}
                placeholder="stripe.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleRunSandbox}
                disabled={isGeneratingSandbox}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Calculate Formulas</span>
              </button>
            </div>
          </div>

          {sandboxPermutations.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {sandboxPermutations.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCopyEmail(p.email)}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 hover:border-indigo-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                      {p.pattern}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{p.confidenceScore}%</span>
                  </div>
                  <p className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600">
                    {p.email}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Search Generator Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <form onSubmit={handleStartSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Company / Domain Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Target Company or Domain *</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  placeholder="e.g. stripe.com or Airbnb or Morgan & Morgan"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 font-medium transition-all"
                  required
                />
              </div>
              {/* Quick sample chips */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[10px] text-slate-500 scrollbar-none">
                <span>Quick:</span>
                {['stripe.com', 'openai.com', 'airbnb.com', 'shopify.com', 'Morgan & Morgan'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCompanyInput(chip)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Role / Function */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Target Role / Title (Optional)</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. CEO, Founder, VP Sales, Managing Partner..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 transition-all"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Leave blank to discover all executive leadership & C-Suite
              </p>
            </div>

            {/* Specific Person Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Specific Person Name (Optional)</span>
              </label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g. Brian Chesky (or leave blank)"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 transition-all"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Target a specific known executive at the company
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {/* Target Count selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Target Leads:</span>
              {[5, 10, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTargetCount(num)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    targetCount === num
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {num} Leads
                </button>
              ))}
            </div>

            {/* Launch Action */}
            <div className="flex items-center gap-2">
              {isRunning && (
                <button
                  type="button"
                  onClick={handleStopJob}
                  className="px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all cursor-pointer"
                >
                  Stop Search
                </button>
              )}

              <button
                type="submit"
                disabled={isStarting || isRunning}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer"
              >
                {isRunning || isStarting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Algo Search...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Launch Algo Search</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 4. Live Progress Inspector (When Running or Active) */}
      {activeJob && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                  isRunning
                    ? 'bg-indigo-600 animate-pulse'
                    : activeJob.status === 'completed'
                    ? 'bg-emerald-600'
                    : 'bg-slate-600'
                }`}
              >
                {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    "{activeJob.query.companyName || activeJob.query.domain}"
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isRunning
                        ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 animate-pulse'
                        : activeJob.status === 'completed'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {activeJob.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  {activeJob.currentStep}
                </p>
              </div>
            </div>

            {/* Infrastructure Details */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 border border-slate-200/80 dark:border-slate-700">
                <Server className="w-3.5 h-3.5 text-indigo-500" />
                <span>{activeJob.domainInfo.mxProvider || 'Detecting MX...'}</span>
              </span>

              {activeJob.domainInfo.primaryPattern && (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                  Formula: {activeJob.domainInfo.primaryPattern}
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="px-2.5 py-1 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {showLogs ? 'Hide Engine Logs' : 'View Engine Logs'}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
            <div
              style={{ width: `${Math.max(activeJob.progressPercent, 4)}%` }}
              className={`h-full rounded-full transition-all duration-300 ${
                isRunning
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-500'
                  : activeJob.status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-slate-500'
              }`}
            />
          </div>

          {/* Engine Logs Terminal */}
          {showLogs && (
            <div className="bg-slate-950 text-slate-200 rounded-2xl p-3.5 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
              {activeJob.logs.map((logLine, idx) => (
                <div key={idx} className="leading-relaxed text-slate-300">
                  {logLine}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Executive Results Table & Profiles */}
      {leads.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          {/* Results Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Verified Decision Makers ({leads.length})
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                  Apollo Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every email verified through DNS MX records and direct SMTP verification ladder.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {onExportXlsx && activeJob && (
                <button
                  type="button"
                  onClick={() => onExportXlsx(`file_algo_${activeJob.id}`)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Excel (.xlsx)</span>
                </button>
              )}

              {onNavigateToResults && (
                <button
                  type="button"
                  onClick={onNavigateToResults}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>View in Stored Files</span>
                </button>
              )}
            </div>
          </div>

          {/* Leads Grid / Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leads.map((lead) => {
              const isPermExpanded = expandedPermutationsLeadId === lead.id;

              return (
                <div
                  key={lead.id}
                  className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-400 dark:hover:border-indigo-600/60 transition-all shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Top Row: Name, Title, Tier Badge */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {lead.fullName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              lead.seniorityTier === 'C-Level' || lead.seniorityTier === 'Founder / Partner'
                                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {lead.seniorityTier}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                          {lead.jobTitle} • <span className="text-slate-500">{lead.companyName}</span>
                        </p>
                      </div>

                      {/* ICP Fit Badge */}
                      <span className="px-2 py-1 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs">
                        {lead.fitScore}% Fit
                      </span>
                    </div>

                    {/* Primary Verified Email Card */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{lead.verificationStatus}</span>
                            <span className="text-slate-400 font-mono">({lead.emailPattern})</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate block">
                            {lead.primaryEmail}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyEmail(lead.primaryEmail)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        {copiedEmail === lead.primaryEmail ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Metadata Row: Phone & LinkedIn */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-2.5">
                      {lead.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{lead.phone}</span>
                        </span>
                      )}

                      {lead.linkedinUrl && (
                        <a
                          href={lead.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          <span>LinkedIn Profile</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      <span className="font-mono text-[11px] text-slate-400">
                        Mail: {lead.mxProvider}
                      </span>
                    </div>
                  </div>

                  {/* Permutation Toggle & Matrix */}
                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPermutationsLeadId(isPermExpanded ? null : lead.id)
                      }
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>
                        {isPermExpanded
                          ? 'Hide 8-Pattern Permutation Ladder'
                          : `View 8 Permutation Formulas (${lead.permutations.length})`}
                      </span>
                      {isPermExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isPermExpanded && (
                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono animate-in fade-in duration-150">
                        {lead.permutations.map((perm, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() => handleCopyEmail(perm.email)}
                            className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                              perm.email === lead.primaryEmail
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                            }`}
                          >
                            <span className="truncate" title={perm.email}>
                              {perm.email}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1 shrink-0 font-sans">
                              {perm.confidenceScore}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Past Searches History Cards */}
      {allJobs.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-500" />
              <span>Past Algo Search Runs ({allJobs.length})</span>
            </h3>
            <span className="text-xs text-slate-400">
              Persisted in SQLite database & accessible across sessions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => setActiveJob(job)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  activeJob?.id === job.id
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 bg-slate-50/30 dark:bg-slate-800/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                      "{job.query.companyName || job.query.domain}"
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        job.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {job.leads.length} Leads
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    Domain: {job.domainInfo.domain || 'Resolved'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteJob(job.id);
                    }}
                    className="text-slate-400 hover:text-rose-500 text-[11px] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
