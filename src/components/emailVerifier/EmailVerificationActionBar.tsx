import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  RefreshCw,
  Play,
  RotateCcw,
  Square,
  CheckSquare,
  AlertCircle,
  Server,
  Zap,
} from 'lucide-react';
import { EmailVerificationStatus, EmailVerifierStatusResponse } from '../../types';

interface EmailVerificationActionBarProps {
  totalEmails: number;
  selectedCount: number;
  unverifiedCount: number;
  validCount: number;
  invalidCount: number;
  riskyCount: number;
  unknownCount: number;
  currentFilter: EmailVerificationStatus | 'All';
  onFilterChange: (status: EmailVerificationStatus | 'All') => void;
  onVerifySelected: (checkSmtp: boolean) => Promise<void>;
  onVerifyUnverified: (checkSmtp: boolean) => Promise<void>;
  onReverifyAll: (checkSmtp: boolean) => Promise<void>;
  onRetryUnknown: (checkSmtp: boolean) => Promise<void>;
  isVerifying: boolean;
  progressPercent?: number;
  progressText?: string;
  onCancelJob?: () => void;
  smtpStatus?: EmailVerifierStatusResponse | null;
}

export const EmailVerificationActionBar: React.FC<EmailVerificationActionBarProps> = ({
  totalEmails,
  selectedCount,
  unverifiedCount,
  validCount,
  invalidCount,
  riskyCount,
  unknownCount,
  currentFilter,
  onFilterChange,
  onVerifySelected,
  onVerifyUnverified,
  onReverifyAll,
  onRetryUnknown,
  isVerifying,
  progressPercent = 0,
  progressText = '',
  onCancelJob,
  smtpStatus,
}) => {
  const [includeSmtp, setIncludeSmtp] = useState(false);

  return (
    <div className="rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-blue-50/40 dark:from-[#0f1424]/90 dark:via-[#13172e]/90 dark:to-[#0f1424]/90 p-4 space-y-3 shadow-xs">
      {/* Top Row: Title, Action Buttons, and SMTP Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title and Badge */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#155eef] to-blue-700 text-white shadow-xs shadow-blue-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Self-Hosted Email Verification
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40">
                100% Free / Zero Credits
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Deterministic RFC 5322 syntax validation, direct DNS MX lookup with A-fallback, and disposable detection.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* SMTP Probe Toggle */}
          <label
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#101730] border border-blue-200/70 dark:border-blue-800/30 text-xs text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs select-none hover:bg-white dark:hover:bg-[#162044] transition-colors"
            title={
              smtpStatus?.smtp_available === false
                ? 'Outbound port 25 is restricted by cloud host firewall; DNS MX records provide full deliverability assurance.'
                : 'Directly probe target mail server port 25 (if enabled)'
            }
          >
            <input
              type="checkbox"
              checked={includeSmtp}
              onChange={(e) => setIncludeSmtp(e.target.checked)}
              disabled={isVerifying}
              className="w-3.5 h-3.5 rounded text-[#155eef] focus:ring-0 cursor-pointer"
            />
            <Server className="w-3 h-3 text-slate-400" />
            <span className="text-[11px] font-medium">SMTP Probing</span>
            {smtpStatus?.smtp_available === false && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono">
                Port 25 blocked
              </span>
            )}
          </label>

          {/* Verify Selected */}
          <button
            type="button"
            onClick={() => onVerifySelected(includeSmtp)}
            disabled={selectedCount === 0 || isVerifying}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>VERIFY SELECTED ({selectedCount})</span>
          </button>

          {/* Verify Unverified */}
          <button
            type="button"
            onClick={() => onVerifyUnverified(includeSmtp)}
            disabled={unverifiedCount === 0 || isVerifying}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-40 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Verify all new and unverified emails"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>VERIFY UNVERIFIED ({unverifiedCount})</span>
          </button>

          {/* Retry Unknown / Timeout */}
          {unknownCount > 0 && (
            <button
              type="button"
              onClick={() => onRetryUnknown(includeSmtp)}
              disabled={isVerifying}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-50 dark:bg-[#101730] dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              title="Retry DNS timeouts and inconclusive addresses"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RETRY UNKNOWN ({unknownCount})</span>
            </button>
          )}

          {/* Reverify All */}
          <button
            type="button"
            onClick={() => onReverifyAll(includeSmtp)}
            disabled={totalEmails === 0 || isVerifying}
            className="p-1.5 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-40 text-slate-500 dark:text-slate-400 hover:text-[#155eef] border border-blue-200/80 dark:border-blue-800/40 transition-colors cursor-pointer shadow-xs"
            title="Force re-verify all emails (bypass cache)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Real-Time Progress Bar (if verifying) */}
      {isVerifying && (
        <div className="p-3 rounded-xl bg-white/90 dark:bg-[#0c1226] border border-blue-200/80 dark:border-blue-800/40 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#155eef] animate-spin" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Verifying Emails...
              </span>
              <span className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
                {progressText}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-[#155eef] dark:text-blue-400">
                {progressPercent}%
              </span>
              {onCancelJob && (
                <button
                  type="button"
                  onClick={onCancelJob}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#155eef] to-emerald-500 transition-all duration-300"
              style={{ width: `${Math.max(3, progressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Row: Filter Pills with Counts */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-blue-100/70 dark:border-blue-900/30 text-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
          Filter By Status:
        </span>

        <button
          type="button"
          onClick={() => onFilterChange('All')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
            currentFilter === 'All'
              ? 'bg-[#155eef] text-white shadow-xs'
              : 'bg-white/80 dark:bg-[#101730] text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-[#162044] border border-blue-100 dark:border-blue-900/30'
          }`}
        >
          All ({totalEmails})
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('Valid')}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            currentFilter === 'Valid'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white/80 dark:bg-[#101730] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/30'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Valid ({validCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('Invalid')}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            currentFilter === 'Invalid'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white/80 dark:bg-[#101730] text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/30'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Invalid ({invalidCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('Risky')}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            currentFilter === 'Risky'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white/80 dark:bg-[#101730] text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/30'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Risky ({riskyCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('Unknown')}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            currentFilter === 'Unknown'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-white/80 dark:bg-[#101730] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Unknown ({unknownCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('Not checked')}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            currentFilter === 'Not checked'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white/80 dark:bg-[#101730] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Not Checked ({unverifiedCount})</span>
        </button>
      </div>
    </div>
  );
};
