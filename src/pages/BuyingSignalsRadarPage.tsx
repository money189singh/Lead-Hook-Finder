import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  TrendingUp,
  Sparkles,
  Briefcase,
  DollarSign,
  Building2,
  Users,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  Database,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Globe,
  Mail,
  Phone,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import { BuyingSignalItem, NewsFeedItem, DailyOpportunity, BuyingSignalType, ScrapeSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { firestoreService } from '../lib/firestoreService';

interface BuyingSignalsRadarPageProps {
  settings: ScrapeSettings | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigateToScraper: () => void;
  onImportToScraper: (urls: string[]) => void;
}

export const BuyingSignalsRadarPage: React.FC<BuyingSignalsRadarPageProps> = ({
  settings,
  onShowToast,
  onNavigateToScraper,
  onImportToScraper,
}) => {
  const { user } = useAuth();

  // State
  const [activeView, setActiveView] = useState<'radar' | 'news'>('radar');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Live Data
  const [stats, setStats] = useState<any>({
    totalSignals: 0,
    highIntentCount: 0,
    hiringCount: 0,
    fundingCount: 0,
    expansionCount: 0,
    leadershipCount: 0,
    isScanning: false,
  });
  const [signals, setSignals] = useState<BuyingSignalItem[]>([]);
  const [opportunities, setOpportunities] = useState<DailyOpportunity[]>([]);
  const [newsFeed, setNewsFeed] = useState<NewsFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanQuery, setScanQuery] = useState<string>('B2B legal & technology firms expanding in United States');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);

  // Fetch Radar Data on Mount
  useEffect(() => {
    fetchRadarData();
    fetchNewsFeed();
  }, []);

  const fetchRadarData = async () => {
    try {
      const res = await fetch('/api/signals/radar');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || {});
        setSignals(data.signals || []);
        setOpportunities(data.opportunities || []);
      }
    } catch (e) {
      console.warn('Failed to load radar data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNewsFeed = async () => {
    try {
      const res = await fetch('/api/signals/news');
      if (res.ok) {
        const data = await res.json();
        setNewsFeed(data || []);
      }
    } catch (e) {
      console.warn('Failed to load news feed:', e);
    }
  };

  const handleRunLiveScan = async () => {
    if (!scanQuery.trim()) {
      onShowToast('Please enter a target search query or market niche', 'warning');
      return;
    }

    setIsScanning(true);
    onShowToast(`Scanning live news and buying signals for "${scanQuery}"...`, 'info');
    try {
      const res = await fetch('/api/signals/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: scanQuery }),
      });

      if (!res.ok) {
        const err = await res.json();
        let errorMsg = err.error || 'Failed to complete radar scan';
        try {
          if (typeof errorMsg === 'string' && errorMsg.includes('"error":')) {
            const parsed = JSON.parse(errorMsg);
            errorMsg = parsed?.error?.message || errorMsg;
          }
        } catch {}
        if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          errorMsg = 'Gemini API Quota Exceeded (429 Rate Limit): Gemini free tier limit reached. Switched to resilient fallback radar.';
        }
        throw new Error(errorMsg);
      }

      const result = await res.json();
      if (result.isFallback) {
        onShowToast(
          `Radar scan completed! Found ${result.newSignalsCount} high-intent buying signals (Delivered via Resilient Fallback Radar due to Gemini 429 quota limits).`,
          'info'
        );
      } else {
        onShowToast(`Radar scan completed! Found ${result.newSignalsCount} verified buying signals.`, 'success');
      }
      fetchRadarData();
      fetchNewsFeed();
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    onShowToast('Copied to clipboard!', 'info');
  };

  const handleSyncToFirestore = async () => {
    if (!user) {
      onShowToast('Please sign in with Google to sync buying signals to Cloud Firestore.', 'warning');
      return;
    }

    setIsSyncingFirestore(true);
    try {
      for (const opp of opportunities) {
        await firestoreService.saveUserCompany(user.uid, {
          company_name: opp.companyName,
          domain: opp.domain,
          website: opp.website,
          industry: opp.industry,
          source: 'buying_signals_radar',
          created_at: new Date().toISOString(),
        });
      }
      onShowToast(`Successfully saved ${opportunities.length} high-intent companies to Cloud Firestore!`, 'success');
    } catch (e: any) {
      onShowToast(`Firestore sync error: ${e.message}`, 'error');
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  // Filtered lists
  const filteredOpportunities = opportunities.filter((opp) => {
    if (selectedTier !== 'all' && opp.intentTier !== selectedTier) return false;
    if (selectedType !== 'all') {
      const hasType = opp.recentSignals.some((s) => s.signalType === selectedType);
      if (!hasType) return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchName = opp.companyName.toLowerCase().includes(q);
      const matchDomain = opp.domain.toLowerCase().includes(q);
      const matchAction = opp.bestAction.toLowerCase().includes(q);
      const matchReason = opp.reasons.some((r) => r.toLowerCase().includes(q));
      if (!matchName && !matchDomain && !matchAction && !matchReason) return false;
    }
    return true;
  });

  const filteredNews = newsFeed.filter((item) => {
    if (selectedType !== 'all' && item.signalType !== selectedType) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        item.companyName.toLowerCase().includes(q) ||
        item.headline.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div id="buying-signals-radar-page" className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 glass-card glass-reflection rounded-2xl shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>Real-Time Buying Signals Radar & News Feed</span>
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 text-[11px] font-medium">
              <Activity className="w-3 h-3 text-emerald-500" />
              Live Feed Active
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Live Buying Signals Radar
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSyncToFirestore}
            disabled={isSyncingFirestore || opportunities.length === 0}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Database className="w-4 h-4 text-[#155eef]" />
            <span>{isSyncingFirestore ? 'Syncing...' : 'Sync to Firestore'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl glass-card border border-slate-200/70 dark:border-slate-800/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#155eef] dark:text-blue-400 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">
              {stats.totalSignals || signals.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Tracked Signals
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-rose-200/70 dark:border-rose-900/40 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 leading-none">
              {stats.highIntentCount || opportunities.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              High Intent (80+)
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-emerald-200/70 dark:border-emerald-900/40 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">
              {stats.hiringCount || signals.filter((s) => s.signalType === 'hiring').length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Hiring Surges
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-amber-200/70 dark:border-amber-900/40 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">
              {stats.fundingCount || signals.filter((s) => s.signalType === 'funding').length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Funding Events
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-indigo-200/70 dark:border-indigo-900/40 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">
              {stats.expansionCount || signals.filter((s) => s.signalType === 'expansion').length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Expansions
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-purple-200/70 dark:border-purple-900/40 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">
              {stats.leadershipCount || signals.filter((s) => s.signalType === 'leadership').length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Exec Moves
            </div>
          </div>
        </div>
      </div>

      {/* Live AI Radar Scanner Bar */}
      <div className="p-5 glass-card rounded-2xl shadow-sm border border-blue-100/90 dark:border-blue-900/40 space-y-3">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#155eef]" />
          <span>Live Radar Grounding Scanner</span>
        </label>

        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isScanning) handleRunLiveScan();
              }}
              placeholder="e.g. California law firms expanding, New York commercial auto fleet services, Texas B2B SaaS hiring..."
              className="w-full px-4 py-3 text-xs bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#155eef]/40"
            />
          </div>

          <button
            onClick={handleRunLiveScan}
            disabled={isScanning}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition cursor-pointer shrink-0 disabled:opacity-60"
          >
            {isScanning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Radio className="w-4 h-4 text-white" />
            )}
            <span>{isScanning ? 'Scanning Live Wires...' : 'Run Live Radar Scan'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400">Quick Radar Targets:</span>
          {[
            'Managing partner appointments in law firms',
            'Commercial auto repair fleet expansions',
            'Healthcare and dental clinic acquisitions',
            'Series A/B tech startups hiring sales teams',
          ].map((preset) => (
            <button
              key={preset}
              onClick={() => setScanQuery(preset)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] transition cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tabs & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveView('radar')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeView === 'radar'
                  ? 'bg-white dark:bg-slate-900 text-[#155eef] dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Opportunities & Leads ({opportunities.length})</span>
            </button>

            <button
              onClick={() => setActiveView('news')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeView === 'news'
                  ? 'bg-white dark:bg-slate-900 text-[#155eef] dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live News Stream ({newsFeed.length})</span>
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search signals..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="all">All Signal Types</option>
              <option value="hiring">Hiring Surges</option>
              <option value="funding">Funding Rounds</option>
              <option value="expansion">Expansions</option>
              <option value="leadership">Exec Appointments</option>
              <option value="product">Product Launches</option>
              <option value="partnership">Partnerships</option>
            </select>

            {activeView === 'radar' && (
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value="all">All Intent Tiers</option>
                <option value="High Intent">High Intent (80+)</option>
                <option value="Moderate Intent">Moderate Intent</option>
                <option value="Emerging Signal">Emerging Signal</option>
              </select>
            )}
          </div>
        </div>

        {/* Radar View: High Intent Daily Opportunities */}
        {activeView === 'radar' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOpportunities.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <Radio className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 animate-pulse" />
                <p className="text-sm font-medium">No matching buying signals found.</p>
                <p className="text-xs">Run a Live Radar Scan above to search live wires for active business triggers.</p>
              </div>
            ) : (
              filteredOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-5 rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-[#155eef]/40 dark:hover:border-blue-500/40 transition space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {opp.companyName}
                        </h3>
                        <a
                          href={opp.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-[#155eef] transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{opp.industry}</span>
                        <span>•</span>
                        <span>{opp.location}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/40 text-[11px] font-bold flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                        <span>Intent Score {opp.buyingSignalScore}/100</span>
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {opp.intentTier}
                      </span>
                    </div>
                  </div>

                  {/* Reasons & Signals Snippet */}
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Active Buying Trigger:
                    </div>
                    {opp.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>

                  {/* Decision Maker Box */}
                  {opp.keyContact && (
                    <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-[#155eef] dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                          {opp.keyContact.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {opp.keyContact.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {opp.keyContact.role}
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 text-[10px] font-semibold">
                        {opp.keyContact.confidence || 'Verified'}
                      </span>
                    </div>
                  )}

                  {/* Outreach Angle Recommendation */}
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-900/30 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900 dark:text-amber-200 mr-1">Recommended Outreach Angle:</span>
                      <span>{opp.bestAction}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleCopy(`${opp.companyName} - ${opp.website}`, opp.id)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedId === opp.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === opp.id ? 'Copied' : 'Copy Lead'}</span>
                    </button>

                    <button
                      onClick={() => {
                        onImportToScraper([opp.website]);
                        onShowToast(`Transferred ${opp.companyName} to Website Scraper!`, 'success');
                        onNavigateToScraper();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#155eef] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <span>Deep Scrape Website</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* News Feed Stream View */}
        {activeView === 'news' && (
          <div className="space-y-3">
            {filteredNews.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                <Activity className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-medium">No commercial news detected in this filter.</p>
              </div>
            ) : (
              filteredNews.map((news) => (
                <div
                  key={news.id}
                  className="p-4 rounded-xl glass-card border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-[#155eef] dark:text-blue-300">
                        {news.signalType}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {news.companyName}
                      </span>
                      <span className="text-[11px] text-slate-400">• {news.publishedDate}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {news.headline}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {news.summary}
                    </p>
                    <div className="text-[11px] text-[#155eef] dark:text-blue-400 pt-1 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{news.aiRelevanceExplanation}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {news.sourceUrl && (
                      <a
                        href={news.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                      >
                        <span>Source</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
