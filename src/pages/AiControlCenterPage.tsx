import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Server,
  Zap,
  Globe,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Activity,
  Terminal,
  ShieldCheck,
  Cpu,
  Layers,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import {
  AiCredential,
  FailoverEvent,
  ModelCapability,
  ProviderType,
  RoutingStrategy,
  StandardErrorCode,
} from '../types';

interface ProviderDefinition {
  id: ProviderType;
  name: string;
  group: 'global' | 'chinese' | 'custom';
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  supportsModelDiscovery: boolean;
  supportsJsonMode: boolean;
  supportsRegions?: boolean;
  regions?: { id: string; name: string; baseUrl: string }[];
  recommendedModels: ModelCapability[];
  docsUrl: string;
}

interface AiControlCenterPageProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onProvidersUpdated?: () => void;
}

export const AiControlCenterPage: React.FC<AiControlCenterPageProps> = ({
  onShowToast,
  onProvidersUpdated,
}) => {
  const [definitions, setDefinitions] = useState<Record<string, ProviderDefinition>>({});
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  const [strategy, setStrategy] = useState<RoutingStrategy>('auto');
  const [failoverLogs, setFailoverLogs] = useState<FailoverEvent[]>([]);
  const [filterGroup, setFilterGroup] = useState<'all' | 'chinese' | 'global' | 'custom'>('all');
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string; latencyMs?: number }>
  >({});
  const [discoveredModels, setDiscoveredModels] = useState<Record<string, ModelCapability[]>>({});

  // Add Credential Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProviderType, setNewProviderType] = useState<ProviderType>('qwen');
  const [newCredName, setNewCredName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('qwen-plus');
  const [newRegion, setNewRegion] = useState('ap-southeast-1');
  const [newBaseUrl, setNewBaseUrl] = useState('https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
  const [newWorkspaceId, setNewWorkspaceId] = useState('');

  // Fetch providers & logs
  const fetchProvidersData = async () => {
    try {
      const resp = await fetch('/api/ai/providers');
      if (resp.ok) {
        const data = await resp.json();
        setDefinitions(data.definitions || {});
        setCredentials(data.credentials || []);
        setStrategy(data.strategy || 'auto');
      }
    } catch (err) {
      console.error('Failed to fetch AI providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const resp = await fetch('/api/ai/failover-logs');
      if (resp.ok) {
        const data = await resp.json();
        setFailoverLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch failover logs:', err);
    }
  };

  useEffect(() => {
    fetchProvidersData();
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Save changes to backend
  const handleSave = async (updatedCreds: AiCredential[], updatedStrategy = strategy) => {
    setSaving(true);
    try {
      const resp = await fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: updatedCreds, strategy: updatedStrategy }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setCredentials(data.credentials || updatedCreds);
        setStrategy(data.strategy || updatedStrategy);
        onShowToast('AI Router configurations saved successfully!', 'success');
        if (onProvidersUpdated) onProvidersUpdated();
      } else {
        throw new Error('Server returned an error saving providers');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to save providers', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle show/hide API key
  const toggleShowKey = (id: string) => {
    setShowKeyMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Move priority up or down
  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newCreds = [...credentials];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newCreds.length) return;

    const temp = newCreds[index];
    newCreds[index] = newCreds[targetIdx];
    newCreds[targetIdx] = temp;

    // Re-index priority
    newCreds.forEach((c, idx) => {
      c.priority = idx + 1;
    });

    setCredentials(newCreds);
    handleSave(newCreds, strategy);
  };

  // Update specific credential field
  const updateCredentialField = (id: string, updates: Partial<AiCredential>) => {
    const newCreds = credentials.map((c) => {
      if (c.id === id) {
        return { ...c, ...updates };
      }
      return c;
    });
    setCredentials(newCreds);
  };

  // Handle region change for Alibaba Qwen
  const handleRegionChange = (id: string, regionId: string) => {
    const def = definitions['qwen'];
    const regionObj = def?.regions?.find((r) => r.id === regionId);
    const updates: Partial<AiCredential> = { region: regionId };
    if (regionObj && regionObj.baseUrl) {
      updates.baseUrl = regionObj.baseUrl;
    }
    updateCredentialField(id, updates);
  };

  // Test single connection
  const handleTestConnection = async (cred: AiCredential) => {
    setTestingId(cred.id);
    try {
      const resp = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: cred }),
      });
      const data = await resp.json();
      setTestResults((prev) => ({
        ...prev,
        [cred.id]: {
          success: data.success,
          message: data.message,
          latencyMs: data.latencyMs,
        },
      }));
      if (data.success) {
        onShowToast(`${cred.name} connected successfully (${data.latencyMs}ms)`, 'success');
      } else {
        onShowToast(`${cred.name} test failed: ${data.message}`, 'error');
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [cred.id]: { success: false, message: err.message },
      }));
      onShowToast(`Failed to test ${cred.name}: ${err.message}`, 'error');
    } finally {
      setTestingId(null);
    }
  };

  // Discover / Refresh models from provider
  const handleDiscoverModels = async (cred: AiCredential) => {
    setDiscoveringId(cred.id);
    try {
      const resp = await fetch('/api/ai/discover-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: cred }),
      });
      const data = await resp.json();
      if (data.success && data.models?.length > 0) {
        setDiscoveredModels((prev) => ({ ...prev, [cred.id]: data.models }));
        onShowToast(`Discovered ${data.models.length} model(s) from ${cred.name}`, 'success');
      } else {
        onShowToast(data.message || 'No models returned from provider', 'warning');
      }
    } catch (err: any) {
      onShowToast(`Model discovery failed: ${err.message}`, 'error');
    } finally {
      setDiscoveringId(null);
    }
  };

  // Reset metrics
  const handleResetMetrics = async () => {
    try {
      const resp = await fetch('/api/ai/reset-metrics', { method: 'POST' });
      if (resp.ok) {
        const data = await resp.json();
        setCredentials(data.credentials || []);
        onShowToast('All credential metrics and cooldowns reset.', 'info');
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Add new credential
  const handleAddCredential = () => {
    const def = definitions[newProviderType];
    const newCred: AiCredential = {
      id: `cred-${newProviderType}-${Date.now()}`,
      provider: newProviderType,
      name: newCredName.trim() || `${def?.name || newProviderType} Key`,
      apiKey: newApiKey.trim(),
      model: newModel.trim() || def?.defaultModel || 'default',
      baseUrl: newBaseUrl.trim() || def?.defaultBaseUrl,
      region: newProviderType === 'qwen' ? newRegion : undefined,
      workspaceId: newWorkspaceId.trim() || undefined,
      priority: credentials.length + 1,
      enabled: Boolean(newApiKey.trim()),
      status: newApiKey.trim() ? 'active' : 'disabled',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimits429: 0,
        quotaErrors: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
      },
    };

    const updated = [...credentials, newCred];
    setCredentials(updated);
    handleSave(updated, strategy);
    setIsAddModalOpen(false);

    // Reset form
    setNewApiKey('');
    setNewCredName('');
    setNewWorkspaceId('');
  };

  // Delete credential
  const handleDeleteCredential = (id: string) => {
    const updated = credentials.filter((c) => c.id !== id);
    updated.forEach((c, idx) => {
      c.priority = idx + 1;
    });
    setCredentials(updated);
    handleSave(updated, strategy);
    onShowToast('Credential removed', 'info');
  };

  // Filter credentials by group
  const filteredCredentials = credentials.filter((c) => {
    if (filterGroup === 'all') return true;
    const def = definitions[c.provider];
    return def?.group === filterGroup;
  });

  // Filter logs
  const filteredLogs = failoverLogs.filter((l) => {
    if (logFilter === 'all') return true;
    return l.level === logFilter;
  });

  return (
    <div id="ai-control-center-page" className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 glass-card rounded-2xl shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-[11px] font-semibold uppercase">
              AI Router Architecture
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 text-[11px] font-semibold">
              Automatic Quota & 429 Failover Active
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#155eef] dark:text-blue-400" />
            AI Control Center & Multi-Provider Router
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            id="ai-add-provider-btn"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Provider Key</span>
          </button>

          <button
            id="ai-save-all-btn"
            type="button"
            onClick={() => handleSave(credentials, strategy)}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>

          <button
            id="ai-reset-metrics-btn"
            type="button"
            onClick={handleResetMetrics}
            className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-[#101730] dark:hover:bg-blue-950/40 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset request counts and clear rate limit cooldowns"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Cooldowns</span>
          </button>
        </div>
      </div>

      {/* Routing Strategy Bar */}
      <div className="p-5 glass-card rounded-2xl border border-blue-100/80 dark:border-blue-900/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-[#155eef] dark:text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Router Failover Strategy
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select how the AI Router selects providers when dispatching website extraction tasks
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'auto', label: 'Auto (Health & Latency)', desc: 'Adaptive routing' },
            { id: 'manual', label: 'Manual Priority', desc: 'Strict priority sequence (1, 2, 3...)' },
            { id: 'free_first', label: 'Free / Low-Cost First', desc: 'Prioritize GLM Flash, DeepSeek, Qwen Turbo' },
            { id: 'fastest', label: 'Fastest Latency', desc: 'Dispatches to lowest avg ms' },
            { id: 'highest_quality', label: 'Flagship Quality', desc: 'Prioritizes max/pro reasoning models' },
          ].map((strat) => (
            <button
              key={strat.id}
              type="button"
              id={`ai-strategy-${strat.id}`}
              onClick={() => {
                const s = strat.id as RoutingStrategy;
                setStrategy(s);
                handleSave(credentials, s);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                strategy === strat.id
                  ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-blue-50/50 dark:bg-[#0f1424]/60 border border-blue-100 dark:border-blue-900/30 text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
              }`}
            >
              {strat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Group Tabs Filter */}
      <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/30 pb-3">
        <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-[#0f1424]/60 p-1 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs">
          {[
            { id: 'all', label: `All Providers (${credentials.length})` },
            {
              id: 'chinese',
              label: `Chinese AI (${
                credentials.filter((c) => definitions[c.provider]?.group === 'chinese').length
              })`,
            },
            {
              id: 'global',
              label: `Global AI (${
                credentials.filter((c) => definitions[c.provider]?.group === 'global').length
              })`,
            },
            {
              id: 'custom',
              label: `Custom / Self-Hosted (${
                credentials.filter((c) => definitions[c.provider]?.group === 'custom').length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              id={`ai-filter-tab-${tab.id}`}
              onClick={() => setFilterGroup(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterGroup === tab.id
                  ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {credentials.filter((c) => c.enabled && Boolean(c.apiKey)).length} Active Provider(s) in Queue
        </span>
      </div>

      {/* Provider Credential Cards List */}
      <div className="space-y-4">
        {filteredCredentials.map((cred, index) => {
          const def = definitions[cred.provider];
          const isTesting = testingId === cred.id;
          const isDiscovering = discoveringId === cred.id;
          const testResult = testResults[cred.id];
          const hasKey = Boolean(cred.apiKey && cred.apiKey.trim().length > 5);
          const showKey = showKeyMap[cred.id] || false;

          // Status Badge details
          let statusBadge = (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Available
            </span>
          );

          if (!cred.enabled) {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Disabled
              </span>
            );
          } else if (cred.status === 'cooldown') {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40 flex items-center gap-1.5">
                <Clock className="w-3 h-3 animate-spin text-amber-500" />
                In Cooldown (429)
              </span>
            );
          } else if (cred.status === 'quota_exhausted') {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40">
                Quota Exhausted
              </span>
            );
          } else if (cred.status === 'auth_error') {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40">
                Auth Error
              </span>
            );
          }

          // Combined model options: recommended + discovered
          const modelsList = [
            ...(def?.recommendedModels || []),
            ...(discoveredModels[cred.id] || []),
          ];

          return (
            <div
              key={cred.id}
              id={`ai-card-${cred.id}`}
              className={`p-6 glass-card border rounded-2xl transition-all space-y-4 shadow-sm ${
                cred.enabled
                  ? 'border-blue-100/80 dark:border-blue-900/30'
                  : 'border-blue-100/40 dark:border-blue-900/20 opacity-70'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 dark:border-blue-900/20 pb-3">
                <div className="flex items-center gap-3">
                  {/* Priority badge & controls */}
                  <div className="flex items-center gap-1 bg-blue-50/50 dark:bg-[#0f1424]/60 p-1 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold text-[#155eef] dark:text-blue-400">
                      #{cred.priority}
                    </span>
                    <button
                      type="button"
                      onClick={() => movePriority(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-30 text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300 cursor-pointer"
                      title="Move priority up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePriority(index, 'down')}
                      disabled={index === credentials.length - 1}
                      className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-30 text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300 cursor-pointer"
                      title="Move priority down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        {cred.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                        {def?.name || cred.provider}
                      </span>
                      {def?.group === 'chinese' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300 border border-red-200/80 dark:border-red-900/30">
                          Chinese AI
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{def?.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {statusBadge}

                  {/* Enable/Disable Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cred.enabled}
                      onChange={(e) => {
                        updateCredentialField(cred.id, {
                          enabled: e.target.checked,
                          status: e.target.checked ? 'active' : 'disabled',
                        });
                      }}
                      className="w-4 h-4 rounded border-blue-300 dark:border-blue-700 text-[#155eef] bg-white dark:bg-[#0f1424] focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {cred.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </label>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteCredential(cred.id)}
                    className="p-1.5 rounded-lg bg-white hover:bg-rose-50 dark:bg-[#101730] dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 border border-blue-100 dark:border-blue-900/30 hover:border-rose-200 dark:hover:border-rose-800/40 transition-colors cursor-pointer"
                    title="Remove credential"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Input Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Region Selector (For Alibaba Qwen) */}
                {def?.supportsRegions && (
                  <div className="space-y-1.5">
                    <label className="text-slate-600 dark:text-slate-400 font-medium flex items-center justify-between">
                      <span>Regional Endpoint:</span>
                      <span className="text-[10px] text-[#155eef] dark:text-blue-400 font-normal">Alibaba Model Studio</span>
                    </label>
                    <select
                      id={`ai-region-${cred.id}`}
                      value={cred.region || 'ap-southeast-1'}
                      onChange={(e) => handleRegionChange(cred.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 glass-input text-slate-900 dark:text-white font-medium focus:outline-none"
                    >
                      {def.regions?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Workspace ID (For Alibaba DashScope) */}
                {cred.provider === 'qwen' && (
                  <div className="space-y-1.5">
                    <label className="text-slate-600 dark:text-slate-400 font-medium flex items-center justify-between">
                      <span>Workspace ID (Optional):</span>
                      <span className="text-[10px] text-slate-400">X-DashScope-WorkSpace</span>
                    </label>
                    <input
                      id={`ai-workspace-${cred.id}`}
                      type="text"
                      value={cred.workspaceId || ''}
                      onChange={(e) => updateCredentialField(cred.id, { workspaceId: e.target.value })}
                      placeholder="e.g. ws-abc1234"
                      className="w-full px-2.5 py-1.5 glass-input text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                )}

                {/* Base URL */}
                <div className={`space-y-1.5 ${cred.provider !== 'qwen' && !def?.supportsRegions ? 'md:col-span-2' : ''}`}>
                  <label className="text-slate-600 dark:text-slate-400 font-medium flex items-center justify-between">
                    <span>Base API Endpoint:</span>
                    <span className="text-[10px] text-slate-400">Configurable</span>
                  </label>
                  <input
                    id={`ai-baseurl-${cred.id}`}
                    type="text"
                    value={cred.baseUrl || ''}
                    onChange={(e) => updateCredentialField(cred.id, { baseUrl: e.target.value })}
                    placeholder={def?.defaultBaseUrl}
                    className="w-full px-2.5 py-1.5 glass-input text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none"
                  />
                </div>

                {/* API Key */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-600 dark:text-slate-400 font-medium">API Secret Key:</label>
                    <div className="flex items-center gap-1.5">
                      {def?.docsUrl && (
                        <a
                          href={def.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-[#155eef] dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Get Key</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleShowKey(cred.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <input
                    id={`ai-apikey-${cred.id}`}
                    type={showKey ? 'text' : 'password'}
                    value={cred.apiKey || ''}
                    onChange={(e) =>
                      updateCredentialField(cred.id, {
                        apiKey: e.target.value,
                        enabled: Boolean(e.target.value.trim()),
                      })
                    }
                    placeholder={`Enter ${def?.name || cred.provider} API key...`}
                    className="w-full px-2.5 py-1.5 glass-input text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none"
                  />
                </div>

                {/* Model Selector & Discovery */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-600 dark:text-slate-400 font-medium">Model ID:</label>
                    {def?.supportsModelDiscovery && (
                      <button
                        type="button"
                        id={`ai-discover-${cred.id}`}
                        onClick={() => handleDiscoverModels(cred)}
                        disabled={isDiscovering || !hasKey}
                        className="text-[10px] text-[#155eef] dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                        <span>Refresh Models (/models)</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      id={`ai-model-select-${cred.id}`}
                      value={cred.model}
                      onChange={(e) => updateCredentialField(cred.id, { model: e.target.value })}
                      className="w-1/2 px-2.5 py-1.5 glass-input text-slate-900 dark:text-white font-medium focus:outline-none"
                    >
                      {modelsList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id} {m.isFreeOrLowCost ? '(Low Cost / Free)' : ''}
                        </option>
                      ))}
                      <option value={cred.model}>Current: {cred.model}</option>
                    </select>
                    <input
                      id={`ai-model-manual-${cred.id}`}
                      type="text"
                      value={cred.model}
                      onChange={(e) => updateCredentialField(cred.id, { model: e.target.value })}
                      placeholder="Manual model ID..."
                      className="w-1/2 px-2.5 py-1.5 glass-input text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
                      title="Enter any specific or newly released model ID manually"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Action & Metrics Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-blue-100 dark:border-blue-900/20">
                {/* Live Test Button & Feedback */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    id={`ai-test-btn-${cred.id}`}
                    onClick={() => handleTestConnection(cred)}
                    disabled={isTesting || !hasKey}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 disabled:opacity-50 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-bounce text-amber-500' : 'text-[#155eef] dark:text-blue-400'}`} />
                    <span>{isTesting ? 'Testing Ping...' : 'Test Connection'}</span>
                  </button>

                  {testResult && (
                    <span
                      className={`text-xs flex items-center gap-1 font-medium ${
                        testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{testResult.message}</span>
                    </span>
                  )}
                </div>

                {/* Credential Metrics Counters */}
                <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>
                    Reqs: <strong className="text-slate-900 dark:text-white">{cred.metrics?.totalRequests || 0}</strong>
                  </span>
                  <span>
                    Success: <strong className="text-emerald-600 dark:text-emerald-400">{cred.metrics?.successfulRequests || 0}</strong>
                  </span>
                  <span>
                    Fail: <strong className="text-rose-600 dark:text-rose-400">{cred.metrics?.failedRequests || 0}</strong>
                  </span>
                  <span>
                    429s: <strong className="text-amber-600 dark:text-amber-400">{cred.metrics?.rateLimits429 || 0}</strong>
                  </span>
                  <span>
                    Avg Latency:{' '}
                    <strong className="text-[#155eef] dark:text-blue-400">{cred.metrics?.averageLatencyMs || 0}ms</strong>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Failover Terminal Activity Log */}
      <div className="glass-card border border-blue-100/80 dark:border-blue-900/30 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 dark:border-blue-900/20 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Live AI Router & Failover Activity Log
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-blue-50/50 dark:bg-[#0f1424]/60 p-1 rounded-xl border border-blue-100 dark:border-blue-900/30 text-[11px]">
              {(['all', 'info', 'success', 'warning', 'error'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLogFilter(t)}
                  className={`px-2 py-0.5 rounded-lg capitalize font-medium cursor-pointer transition-all ${
                    logFilter === t
                      ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchLogs}
              className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 transition-colors cursor-pointer"
              title="Refresh logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          id="ai-failover-log-terminal"
          className="h-64 overflow-y-auto p-4 bg-blue-50/30 dark:bg-[#080d1a] border border-blue-100/80 dark:border-blue-900/30 rounded-xl font-mono text-xs space-y-2 selection:bg-blue-500/30"
        >
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              const colors = {
                info: 'text-slate-600 dark:text-slate-300',
                success: 'text-emerald-600 dark:text-emerald-400',
                warning: 'text-amber-600 dark:text-amber-400',
                error: 'text-rose-600 dark:text-rose-400',
              };
              return (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-slate-400 dark:text-slate-500 select-none shrink-0">[{log.timeStr}]</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100/60 dark:bg-blue-950/60 text-[#155eef] dark:text-blue-300 text-[10px] shrink-0 font-medium">
                    {log.provider}
                  </span>
                  <span className={`${colors[log.level]} break-all`}>{log.message}</span>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
              No router failover events recorded yet. Failover logs will appear here during live crawling runs.
            </div>
          )}
        </div>
      </div>

      {/* Add Provider Key Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg glass-card border border-blue-100/80 dark:border-blue-900/30 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/20 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
                Add AI Provider Credential
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Provider Type */}
              <div className="space-y-1.5">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Provider Type:</label>
                <select
                  id="modal-provider-type-select"
                  value={newProviderType}
                  onChange={(e) => {
                    const p = e.target.value as ProviderType;
                    setNewProviderType(p);
                    const def = definitions[p];
                    if (def) {
                      setNewModel(def.defaultModel);
                      setNewBaseUrl(def.defaultBaseUrl);
                      setNewCredName(`${def.name} Secondary`);
                    }
                  }}
                  className="w-full px-3 py-2 glass-input text-slate-900 dark:text-white font-medium focus:outline-none"
                >
                  <optgroup label="Chinese AI Providers">
                    <option value="qwen">Alibaba Qwen / Model Studio</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="kimi">Moonshot Kimi</option>
                    <option value="glm">Zhipu GLM</option>
                    <option value="minimax">MiniMax</option>
                    <option value="custom_chinese">Other Chinese Provider</option>
                  </optgroup>
                  <optgroup label="Global AI Providers">
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="claude">Anthropic Claude</option>
                  </optgroup>
                  <optgroup label="Custom / Self-Hosted">
                    <option value="custom_openai">Custom OpenAI-Compatible</option>
                  </optgroup>
                </select>
              </div>

              {/* Credential Name */}
              <div className="space-y-1.5">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Credential Nickname:</label>
                <input
                  id="modal-cred-name-input"
                  type="text"
                  value={newCredName}
                  onChange={(e) => setNewCredName(e.target.value)}
                  placeholder="e.g. Qwen Singapore Backup Key"
                  className="w-full px-3 py-2 glass-input text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Region (if Alibaba Qwen) */}
              {newProviderType === 'qwen' && (
                <div className="space-y-1.5">
                  <label className="text-slate-600 dark:text-slate-400 font-medium">Regional Endpoint:</label>
                  <select
                    id="modal-region-select"
                    value={newRegion}
                    onChange={(e) => {
                      setNewRegion(e.target.value);
                      const reg = definitions['qwen']?.regions?.find((r) => r.id === e.target.value);
                      if (reg && reg.baseUrl) setNewBaseUrl(reg.baseUrl);
                    }}
                    className="w-full px-3 py-2 glass-input text-slate-900 dark:text-white focus:outline-none"
                  >
                    {definitions['qwen']?.regions?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Workspace ID (Optional, Alibaba) */}
              {newProviderType === 'qwen' && (
                <div className="space-y-1.5">
                  <label className="text-slate-600 dark:text-slate-400 font-medium">Workspace ID (Optional):</label>
                  <input
                    id="modal-workspace-input"
                    type="text"
                    value={newWorkspaceId}
                    onChange={(e) => setNewWorkspaceId(e.target.value)}
                    placeholder="e.g. ws-12345"
                    className="w-full px-3 py-2 glass-input text-slate-900 dark:text-white font-mono focus:outline-none"
                  />
                </div>
              )}

              {/* Base URL */}
              <div className="space-y-1.5">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Base URL:</label>
                <input
                  id="modal-baseurl-input"
                  type="text"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 glass-input text-slate-900 dark:text-white font-mono focus:outline-none"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-slate-600 dark:text-slate-400 font-medium">API Key:</label>
                <input
                  id="modal-apikey-input"
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Paste API key..."
                  className="w-full px-3 py-2 glass-input text-slate-900 dark:text-white font-mono focus:outline-none"
                />
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-slate-600 dark:text-slate-400 font-medium">Model ID:</label>
                <input
                  id="modal-model-input"
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="e.g. qwen-plus, deepseek-chat"
                  className="w-full px-3 py-2 glass-input text-slate-900 dark:text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-100 dark:border-blue-900/20">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="modal-save-cred-btn"
                onClick={handleAddCredential}
                disabled={!newApiKey.trim()}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] disabled:opacity-50 text-white text-xs font-bold shadow cursor-pointer"
              >
                Add Credential
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
