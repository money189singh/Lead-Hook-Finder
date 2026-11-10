import React, { useState } from 'react';
import {
  Target,
  Sliders,
  Award,
  Building2,
  Briefcase,
  Check,
  Plus,
  X,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { IcpConfig, RoleTier } from '../../types';

interface IcpSettingsCardProps {
  config: IcpConfig;
  onChange: (config: IcpConfig) => void;
  onSave?: () => void;
  saving?: boolean;
}

const PRESET_INDUSTRIES = [
  'SaaS / Cloud Software',
  'E-Commerce & Retail',
  'Financial Services & Fintech',
  'Healthcare & Biotech',
  'Manufacturing & Industrial',
  'Consulting & Professional Services',
  'Marketing & Advertising',
  'Real Estate & Construction',
];

const EMPLOYEE_TIERS = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export const IcpSettingsCard: React.FC<IcpSettingsCardProps> = ({
  config,
  onChange,
  onSave,
  saving = false,
}) => {
  const [newIndustry, setNewIndustry] = useState('');
  const [newRole, setNewRole] = useState('');

  const toggleSize = (tier: string) => {
    const current = config.preferred_company_sizes || [];
    const updated = current.includes(tier)
      ? current.filter((s) => s !== tier)
      : [...current, tier];
    onChange({
      ...config,
      preferred_company_sizes: updated,
    });
  };

  const addIndustry = (ind: string) => {
    const trimmed = ind.trim();
    if (!trimmed) return;
    const current = config.target_industries || [];
    if (!current.includes(trimmed)) {
      onChange({
        ...config,
        target_industries: [...current, trimmed],
      });
    }
    setNewIndustry('');
  };

  const removeIndustry = (ind: string) => {
    onChange({
      ...config,
      target_industries: (config.target_industries || []).filter((i) => i !== ind),
    });
  };

  const addRole = () => {
    const trimmed = newRole.trim();
    if (!trimmed) return;
    const current = config.target_roles || [];
    if (!current.includes(trimmed)) {
      onChange({
        ...config,
        target_roles: [...current, trimmed],
      });
    }
    setNewRole('');
  };

  const removeRole = (role: string) => {
    onChange({
      ...config,
      target_roles: (config.target_roles || []).filter((r) => r !== role),
    });
  };

  const updateWeight = (key: keyof IcpConfig['weights'], val: number) => {
    onChange({
      ...config,
      weights: {
        ...config.weights,
        [key]: val,
      },
    });
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-100 dark:border-blue-900/30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 text-[#155eef] dark:text-blue-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Ideal Customer Profile (ICP) & Role Categorization</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                0–100% Scoring Engine
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Score and categorize extracted decision makers automatically according to your target personas and firmographics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#155eef]"></div>
            <span className="ml-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {config.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      {/* Minimum Score Threshold Slider */}
      <div className="bg-blue-50/40 dark:bg-[#0f1424]/60 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <span>High-Priority Match Threshold</span>
          </span>
          <span className="font-mono text-[#155eef] dark:text-blue-300 font-bold bg-blue-100/60 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/80 dark:border-blue-800/40">
            ≥ {config.min_icp_score}%
          </span>
        </div>
        <input
          type="range"
          min="40"
          max="95"
          step="5"
          value={config.min_icp_score}
          onChange={(e) => onChange({ ...config, min_icp_score: Number(e.target.value) })}
          className="w-full accent-[#155eef] cursor-pointer h-1.5 bg-blue-100 dark:bg-slate-800 rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>Broad (40%)</span>
          <span>Balanced (60%)</span>
          <span>Strict Enterprise (80%+)</span>
        </div>
      </div>

      {/* Target Decision-Maker Roles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <span>Target Decision-Maker Titles & Roles</span>
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {config.target_roles.length} roles monitored
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.target_roles.map((role) => (
            <span
              key={role}
              className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 text-[#155eef] dark:text-blue-300 text-xs font-medium flex items-center gap-1.5"
            >
              <span>{role}</span>
              <button
                type="button"
                onClick={() => removeRole(role)}
                className="text-blue-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 max-w-md">
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRole()}
            placeholder="Add title (e.g. Chief Revenue Officer, VP Sales)..."
            className="flex-1 px-3 py-1.5 glass-input rounded-xl text-xs placeholder-slate-400"
          />
          <button
            type="button"
            onClick={addRole}
            className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Target Industries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <span>Target Vertical / Industry Focus</span>
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {config.target_industries.length} industries active
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.target_industries.map((ind) => (
            <span
              key={ind}
              className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 text-[#155eef] dark:text-blue-300 text-xs font-medium flex items-center gap-1.5"
            >
              <span>{ind}</span>
              <button
                type="button"
                onClick={() => removeIndustry(ind)}
                className="text-blue-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Quick presets */}
        <div className="pt-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-2">Suggested presets:</span>
          <div className="inline-flex flex-wrap gap-1.5 mt-1">
            {PRESET_INDUSTRIES.filter((p) => !config.target_industries.includes(p)).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => addIndustry(preset)}
                className="px-2.5 py-1 rounded-lg text-[11px] bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] text-slate-700 dark:text-slate-300 border border-blue-100 dark:border-blue-900/40 flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-2.5 h-2.5 text-[#155eef]" />
                <span>{preset}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preferred Company Sizes (Employee Tiers) */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <span>Preferred Company Size (Employees)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {EMPLOYEE_TIERS.map((tier) => {
            const isSelected = (config.preferred_company_sizes || []).includes(tier);
            return (
              <button
                key={tier}
                type="button"
                onClick={() => toggleSize(tier)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-100 text-[#155eef] border-blue-300 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-200 font-semibold shadow-xs'
                    : 'bg-white/60 dark:bg-[#0f1424]/60 border-blue-100 dark:border-blue-900/30 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-[#162044] hover:text-[#155eef] dark:hover:text-blue-300'
                }`}
              >
                <span>{tier}</span>
                {isSelected && <Check className="w-3 h-3 inline-block ml-1 text-[#155eef] dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weighting Matrix Breakdown */}
      <div className="space-y-4 pt-2 border-t border-blue-100 dark:border-blue-900/30">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Scoring Weight Distribution
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-blue-50/40 dark:bg-[#0f1424]/60 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Decision-Maker Role</span>
              <span className="font-bold text-[#155eef] dark:text-blue-300 font-mono">{config.weights.roleWeight} pts</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={config.weights.roleWeight}
              onChange={(e) => updateWeight('roleWeight', Number(e.target.value))}
              className="w-full accent-[#155eef] cursor-pointer h-1.5 bg-blue-100 dark:bg-slate-800 rounded-lg"
            />
          </div>

          <div className="bg-blue-50/40 dark:bg-[#0f1424]/60 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Target Industry Match</span>
              <span className="font-bold text-[#155eef] dark:text-blue-300 font-mono">{config.weights.industryWeight} pts</span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              step="5"
              value={config.weights.industryWeight}
              onChange={(e) => updateWeight('industryWeight', Number(e.target.value))}
              className="w-full accent-[#155eef] cursor-pointer h-1.5 bg-blue-100 dark:bg-slate-800 rounded-lg"
            />
          </div>

          <div className="bg-blue-50/40 dark:bg-[#0f1424]/60 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Company Size Fit</span>
              <span className="font-bold text-[#155eef] dark:text-blue-300 font-mono">{config.weights.companySizeWeight} pts</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={config.weights.companySizeWeight}
              onChange={(e) => updateWeight('companySizeWeight', Number(e.target.value))}
              className="w-full accent-[#155eef] cursor-pointer h-1.5 bg-blue-100 dark:bg-slate-800 rounded-lg"
            />
          </div>

          <div className="bg-blue-50/40 dark:bg-[#0f1424]/60 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Direct Personal Email</span>
              <span className="font-bold text-[#155eef] dark:text-blue-300 font-mono">{config.weights.emailTypeWeight} pts</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={config.weights.emailTypeWeight}
              onChange={(e) => updateWeight('emailTypeWeight', Number(e.target.value))}
              className="w-full accent-[#155eef] cursor-pointer h-1.5 bg-blue-100 dark:bg-slate-800 rounded-lg"
            />
          </div>

          <div className="bg-blue-50/40 dark:bg-[#0f1424]/60 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Discovered LinkedIn Profile</span>
              <span className="font-bold text-[#155eef] dark:text-blue-300 font-mono">{config.weights.socialWeight} pts</span>
            </div>
            <input
              type="range"
              min="5"
              max="25"
              step="5"
              value={config.weights.socialWeight}
              onChange={(e) => updateWeight('socialWeight', Number(e.target.value))}
              className="w-full accent-[#155eef] cursor-pointer h-1.5 bg-blue-100 dark:bg-slate-800 rounded-lg"
            />
          </div>
        </div>
      </div>

      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving ICP Settings...' : 'Apply ICP Matrix'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
