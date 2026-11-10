import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { EmailVerificationResult, EmailVerificationStatus } from '../../types';

interface EmailVerificationBadgeProps {
  status?: EmailVerificationStatus;
  result?: EmailVerificationResult;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export const EmailVerificationBadge: React.FC<EmailVerificationBadgeProps> = ({
  status = 'Not checked',
  result,
  onClick,
  size = 'md',
}) => {
  const currentStatus = result?.verification_status || status;

  const config = {
    Valid: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200/80 dark:border-emerald-800/40',
      icon: CheckCircle2,
      label: 'Valid',
      title: result?.verification_details?.reason || 'Syntax valid, active MX records confirmed',
    },
    Invalid: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200/80 dark:border-rose-800/40',
      icon: XCircle,
      label: 'Invalid',
      title: result?.verification_error || 'Syntax malformed or domain lacks mail servers',
    },
    Risky: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200/80 dark:border-amber-800/40',
      icon: AlertTriangle,
      label: 'Risky',
      title: result?.verification_error || 'Disposable domain or high bounce risk',
    },
    Unknown: {
      bg: 'bg-slate-100 dark:bg-slate-800/60',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      icon: HelpCircle,
      label: 'Unknown',
      title: result?.verification_error || 'DNS timeout or inconclusive network response',
    },
    'Not checked': {
      bg: 'bg-blue-50/50 dark:bg-blue-950/20',
      text: 'text-slate-500 dark:text-slate-400',
      border: 'border-blue-100 dark:border-blue-900/30',
      icon: Clock,
      label: 'Not Checked',
      title: 'Click to verify this email address',
    },
  }[currentStatus] || {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: Clock,
    label: currentStatus,
    title: '',
  };

  const Icon = config.icon;
  const isClickable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      title={config.title}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border transition-all ${config.bg} ${config.text} ${config.border} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } ${isClickable ? 'cursor-pointer hover:shadow-xs hover:brightness-95' : 'cursor-default'}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
      {typeof result?.deliverability_score === 'number' && (
        <span
          className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/10 dark:bg-white/15 font-semibold"
          title={`Deliverability Score: ${result.deliverability_score}% | Bounce Probability: ${result.bounce_probability || 'N/A'}`}
        >
          {result.deliverability_score}%
        </span>
      )}
      {result && result.is_catch_all && (
        <span
          className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono"
          title="Catch-all domain: accepts all mailboxes (high bounce hazard)"
        >
          Catch-All
        </span>
      )}
      {result && (result.is_role_account || result.verification_details?.is_role_account) && (
        <span
          className="text-[9px] px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono"
          title={`Role Account: ${result.verification_details?.role_department || 'General'}`}
        >
          Role
        </span>
      )}
    </button>
  );
};
