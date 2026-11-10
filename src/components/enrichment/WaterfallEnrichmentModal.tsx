import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Phone,
  Mail,
  Linkedin,
  Globe,
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Server,
  RefreshCw,
} from 'lucide-react';
import { Contact, WaterfallEnrichmentResult } from '../../types';

interface WaterfallEnrichmentModalProps {
  isOpen: boolean;
  contact: Contact | null;
  onClose: () => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onEnriched: (updatedContact: Contact) => void;
}

export const WaterfallEnrichmentModal: React.FC<WaterfallEnrichmentModalProps> = ({
  isOpen,
  contact,
  onClose,
  onShowToast,
  onEnriched,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [waterfallResult, setWaterfallResult] = useState<WaterfallEnrichmentResult | null>(null);

  if (!isOpen || !contact) return null;

  const handleStartWaterfall = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/waterfall/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Waterfall enrichment failed');
      }

      const result: WaterfallEnrichmentResult = await res.json();
      setWaterfallResult(result);

      // Merge into contact
      const updated: Contact = {
        ...contact,
        email: result.enrichedFields.verified_email || contact.email,
        phone: result.enrichedFields.direct_phone || contact.phone,
        phone_type: result.enrichedFields.phone_type,
        tech_stack: result.enrichedFields.tech_stack || contact.tech_stack,
        linkedin_url: result.enrichedFields.linkedin_url || contact.linkedin_url,
        waterfall_status: 'enriched',
      };

      onEnriched(updated);
      onShowToast('Waterfall Enrichment successfully completed!', 'success');
    } catch (e: any) {
      onShowToast(e.message || 'Waterfall failed', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="glass-card relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0c1322] border border-blue-200/80 dark:border-blue-900/40 shadow-2xl overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Waterfall Decision-Maker & Phone Enrichment
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {/* Target Profile Card */}
        <div className="my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {contact.full_name || 'Prospect'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {contact.role || 'Executive'} &bull; {contact.company_name}
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-mono">
              {contact.website || 'No website URL'}
            </div>
          </div>

          <button
            onClick={handleStartWaterfall}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-all"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Waterfall...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Enrich Now</span>
              </>
            )}
          </button>
        </div>

        {/* 4-Step Waterfall Visualization */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Waterfall Execution Pipeline
          </h3>

          <div className="space-y-2">
            {[
              {
                step: 1,
                title: 'Domain & Tech Stack Discovery',
                desc: 'Scans DNS, CMS, analytics, CRM & payment signatures',
                icon: Globe,
                resStep: waterfallResult?.steps[0],
              },
              {
                step: 2,
                title: 'Decision Maker & Identity Validation',
                desc: 'Matches C-suite and VP executive hierarchy from web signals',
                icon: ShieldCheck,
                resStep: waterfallResult?.steps[1],
              },
              {
                step: 3,
                title: 'Corporate Email Permutation & MX Check',
                desc: 'Generates 6 B2B format patterns and validates mail exchanger records',
                icon: Mail,
                resStep: waterfallResult?.steps[2],
              },
              {
                step: 4,
                title: 'Direct Dial Phone & Social Profile Mapping',
                desc: 'Normalizes direct/mobile lines and matches direct LinkedIn URLs',
                icon: Phone,
                resStep: waterfallResult?.steps[3],
              },
            ].map((st) => {
              const Icon = st.icon;
              const isComplete = Boolean(st.resStep?.status === 'success');

              return (
                <div
                  key={st.step}
                  className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isComplete
                      ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isComplete
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {st.step}. {st.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{st.desc}</div>
                      {st.resStep?.details && (
                        <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          &bull; {st.resStep.details}
                        </div>
                      )}
                    </div>
                  </div>

                  {isComplete ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Ready</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enriched Attributes Preview */}
        {waterfallResult && (
          <div className="mt-4 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/30">
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Enrichment Highlights</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Verified Email:</span>{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {waterfallResult.enrichedFields.verified_email || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Phone ({waterfallResult.enrichedFields.phone_type}):</span>{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {waterfallResult.enrichedFields.direct_phone || 'N/A'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 dark:text-slate-400">Tech Stack:</span>{' '}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {waterfallResult.enrichedFields.tech_stack?.join(', ') || 'Standard web stack'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
