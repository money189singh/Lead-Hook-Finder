import React, { useState } from 'react';
import {
  HardDrive,
  Cloud,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  FolderOpen,
  ArrowUpRight,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
  MapPin,
  Compass,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

export interface StorageCategoryData {
  category: string;
  label: string;
  bytes: number;
  record_count: number;
  color: string;
  accent_class: string;
}

export interface CloudStorageData {
  total_quota_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_percent: number;
  categories: {
    maps: StorageCategoryData;
    discovery: StorageCategoryData;
    scraper: StorageCategoryData;
    signals: StorageCategoryData;
    ai_organized: StorageCategoryData;
  };
  total_datasets: number;
  total_leads: number;
  last_sync: string;
  engine: string;
}

interface CloudStorageIndicatorProps {
  storageInfo: CloudStorageData | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onOpenExplorer?: (category?: string) => void;
  onOrganizeAll?: () => void;
  compact?: boolean;
}

export const CloudStorageIndicator: React.FC<CloudStorageIndicatorProps> = ({
  storageInfo,
  isLoading = false,
  onRefresh,
  onOpenExplorer,
  onOrganizeAll,
  compact = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState<boolean>(false);
  const [barDisplayMode, setBarDisplayMode] = useState<'proportional' | 'quota'>('proportional');

  if (!storageInfo) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm animate-pulse">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-64 mb-3" />
        <div className="h-5 bg-slate-100 dark:bg-slate-800/60 rounded-full w-full" />
      </div>
    );
  }

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const dm = 1;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const usedFormatted = formatBytes(storageInfo.used_bytes);
  const totalFormatted = formatBytes(storageInfo.total_quota_bytes);
  const freeFormatted = formatBytes(storageInfo.free_bytes);

  const cats = storageInfo.categories;
  const totalQuota = storageInfo.total_quota_bytes || 1;
  const totalUsed = Math.max(storageInfo.used_bytes, 1);

  // Proportional percentages of used data (for Apple aesthetic breakdown)
  const mapsProp = ((cats.maps?.bytes || 0) / totalUsed) * 100;
  const discProp = ((cats.discovery?.bytes || 0) / totalUsed) * 100;
  const scrapProp = ((cats.scraper?.bytes || 0) / totalUsed) * 100;
  const sigProp = ((cats.signals?.bytes || 0) / totalUsed) * 100;
  const orgProp = ((cats.ai_organized?.bytes || 0) / totalUsed) * 100;

  // Quota percentages of total 500 MB
  const mapsQuota = ((cats.maps?.bytes || 0) / totalQuota) * 100;
  const discQuota = ((cats.discovery?.bytes || 0) / totalQuota) * 100;
  const scrapQuota = ((cats.scraper?.bytes || 0) / totalQuota) * 100;
  const sigQuota = ((cats.signals?.bytes || 0) / totalQuota) * 100;
  const orgQuota = ((cats.ai_organized?.bytes || 0) / totalQuota) * 100;

  const categoryList = [
    {
      id: 'maps',
      name: 'Google Maps Leads',
      data: cats.maps,
      icon: MapPin,
      color: '#007AFF', // Apple iOS Blue
      tailwindBg: 'bg-[#007AFF]',
      toolKey: 'maps',
    },
    {
      id: 'discovery',
      name: 'AI Prospect Discoveries',
      data: cats.discovery,
      icon: Sparkles,
      color: '#34C759', // Apple iOS Green
      tailwindBg: 'bg-[#34C759]',
      toolKey: 'discovery',
    },
    {
      id: 'scraper',
      name: 'Website Crawls & Contacts',
      data: cats.scraper,
      icon: Compass,
      color: '#FF9500', // Apple iOS Amber / Orange
      tailwindBg: 'bg-[#FF9500]',
      toolKey: 'scraper',
    },
    {
      id: 'signals',
      name: 'Buying Signals Radar',
      data: cats.signals,
      icon: Radio,
      color: '#AF52DE', // Apple iOS Purple
      tailwindBg: 'bg-[#AF52DE]',
      toolKey: 'signals',
    },
    {
      id: 'ai_organized',
      name: 'AI Organized Data',
      data: cats.ai_organized,
      icon: Sparkles,
      color: '#FF2D55', // Apple iOS Pink / Rose
      tailwindBg: 'bg-[#FF2D55]',
      toolKey: 'all',
    },
  ];

  return (
    <div className="bg-white/95 dark:bg-[#0c1222]/95 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-sm transition-all relative overflow-hidden backdrop-blur-md">
      {/* Background ambient Apple glow */}
      <div className="absolute top-0 right-0 w-96 h-36 bg-gradient-to-bl from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none" />

      {/* Header Row: iOS / macOS Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                Cloud Storage & SQL Database
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-3 h-3" />
                Persistent
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-bold text-slate-900 dark:text-slate-100">{usedFormatted}</span> of{' '}
              <span className="font-bold text-slate-900 dark:text-slate-100">{totalFormatted}</span> Used •{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{freeFormatted} Available</span>
              <span className="text-slate-400 dark:text-slate-500 ml-1.5 font-mono">
                ({storageInfo.total_leads.toLocaleString()} Leads Indexed in SQLite)
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Bar Mode Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => setBarDisplayMode('proportional')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                barDisplayMode === 'proportional'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Show proportional distribution of scraped leads"
            >
              Data Share
            </button>
            <button
              onClick={() => setBarDisplayMode('quota')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                barDisplayMode === 'quota'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Show share of total 500 MB cloud quota"
            >
              500 MB Quota
            </button>
          </div>

          {onOrganizeAll && (
            <button
              onClick={onOrganizeAll}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 border border-pink-200 dark:border-pink-800/50 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="AI Organizer: clean, tier, deduplicate and enrich all leads"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
              <span>AI Organize</span>
            </button>
          )}

          {onOpenExplorer && (
            <button
              onClick={() => onOpenExplorer()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{storageInfo.total_datasets} Stored Files</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              title="Sync & recalculate cloud storage"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Horizontal Bar (Apple MacBook / iPhone OS Style) */}
      <div className="w-full h-4 sm:h-5 bg-slate-100 dark:bg-slate-800/90 rounded-full overflow-hidden flex shadow-inner relative p-0.5 border border-slate-200/70 dark:border-slate-700/70">
        {barDisplayMode === 'proportional' ? (
          <>
            {/* Google Maps Segment */}
            {cats.maps?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(mapsProp, 3)}%` }}
                className="h-full bg-[#007AFF] hover:opacity-90 transition-all rounded-l-full relative cursor-pointer"
                title={`Google Maps: ${formatBytes(cats.maps.bytes)} (${cats.maps.record_count} leads)`}
                onMouseEnter={() => setActiveCategory('maps')}
                onMouseLeave={() => setActiveCategory(null)}
                onClick={() => onOpenExplorer?.('maps')}
              />
            )}

            {/* AI Prospect Discovery Segment */}
            {cats.discovery?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(discProp, 3)}%` }}
                className="h-full bg-[#34C759] hover:opacity-90 transition-all relative cursor-pointer"
                title={`AI Discovery: ${formatBytes(cats.discovery.bytes)} (${cats.discovery.record_count} leads)`}
                onMouseEnter={() => setActiveCategory('discovery')}
                onMouseLeave={() => setActiveCategory(null)}
                onClick={() => onOpenExplorer?.('discovery')}
              />
            )}

            {/* Website Scraper Segment */}
            {cats.scraper?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(scrapProp, 3)}%` }}
                className="h-full bg-[#FF9500] hover:opacity-90 transition-all relative cursor-pointer"
                title={`Website Scraper: ${formatBytes(cats.scraper.bytes)} (${cats.scraper.record_count} contacts)`}
                onMouseEnter={() => setActiveCategory('scraper')}
                onMouseLeave={() => setActiveCategory(null)}
                onClick={() => onOpenExplorer?.('scraper')}
              />
            )}

            {/* Buying Signals Radar Segment */}
            {cats.signals?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(sigProp, 3)}%` }}
                className="h-full bg-[#AF52DE] hover:opacity-90 transition-all relative cursor-pointer"
                title={`Signals Radar: ${formatBytes(cats.signals.bytes)} (${cats.signals.record_count} signals)`}
                onMouseEnter={() => setActiveCategory('signals')}
                onMouseLeave={() => setActiveCategory(null)}
                onClick={() => onOpenExplorer?.('signals')}
              />
            )}

            {/* AI Organized Segment */}
            {cats.ai_organized?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(orgProp, 3)}%` }}
                className="h-full bg-[#FF2D55] hover:opacity-90 transition-all rounded-r-full relative cursor-pointer"
                title={`AI Organized Data: ${formatBytes(cats.ai_organized.bytes)}`}
                onMouseEnter={() => setActiveCategory('ai_organized')}
                onMouseLeave={() => setActiveCategory(null)}
                onClick={() => onOpenExplorer?.('all')}
              />
            )}
          </>
        ) : (
          <>
            {/* Absolute Quota Bar (Percentage of 500 MB) */}
            {cats.maps?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(mapsQuota, 0.8)}%` }}
                className="h-full bg-[#007AFF] transition-all rounded-l-full relative cursor-pointer"
                title={`Google Maps: ${formatBytes(cats.maps.bytes)}`}
              />
            )}
            {cats.discovery?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(discQuota, 0.8)}%` }}
                className="h-full bg-[#34C759] transition-all relative cursor-pointer"
                title={`AI Discovery: ${formatBytes(cats.discovery.bytes)}`}
              />
            )}
            {cats.scraper?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(scrapQuota, 0.8)}%` }}
                className="h-full bg-[#FF9500] transition-all relative cursor-pointer"
                title={`Website Scraper: ${formatBytes(cats.scraper.bytes)}`}
              />
            )}
            {cats.signals?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(sigQuota, 0.8)}%` }}
                className="h-full bg-[#AF52DE] transition-all relative cursor-pointer"
                title={`Signals Radar: ${formatBytes(cats.signals.bytes)}`}
              />
            )}
            {cats.ai_organized?.bytes > 0 && (
              <div
                style={{ width: `${Math.max(orgQuota, 0.8)}%` }}
                className="h-full bg-[#FF2D55] transition-all relative cursor-pointer"
                title={`AI Organized: ${formatBytes(cats.ai_organized.bytes)}`}
              />
            )}
          </>
        )}
      </div>

      {/* Legend & Category Indicators Row (iOS / macOS Style) */}
      <div className="flex flex-wrap items-center justify-between gap-y-2.5 gap-x-4 mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {categoryList.map((c) => {
            const hasData = c.data?.bytes > 0 || c.data?.record_count > 0;
            return (
              <div
                key={c.id}
                onClick={() => onOpenExplorer?.(c.toolKey)}
                onMouseEnter={() => setActiveCategory(c.id)}
                onMouseLeave={() => setActiveCategory(null)}
                className={`flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-100 ${
                  activeCategory && activeCategory !== c.id
                    ? 'opacity-35'
                    : hasData
                    ? 'opacity-100'
                    : 'opacity-50'
                }`}
              >
                <span
                  style={{ backgroundColor: c.color }}
                  className="w-2.5 h-2.5 rounded-full shadow-xs"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">{c.name}</span>
                <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                  {formatBytes(c.data?.bytes || 0)}
                </span>
                {c.data?.record_count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                    {c.data.record_count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Detailed Breakdown Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
          >
            <span>{showDetailedBreakdown ? 'Hide Breakdown' : 'Manage Breakdown'}</span>
            {showDetailedBreakdown ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px]">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">SQLite 3 Database</span>
          </div>
        </div>
      </div>

      {/* Expandable macOS Style Storage Management Grid */}
      {showDetailedBreakdown && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-in fade-in duration-200">
          {categoryList.map((c) => {
            const Icon = c.icon;
            const pctOfUsed = totalUsed > 0 ? ((c.data?.bytes || 0) / totalUsed) * 100 : 0;

            return (
              <div
                key={`breakdown_${c.id}`}
                className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 flex flex-col justify-between hover:border-blue-400/50 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      style={{ backgroundColor: `${c.color}15`, color: c.color }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                      {pctOfUsed.toFixed(1)}% of used
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {c.name}
                  </h4>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      {formatBytes(c.data?.bytes || 0)}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ({c.data?.record_count || 0} leads)
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px]">
                  <button
                    onClick={() => onOpenExplorer?.(c.toolKey)}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View Files</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Synced
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
