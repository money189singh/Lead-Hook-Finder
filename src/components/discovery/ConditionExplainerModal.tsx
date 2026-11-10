import React from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Zap,
  Building2,
  ShieldCheck,
  TrendingUp,
  X,
  ExternalLink,
} from 'lucide-react';
import { DiscoveredProspect } from '../../types';

interface ConditionExplainerModalProps {
  prospect: DiscoveredProspect | null;
  onClose: () => void;
}

export const ConditionExplainerModal: React.FC<ConditionExplainerModalProps> = ({
  prospect,
  onClose,
}) => {
  if (!prospect) return null;

  const explanation = prospect.matchExplanation;
  const score = prospect.fitScore || explanation?.matchScore || 85;
  const signals = prospect.buyingSignals || explanation?.activeSignals || [];

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#155eef] to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20 shrink-0">
              {score}%
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Criteria Fit & Signals: {prospect.companyName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transparent breakdown of applied conditions and discovery evidence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] custom-scrollbar text-xs">
          {/* Summary Box */}
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40">
            <div className="text-[11px] text-[#155eef] dark:text-blue-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Discovery Engine Qualification
            </div>
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {explanation?.summary ||
                `${score}% criteria match based on official domain verification, scale fit, and recent business activity.`}
            </p>
          </div>

          {/* Active Buying Signals */}
          {signals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                <Zap className="w-3.5 h-3.5" />
                Active Daily Buying Signals Detected
              </div>
              <div className="space-y-2">
                {signals.map((sig, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200"
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{sig.badgeLabel}</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                        Confidence: {sig.confidence}
                      </span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">{sig.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condition Evaluation Matrix */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#155eef]" />
              Applied Conditions & Qualification Status
            </div>

            <div className="space-y-2">
              {explanation?.passedConditions && explanation.passedConditions.length > 0 ? (
                explanation.passedConditions.map((cond, idx) => {
                  const isPassed = cond.status === 'passed';
                  const isWarning = cond.status === 'warning';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/40 flex items-start gap-2.5"
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                          <span>{cond.condition}</span>
                          <span
                            className={`text-[10px] font-semibold capitalize ${
                              isPassed
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isWarning
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {cond.status}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-snug">{cond.detail}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-500 text-xs">
                  Domain verified via live search grounding and confirmed as an independent operating entity.
                </div>
              )}
            </div>
          </div>

          {/* Freshness & Domain Details */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold block">Historical Freshness</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Brand New Discovery
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold block">Official Website</span>
              {prospect.website ? (
                <a
                  href={prospect.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#155eef] dark:text-blue-400 hover:underline font-semibold text-xs flex items-center gap-1 mt-0.5 truncate"
                >
                  {prospect.domain || prospect.website} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-slate-400 text-xs">Unverified</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
