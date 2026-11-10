import React, { useState, useEffect } from 'react';
import {
  Building2,
  Cloud,
  RefreshCw,
  Send,
  Sliders,
  Key,
  Database,
  Check,
  Copy,
  Zap,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CrmConfig,
  CrmProviderType,
  CrmSyncLog,
  LeadHookApiKey,
} from '../../types';

interface CrmDirectIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onSyncAll: () => Promise<void>;
  leadsCount: number;
}

export const CrmDirectIntegrationModal: React.FC<CrmDirectIntegrationModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onSyncAll,
  leadsCount,
}) => {
  const [activeTab, setActiveTab] = useState<CrmProviderType | 'api_keys' | 'logs'>('in_house');
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [generatingKey, setGeneratingKey] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    statusCode?: number;
    latencyMs?: number;
    responseSnippet?: string;
  } | null>(null);
  const [logs, setLogs] = useState<CrmSyncLog[]>([]);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadLogs();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/crm/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.active_provider) {
          setActiveTab(data.active_provider);
        }
      }
    } catch {
      // Ignore error
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch('/api/crm/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch {
      // Ignore error
    }
  };

  const handleSaveConfig = async (newConfigPartial?: Partial<CrmConfig>) => {
    if (!config) return;
    setIsSaving(true);
    try {
      const toSave = newConfigPartial ? { ...config, ...newConfigPartial } : config;
      const res = await fetch('/api/crm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save configuration');
      }

      const data = await res.json();
      setConfig(data.config || toSave);
      onShowToast('CRM integration settings saved!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Error saving settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/crm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        onShowToast(`Connection verified! ${data.message}`, 'success');
      } else {
        onShowToast(data.message || 'Connection test failed', 'error');
      }
      loadLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error reaching test endpoint',
      });
      onShowToast(err.message || 'Test failed', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerBulkSync = async () => {
    setIsSyncingAll(true);
    try {
      await onSyncAll();
      loadLogs();
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setGeneratingKey(true);
    try {
      const res = await fetch('/api/crm/api-keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() || 'CRM Integration Key' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate API key');
      setConfig(data.config);
      setNewKeyName('');
      if (data.api_key?.key) {
        navigator.clipboard.writeText(data.api_key.key).catch(() => {});
        setCopiedId(data.api_key.id);
        setTimeout(() => setCopiedId(null), 2500);
      }
      onShowToast('Generated and copied new API key.', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to generate key', 'error');
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      const res = await fetch('/api/crm/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.config) {
        setConfig(data.config);
        onShowToast('API key revoked.', 'info');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to revoke key', 'error');
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    onShowToast('Copied to clipboard.', 'info');
  };

  if (!isOpen) return null;

  const apiKeys: LeadHookApiKey[] = config?.leadhook_api_keys || [];
  const sampleKey = apiKeys[0]?.key || 'lh_live_YOUR_KEY';
  const pullEndpoint = `${window.location.origin}/api/crm/external/leads?api_key=${sampleKey}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl glass-panel p-5 sm:p-7 border border-white/60 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-900 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>DIRECT CRM & API KEYS</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              CRM Connections & External Tool API Keys
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('in_house');
              if (config) setConfig({ ...config, active_provider: 'in_house' });
            }}
            className={`flex-1 min-w-[115px] py-2 px-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'in_house'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Custom CRM</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('apollo');
              if (config) setConfig({ ...config, active_provider: 'apollo' });
            }}
            className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'apollo'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Apollo.io</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('hubspot');
              if (config) setConfig({ ...config, active_provider: 'hubspot' });
            }}
            className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'hubspot'
                ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>HubSpot</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('pipedrive');
              if (config) setConfig({ ...config, active_provider: 'pipedrive' });
            }}
            className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pipedrive'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Pipedrive</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('salesforce');
              if (config) setConfig({ ...config, active_provider: 'salesforce' });
            }}
            className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'salesforce'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Salesforce</span>
          </button>

          <button
            onClick={() => setActiveTab('api_keys')}
            className={`flex-1 min-w-[105px] py-2 px-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'api_keys'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys ({apiKeys.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 min-w-[100px] py-2 px-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Logs ({logs.length})</span>
          </button>
        </div>

        {/* Global Auto-Sync & Active Provider Switcher */}
        {config && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Active CRM:</span>
              <span className="px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                {config.active_provider.replace('_', '-')}
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.auto_sync_enabled}
                onChange={(e) => {
                  const updated = { ...config, auto_sync_enabled: e.target.checked };
                  setConfig(updated);
                  handleSaveConfig(updated);
                }}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Auto-send collected leads to CRM
              </span>
            </label>
          </div>
        )}

        {/* Content Loading State */}
        {isLoading || !config ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* 1. In-House Tool Tab */}
            {activeTab === 'in_house' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      CRM Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={config.in_house.endpoint_url}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          in_house: { ...config.in_house, endpoint_url: e.target.value },
                        })
                      }
                      placeholder="https://api.mycompany.com/crm/v1/leads"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      HTTP Method
                    </label>
                    <select
                      value={config.in_house.http_method}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          in_house: {
                            ...config.in_house,
                            http_method: e.target.value as 'POST' | 'PUT',
                          },
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Authentication Type
                    </label>
                    <select
                      value={config.in_house.auth_type}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          in_house: {
                            ...config.in_house,
                            auth_type: e.target.value as any,
                          },
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="bearer">Bearer Token</option>
                      <option value="api_key">X-API-Key Header</option>
                      <option value="none">No Auth</option>
                    </select>
                  </div>

                  {config.in_house.auth_type === 'bearer' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Bearer Token
                      </label>
                      <input
                        type="password"
                        value={config.in_house.auth_token || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            in_house: { ...config.in_house, auth_token: e.target.value },
                          })
                        }
                        placeholder="Paste Bearer token..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {config.in_house.auth_type === 'api_key' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Header Name
                        </label>
                        <input
                          type="text"
                          value={config.in_house.api_key_header || 'X-API-Key'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              in_house: { ...config.in_house, api_key_header: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          API Key Value
                        </label>
                        <input
                          type="password"
                          value={config.in_house.api_key_value || ''}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              in_house: { ...config.in_house, api_key_value: e.target.value },
                            })
                          }
                          placeholder="Key value..."
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Field Mapping Accordion */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Custom JSON Field Mapping</span>
                    </span>
                    <span className="text-slate-400">{showAdvancedMapping ? '▲' : '▼'}</span>
                  </button>

                  {showAdvancedMapping && (
                    <div className="p-4 bg-white dark:bg-slate-900 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Contact Name Key</label>
                          <input
                            type="text"
                            value={config.in_house.field_mapping?.name_field || 'name'}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                in_house: {
                                  ...config.in_house,
                                  field_mapping: {
                                    ...config.in_house.field_mapping,
                                    name_field: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Email Key</label>
                          <input
                            type="text"
                            value={config.in_house.field_mapping?.email_field || 'email'}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                in_house: {
                                  ...config.in_house,
                                  field_mapping: {
                                    ...config.in_house.field_mapping,
                                    email_field: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Company Key</label>
                          <input
                            type="text"
                            value={config.in_house.field_mapping?.company_field || 'company'}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                in_house: {
                                  ...config.in_house,
                                  field_mapping: {
                                    ...config.in_house.field_mapping,
                                    company_field: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Notes Key</label>
                          <input
                            type="text"
                            value={config.in_house.field_mapping?.notes_field || 'notes'}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                in_house: {
                                  ...config.in_house,
                                  field_mapping: {
                                    ...config.in_house.field_mapping,
                                    notes_field: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Apollo.io Tab */}
            {activeTab === 'apollo' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Apollo.io API Key
                  </label>
                  <input
                    type="password"
                    value={config.apollo?.api_key || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        apollo: { ...(config.apollo || {}), api_key: e.target.value },
                      })
                    }
                    placeholder="Paste Apollo.io API key..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Apollo Contact Label
                  </label>
                  <input
                    type="text"
                    value={config.apollo?.label_names || 'LeadHook Automated'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        apollo: { ...(config.apollo || {}), label_names: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
              </div>
            )}

            {/* 3. HubSpot Tab */}
            {activeTab === 'hubspot' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    HubSpot Private App Access Token
                  </label>
                  <input
                    type="password"
                    value={config.hubspot.access_token || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        hubspot: { ...config.hubspot, access_token: e.target.value },
                      })
                    }
                    placeholder="pat-na1-..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Lifecycle Stage
                    </label>
                    <input
                      type="text"
                      value={config.hubspot.lifecycle_stage || 'lead'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          hubspot: { ...config.hubspot, lifecycle_stage: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Lead Status
                    </label>
                    <input
                      type="text"
                      value={config.hubspot.lead_status || 'OPEN_DEAL'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          hubspot: { ...config.hubspot, lead_status: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Pipedrive Tab */}
            {activeTab === 'pipedrive' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pipedrive API Token
                  </label>
                  <input
                    type="password"
                    value={config.pipedrive.api_token || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pipedrive: { ...config.pipedrive, api_token: e.target.value },
                      })
                    }
                    placeholder="Paste Pipedrive API token..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Company Domain
                  </label>
                  <input
                    type="text"
                    value={config.pipedrive.company_domain || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pipedrive: { ...config.pipedrive, company_domain: e.target.value },
                      })
                    }
                    placeholder="yourcompany.pipedrive.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* 5. Salesforce CRM Tab */}
            {activeTab === 'salesforce' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Salesforce Mode
                  </label>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          salesforce: { ...config.salesforce, mode: 'web_to_lead' },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        config.salesforce.mode === 'web_to_lead'
                          ? 'bg-white dark:bg-slate-900 font-semibold text-blue-600 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Web-to-Lead
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          salesforce: { ...config.salesforce, mode: 'rest_api' },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        config.salesforce.mode === 'rest_api'
                          ? 'bg-white dark:bg-slate-900 font-semibold text-blue-600 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      REST API
                    </button>
                  </div>
                </div>

                {config.salesforce.mode === 'web_to_lead' ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Salesforce Organization ID (OID)
                      </label>
                      <input
                        type="text"
                        value={config.salesforce.oid || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            salesforce: { ...config.salesforce, oid: e.target.value },
                          })
                        }
                        placeholder="00D5e000000XXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Salesforce Instance URL
                      </label>
                      <input
                        type="url"
                        value={config.salesforce.instance_url || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            salesforce: { ...config.salesforce, instance_url: e.target.value },
                          })
                        }
                        placeholder="https://yourinstance.my.salesforce.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Connected App Access Token
                      </label>
                      <input
                        type="password"
                        value={config.salesforce.access_token || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            salesforce: { ...config.salesforce, access_token: e.target.value },
                          })
                        }
                        placeholder="Paste Salesforce access token..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. API Keys Tab */}
            {activeTab === 'api_keys' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateApiKey()}
                    placeholder="Key Label (e.g. My CRM Integration)"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateApiKey}
                    disabled={generatingKey}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {generatingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Create API Key</span>
                  </button>
                </div>

                {apiKeys.length > 0 && (
                  <div className="space-y-2">
                    {apiKeys.map((k) => (
                      <div
                        key={k.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {k.name}
                          </span>
                          <code className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            {k.key}
                          </code>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyText(k.key, k.id)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === k.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === k.id ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeApiKey(k.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <code className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                    {pullEndpoint}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(pullEndpoint, 'modal_pull_endpoint')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedId === 'modal_pull_endpoint' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Endpoint</span>
                  </button>
                </div>
              </div>
            )}

            {/* 7. Logs Tab */}
            {activeTab === 'logs' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    CRM Dispatch History ({logs.length})
                  </div>
                  <button
                    onClick={loadLogs}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'success'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {log.status === 'success' ? '✓ SENT' : '✕ FAILED'}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {log.companyName || log.leadTitle}
                          </span>
                          <span className="text-[10px] uppercase font-mono text-slate-400">
                            via {log.provider}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{log.message}</div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-mono text-slate-400">{log.latencyMs}ms</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Test Connection Banner */}
            {testResult && activeTab !== 'logs' && activeTab !== 'api_keys' && (
              <div
                className={`p-3.5 rounded-2xl text-xs border ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500/30 text-rose-800 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {testResult.success
                      ? '✓ CRM Connection Verified'
                      : '✕ CRM Connection Failed'}
                  </span>
                  {testResult.latencyMs && (
                    <span className="text-[11px] font-mono opacity-80">
                      {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] opacity-90">{testResult.message}</div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveConfig()}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save CRM Settings</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerBulkSync}
                  disabled={isSyncingAll || leadsCount === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSyncingAll ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing {leadsCount} Leads...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Sync All {leadsCount} Leads to CRM</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
