import React, { useState } from 'react';
import { BusinessVerifierRules, VerificationCreditSettings } from '../../types';
import { SlidersHorizontal, ShieldCheck, Sparkles, Clock, Save, RotateCcw } from 'lucide-react';

interface VerifierRulesModalProps {
  rules: BusinessVerifierRules;
  creditSettings: VerificationCreditSettings;
  onClose: () => void;
  onSave: (rules: BusinessVerifierRules, creditSettings: VerificationCreditSettings) => Promise<void>;
}

export const VerifierRulesModal: React.FC<VerifierRulesModalProps> = ({
  rules: initialRules,
  creditSettings: initialCreditSettings,
  onClose,
  onSave,
}) => {
  const [rules, setRules] = useState<BusinessVerifierRules>({ ...initialRules });
  const [creditSettings, setCreditSettings] = useState<VerificationCreditSettings>({ ...initialCreditSettings });
  const [activeTab, setActiveTab] = useState<'instructions' | 'intervals' | 'pricing' | 'statusRules'>('instructions');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSavedMessage(null);
    try {
      await onSave(rules, creditSettings);
      setSavedMessage('Verification rules & credit settings saved successfully!');
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131122] border border-purple-100 dark:border-purple-900/40 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-100/80 dark:border-purple-900/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Business Verification Rules & Configuration</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Custom instructions, evidence rules, recheck intervals, and pricing</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 border-b border-purple-100/80 dark:border-purple-900/30 flex gap-2 shrink-0 bg-purple-50/30 dark:bg-[#181628]/40 text-xs font-semibold">
          {[
            { id: 'instructions', label: 'Instructions & Prompt' },
            { id: 'statusRules', label: 'Status & Confidence Criteria' },
            { id: 'intervals', label: 'Re-verification Intervals' },
            { id: 'pricing', label: 'Credit Costs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4">
          {activeTab === 'instructions' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-800 dark:text-slate-200 font-bold mb-1">
                  Verification System Instructions (Prompt Logic)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  High-level directives guiding evidence evaluation and zero-guesswork synthesis.
                </p>
                <textarea
                  rows={8}
                  value={rules.verification_instructions}
                  onChange={(e) => setRules({ ...rules, verification_instructions: e.target.value })}
                  className="w-full glass-input rounded-xl p-3 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-800 dark:text-slate-200 font-bold mb-1">
                  AI Usage Constraint
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  AI must never guess or fabricate operational status. AI is triggered exclusively on ambiguous/conflicting signals.
                </p>
                <textarea
                  rows={4}
                  value={rules.ai_usage_rules}
                  onChange={(e) => setRules({ ...rules, ai_usage_rules: e.target.value })}
                  className="w-full glass-input rounded-xl p-3 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {activeTab === 'statusRules' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 space-y-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">OPEN Rule Criteria</span>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  {(rules.status_rules as any)?.OPEN || 'Business verified active on website, directory, or maps.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 space-y-1">
                <span className="font-bold text-amber-600 dark:text-amber-400">TEMPORARILY CLOSED Rule Criteria</span>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  {(rules.status_rules as any)?.['TEMPORARILY CLOSED'] || 'Temporary closure notice or suspended operations within last 90 days.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 space-y-1">
                <span className="font-bold text-rose-600 dark:text-rose-400">PERMANENTLY CLOSED Rule Criteria</span>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  {(rules.status_rules as any)?.['PERMANENTLY CLOSED'] || 'Dissolved registry status, permanently closed on maps, and disconnected website.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 space-y-1">
                <span className="font-bold text-purple-600 dark:text-purple-400">UNCERTAIN Rule Criteria</span>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  {(rules.status_rules as any)?.UNCERTAIN || 'Conflicting signals or no verifiable corporate or directory records found.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'intervals' && (
            <div className="space-y-4">
              <div className="text-slate-500 dark:text-slate-400 text-xs">
                Configure automatic scheduled reverification intervals based on status outcome:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-[#181628]/40 border border-purple-100/80 dark:border-purple-900/30 space-y-2 shadow-xs">
                  <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">OPEN Recheck Interval</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={rules.reverification_intervals.open_days}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          reverification_intervals: {
                            ...rules.reverification_intervals,
                            open_days: Number(e.target.value) || 30,
                          },
                        })
                      }
                      className="w-20 glass-input rounded-lg p-2 font-bold text-center"
                    />
                    <span className="text-slate-500 dark:text-slate-400">Days</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181628]/40 border border-purple-100/80 dark:border-purple-900/30 space-y-2 shadow-xs">
                  <label className="text-xs font-bold text-amber-600 dark:text-amber-400">Temp Closed Recheck</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={rules.reverification_intervals.temporarily_closed_days}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          reverification_intervals: {
                            ...rules.reverification_intervals,
                            temporarily_closed_days: Number(e.target.value) || 14,
                          },
                        })
                      }
                      className="w-20 glass-input rounded-lg p-2 font-bold text-center"
                    />
                    <span className="text-slate-500 dark:text-slate-400">Days</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181628]/40 border border-purple-100/80 dark:border-purple-900/30 space-y-2 shadow-xs">
                  <label className="text-xs font-bold text-purple-600 dark:text-purple-400">Uncertain Recheck</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={rules.reverification_intervals.uncertain_days}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          reverification_intervals: {
                            ...rules.reverification_intervals,
                            uncertain_days: Number(e.target.value) || 7,
                          },
                        })
                      }
                      className="w-20 glass-input rounded-lg p-2 font-bold text-center"
                    />
                    <span className="text-slate-500 dark:text-slate-400">Days</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="text-slate-500 dark:text-slate-400 text-xs">
                Configure credit deduction rates per verified business for each tier:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-[#181628]/40 border border-purple-100/80 dark:border-purple-900/30 space-y-2 shadow-xs">
                  <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400">LOW Level Cost</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={creditSettings.low_cost ?? creditSettings.cost_per_level?.LOW ?? 0.5}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0.5;
                        setCreditSettings({
                          ...creditSettings,
                          low_cost: val,
                          cost_per_level: {
                            ...(creditSettings.cost_per_level || {}),
                            LOW: val,
                          },
                        });
                      }}
                      className="w-24 glass-input rounded-lg p-2 font-bold text-center"
                    />
                    <span className="text-slate-500 dark:text-slate-400">Credits</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181628]/40 border border-purple-100/80 dark:border-purple-900/30 space-y-2 shadow-xs">
                  <label className="text-xs font-bold text-purple-600 dark:text-purple-400">MEDIUM Level Cost</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={creditSettings.medium_cost ?? creditSettings.cost_per_level?.MEDIUM ?? 1.0}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 1.0;
                        setCreditSettings({
                          ...creditSettings,
                          medium_cost: val,
                          cost_per_level: {
                            ...(creditSettings.cost_per_level || {}),
                            MEDIUM: val,
                          },
                        });
                      }}
                      className="w-24 glass-input rounded-lg p-2 font-bold text-center"
                    />
                    <span className="text-slate-500 dark:text-slate-400">Credits</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#181628]/40 border border-purple-100/80 dark:border-purple-900/30 space-y-2 shadow-xs">
                  <label className="text-xs font-bold text-purple-700 dark:text-purple-300">HIGH Level Cost</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={creditSettings.high_cost ?? creditSettings.cost_per_level?.HIGH ?? 2.0}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 2.0;
                        setCreditSettings({
                          ...creditSettings,
                          high_cost: val,
                          cost_per_level: {
                            ...(creditSettings.cost_per_level || {}),
                            HIGH: val,
                          },
                        });
                      }}
                      className="w-24 glass-input rounded-lg p-2 font-bold text-center"
                    />
                    <span className="text-slate-500 dark:text-slate-400">Credits</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {savedMessage && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 px-3 py-2 rounded-xl">
              {savedMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-purple-100/80 dark:border-purple-900/30 bg-purple-50/20 dark:bg-[#151325]/80 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Rules & Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
