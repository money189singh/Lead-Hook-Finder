import React, { useState, useEffect } from 'react';
import {
  Globe,
  MapPin,
  Search,
  CheckCircle2,
  Users,
  Mail,
  Play,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  Plus,
  GitBranch,
  Cloud,
  Server,
  Zap,
  Radio,
  RefreshCw,
  Bot,
  Cpu,
  Layers,
  Webhook,
  Building,
  Settings,
} from 'lucide-react';
import { ScrapeJob, ScrapeSettings } from '../types';
import { NavTab } from '../components/Sidebar';
import { GlassPanel, GlassButton } from '../components/glass';

interface DashboardPageProps {
  currentJob: ScrapeJob | null;
  settings: ScrapeSettings | null;
  onNavigate: (tab: NavTab) => void;
  onStartQuickBatch: (urls: string[]) => void;
  onExportXlsx: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentJob,
  settings,
  onNavigate,
  onStartQuickBatch,
  onExportXlsx,
}) => {
  const [quickUrlInput, setQuickUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cronStatus, setCronStatus] = useState<any>(null);
  const [workerHealth, setWorkerHealth] = useState<any>(null);
  const [isTestingCloud, setIsTestingCloud] = useState(false);

  useEffect(() => {
    fetch('/api/scheduler/cronjob-org')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCronStatus(data))
      .catch(() => {});

    fetch('/api/discovery/worker/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setWorkerHealth(data))
      .catch(() => {});
  }, []);

  const handleTestCloudPing = async () => {
    setIsTestingCloud(true);
    try {
      const res = await fetch('/api/scheduler/cron-tick?force=true', { method: 'POST' });
      if (res.ok) {
        setCronStatus((prev: any) => ({
          ...prev,
          totalPingsReceived: (prev?.totalPingsReceived || 0) + 1,
          lastIncomingPingAt: new Date().toISOString(),
        }));
      }
    } catch {}
    finally {
      setIsTestingCloud(false);
    }
  };

  const totalWebsites = currentJob?.total_websites || 0;
  const completed = currentJob?.completed_websites || 0;
  const contactsFound = currentJob?.contacts_found || 0;
  const emailsFound = currentJob?.emails_found || 0;
  const isScraping = currentJob?.status === 'running';
  const successRate = totalWebsites > 0 ? Math.round((completed / totalWebsites) * 100) : 0;

  const handleStartQuickBatch = () => {
    const urls = quickUrlInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 3);
    if (urls.length > 0) {
      onStartQuickBatch(urls);
      setQuickUrlInput('');
    }
  };

  const sampleUrls = [
    'https://stripe.com',
    'https://openai.com',
    'https://anthropic.com',
    'https://datadoghq.com',
  ];

  return (
    <div id="dashboard-page" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <GlassPanel
        variant="elevated"
        rounded="xl"
        className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-white/70 dark:border-white/10 shadow-lg"
      >
        <div className="space-y-0.5">
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Lead Generation Overview</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <GlassButton
            size="xs"
            variant="secondary"
            onClick={() => onNavigate('workflows')}
            icon={<GitBranch className="w-3.5 h-3.5 text-cyan-500" />}
          >
            AI Workflows
          </GlassButton>

          <GlassButton
            size="xs"
            variant="secondary"
            onClick={() => onNavigate('discovery')}
            icon={<Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
          >
            AI Discovery
          </GlassButton>

          <GlassButton
            size="xs"
            variant="secondary"
            onClick={() => onNavigate('google-maps')}
            icon={<MapPin className="w-3.5 h-3.5 text-rose-500" />}
          >
            Maps Scraper
          </GlassButton>

          <GlassButton
            size="xs"
            variant="secondary"
            onClick={() => onNavigate('settings')}
            icon={<Settings className="w-3.5 h-3.5 text-slate-500" />}
          >
            Settings
          </GlassButton>

          <GlassButton
            size="xs"
            variant="primary"
            onClick={() => onNavigate('scraper')}
            icon={<Play className="w-3.5 h-3.5 fill-white" />}
          >
            New Batch
          </GlassButton>
        </div>
      </GlassPanel>

      {/* 5 Enterprise Lead Hunting & Intelligence Modules - Prominently Positioned at Top */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Enterprise Lead Engines</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              NEW
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card 1: Autonomous Hunting Agents */}
          <div
            id="dash-launch-hunting-agents"
            onClick={() => onNavigate('hunting-agents')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  24/7 AUTO
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Lead Hunting Agents
              </h3>
            </div>
            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Open Hunters</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 2: Website Tech Stack Detector */}
          <div
            id="dash-launch-tech-detector"
            onClick={() => onNavigate('tech-detector')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-600 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
                  <Cpu className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                  BUILTWITH
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                Tech Stack Detector
              </h3>
            </div>
            <div className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Inspect Stack</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 3: Waterfall Decision-Maker Finder */}
          <div
            id="dash-launch-waterfall"
            onClick={() => onNavigate('waterfall')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  PHONE & PRO
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Waterfall Enrichment
              </h3>
            </div>
            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Start Waterfall</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 4: Inbound Webhook Listener */}
          <div
            id="dash-launch-inbound"
            onClick={() => onNavigate('inbound-gateway')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <Webhook className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  1-CLICK
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Inbound & Extension
              </h3>
            </div>
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Open Gateway</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 5: Team Collaboration & Workspaces */}
          <div
            id="dash-launch-workspaces"
            onClick={() => onNavigate('workspaces')}
            className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                  <Building className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  TEAM ROLES
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Team Workspaces
              </h3>
            </div>
            <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Manage Team</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <GlassPanel rounded="xl" className="p-5 border-white/60 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Websites Processed</span>
            <Globe className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {completed}
            </span>
            <span className="text-xs text-slate-400">/ {totalWebsites}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isScraping ? 'Crawler running' : 'System ready'}</span>
          </div>
        </GlassPanel>

        {/* Metric 2 */}
        <GlassPanel rounded="xl" className="p-5 border-white/60 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Contacts Discovered</span>
            <Users className="w-4 h-4 text-[#155eef]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {contactsFound}
            </span>
          </div>
        </GlassPanel>

        {/* Metric 3 */}
        <GlassPanel rounded="xl" className="p-5 border-white/60 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Verified Emails</span>
            <Mail className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {emailsFound}
            </span>
          </div>
        </GlassPanel>

        {/* Metric 4 */}
        <GlassPanel rounded="xl" className="p-5 border-white/60 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Batch Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {successRate}%
            </span>
          </div>
        </GlassPanel>
      </div>

      {/* Cloud Autopilot Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-indigo-900/50 shadow-md text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 animate-pulse text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Autopilot Scraping Engine
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                cronStatus?.connected || workerHealth?.status === 'online'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {cronStatus?.connected ? 'Online 24/7' : workerHealth?.status === 'online' ? 'Oracle Worker Online' : 'Cloud Pinger Ready'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={handleTestCloudPing}
            disabled={isTestingCloud}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingCloud ? 'animate-spin' : ''}`} />
            <span>{isTestingCloud ? 'Pinging...' : 'Test Cloud Ping'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('discovery')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-cyan-300" />
            <span>Schedule Settings</span>
          </button>
        </div>
      </div>

      {/* Main Action Workspaces */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspace A: Quick Batch Scrape */}
        <GlassPanel variant="elevated" rounded="xl" className="p-6 border-white/70 dark:border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#155eef]" />
              <span>Instant Website Batch Scrape</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">1 URL per line</span>
          </div>

          <div className="space-y-3">
            <textarea
              id="dash-quick-urls-textarea"
              value={quickUrlInput}
              onChange={(e) => setQuickUrlInput(e.target.value)}
              placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
              rows={4}
              className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#155eef]/10 focus:border-[#155eef] transition resize-none shadow-2xs"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>Samples:</span>
                {sampleUrls.slice(0, 2).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuickUrlInput((prev) => (prev ? `${prev}\n${s}` : s))}
                    className="text-[#155eef] dark:text-blue-400 hover:underline cursor-pointer font-medium"
                  >
                    {s.replace('https://', '')}
                  </button>
                ))}
              </div>

              <GlassButton
                id="dash-quick-start-btn"
                size="sm"
                variant="primary"
                onClick={handleStartQuickBatch}
                disabled={!quickUrlInput.trim()}
                icon={<Play className="w-3.5 h-3.5 fill-white" />}
              >
                Start Scraping
              </GlassButton>
            </div>
          </div>
        </GlassPanel>

        {/* Workspace B: AI Prospect & Maps Discovery */}
        <GlassPanel variant="elevated" rounded="xl" className="p-6 border-white/70 dark:border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Target Prospect Discovery</span>
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Live Web
            </span>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onNavigate('discovery');
                }}
                placeholder="e.g. B2B SaaS startups in Austin with Series A funding..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#155eef]/10 focus:border-[#155eef] transition shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('algo-search')}
                className="p-3.5 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 border border-indigo-200/60 dark:border-indigo-900/40 text-left transition-all cursor-pointer hover:-translate-y-0.5 bg-indigo-50/40 dark:bg-indigo-950/20"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  <span>Algo Search</span>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('social-radar')}
                className="p-3.5 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 border border-rose-200/60 dark:border-rose-900/40 text-left transition-all cursor-pointer hover:-translate-y-0.5 bg-rose-50/40 dark:bg-rose-950/20"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-300">
                  <span>Social Demand</span>
                  <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('discovery')}
                className="p-3.5 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 border border-white/60 dark:border-white/5 text-left transition-all cursor-pointer hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>AI Discovery</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('google-maps')}
                className="p-3.5 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 border border-white/60 dark:border-white/5 text-left transition-all cursor-pointer hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Maps Leads</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Results & Export Banner (if contacts found) */}
      {contactsFound > 0 && (
        <GlassPanel rounded="xl" className="p-4 flex items-center justify-between gap-4 border-white/70 dark:border-white/10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {contactsFound} contacts extracted in current session
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              size="xs"
              variant="secondary"
              onClick={() => onNavigate('results')}
            >
              View Results
            </GlassButton>
            <GlassButton
              size="xs"
              variant="primary"
              onClick={onExportXlsx}
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              Export Excel
            </GlassButton>
          </div>
        </GlassPanel>
      )}
    </div>
  );
};
