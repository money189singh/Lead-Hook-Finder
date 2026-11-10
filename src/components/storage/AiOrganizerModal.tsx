import React, { useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  Users,
  ShieldCheck,
  Building,
  Target,
  ArrowRight,
  Download,
  AlertCircle,
  TrendingUp,
  Award,
  Layers,
} from 'lucide-react';

interface AiOrganizerSummary {
  summary: string;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  decision_makers_percent: number;
  verified_emails_percent: number;
  top_industries: string[];
  recommended_outreach: string;
}

interface AiOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  isOrganizing: boolean;
  summary: AiOrganizerSummary | null;
  totalProcessed?: number;
  duplicatesRemoved?: number;
  onViewData: () => void;
  onExportXlsx?: () => void;
}

export const AiOrganizerModal: React.FC<AiOrganizerModalProps> = ({
  isOpen,
  onClose,
  datasetName,
  isOrganizing,
  summary,
  totalProcessed = 0,
  duplicatesRemoved = 0,
  onViewData,
  onExportXlsx,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden relative">
        {/* Header Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-pink-500/10 via-indigo-500/10 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/25">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>AI Data Organizer</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/50">
                  SQL Indexed
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm">
                "{datasetName}"
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {isOrganizing ? (
            <div className="py-12 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-full border-4 border-pink-200 dark:border-pink-900 border-t-pink-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-pink-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                AI Organizing & Normalizing Dataset...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Standardizing company nomenclature, validating phone numbers, classifying role tiers, and scoring commercial intent.
              </p>
            </div>
          ) : summary ? (
            <div className="space-y-5">
              {/* Executive Summary Card */}
              <div className="bg-gradient-to-r from-pink-50/60 via-indigo-50/40 to-blue-50/40 dark:from-pink-950/20 dark:via-indigo-950/20 dark:to-blue-950/20 border border-pink-200/80 dark:border-pink-800/40 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-pink-800 dark:text-pink-300">
                  <TrendingUp className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                  <span>Executive AI Synthesis</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {summary.summary}
                </p>
              </div>

              {/* Tier Metrics Breakdown */}
              <div>
                <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Commercial ICP Tier Distribution</span>
                </h5>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
                      Tier 1 • High Intent
                    </span>
                    <span className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
                      {summary.tier1_count}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
                      Executive / Decision Makers
                    </span>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-0.5">
                      Tier 2 • Growth Fit
                    </span>
                    <span className="text-xl font-bold text-blue-800 dark:text-blue-200">
                      {summary.tier2_count}
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5 font-medium">
                      Mid-Market Commercial
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                      Tier 3 • Standard
                    </span>
                    <span className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      {summary.tier3_count}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 font-medium">
                      SMB Directory Leads
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Quality & Deduplication Stats */}
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[10px] block">Verified Emails</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {summary.verified_emails_percent}%
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[10px] block">Decision Makers</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {summary.decision_makers_percent}%
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-pink-500 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[10px] block">Duplicates Merged</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {duplicatesRemoved} records
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommended Sales Action */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  💡 Actionable Sales Playbook
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {summary.recommended_outreach}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {onExportXlsx && summary && (
              <button
                onClick={onExportXlsx}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export XLSX</span>
              </button>
            )}

            <button
              onClick={() => {
                onViewData();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 transition-all flex items-center gap-1.5 shadow-md shadow-pink-500/20"
            >
              <span>View Organized Leads</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
