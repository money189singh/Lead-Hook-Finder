import React from 'react';
import {
  Building2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Coins,
  History,
  PlusCircle,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import { VerificationJobStatus, VerificationCreditSettings } from '../../types';

interface VerifierDashboardProps {
  status: VerificationJobStatus | null;
  creditSettings: VerificationCreditSettings | null;
  totalCompaniesCount: number;
  onOpenCreditHistory: () => void;
  onOpenAddCredits: () => void;
  onOpenRules: () => void;
}

export const VerifierDashboard: React.FC<VerifierDashboardProps> = ({
  status,
  creditSettings,
  totalCompaniesCount,
  onOpenCreditHistory,
  onOpenAddCredits,
  onOpenRules,
}) => {
  const openCount = status?.open_count || 0;
  const tempClosedCount = status?.temporarily_closed_count || 0;
  const permClosedCount = status?.permanently_closed_count || 0;
  const uncertainCount = status?.uncertain_count || 0;
  const processedCount = status?.processed || 0;
  const availableCredits = creditSettings?.available_credits ?? 10000;

  const apiUsage = status?.api_usage || {
    google_maps_calls: 0,
    search_calls: 0,
    gov_calls: 0,
    ai_calls: 0,
    api_errors: 0,
    fallback_events: 0,
  };

  return (
    <div className="space-y-3.5">
      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Target Businesses */}
        <div className="glass-card glass-reflection rounded-2xl p-4 transition-all hover:translate-y-[-1px]">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Businesses</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {processedCount} <span className="text-xs font-normal text-slate-400">/ {totalCompaniesCount}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Workspace total</div>
        </div>

        {/* OPEN (Operating) */}
        <div className="glass-card glass-reflection rounded-2xl p-4 transition-all hover:translate-y-[-1px]">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-semibold">Open</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{openCount}</div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">Lead: KEEP</div>
        </div>

        {/* Temporarily Closed */}
        <div className="glass-card glass-reflection rounded-2xl p-4 transition-all hover:translate-y-[-1px]">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-semibold">Temp Closed</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">{tempClosedCount}</div>
          <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1 font-medium">Recheck in 14d</div>
        </div>

        {/* Permanently Closed */}
        <div className="glass-card glass-reflection rounded-2xl p-4 transition-all hover:translate-y-[-1px]">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
            <span className="text-xs font-semibold">Perm Closed</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">{permClosedCount}</div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">Lead: SKIP</div>
        </div>

        {/* Uncertain */}
        <div className="glass-card glass-reflection rounded-2xl p-4 transition-all hover:translate-y-[-1px]">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
            <span className="text-xs font-semibold">Uncertain</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">{uncertainCount}</div>
          <div className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1 font-medium">Zero-guesswork</div>
        </div>

        {/* Available Credits Card */}
        <div className="glass-card glass-reflection rounded-2xl p-4 border-purple-200/80 dark:border-purple-800/40 bg-gradient-to-br from-purple-50/40 via-white to-indigo-50/30 dark:from-purple-950/40 dark:via-[#161426] dark:to-indigo-950/30 transition-all hover:translate-y-[-1px]">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-2">
            <span className="text-xs font-semibold">Credits Left</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-500">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {availableCredits.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">pts</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onOpenAddCredits}
              className="text-[11px] px-2.5 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3 h-3" />
              Add
            </button>
            <button
              onClick={onOpenCreditHistory}
              className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <History className="w-3 h-3" />
              Log
            </button>
          </div>
        </div>
      </div>

      {/* API Usage & Verification Rules Strip */}
      <div className="glass-card glass-reflection rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-5 flex-wrap text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>API Execution Meter:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Maps:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{apiUsage.google_maps_calls}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Search:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{apiUsage.search_calls}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Gov Registry:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{apiUsage.gov_calls}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">AI Synthesizer:</span>
            <span className="font-semibold text-purple-600 dark:text-purple-300">{apiUsage.ai_calls}</span>
            <span className="text-[10px] text-slate-400">(Conflict only)</span>
          </div>
          {apiUsage.fallback_events > 0 && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <span>Fallbacks:</span>
              <span className="font-bold">{apiUsage.fallback_events}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRules}
            className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Verification Rules</span>
          </button>
        </div>
      </div>
    </div>
  );
};
