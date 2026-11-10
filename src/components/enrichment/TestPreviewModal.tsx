import React, { useState } from 'react';
import {
  X,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Crown,
  Mail,
  ShieldCheck,
  ExternalLink,
  Target,
  Filter,
} from 'lucide-react';
import { Contact, ScrapeSettings, IcpConfig, RuleEvaluationItem } from '../../types';
import {
  EmailClassificationBadge,
  DecisionMakerBadge,
  IcpFilterStatusBadge,
} from './LeadEnrichmentBadges';

interface TestPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUrl?: string;
  settings?: ScrapeSettings | null;
}

export const TestPreviewModal: React.FC<TestPreviewModalProps> = ({
  isOpen,
  onClose,
  defaultUrl = '',
  settings,
}) => {
  const [testUrl, setTestUrl] = useState(defaultUrl || 'https://example.com');
  const [customRules, setCustomRules] = useState(
    settings?.custom_rules ||
      'Find only company owners and founders\nProfessional personal email only\nVerify identity against team/about page'
  );
  const [companySize, setCompanySize] = useState('1-10');
  const [emailFilter, setEmailFilter] = useState<'all' | 'professional_only' | 'generic_only'>('professional_only');
  const [isLoading, setIsLoading] = useState(false);
  const [testResponse, setTestResponse] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunPreview = async () => {
    if (!testUrl.trim()) return;
    setIsLoading(true);
    setError(null);
    setTestResponse(null);

    try {
      const res = await fetch('/api/scrape/preview-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: testUrl.trim(),
          custom_rules: customRules,
          strict_icp_config: {
            enabled: true,
            strict_mode: true,
            preferred_company_sizes: companySize !== 'all' ? [companySize] : [],
            required_email_types:
              emailFilter === 'professional_only'
                ? ['Professional Personal Email']
                : emailFilter === 'generic_only'
                ? ['Generic Business Email']
                : undefined,
            min_icp_score: 50,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Preview failed');
      }

      const data = await res.json();
      setTestResponse(data);
    } catch (e: any) {
      setError(e.message || 'An error occurred during test extraction.');
    } finally {
      setIsLoading(false);
    }
  };

  const contacts: Contact[] = testResponse?.contacts || [];
  const website = testResponse?.website;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in-50">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Extraction & Strict Filter Preview Test</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Controls Bar */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/60 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">Target Website Domain</label>
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="e.g. stripe.com or abcsecurity.com"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">Company Size Filter</label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="1-10">1–10 employees</option>
                <option value="11-50">11–50 employees</option>
                <option value="51-200">51–200 employees</option>
                <option value="201-500">201–500 employees</option>
                <option value="all">Any Size</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">Email Classification Filter</label>
              <select
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="professional_only">Professional personal email only</option>
                <option value="all">All emails (Personal + Generic)</option>
                <option value="generic_only">Generic business emails only</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Active Custom AI Agent Rules:</span>
            </label>
            <textarea
              rows={2}
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleRunPreview}
              disabled={isLoading || !testUrl.trim()}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Crawling & Evaluating Rules...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>RUN TEST PREVIEW</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!testResponse && !isLoading && !error && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Target className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <div className="text-sm font-medium text-slate-400">Ready to test extraction</div>
            </div>
          )}

          {testResponse && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">Target Company</div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{website?.company_name || testUrl}</span>
                    <span className="text-xs font-mono text-blue-400 font-normal">{website?.url || testUrl}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Contacts Found</div>
                    <div className="text-sm font-bold text-white font-mono">{contacts.length}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">ICP Filter Status</div>
                    <div className="text-xs font-bold text-emerald-400">
                      {website?.icp_filter_status || 'EVALUATED'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Extracted Contacts Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-800/60 px-4 py-2 text-xs font-bold text-slate-300 border-b border-slate-800">
                  Extracted Contacts & Rule Compliance ({contacts.length})
                </div>

                {contacts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No contacts matched the active strict filters or were found on this domain.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 text-xs">
                    {contacts.map((c, i) => (
                      <div key={`contact-preview-${c.email || c.full_name || i}-${i}`} className="p-4 bg-slate-900/40 hover:bg-slate-800/40 transition-colors space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{c.full_name || c.email}</span>
                            <span className="text-slate-400 text-xs">— {c.role || 'Unspecified Role'}</span>
                            <DecisionMakerBadge
                              isDecisionMaker={c.is_decision_maker}
                              tier={c.decision_maker_tier}
                              score={c.decision_maker_score}
                              reasons={c.decision_maker_reasons}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <EmailClassificationBadge
                              type={c.email_type}
                              reason={c.email_classification_reason}
                              identityVerified={c.identity_verified}
                            />
                            <IcpFilterStatusBadge
                              status={c.icp_filter_status}
                              reasons={c.icp_exclusion_reasons || c.icp_inclusion_reasons}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
                          <div>
                            <span className="font-semibold text-slate-300">Email:</span>{' '}
                            <span className="font-mono text-blue-400">{c.email}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-300">Classification Reason:</span>{' '}
                            <span>{c.email_classification_reason || 'Exact deterministic match'}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-300">Identity Verification:</span>{' '}
                            <span className={c.identity_verified ? 'text-emerald-400' : 'text-slate-400'}>
                              {c.identity_verified ? 'Verified Person' : 'Unverified Person'}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-300">Decision-Maker Status:</span>{' '}
                            <span>{c.is_decision_maker ? `YES (${c.decision_maker_tier})` : 'NO'}</span>
                          </div>
                        </div>

                        {c.rule_evaluations && c.rule_evaluations.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                              Rule Evaluations by AI Agent:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {c.rule_evaluations.map((re, rIdx) => (
                                <span
                                  key={rIdx}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono border inline-flex items-center gap-1 ${
                                    re.status === 'FOLLOWED'
                                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                      : re.status === 'FAILED'
                                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  }`}
                                  title={re.detail}
                                >
                                  <span>{re.status}:</span>
                                  <span>{re.rule}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
