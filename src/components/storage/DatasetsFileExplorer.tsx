import React, { useState, useMemo } from 'react';
import {
  FileText,
  MapPin,
  Sparkles,
  Compass,
  Radio,
  Calendar,
  Clock,
  HardDrive,
  Download,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  FolderOpen,
  ArrowRight,
  Database,
  Tag,
  Eye,
  Check,
  Wand2,
} from 'lucide-react';

export interface FileDatasetItem {
  id: string;
  tool: string;
  search_name: string;
  created_at: string;
  updated_at: string;
  record_count: number;
  file_size: number;
  ai_organized: boolean;
  ai_summary?: {
    summary: string;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
    decision_makers_percent: number;
    verified_emails_percent: number;
    top_industries: string[];
    recommended_outreach: string;
  };
  tags: string[];
  cloud_synced: boolean;
}

interface DatasetsFileExplorerProps {
  datasets: FileDatasetItem[];
  selectedDatasetId?: string | null;
  onSelectDataset: (datasetId: string) => void;
  onOrganizeDataset: (datasetId: string) => void;
  onDeleteDataset: (datasetId: string) => void;
  onExportDatasetXlsx?: (datasetId: string) => void;
  initialToolFilter?: string;
  isLoading?: boolean;
}

export const DatasetsFileExplorer: React.FC<DatasetsFileExplorerProps> = ({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  onOrganizeDataset,
  onDeleteDataset,
  onExportDatasetXlsx,
  initialToolFilter = 'all',
  isLoading = false,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [toolFilter, setToolFilter] = useState<string>(initialToolFilter);
  const [organizeOnly, setOrganizeOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter datasets
  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      // Search term
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesName = d.search_name.toLowerCase().includes(q);
        const matchesTool = d.tool.toLowerCase().includes(q);
        const matchesTags = d.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesTool && !matchesTags) return false;
      }

      // Tool filter
      if (toolFilter !== 'all') {
        if (toolFilter === 'maps' && !d.tool.includes('Maps')) return false;
        if (toolFilter === 'discovery' && !d.tool.includes('Discovery')) return false;
        if (toolFilter === 'algo' && !d.tool.includes('Algo')) return false;
        if (toolFilter === 'scraper' && !d.tool.includes('Website') && !d.tool.includes('Scraper')) return false;
        if (toolFilter === 'signals' && !d.tool.includes('Signals') && !d.tool.includes('Radar')) return false;
      }

      // AI Organized filter
      if (organizeOnly && !d.ai_organized) {
        return false;
      }

      return true;
    });
  }, [datasets, searchFilter, toolFilter, organizeOnly]);

  const formatFileSize = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return {
        formattedDate: date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        formattedTime: date.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }),
        relativeTime: getRelativeTimeString(date),
      };
    } catch {
      return {
        formattedDate: isoString,
        formattedTime: '',
        relativeTime: '',
      };
    }
  };

  function getRelativeTimeString(date: Date): string {
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  const getToolMeta = (tool: string) => {
    if (tool.includes('Maps')) {
      return {
        icon: MapPin,
        colorClass: 'text-blue-600 dark:text-blue-400',
        bgClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40',
        fileExtension: '.maps.dataset',
      };
    }
    if (tool.includes('Discovery')) {
      return {
        icon: Sparkles,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40',
        fileExtension: '.discovery.dataset',
      };
    }
    if (tool.includes('Algo')) {
      return {
        icon: Wand2,
        colorClass: 'text-indigo-600 dark:text-indigo-400',
        bgClass: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40',
        fileExtension: '.algosearch.dataset',
      };
    }
    if (tool.includes('Signals') || tool.includes('Radar')) {
      return {
        icon: Radio,
        colorClass: 'text-purple-600 dark:text-purple-400',
        bgClass: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40',
        fileExtension: '.signals.dataset',
      };
    }
    return {
      icon: Compass,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40',
      fileExtension: '.crawler.dataset',
    };
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search stored files by search name, tool, or tags..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-100 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setToolFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              toolFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Files ({datasets.length})
          </button>

          <button
            onClick={() => setToolFilter('maps')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
              toolFilter === 'maps'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-3 h-3" />
            <span>Google Maps</span>
          </button>

          <button
            onClick={() => setToolFilter('discovery')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
              toolFilter === 'discovery'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Discovery</span>
          </button>

          <button
            onClick={() => setToolFilter('algo')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
              toolFilter === 'algo'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Wand2 className="w-3 h-3" />
            <span>Algo Search</span>
          </button>

          <button
            onClick={() => setToolFilter('scraper')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
              toolFilter === 'scraper'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Web Scraper</span>
          </button>

          <button
            onClick={() => setToolFilter('signals')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
              toolFilter === 'signals'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>Signals Radar</span>
          </button>

          <button
            onClick={() => setOrganizeOnly(!organizeOnly)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 border ${
              organizeOnly
                ? 'bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Sparkles className="w-3 h-3 text-pink-500" />
            <span>AI Organized Only</span>
          </button>
        </div>
      </div>

      {/* Dataset File Cards Grid */}
      {filteredDatasets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            No stored files matching filters
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Run a search in Google Maps Scraper, AI Prospect Discovery, or Website Scraper. Every search automatically stores all leads as persistent cloud files.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDatasets.map((dataset) => {
            const meta = getToolMeta(dataset.tool);
            const ToolIcon = meta.icon;
            const { formattedDate, formattedTime, relativeTime } = formatDateTime(dataset.created_at);
            const isSelected = selectedDatasetId === dataset.id;

            // Generate sanitized display file name
            const sanitizedSearch = dataset.search_name
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '-')
              .replace(/-+/g, '-')
              .slice(0, 32);
            const fileName = `${sanitizedSearch || 'leads'}${meta.fileExtension}`;

            return (
              <div
                key={dataset.id}
                onClick={() => onSelectDataset(dataset.id)}
                className={`group relative bg-white dark:bg-slate-900 rounded-2xl border transition-all cursor-pointer p-4 flex flex-col justify-between hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${meta.bgClass}`}
                      >
                        <ToolIcon className={`w-5 h-5 ${meta.colorClass}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {dataset.tool}
                          </span>
                          {dataset.ai_organized && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800">
                              <Sparkles className="w-2.5 h-2.5" />
                              AI Cleaned
                            </span>
                          )}
                        </div>
                        <h4
                          className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[190px]"
                          title={fileName}
                        >
                          📄 {fileName}
                        </h4>
                      </div>
                    </div>

                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {relativeTime}
                    </span>
                  </div>

                  {/* Search Title & Info */}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                      "{dataset.search_name}"
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formattedDate} • {formattedTime}
                      </span>
                    </div>
                  </div>

                  {/* Badges / Metrics Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <FileText className="w-3 h-3 text-blue-500" />
                      {dataset.record_count} Records
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <HardDrive className="w-3 h-3 text-slate-400" />
                      {formatFileSize(dataset.file_size)}
                    </span>
                    {dataset.ai_summary && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Tier 1: {dataset.ai_summary.tier1_count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDataset(dataset.id);
                    }}
                    className="px-2.5 py-1 rounded-lg font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1"
                  >
                    <span>View Data</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrganizeDataset(dataset.id);
                      }}
                      className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      title="Run AI Organizer on this file"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>

                    {onExportDatasetXlsx && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportDatasetXlsx(dataset.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Export file as Excel (.xlsx)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete file dataset "${fileName}"? This will free up storage.`)) {
                          onDeleteDataset(dataset.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
