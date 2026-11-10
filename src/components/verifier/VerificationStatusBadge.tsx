import React from 'react';
import {
  BusinessStatus,
  StatusConfidence,
  LeadEligibility,
} from '../../types';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, ShieldAlert } from 'lucide-react';

interface VerificationStatusBadgeProps {
  status?: BusinessStatus;
  confidence?: StatusConfidence;
  leadEligibility?: LeadEligibility;
  showConfidence?: boolean;
  showEligibility?: boolean;
}

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  confidence,
  leadEligibility,
  showConfidence = true,
  showEligibility = false,
}) => {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-purple-950/30 dark:text-slate-400 dark:border-purple-900/30">
        <HelpCircle className="w-3 h-3 text-slate-400" />
        Unverified
      </span>
    );
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'OPEN':
        return {
          icon: CheckCircle,
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-300',
          dot: 'bg-emerald-500',
          label: 'OPEN',
        };
      case 'TEMPORARILY CLOSED':
        return {
          icon: AlertTriangle,
          bg: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-500/30 dark:text-amber-300',
          dot: 'bg-amber-500',
          label: 'TEMP CLOSED',
        };
      case 'PERMANENTLY CLOSED':
        return {
          icon: XCircle,
          bg: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-300',
          dot: 'bg-rose-500',
          label: 'PERM CLOSED',
        };
      case 'UNCERTAIN':
      default:
        return {
          icon: ShieldAlert,
          bg: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:border-purple-500/30 dark:text-purple-300',
          dot: 'bg-purple-500',
          label: 'UNCERTAIN',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const getConfidenceBadge = () => {
    if (!confidence) return null;
    switch (confidence) {
      case 'HIGH':
        return <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">High Conf</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-300">Med Conf</span>;
      case 'LOW':
        return <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Low Conf</span>;
    }
  };

  const getEligibilityBadge = () => {
    if (!leadEligibility) return null;
    switch (leadEligibility) {
      case 'KEEP':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30">
            KEEP
          </span>
        );
      case 'SKIP':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30">
            SKIP
          </span>
        );
      case 'VERIFY':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/30">
            VERIFY
          </span>
        );
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${config.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
      {showConfidence && confidence && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900/40 shadow-xs">
          {getConfidenceBadge()}
        </span>
      )}
      {showEligibility && leadEligibility && getEligibilityBadge()}
    </div>
  );
};
