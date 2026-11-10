import React, { useState } from 'react';
import {
  VerificationLevel,
  CustomVerificationOptions,
  VerificationJobStatus,
} from '../../types';
import {
  ShieldCheck,
  Zap,
  Sliders,
  Play,
  Pause,
  Square,
  AlertCircle,
  Coins,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

interface VerifierControlBarProps {
  selectedCount: number;
  totalCount: number;
  verificationLevel: VerificationLevel;
  onSelectLevel: (level: VerificationLevel) => void;
  customOptions: CustomVerificationOptions;
  onUpdateCustomOptions: (opts: CustomVerificationOptions) => void;
  availableCredits: number;
  costPerBusiness: number;
  jobStatus: VerificationJobStatus | null;
  onVerifySelected: () => void;
  onVerifyAll: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenAddCredits: () => void;
}

export const VerifierControlBar: React.FC<VerifierControlBarProps> = ({
  selectedCount,
  totalCount,
  verificationLevel,
  onSelectLevel,
  customOptions,
  onUpdateCustomOptions,
  availableCredits,
  costPerBusiness,
  jobStatus,
  onVerifySelected,
  onVerifyAll,
  onPause,
  onResume,
  onStop,
  onOpenAddCredits,
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);

  const isRunning = jobStatus?.status === 'running';
  const isPaused = jobStatus?.status === 'paused';

  const effectiveCount = selectedCount > 0 ? selectedCount : totalCount;
  const estimatedCost = Math.round(effectiveCount * costPerBusiness * 10) / 10;
  const remainingCredits = Math.max(0, Math.round((availableCredits - estimatedCost) * 10) / 10);
  const hasEnoughCredits = availableCredits >= estimatedCost;

  const levels: {
    id: VerificationLevel;
    label: string;
    costText: string;
    desc: string;
  }[] = [
    {
      id: 'LOW',
      label: 'LOW',
      costText: '0.5 Credits',
      desc: 'Website HTTP + SSL + Google Maps basic check. Fast & lightweight.',
    },
    {
      id: 'MEDIUM',
      label: 'MEDIUM',
      costText: '1.0 Credit',
      desc: 'LOW + Search Query Verification + Activity recency. AI only on conflict.',
    },
    {
      id: 'HIGH',
      label: 'HIGH',
      costText: '2.0 Credits',
      desc: 'MEDIUM + Gov Registry filings + Sitemap dates + AI synthesis.',
    },
    {
      id: 'CUSTOM',
      label: 'CUSTOM',
      costText: 'Configurable',
      desc: 'Fine-tune exact APIs, searches, government checks, and AI rules.',
    },
  ];

  return (
    <div className="glass-card glass-reflection rounded-2xl p-5 space-y-4">
      {/* Top row: Level Selection & Custom toggle */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Verification Level
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Current Rate: <span className="font-bold text-purple-700 dark:text-purple-300">{costPerBusiness} credits</span> / business
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {levels.map((lvl) => {
            const isSelected = verificationLevel === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => {
                  onSelectLevel(lvl.id);
                  if (lvl.id === 'CUSTOM') {
                    setShowCustomModal(true);
                  }
                }}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 shadow-sm shadow-purple-500/15 ring-1 ring-purple-500/30'
                    : 'bg-white/60 dark:bg-[#161426]/50 border-purple-100/80 dark:border-purple-900/30 hover:bg-purple-50/40 dark:hover:bg-purple-950/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-white'}`}>
                    {lvl.label}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-purple-950 dark:text-slate-400'
                    }`}
                  >
                    {lvl.costText}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">{lvl.desc}</p>
                {lvl.id === 'CUSTOM' && isSelected && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomModal(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-2 hover:underline"
                  >
                    <Sliders className="w-3 h-3" /> Configure Custom Options
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cost Estimation and Balance Checker Bar */}
      <div className="rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs bg-purple-50/40 dark:bg-[#161426]/60 border border-purple-100/80 dark:border-purple-900/30">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400">Target(s):</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {selectedCount > 0 ? `${selectedCount} selected` : `All (${totalCount})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Estimated Cost:</span>
            <span className="font-bold text-purple-700 dark:text-purple-300">{estimatedCost} credits</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Available:</span>
            <span className={`font-bold ${hasEnoughCredits ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {availableCredits.toLocaleString()} credits
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Est. Remaining:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{remainingCredits.toLocaleString()} credits</span>
          </div>
        </div>

        {/* Insufficient Credits Banner & Add Credits shortcut */}
        {!hasEnoughCredits && (
          <div className="flex items-center gap-3 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-3 py-1.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Need {estimatedCost - availableCredits} more credits.</span>
            <button
              onClick={onOpenAddCredits}
              className="text-xs px-2.5 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-all cursor-pointer shadow-xs"
            >
              Add Credits
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons: VERIFY SELECTED, VERIFY ALL, Pause, Resume, Stop */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          {/* VERIFY SELECTED */}
          <button
            onClick={onVerifySelected}
            disabled={selectedCount === 0 || isRunning || !hasEnoughCredits}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              selectedCount > 0 && !isRunning && hasEnoughCredits
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-purple-500/20 active:scale-95'
                : 'bg-slate-100 text-slate-400 dark:bg-[#1C1A2E] dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-purple-900/30'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>VERIFY SELECTED ({selectedCount})</span>
          </button>

          {/* VERIFY ALL */}
          <button
            onClick={onVerifyAll}
            disabled={totalCount === 0 || isRunning || !hasEnoughCredits}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              totalCount > 0 && !isRunning && hasEnoughCredits
                ? 'bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800/40 active:scale-95'
                : 'bg-slate-100/60 text-slate-400 dark:bg-[#161426]/50 dark:text-slate-600 cursor-not-allowed border border-slate-200/60 dark:border-purple-900/20'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>VERIFY ALL ({totalCount})</span>
          </button>
        </div>

        {/* Running Controls (Pause, Resume, Stop) */}
        {isRunning && (
          <div className="flex items-center gap-2">
            {!isPaused ? (
              <button
                onClick={onPause}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={onResume}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            )}

            <button
              onClick={onStop}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          </div>
        )}
      </div>

      {/* Custom Verification Options Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card glass-reflection rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-purple-100/80 dark:border-purple-900/30 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Custom Verification Options</h3>
              </div>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/40 dark:bg-[#181628]/60 border border-purple-100/80 dark:border-purple-900/30 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                <input
                  type="checkbox"
                  checked={customOptions.checkWebsite}
                  onChange={(e) => onUpdateCustomOptions({ ...customOptions, checkWebsite: e.target.checked })}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-200">Website Health & Recency (+0.2 credits)</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Probes HTTP response code, SSL validity, and Last-Modified headers.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/40 dark:bg-[#181628]/60 border border-purple-100/80 dark:border-purple-900/30 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                <input
                  type="checkbox"
                  checked={customOptions.checkGoogleMaps}
                  onChange={(e) => onUpdateCustomOptions({ ...customOptions, checkGoogleMaps: e.target.checked })}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-200">Google Maps / Places Status (+0.3 credits)</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Queries Google Places operational status (OPERATIONAL vs CLOSED).
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/40 dark:bg-[#181628]/60 border border-purple-100/80 dark:border-purple-900/30 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                <input
                  type="checkbox"
                  checked={customOptions.checkSearch}
                  onChange={(e) => onUpdateCustomOptions({ ...customOptions, checkSearch: e.target.checked })}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-200">Search Engine Closure Queries (+0.5 credits)</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Executes targeted closure queries ("permanently closed", "out of business").
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/40 dark:bg-[#181628]/60 border border-purple-100/80 dark:border-purple-900/30 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                <input
                  type="checkbox"
                  checked={customOptions.checkGovernment}
                  onChange={(e) => onUpdateCustomOptions({ ...customOptions, checkGovernment: e.target.checked })}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-200">Government Registry: GovFiles (+0.4 credits)</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Queries GovFiles & official state business registries for legal entity validation.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/40 dark:bg-[#181628]/60 border border-purple-100/80 dark:border-purple-900/30 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                <input
                  type="checkbox"
                  checked={customOptions.aiOnlyWhenUncertain}
                  onChange={(e) => onUpdateCustomOptions({ ...customOptions, aiOnlyWhenUncertain: e.target.checked })}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    AI Evidence Synthesis (+0.2 credits)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Invokes AI only when evidence is conflicting or ambiguous. Zero guesswork.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                Apply Custom Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
