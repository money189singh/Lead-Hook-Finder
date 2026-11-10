import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Globe,
  Server,
  Zap,
  RefreshCw,
  Sliders,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Activity,
  Check,
  Percent,
  Cpu,
  Fingerprint,
  ChevronRight,
  Database,
  Search,
} from 'lucide-react';
import { ProxyNode, ProxyPoolConfig, AntiBotConfig, ContentPruningConfig, QueueMetrics, ScrapeJob, ScrapeSettings } from '../types';

interface ResiliencePageProps {
  currentJob: ScrapeJob | null;
  settings: ScrapeSettings | null;
  onShowToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onRefreshSettings: () => void;
}

export const ResiliencePage: React.FC<ResiliencePageProps> = ({
  currentJob,
  settings,
  onShowToast,
  onRefreshSettings,
}) => {
  const [proxyConfig, setProxyConfig] = useState<ProxyPoolConfig | null>(null);
  const [proxies, setProxies] = useState<ProxyNode[]>([]);
  const [antiBotConfig, setAntiBotConfig] = useState<AntiBotConfig | null>(null);
  const [pruningConfig, setPruningConfig] = useState<ContentPruningConfig | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [testingProxyId, setTestingProxyId] = useState<string | null>(null);
  const [showAddProxyModal, setShowAddProxyModal] = useState<boolean>(false);

  // New proxy form state
  const [newProxy, setNewProxy] = useState<Partial<ProxyNode>>({
    protocol: 'http',
    host: '',
    port: 8080,
    username: '',
    password: '',
    country: 'US',
    enabled: true,
  });

  // Concurrency and Polite Delay state
  const [concurrency, setConcurrency] = useState<number>(settings?.concurrency || 5);
  const [requestDelayMs, setRequestDelayMs] = useState<number>(settings?.request_delay_ms || 800);

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'proxies' | 'antibot' | 'pruning' | 'queue'>('proxies');

  // Load configs from server
  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const [proxyRes, antiBotRes, pruningRes] = await Promise.all([
        fetch('/api/proxy/pool'),
        fetch('/api/antibot/config'),
        fetch('/api/pruning/config'),
      ]);

      if (proxyRes.ok) {
        const data = await proxyRes.json();
        setProxyConfig(data.config);
        setProxies(data.proxies || []);
      }
      if (antiBotRes.ok) {
        const data = await antiBotRes.json();
        setAntiBotConfig(data.config);
      }
      if (pruningRes.ok) {
        const data = await pruningRes.json();
        setPruningConfig(data.config);
      }
    } catch (err: any) {
      console.error('Failed to load resilience configs:', err);
      onShowToast(err.message || 'Failed to load resilience configurations', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Update Proxy Pool config
  const handleUpdateProxyConfig = async (patch: Partial<ProxyPoolConfig>) => {
    if (!proxyConfig) return;
    const updated = { ...proxyConfig, ...patch };
    setProxyConfig(updated);
    try {
      const res = await fetch('/api/proxy/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        onShowToast('Proxy pool settings updated', 'success');
        onRefreshSettings();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Update Anti-Bot config
  const handleUpdateAntiBot = async (patch: Partial<AntiBotConfig>) => {
    if (!antiBotConfig) return;
    const updated = { ...antiBotConfig, ...patch };
    setAntiBotConfig(updated);
    try {
      const res = await fetch('/api/antibot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        onShowToast('Anti-bot fingerprint settings updated', 'success');
        onRefreshSettings();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Update Pruning config
  const handleUpdatePruning = async (patch: Partial<ContentPruningConfig>) => {
    if (!pruningConfig) return;
    const updated = { ...pruningConfig, ...patch };
    setPruningConfig(updated);
    try {
      const res = await fetch('/api/pruning/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        onShowToast('Smart Content Pruning settings updated', 'success');
        onRefreshSettings();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Save Task Queue concurrency & domain polite delay
  const handleSaveQueueSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concurrency,
          request_delay_ms: requestDelayMs,
        }),
      });
      if (res.ok) {
        onShowToast('Queue worker concurrency & delay saved', 'success');
        onRefreshSettings();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Test a single proxy
  const handleTestProxy = async (proxyId: string) => {
    setTestingProxyId(proxyId);
    try {
      const res = await fetch('/api/proxy/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proxyId }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(`Proxy test passed! Latency: ${data.latencyMs}ms (${data.ip})`, 'success');
      } else {
        onShowToast(`Proxy test failed: ${data.message}`, 'error');
      }
      loadConfigs();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setTestingProxyId(null);
    }
  };

  // Toggle proxy node enabled
  const handleToggleProxy = async (proxy: ProxyNode) => {
    try {
      const updated = { ...proxy, enabled: !proxy.enabled };
      const res = await fetch('/api/proxy/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        loadConfigs();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Delete a proxy
  const handleDeleteProxy = async (id: string) => {
    try {
      const res = await fetch(`/api/proxy/item/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onShowToast('Proxy removed', 'info');
        loadConfigs();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Add new proxy node
  const handleAddProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProxy.host || !newProxy.port) {
      onShowToast('Please provide a host and port', 'error');
      return;
    }
    try {
      const res = await fetch('/api/proxy/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProxy),
      });
      if (res.ok) {
        onShowToast('Proxy node added successfully', 'success');
        setShowAddProxyModal(false);
        setNewProxy({
          protocol: 'http',
          host: '',
          port: 8080,
          username: '',
          password: '',
          country: 'US',
          enabled: true,
        });
        loadConfigs();
      } else {
        const err = await res.json();
        onShowToast(err.error || 'Failed to add proxy', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Queue metrics from active or recent job
  const queueMetrics: QueueMetrics | undefined = currentJob?.queue_metrics;
  const pruningStats = currentJob?.pruning_stats;

  return (
    <div id="resilience-page" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 flex items-center justify-center text-[#155eef] dark:text-blue-400 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                High-Throughput & Crawl Resilience
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                  Enterprise Grade
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white/70 dark:bg-[#0f1424]/70 border border-blue-100 dark:border-blue-900/30 flex items-center gap-2.5 shadow-xs">
            <Globe className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Proxy Pool</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {proxyConfig?.enabled ? `${proxies.filter((p) => p.enabled).length} Active Nodes` : 'Direct Mode'}
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-white/70 dark:bg-[#0f1424]/70 border border-blue-100 dark:border-blue-900/30 flex items-center gap-2.5 shadow-xs">
            <Fingerprint className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Anti-Bot Shield</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {antiBotConfig?.rotateUserAgents ? 'Randomized Fingerprints' : 'Standard'}
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-white/70 dark:bg-[#0f1424]/70 border border-blue-100 dark:border-blue-900/30 flex items-center gap-2.5 shadow-xs">
            <Percent className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">DOM Pruning</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {pruningStats?.percentSaved ? `-${pruningStats.percentSaved}% Tokens` : 'Active'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-blue-100 dark:border-blue-900/30 pb-2">
        <button
          id="tab-proxies"
          onClick={() => setActiveSubTab('proxies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeSubTab === 'proxies'
              ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#12192e]'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Rotating Proxy Pools</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSubTab === 'proxies' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950/60 text-[#155eef] dark:text-blue-300'}`}>
            {proxies.length}
          </span>
        </button>

        <button
          id="tab-antibot"
          onClick={() => setActiveSubTab('antibot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeSubTab === 'antibot'
              ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#12192e]'
          }`}
        >
          <Fingerprint className="w-3.5 h-3.5" />
          <span>Anti-Bot Fingerprinting</span>
        </button>

        <button
          id="tab-pruning"
          onClick={() => setActiveSubTab('pruning')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeSubTab === 'pruning'
              ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#12192e]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Smart DOM Pruning</span>
        </button>

        <button
          id="tab-queue"
          onClick={() => setActiveSubTab('queue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeSubTab === 'queue'
              ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-white hover:bg-blue-50 dark:hover:bg-[#12192e]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Queue & Concurrency</span>
        </button>
      </div>

      {/* 1. ROTATING PROXY POOL TAB */}
      {activeSubTab === 'proxies' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="glass-card p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
            <div className="flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="toggle-proxy-pool"
                  checked={Boolean(proxyConfig?.enabled)}
                  onChange={(e) => handleUpdateProxyConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#155eef]"></div>
                <span className="ml-3 text-xs font-semibold text-slate-900 dark:text-white">
                  {proxyConfig?.enabled ? 'Proxy Pool Active' : 'Proxy Pool Disabled (Direct IP)'}
                </span>
              </label>

              {proxyConfig?.enabled && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-l border-blue-100 dark:border-blue-900/30 pl-4">
                  <span>Rotation Strategy:</span>
                  <select
                    id="proxy-rotation-mode"
                    value={proxyConfig.rotationMode || 'round-robin'}
                    onChange={(e) => handleUpdateProxyConfig({ rotationMode: e.target.value as any })}
                    className="glass-input rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="round-robin">Round-Robin (Balanced)</option>
                    <option value="fastest">Fastest Ping (Lowest Latency)</option>
                    <option value="random">Pure Random (Jittered)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-refresh-proxies"
                onClick={loadConfigs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#152042] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button
                id="btn-add-proxy"
                onClick={() => setShowAddProxyModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Proxy Node
              </button>
            </div>
          </div>

          {/* Proxy Node Cards / Table */}
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-blue-100/80 dark:border-blue-900/30">
            <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
                Configured Proxy Nodes ({proxies.length})
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Supports residential, datacenter, and mobile proxies (HTTP, HTTPS, SOCKS5)
              </span>
            </div>

            {proxies.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Globe className="w-10 h-10 text-blue-300 dark:text-blue-600 mx-auto" />
                <div className="text-slate-800 dark:text-slate-200 font-semibold text-sm">No custom proxies registered yet</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Add residential or datacenter proxies from providers like Bright Data, Oxylabs, Smartproxy, or custom SOCKS5 nodes to bypass geoblocks and IP rate limits.
                </p>
                <button
                  onClick={() => setShowAddProxyModal(true)}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add First Proxy Node
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-blue-50/50 dark:bg-[#0f1424]/60 border-b border-blue-100 dark:border-blue-900/30 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Endpoint</th>
                      <th className="py-3 px-4">Protocol</th>
                      <th className="py-3 px-4">Geo / Region</th>
                      <th className="py-3 px-4">Latency</th>
                      <th className="py-3 px-4">Success Rate</th>
                      <th className="py-3 px-4">Total Requests</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 dark:divide-blue-900/20 font-mono">
                    {proxies.map((proxy) => {
                      const isTesting = testingProxyId === proxy.id;
                      const successRate =
                        proxy.totalRequests > 0
                          ? Math.round((proxy.successfulRequests / proxy.totalRequests) * 100)
                          : 100;

                      return (
                        <tr key={proxy.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium border ${
                                !proxy.enabled
                                  ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  : proxy.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  !proxy.enabled ? 'bg-slate-400' : proxy.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {!proxy.enabled ? 'Disabled' : proxy.status === 'active' ? 'Active' : 'Unreachable'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {proxy.host}:{proxy.port}
                          </td>
                          <td className="py-3 px-4">
                            <span className="uppercase text-[10px] px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 font-sans font-bold">
                              {proxy.protocol}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-700 dark:text-slate-300">
                            {proxy.country ? `🌍 ${proxy.country.toUpperCase()}` : 'Global'}
                          </td>
                          <td className="py-3 px-4">
                            {proxy.latencyMs ? (
                              <span className={proxy.latencyMs < 400 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                                {proxy.latencyMs}ms
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={
                                successRate > 90 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : successRate > 60 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'
                              }
                            >
                              {successRate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-sans">
                            {proxy.totalRequests} reqs
                          </td>
                          <td className="py-3 px-4 text-right font-sans space-x-2">
                            <button
                              id={`test-proxy-${proxy.id}`}
                              onClick={() => handleTestProxy(proxy.id)}
                              disabled={isTesting}
                              className="px-2.5 py-1 bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#152042] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 rounded-lg text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 text-[#155eef] dark:text-blue-400" />}
                              Test
                            </button>
                            <button
                              id={`toggle-proxy-${proxy.id}`}
                              onClick={() => handleToggleProxy(proxy)}
                              className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer border ${
                                proxy.enabled
                                  ? 'bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#152042] text-slate-700 dark:text-slate-300 border-blue-100 dark:border-blue-900/30'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {proxy.enabled ? 'Pause' : 'Enable'}
                            </button>
                            <button
                              id={`delete-proxy-${proxy.id}`}
                              onClick={() => handleDeleteProxy(proxy.id)}
                              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Delete proxy"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ANTI-BOT FINGERPRINT SHIELD TAB */}
      {activeSubTab === 'antibot' && antiBotConfig && (
        <div className="glass-card p-6 rounded-2xl space-y-6 shadow-sm border border-purple-100/80 dark:border-purple-900/30">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Anti-Scraping Defense & TLS/Header Fingerprint Randomizer
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Randomizes user-agent pools, sec-ch-ua client hints, humanized mouse jitter delay, and TLS header order to bypass Cloudflare, Akamai, and Datadome.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* User Agent Rotation */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">User-Agent Rotation</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Cycles modern Chrome, Firefox, Safari & Edge desktop agents per request.</p>
                </div>
                <input
                  type="checkbox"
                  id="antibot-rotate-ua"
                  checked={antiBotConfig.rotateUserAgents}
                  onChange={(e) => handleUpdateAntiBot({ rotateUserAgents: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>

            {/* Sec-CH-UA Client Hints */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Sec-CH-UA Client Hints</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Matches client-hints (platform, model, bitness) to the randomized UA.</p>
                </div>
                <input
                  type="checkbox"
                  id="antibot-client-hints"
                  checked={antiBotConfig.randomizeClientHints}
                  onChange={(e) => handleUpdateAntiBot({ randomizeClientHints: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>

            {/* Randomized Accept Headers / Client Hints */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Randomize Client Hints</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Emits standard browser Sec-CH-UA and Sec-CH-UA-Mobile hints.</p>
                </div>
                <input
                  type="checkbox"
                  id="antibot-accept-headers"
                  checked={antiBotConfig.randomizeClientHints}
                  onChange={(e) => handleUpdateAntiBot({ randomizeClientHints: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>

            {/* HTTP Headers Order Randomization */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Randomize HTTP Headers Order</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Randomizes header ordering to bypass robotic fingerprinting.</p>
                </div>
                <input
                  type="checkbox"
                  id="antibot-simulate-behavior"
                  checked={antiBotConfig.randomizeHeadersOrder}
                  onChange={(e) => handleUpdateAntiBot({ randomizeHeadersOrder: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Humanized Jitter Delay Range */}
          <div className="p-5 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Humanized Jitter Delay Between Requests
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adds a randomized Gaussian delay between each page crawl so scraper traffic cannot be flagged by robotic interval detectors.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                {antiBotConfig.minJitterMs}ms – {antiBotConfig.maxJitterMs}ms
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1 font-medium">Min Jitter Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  max="5000"
                  step="50"
                  value={antiBotConfig.minJitterMs}
                  onChange={(e) => handleUpdateAntiBot({ minJitterMs: parseInt(e.target.value) || 0 })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1 font-medium">Max Jitter Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="50"
                  value={antiBotConfig.maxJitterMs}
                  onChange={(e) => handleUpdateAntiBot({ maxJitterMs: parseInt(e.target.value) || 1000 })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SMART DOM CONTENT PRUNING TAB */}
      {activeSubTab === 'pruning' && pruningConfig && (
        <div className="glass-card p-6 rounded-2xl space-y-6 shadow-sm border border-purple-100/80 dark:border-purple-900/30">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Smart DOM Content Pruner & Token Optimizer
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Strips noisy boilerplates, cookie banners, navigation menus, and footers before feeding clean semantic text into the AI model. Reduces token costs by 60–80% and accelerates extraction speed.
            </p>
          </div>

          {/* Live Pruning Stats Meter if available */}
          {pruningStats && pruningStats.rawBytesTotal > 0 && (
            <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-purple-900 dark:text-purple-200">Active Job Token Reduction</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  {pruningStats.percentSaved}% Saved (~{pruningStats.tokensEstimatedSaved.toLocaleString()} tokens)
                </span>
              </div>
              <div className="w-full h-2 bg-purple-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${pruningStats.percentSaved}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <div>Raw Payload: {(pruningStats.rawBytesTotal / 1024).toFixed(1)} KB</div>
                <div>Pruned Payload: {(pruningStats.prunedBytesTotal / 1024).toFixed(1)} KB</div>
                <div>Schema Contacts: {pruningStats.schemaEntitiesExtracted}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Strip Boilerplates */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Strip Navigation & Footers</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Eliminates header, nav, footer, style, svg, and form tags.</p>
                </div>
                <input
                  type="checkbox"
                  id="prune-boilerplates"
                  checked={pruningConfig.stripNavAndFooter}
                  onChange={(e) => handleUpdatePruning({ stripNavAndFooter: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>

            {/* Strip Cookie Banners & Ads */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Strip Cookie Banners & Popups</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Removes GDPR banners, cookie popups, and banner advertising overlays.</p>
                </div>
                <input
                  type="checkbox"
                  id="prune-cookie-banners"
                  checked={pruningConfig.stripCookieBanners}
                  onChange={(e) => handleUpdatePruning({ stripCookieBanners: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>

            {/* Schema.org Microdata Extraction */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Schema.org JSON-LD Harvesting</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Parses structured JSON-LD Person and Organization contacts with 0% hallucination.</p>
                </div>
                <input
                  type="checkbox"
                  id="prune-schema-org"
                  checked={pruningConfig.extractSchemaOrgMicrodata}
                  onChange={(e) => handleUpdatePruning({ extractSchemaOrgMicrodata: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>

            {/* Contextual Contact Windows */}
            <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Contextual Snippet Slicing</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pins paragraphs surrounding @ email addresses and telephone links.</p>
                </div>
                <input
                  type="checkbox"
                  id="prune-contextual"
                  checked={pruningConfig.extractContextualMailtoSnippets}
                  onChange={(e) => handleUpdatePruning({ extractContextualMailtoSnippets: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Max Semantic Bytes Slider */}
          <div className="p-5 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white">
                Max Semantic Token Budget Per Page
              </label>
              <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                {pruningConfig.maxTokenBudgetPerPage} tokens (~{((pruningConfig.maxTokenBudgetPerPage * 4) / 1024).toFixed(0)} KB)
              </span>
            </div>
            <input
              type="range"
              min="2000"
              max="32000"
              step="1000"
              value={pruningConfig.maxTokenBudgetPerPage}
              onChange={(e) => handleUpdatePruning({ maxTokenBudgetPerPage: parseInt(e.target.value) })}
              className="w-full accent-purple-600"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Truncates oversized corporate documentation or terms-of-service pages while prioritizing team and contact sections.
            </p>
          </div>
        </div>
      )}

      {/* 4. TASK QUEUE & CONCURRENCY TAB */}
      {activeSubTab === 'queue' && (
        <div className="space-y-6">
          {/* Live Queue Performance Card */}
          {queueMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-4 rounded-xl shadow-sm border border-purple-100/80 dark:border-purple-900/30">
                <div className="text-xs text-slate-500 dark:text-slate-400">Pending Domains in Queue</div>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {queueMetrics.pendingTasks}
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl shadow-sm border border-purple-100/80 dark:border-purple-900/30">
                <div className="text-xs text-slate-500 dark:text-slate-400">Active Workers</div>
                <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                  {queueMetrics.activeWorkers} / {concurrency}
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl shadow-sm border border-purple-100/80 dark:border-purple-900/30">
                <div className="text-xs text-slate-500 dark:text-slate-400">Crawl Throughput</div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {queueMetrics.throughputPerMinute} domains/min
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl shadow-sm border border-purple-100/80 dark:border-purple-900/30">
                <div className="text-xs text-slate-500 dark:text-slate-400">Avg Latency Per Domain</div>
                <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                  {queueMetrics.avgDomainCrawlMs > 0 ? `${(queueMetrics.avgDomainCrawlMs / 1000).toFixed(1)}s` : '0s'}
                </div>
              </div>
            </div>
          )}

          {/* Queue Settings Form */}
          <div className="glass-card p-6 rounded-2xl space-y-6 shadow-sm border border-purple-100/80 dark:border-purple-900/30">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Distributed Work Queue & Polite Concurrency Controls
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Regulates worker process concurrency and domain polite delay to prevent event-loop exhaustion and IP throttling.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Concurrency Slider */}
              <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white">Worker Concurrency</label>
                  <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">{concurrency} concurrent domains</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recommended: 3–5 for standard servers; up to 15–20 when rotating proxy pool is active.
                </p>
              </div>

              {/* Polite Delay Slider */}
              <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white">Per-Domain Polite Delay</label>
                  <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">{requestDelayMs} ms</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="100"
                  value={requestDelayMs}
                  onChange={(e) => setRequestDelayMs(parseInt(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Minimum wait interval before issuing consecutive page requests to the same target domain.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                id="btn-save-queue-settings"
                onClick={handleSaveQueueSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Queue Concurrency
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PROXY MODAL */}
      {showAddProxyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-purple-100/80 dark:border-purple-900/30 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Register New Proxy Node
              </h3>
              <button
                onClick={() => setShowAddProxyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProxy} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Protocol</label>
                  <select
                    id="new-proxy-protocol"
                    value={newProxy.protocol}
                    onChange={(e) => setNewProxy({ ...newProxy, protocol: e.target.value as any })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Geo / Region</label>
                  <input
                    type="text"
                    id="new-proxy-country"
                    placeholder="US, AE, GB, CN..."
                    value={newProxy.country}
                    onChange={(e) => setNewProxy({ ...newProxy, country: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Host / IP *</label>
                  <input
                    type="text"
                    id="new-proxy-host"
                    required
                    placeholder="proxy.example.com or 192.168.1.1"
                    value={newProxy.host}
                    onChange={(e) => setNewProxy({ ...newProxy, host: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Port *</label>
                  <input
                    type="number"
                    id="new-proxy-port"
                    required
                    placeholder="8080"
                    value={newProxy.port}
                    onChange={(e) => setNewProxy({ ...newProxy, port: parseInt(e.target.value) || 8080 })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Username (Optional)</label>
                  <input
                    type="text"
                    id="new-proxy-user"
                    placeholder="user_123"
                    value={newProxy.username}
                    onChange={(e) => setNewProxy({ ...newProxy, username: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password (Optional)</label>
                  <input
                    type="password"
                    id="new-proxy-pass"
                    placeholder="••••••••"
                    value={newProxy.password}
                    onChange={(e) => setNewProxy({ ...newProxy, password: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-purple-100 dark:border-purple-900/30">
                <button
                  type="button"
                  onClick={() => setShowAddProxyModal(false)}
                  className="px-4 py-2 bg-white hover:bg-purple-50 dark:bg-[#181628] dark:hover:bg-[#201d36] text-slate-700 dark:text-slate-300 border border-purple-100 dark:border-purple-900/30 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-new-proxy"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Proxy Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
