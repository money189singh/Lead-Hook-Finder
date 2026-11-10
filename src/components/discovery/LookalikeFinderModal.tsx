import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Globe,
  CheckSquare,
  Square,
  Play,
  Plus,
} from 'lucide-react';

interface LookalikeItem {
  name: string;
  domain: string;
  industry?: string;
  location?: string;
  estimatedSize?: string;
  similarityScore?: number;
  matchReason?: string;
}

interface LookalikeFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSeedDomains?: string[];
  onQueueDomains: (urls: string[], startImmediately: boolean) => void;
  onShowToast?: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export const LookalikeFinderModal: React.FC<LookalikeFinderModalProps> = ({
  isOpen,
  onClose,
  initialSeedDomains = [],
  onQueueDomains,
  onShowToast,
}) => {
  const [seedsInput, setSeedsInput] = useState('');
  const [targetRegion, setTargetRegion] = useState('United States');
  const [companyScale, setCompanyScale] = useState('smb');
  const [targetCount, setTargetCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [lookalikes, setLookalikes] = useState<LookalikeItem[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [icpTitle, setIcpTitle] = useState('');

  useEffect(() => {
    if (isOpen && initialSeedDomains.length > 0 && !seedsInput.trim()) {
      setSeedsInput(initialSeedDomains.slice(0, 5).join('\n'));
    }
  }, [isOpen, initialSeedDomains]);

  if (!isOpen) return null;

  const handleFindLookalikes = async () => {
    const seeds = seedsInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (seeds.length === 0) {
      onShowToast?.('Enter at least 1 seed domain or company.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/discovery/analyze-icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedCompanies: seeds,
          targetRegion,
          companyScale,
          targetCount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.profile) {
        throw new Error(data.error || 'Failed to discover lookalikes');
      }
      const list: LookalikeItem[] = data.profile.lookalikes || [];
      setIcpTitle(data.profile.icpTitle || '');
      setLookalikes(list);
      setSelectedDomains(new Set(list.map((item) => item.domain).filter(Boolean)));
      onShowToast?.(`Found ${list.length} lookalike companies`, 'success');
    } catch (err: any) {
      onShowToast?.(err.message || 'Lookalike search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const handleApply = (startImmediately: boolean) => {
    const urls = Array.from<string>(selectedDomains).map((d) =>
      d.startsWith('http') ? d : `https://${d}`
    );
    if (urls.length === 0) {
      onShowToast?.('Select at least 1 domain.', 'warning');
      return;
    }
    onQueueDomains(urls, startImmediately);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#0f1424] border border-blue-100 dark:border-blue-900/40 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Lookalike & Competitor Domain Finder
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Seed Domains or Company Names
            </label>
            <textarea
              rows={3}
              value={seedsInput}
              onChange={(e) => setSeedsInput(e.target.value)}
              placeholder="stripe.com&#10;plaid.com&#10;brex.com"
              className="w-full p-3 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Region</label>
              <input
                type="text"
                value={targetRegion}
                onChange={(e) => setTargetRegion(e.target.value)}
                placeholder="United States"
                className="w-full px-3 py-2 glass-input rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Company Scale</label>
              <select
                value={companyScale}
                onChange={(e) => setCompanyScale(e.target.value)}
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-medium"
              >
                <option value="startups">Startups (1–50)</option>
                <option value="smb">SMB (11–200)</option>
                <option value="mid_market">Mid-Market (201–1000)</option>
                <option value="all">All Sizes</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Max Matches</label>
              <select
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="w-full px-3 py-2 glass-input rounded-xl text-xs font-medium"
              >
                <option value={8}>8 companies</option>
                <option value={12}>12 companies</option>
                <option value={20}>20 companies</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFindLookalikes}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#155eef] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{loading ? 'Analyzing ICP & Finding Lookalikes...' : 'Find Lookalike Domains'}</span>
          </button>

          {lookalikes.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  {icpTitle || 'Discovered Lookalikes'} ({selectedDomains.size}/{lookalikes.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDomains(new Set(lookalikes.map((l) => l.domain)))}
                    className="text-[#155eef] dark:text-blue-400 hover:underline font-medium cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDomains(new Set())}
                    className="text-slate-500 hover:underline font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {lookalikes.map((item, idx) => {
                  const isChecked = selectedDomains.has(item.domain);
                  return (
                    <div
                      key={`lookalike-${item.domain}-${idx}`}
                      onClick={() => toggleDomain(item.domain)}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white dark:bg-[#0f1424] hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#155eef] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="truncate">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{item.name}</span>
                            <span className="font-mono text-[11px] text-[#155eef] dark:text-blue-400">
                              {item.domain}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.industry && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                            {item.industry}
                          </span>
                        )}
                        {item.similarityScore && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 text-[10px] font-bold font-mono">
                            {item.similarityScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-blue-100 dark:border-blue-900/30 bg-slate-50/60 dark:bg-[#0c101d]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Close
          </button>

          {lookalikes.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleApply(false)}
                disabled={selectedDomains.size === 0}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#101730] hover:bg-blue-50 text-[#155eef] dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to URL Queue ({selectedDomains.size})</span>
              </button>
              <button
                type="button"
                onClick={() => handleApply(true)}
                disabled={selectedDomains.size === 0}
                className="px-4 py-2 rounded-xl bg-[#155eef] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Scrape Selected ({selectedDomains.size})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
