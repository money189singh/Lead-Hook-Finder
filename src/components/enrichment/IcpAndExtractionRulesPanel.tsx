import React, { useState } from 'react';
import {
  Filter,
  Sparkles,
  Crown,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  ChevronDown,
  ChevronUp,
  Plus,
  Play,
  RotateCcw,
  Check,
  Building2,
  Users2,
  Target,
} from 'lucide-react';
import { ScrapeSettings, IcpConfig } from '../../types';

interface IcpAndExtractionRulesPanelProps {
  settings?: ScrapeSettings | null;
  onUpdateSettings: (newSettings: Partial<ScrapeSettings>) => Promise<any>;
  onOpenTestPreview: () => void;
  onOpenTestSuite: () => void;
  disabled?: boolean;
}

const PRESET_RULES = [
  'Find only company owners and founders',
  'Professional personal email only (exclude generic info@/contact@)',
  'Exclude personal email providers (gmail/yahoo/hotmail)',
  'Verify leadership identity against team/about page',
  'Extract verified direct phone numbers when available',
];

export const IcpAndExtractionRulesPanel: React.FC<IcpAndExtractionRulesPanelProps> = ({
  settings,
  onUpdateSettings,
  onOpenTestPreview,
  onOpenTestSuite,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // ICP config local states
  const icpConfig: IcpConfig = settings?.icp_config || {
    enabled: true,
    strict_mode: false,
    target_roles: [
      'CEO',
      'Founder',
      'Owner',
      'Managing Partner',
      'Partner',
      'Managing Director',
      'Director',
      'Director of Legal Services',
      'Managing Attorney',
      'Attorney',
      'Lawyer',
      'General Counsel',
      'President',
      'VP',
    ],
    target_industries: [],
    preferred_company_sizes: ['1-10', '11-50', '51-200'],
    min_icp_score: 50,
    weights: { roleWeight: 40, industryWeight: 20, companySizeWeight: 15, emailTypeWeight: 15, socialWeight: 10 },
  };

  const strictMode = icpConfig.strict_mode !== false;
  const unknownPolicy = icpConfig.unknown_policy || 'mark_unverified';
  const preferredSizes = icpConfig.preferred_company_sizes || ['1-10'];
  const emailFilterMode = settings?.email_filter_mode || 'professional_only';

  const customRules = settings?.custom_rules || (settings as any)?.ai_agent_rules || '';

  const handleToggleStrictMode = (enabled: boolean) => {
    onUpdateSettings({
      strict_icp_mode: enabled,
      icp_config: {
        ...icpConfig,
        strict_mode: enabled,
      },
    });
  };

  const handleSetEmailFilterMode = (mode: 'all' | 'professional_only' | 'generic_only') => {
    const requiredTypes =
      mode === 'professional_only'
        ? (['Professional Personal Email'] as any)
        : mode === 'generic_only'
        ? (['Generic Business Email'] as any)
        : undefined;

    onUpdateSettings({
      email_filter_mode: mode,
      icp_config: {
        ...icpConfig,
        required_email_types: requiredTypes,
      },
    });
  };

  const handleToggleSize = (size: string) => {
    let updated: string[];
    if (preferredSizes.includes(size)) {
      updated = preferredSizes.filter((s) => s !== size);
    } else {
      updated = [...preferredSizes, size];
    }
    onUpdateSettings({
      icp_config: {
        ...icpConfig,
        preferred_company_sizes: updated,
      },
    });
  };

  const handleSetUnknownPolicy = (policy: 'include' | 'exclude' | 'mark_unverified') => {
    onUpdateSettings({
      icp_config: {
        ...icpConfig,
        unknown_policy: policy,
      },
    });
  };

  const handleAddPresetRule = (rule: string) => {
    const current = customRules.trim();
    if (current.includes(rule)) return;
    const next = current ? `${current}\n${rule}` : rule;
    onUpdateSettings({
      custom_rules: next,
      ai_agent_rules: next,
    });
  };

  const handleRulesChange = (val: string) => {
    onUpdateSettings({
      custom_rules: val,
      ai_agent_rules: val,
    });
  };

  // Active rules count
  const activeRuleLines = customRules
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !r.startsWith('#'));

  return (
    <div className="glass-card rounded-2xl p-5 border border-blue-100/80 dark:border-blue-900/30 space-y-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Strict ICP Filters & AI Agent Rules
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  strictMode
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}
              >
                {strictMode ? 'STRICT ENFORCEMENT ON' : 'SUGGESTION MODE'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenTestPreview}
            disabled={disabled}
            className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Play className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span>Test Single URL</span>
          </button>

          <button
            type="button"
            onClick={onOpenTestSuite}
            disabled={disabled}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Verification Suite</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-blue-100/60 dark:border-blue-900/20 text-xs">
          {/* Section 1: Strict ICP Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5 bg-blue-50/40 dark:bg-[#0f1424]/40 rounded-xl border border-blue-100/70 dark:border-blue-900/30">
            {/* 1. Email Classification Filter */}
            <div className="space-y-2">
              <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                <span>Email Classification Filter:</span>
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="emailFilterMode"
                    value="professional_only"
                    checked={emailFilterMode === 'professional_only'}
                    onChange={() => handleSetEmailFilterMode('professional_only')}
                    disabled={disabled}
                    className="text-[#155eef]"
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    Professional personal email only
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="emailFilterMode"
                    value="all"
                    checked={emailFilterMode === 'all'}
                    onChange={() => handleSetEmailFilterMode('all')}
                    disabled={disabled}
                    className="text-[#155eef]"
                  />
                  <span className="text-slate-600 dark:text-slate-400">All emails (Personal + Generic)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="emailFilterMode"
                    value="generic_only"
                    checked={emailFilterMode === 'generic_only'}
                    onChange={() => handleSetEmailFilterMode('generic_only')}
                    disabled={disabled}
                    className="text-[#155eef]"
                  />
                  <span className="text-slate-600 dark:text-slate-400">Generic business emails only</span>
                </label>
              </div>
            </div>

            {/* 2. Company Size (Employee Count) */}
            <div className="space-y-2">
              <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                <Users2 className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span>Company Size (Employee Range):</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['1-10', '11-50', '51-200', '201-500', '500+'].map((sz) => {
                  const isSel = preferredSizes.includes(sz);
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleToggleSize(sz)}
                      disabled={disabled}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-purple-400'
                      }`}
                    >
                      {sz} emp
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Unknown Policy & Strict Enforcement */}
            <div className="space-y-2">
              <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Enforcement & Unknowns:</span>
              </label>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => handleToggleStrictMode(e.target.checked)}
                    disabled={disabled}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Hard ICP Enforcement
                  </span>
                </label>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500">Unverified employee policy:</div>
                  <select
                    value={unknownPolicy}
                    onChange={(e) => handleSetUnknownPolicy(e.target.value as any)}
                    disabled={disabled}
                    className="w-full px-2 py-1 glass-input rounded-lg text-xs"
                  >
                    <option value="mark_unverified">Mark as Unknown & include with warning</option>
                    <option value="exclude">Strictly Exclude Unknowns</option>
                    <option value="include">Allow Unknowns</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Custom AI Agent Extraction Rules */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-slate-800 dark:text-slate-200 font-bold flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Custom AI Agent Extraction Rules</span>
              </label>
              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                {activeRuleLines.length} active rule{activeRuleLines.length === 1 ? '' : 's'}
              </div>
            </div>

            {/* Quick Rule Presets Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 mr-1">Add rule:</span>
              {PRESET_RULES.map((preset, pIdx) => (
                <button
                  key={`preset-${pIdx}-${preset}`}
                  type="button"
                  onClick={() => handleAddPresetRule(preset)}
                  disabled={disabled}
                  className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/40 hover:bg-blue-100 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>{preset.split('(')[0].trim()}</span>
                </button>
              ))}
            </div>

            {/* Rules Textarea */}
            <textarea
              rows={3}
              value={customRules}
              onChange={(e) => handleRulesChange(e.target.value)}
              disabled={disabled}
              placeholder={`Enter one extraction rule per line.\nExample:\nFind only company owners and founders\nProfessional personal email only\nVerify leadership identity against team page`}
              className="w-full p-3 glass-input rounded-xl text-xs font-mono placeholder-slate-400 dark:placeholder-slate-600 leading-relaxed disabled:opacity-60"
            />

            {/* Active Rules Display Pills */}
            {activeRuleLines.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Active Rules:</span>
                {activeRuleLines.map((rule, idx) => (
                  <span
                    key={`active-rule-${idx}-${rule}`}
                    className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/25 text-[10px] font-mono inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 text-purple-400" />
                    <span>{rule}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
