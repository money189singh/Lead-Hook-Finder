import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  Globe,
  Sliders,
  Calendar,
  Layers,
  ChevronRight,
  Terminal,
  Activity,
  Trash2,
  Zap,
  Sparkles,
} from 'lucide-react';
import { HuntingAgent, HuntingAgentRun } from '../types';

interface HuntingAgentsPageProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToResults?: () => void;
}

export const HuntingAgentsPage: React.FC<HuntingAgentsPageProps> = ({
  onShowToast,
  onNavigateToResults,
}) => {
  const [agents, setAgents] = useState<HuntingAgent[]>([]);
  const [runs, setRuns] = useState<HuntingAgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'runs' | 'create'>('agents');
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  // New Agent Form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuery, setFormQuery] = useState('');
  const [formIndustry, setFormIndustry] = useState('Software & Technology');
  const [formGeography, setFormGeography] = useState('United States');
  const [formSchedule, setFormSchedule] = useState<HuntingAgent['schedule']>('daily');
  const [formMinIcp, setFormMinIcp] = useState<number>(85);
  const [formAutoCrm, setFormAutoCrm] = useState<boolean>(true);
  const [formAutoWaterfall, setFormAutoWaterfall] = useState<boolean>(true);
  const [formTargetCount, setFormTargetCount] = useState<number>(5);

  useEffect(() => {
    loadAgents();
    loadRuns();
  }, []);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/hunting-agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data || []);
      }
    } catch {
      onShowToast('Could not load hunting agents', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRuns = async () => {
    try {
      const res = await fetch('/api/hunting-agents/runs/all');
      if (res.ok) {
        const data = await res.json();
        setRuns(data || []);
      }
    } catch {}
  };

  const handleRunAgentNow = async (agent: HuntingAgent) => {
    setRunningAgentId(agent.id);
    onShowToast(`Agent "${agent.name}" started hunting...`, 'info');
    try {
      const res = await fetch(`/api/hunting-agents/${agent.id}/run`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Agent run failed');
      }
      const run: HuntingAgentRun = await res.json();
      onShowToast(`Agent completed: Discovered ${run.leadsFound} verified leads!`, 'success');
      loadAgents();
      loadRuns();
    } catch (e: any) {
      onShowToast(e.message || 'Run failed', 'error');
    } finally {
      setRunningAgentId(null);
    }
  };

  const handleToggleStatus = async (agent: HuntingAgent) => {
    const newStatus: HuntingAgent['status'] = agent.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/hunting-agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, status: newStatus } : a)));
        onShowToast(`Agent status updated to ${newStatus}`, 'info');
      }
    } catch {
      onShowToast('Failed to update agent status', 'error');
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this autonomous hunting agent?')) return;
    try {
      const res = await fetch(`/api/hunting-agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== id));
        onShowToast('Agent deleted', 'info');
      }
    } catch {
      onShowToast('Failed to delete agent', 'error');
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formQuery.trim()) {
      onShowToast('Agent name and target search query are required', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/hunting-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          targetQuery: formQuery.trim(),
          industry: formIndustry,
          geography: formGeography,
          schedule: formSchedule,
          minIcpScore: formMinIcp,
          autoSyncCrm: formAutoCrm,
          autoWaterfallEnrich: formAutoWaterfall,
          targetCountPerRun: formTargetCount,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create agent');
      }

      onShowToast(`Hunting Agent "${formName}" deployed!`, 'success');
      setFormName('');
      setFormDescription('');
      setFormQuery('');
      setActiveTab('agents');
      loadAgents();
    } catch (e: any) {
      onShowToast(e.message || 'Creation failed', 'error');
    }
  };

  const totalLeadsCaptured = agents.reduce((acc, a) => acc + (a.totalLeadsFound || 0), 0);
  const activeCount = agents.filter((a) => a.status === 'active').length;

  return (
    <div id="hunting-agents-page" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-blue-200/80 dark:border-blue-900/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Autonomous "Always-On" Lead Hunting Agents
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                24/7 Autopilot
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('create')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy New Agent</span>
          </button>
          <button
            onClick={() => {
              loadAgents();
              loadRuns();
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition"
            title="Refresh agents"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Hunters</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <span>{activeCount}</span>
            <span className="text-xs font-normal text-slate-400">/ {agents.length} deployed</span>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Leads Captured</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {totalLeadsCaptured}
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Automated Executions</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {runs.length}
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average ICP Quality</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            89%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('agents')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'agents'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Active Agents ({agents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'runs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Execution History & Logs ({runs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'create'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Deploy New Hunter</span>
        </button>
      </div>

      {/* Tab: Agents List */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          {agents.length === 0 && !isLoading && (
            <div className="py-16 text-center text-slate-400 space-y-3 glass-card rounded-2xl border border-slate-200 dark:border-slate-800">
              <Bot className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No Autonomous Hunting Agents Active
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click "Deploy New Agent" to unleash an autonomous scout searching 24/7 for high-ICP decision makers.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Hunter</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const isRunning = runningAgentId === agent.id;
              const isActive = agent.status === 'active';

              return (
                <div
                  key={agent.id}
                  className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm hover:border-blue-300 dark:hover:border-blue-900/60 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {agent.name}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isActive ? 'Always-On' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {agent.description || agent.targetQuery}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                      title="Delete Agent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Target Params */}
                  <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Query</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                        "{agent.targetQuery}"
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Schedule</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {agent.schedule.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Industry</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                        {agent.industry || 'All Industries'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Min ICP Score</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {agent.minIcpScore}%
                      </span>
                    </div>
                  </div>

                  {/* Automations Badge */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    {agent.autoWaterfallEnrich && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/30 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        <span>Waterfall Enriched</span>
                      </span>
                    )}
                    {agent.autoSyncCrm && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800/30 flex items-center gap-1">
                        <Database className="w-3 h-3 text-blue-500" />
                        <span>Auto-Sync to CRM</span>
                      </span>
                    )}
                  </div>

                  {/* Footer Action Bar */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Discovered <strong className="text-emerald-600 dark:text-emerald-400">{agent.totalLeadsFound}</strong> leads
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(agent)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isActive ? 'Pause' : 'Activate'}</span>
                      </button>

                      <button
                        onClick={() => handleRunAgentNow(agent)}
                        disabled={isRunning}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1 transition cursor-pointer"
                      >
                        {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        <span>{isRunning ? 'Hunting...' : 'Hunt Now'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Runs & Execution History */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase text-slate-500 tracking-wider">
              Autonomous Agent Execution Audit Trail
            </div>
            {runs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No agent runs logged yet. Execute an agent above to see full execution telemetry.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {runs.map((run) => (
                  <div key={run.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {run.agentName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono">
                          +{run.leadsFound} Leads Found
                        </span>
                        {run.leadsSyncedCrm > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono">
                            {run.leadsSyncedCrm} Synced to CRM
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(run.startedAt).toLocaleString()}
                      </span>
                    </div>

                    {run.logs && run.logs.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-300 text-[11px] font-mono space-y-1">
                        {run.logs.slice(-3).map((log, idx) => (
                          <div key={idx} className="truncate">{log}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Deploy New Hunter */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateAgent} className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-w-2xl">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <span>Configure Autonomous Hunting Parameters</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Agent Name *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Series-A Fintech Founders Hunter"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Discovery Query *
              </label>
              <input
                type="text"
                required
                value={formQuery}
                onChange={(e) => setFormQuery(e.target.value)}
                placeholder='e.g. "Cybersecurity startup" or "B2B SaaS with >50 employees"'
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Industry Focus
                </label>
                <select
                  value={formIndustry}
                  onChange={(e) => setFormIndustry(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Software & Technology">Software & Technology</option>
                  <option value="Fintech & Banking">Fintech & Banking</option>
                  <option value="Healthcare & Bio">Healthcare & Bio</option>
                  <option value="E-Commerce & Retail">E-Commerce & Retail</option>
                  <option value="Manufacturing & Logistics">Manufacturing & Logistics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Run Frequency
                </label>
                <select
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="hourly">Every 1 Hour (Aggressive)</option>
                  <option value="every_6_hours">Every 6 Hours</option>
                  <option value="daily">Daily Autopilot (Recommended)</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAutoWaterfall}
                  onChange={(e) => setFormAutoWaterfall(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Automatic Waterfall Enrichment
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAutoCrm}
                  onChange={(e) => setFormAutoCrm(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Automatic Sync to CRM
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('agents')}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer transition"
            >
              Deploy Agent
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
