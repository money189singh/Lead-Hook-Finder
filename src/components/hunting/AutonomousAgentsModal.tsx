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
} from 'lucide-react';
import { HuntingAgent, HuntingAgentRun } from '../../types';

interface AutonomousAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export const AutonomousAgentsModal: React.FC<AutonomousAgentsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
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
    if (isOpen) {
      loadAgents();
      loadRuns();
    }
  }, [isOpen]);

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

      if (!res.ok) throw new Error('Failed to create hunting agent');
      onShowToast('Autonomous Hunting Agent created successfully!', 'success');
      setFormName('');
      setFormDescription('');
      setFormQuery('');
      setActiveTab('agents');
      loadAgents();
    } catch (e: any) {
      onShowToast(e.message || 'Creation failed', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="glass-card relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0c1322] border border-blue-200/80 dark:border-blue-900/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Autonomous Lead Hunting Agents
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  Always-On 24/7
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadAgents();
                loadRuns();
              }}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'agents'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Active Agents ({agents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('runs')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'runs'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Execution Runs ({runs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create New Agent</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'agents' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => {
                  const isRunning = runningAgentId === agent.id || agent.status === 'running';

                  return (
                    <div
                      key={agent.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628] hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {agent.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                                  agent.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                }`}
                              >
                                {agent.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {agent.description || agent.targetQuery}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleStatus(agent)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title={agent.status === 'active' ? 'Pause Agent' : 'Resume Agent'}
                            >
                              {agent.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteAgent(agent.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete Agent"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Specs */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
                          <div>
                            <span className="text-slate-400">Schedule:</span>{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                              {agent.schedule.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Total Found:</span>{' '}
                            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                              {agent.totalLeadsFound} Leads
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Min ICP Score:</span>{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {agent.minIcpScore}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">CRM Auto-Sync:</span>{' '}
                            <span className={`font-semibold ${agent.autoSyncCrm ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {agent.autoSyncCrm ? 'Enabled' : 'Off'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            Next run: {agent.nextRunAt ? new Date(agent.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                          </span>
                        </div>

                        <button
                          onClick={() => handleRunAgentNow(agent)}
                          disabled={isRunning}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Hunting...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Run Now</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'runs' && (
            <div className="space-y-3">
              {runs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No execution runs recorded yet.</p>
                </div>
              ) : (
                runs.map((run) => (
                  <div
                    key={run.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628] text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${run.status === 'completed' ? 'bg-emerald-500' : run.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span className="font-bold text-slate-900 dark:text-white">{run.agentName}</span>
                        <span className="text-[10px] text-slate-400">({new Date(run.startedAt).toLocaleTimeString()})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                          +{run.leadsFound} Leads Found
                        </span>
                        {run.leadsSyncedCrm > 0 && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                            {run.leadsSyncedCrm} Synced to CRM
                          </span>
                        )}
                      </div>
                    </div>

                    {run.logs && run.logs.length > 0 && (
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-900 text-slate-300 font-mono text-[11px] space-y-1">
                        {run.logs.map((log, i) => (
                          <div key={i} className="text-slate-300 truncate">
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateAgent} className="max-w-2xl mx-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Enterprise B2B SaaS Scout"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Search Query / Criteria
                </label>
                <input
                  type="text"
                  value={formQuery}
                  onChange={(e) => setFormQuery(e.target.value)}
                  placeholder="e.g., FinTech startups hiring VP Sales United States"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Geography
                  </label>
                  <input
                    type="text"
                    value={formGeography}
                    onChange={(e) => setFormGeography(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Recurrence Schedule
                  </label>
                  <select
                    value={formSchedule}
                    onChange={(e) => setFormSchedule(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-sm text-slate-900 dark:text-white"
                  >
                    <option value="hourly">Every Hour</option>
                    <option value="every_6_hours">Every 6 Hours</option>
                    <option value="daily">Daily (24h)</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Min ICP Score ({formMinIcp}%)
                  </label>
                  <input
                    type="range"
                    min="70"
                    max="98"
                    value={formMinIcp}
                    onChange={(e) => setFormMinIcp(parseInt(e.target.value, 10))}
                    className="w-full mt-2 accent-blue-600"
                  />
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={formAutoWaterfall}
                    onChange={(e) => setFormAutoWaterfall(e.target.checked)}
                    className="rounded-md text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Run Waterfall Enrichment (Extract phone numbers & tech stack automatically)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={formAutoCrm}
                    onChange={(e) => setFormAutoCrm(e.target.checked)}
                    className="rounded-md text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Auto-Sync Verified Leads directly to CRM (Salesforce / In-House / HubSpot)</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span>Launch Autonomous Agent</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
