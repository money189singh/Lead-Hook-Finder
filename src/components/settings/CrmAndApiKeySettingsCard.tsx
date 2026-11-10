import React, { useState, useEffect } from 'react';
import {
  Database,
  Key,
  Send,
  RefreshCw,
  Check,
  Copy,
  Plus,
  Trash2,
  Building2,
  Zap,
  Cloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CrmConfig, CrmProviderType, LeadHookApiKey } from '../../types';

interface CrmAndApiKeySettingsCardProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export const CrmAndApiKeySettingsCard: React.FC<CrmAndApiKeySettingsCardProps> = ({
  onShowToast,
}) => {
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [activeProviderTab, setActiveProviderTab] = useState<CrmProviderType>('in_house');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testBanner, setTestBanner] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const loadCrmConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.active_provider) {
          setActiveProviderTab(data.active_provider);
        }
      }
    } catch {
      // Ignore initial load error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCrmConfig();
  }, []);

  const handleSaveCrm = async (override?: Partial<CrmConfig>) => {
    if (!config) return;
    setSaving(true);
    try {
      const payload = override ? { ...config, ...override } : config;
      const res = await fetch('/api/crm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save CRM configuration');
      setConfig(data.config || payload);
      onShowToast('CRM integration saved.', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Error saving CRM settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestCrm = async () => {
    if (!config) return;
    setTesting(true);
    setTestBanner(null);
    try {
      const res = await fetch('/api/crm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTestBanner({
        success: Boolean(data.success),
        message: data.message || (data.success ? 'CRM connection verified.' : 'Connection failed.'),
      });
      onShowToast(
        data.message || (data.success ? 'CRM connection verified.' : 'Connection failed.'),
        data.success ? 'success' : 'error'
      );
    } catch (err: any) {
      setTestBanner({
        success: false,
        message: err.message || 'CRM test error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncLeadsNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/crm/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: config?.active_provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'CRM sync failed');
      onShowToast(
        `Synced ${data.successful || 0}/${data.total || 0} lead(s) to ${(config?.active_provider || 'CRM').toUpperCase()}.`,
        data.successful > 0 ? 'success' : 'warning'
      );
    } catch (err: any) {
      onShowToast(err.message || 'No leads to sync or CRM error', 'warning');
    } finally {
      setSyncing(false);
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

  if (loading || !config) {
    return null;
  }

  const apiKeys: LeadHookApiKey[] = config.leadhook_api_keys || [];
  const sampleKey = apiKeys[0]?.key || 'lh_live_YOUR_KEY';
  const pullEndpoint = `${window.location.origin}/api/crm/external/leads?api_key=${sampleKey}`;

  return (
    <div
      id="settings-crm-integrations-card"
      className="glass-card rounded-2xl p-6 space-y-6 shadow-sm border border-blue-100/80 dark:border-blue-900/30"
    >
      {/* Header + Auto-Sync Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            CRM & External Tool Integrations
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#155eef] dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/50 uppercase">
            {config.active_provider.replace('_', '-')}
          </span>
        </div>

        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Auto-Send Leads to CRM
          </span>
          <input
            id="settings-crm-autosync-toggle"
            type="checkbox"
            checked={config.auto_sync_enabled}
            onChange={(e) => {
              const updated = { ...config, auto_sync_enabled: e.target.checked };
              setConfig(updated);
              handleSaveCrm(updated);
            }}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#155eef]" />
        </label>
      </div>

      {/* CRM Provider Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#101730] text-xs">
        {(
          [
            { id: 'in_house', label: 'Custom / In-House CRM', icon: Building2 },
            { id: 'apollo', label: 'Apollo.io', icon: Zap },
            { id: 'hubspot', label: 'HubSpot', icon: Zap },
            { id: 'pipedrive', label: 'Pipedrive', icon: Database },
            { id: 'salesforce', label: 'Salesforce', icon: Cloud },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeProviderTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveProviderTab(tab.id);
                setConfig({ ...config, active_provider: tab.id });
                setTestBanner(null);
              }}
              className={`flex-1 min-w-[125px] py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white dark:bg-[#182346] text-[#155eef] dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Provider Credentials Form */}
      {activeProviderTab === 'in_house' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
              CRM Endpoint URL
            </label>
            <input
              id="settings-crm-endpoint-input"
              type="url"
              value={config.in_house.endpoint_url || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  in_house: { ...config.in_house, endpoint_url: e.target.value },
                })
              }
              placeholder="https://api.yourcrm.com/v1/leads"
              className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
              Authentication Mode
            </label>
            <select
              value={config.in_house.auth_type}
              onChange={(e) =>
                setConfig({
                  ...config,
                  in_house: { ...config.in_house, auth_type: e.target.value as any },
                })
              }
              className="w-full px-3 py-2 glass-input rounded-xl font-medium"
            >
              <option value="bearer">Bearer Token</option>
              <option value="api_key">X-API-Key Header</option>
              <option value="none">No Auth</option>
            </select>
          </div>

          {config.in_house.auth_type === 'bearer' && (
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-slate-700 dark:text-slate-300 font-medium">
                CRM Bearer API Token
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
                placeholder="Paste CRM Bearer token..."
                className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
              />
            </div>
          )}

          {config.in_house.auth_type === 'api_key' && (
            <>
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-medium">
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
                  className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-medium">
                  CRM API Key
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
                  placeholder="Paste CRM API key..."
                  className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
                />
              </div>
            </>
          )}
        </div>
      )}

      {activeProviderTab === 'apollo' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
              Apollo.io API Key
            </label>
            <input
              id="settings-apollo-key-input"
              type="password"
              value={config.apollo?.api_key || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  apollo: { ...(config.apollo || {}), api_key: e.target.value },
                })
              }
              placeholder="Paste Apollo API key..."
              className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
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
              placeholder="LeadHook Automated"
              className="w-full px-3 py-2 glass-input rounded-xl text-xs"
            />
          </div>
        </div>
      )}

      {activeProviderTab === 'hubspot' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
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
              className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
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
              className="w-full px-3 py-2 glass-input rounded-xl text-xs"
            />
          </div>
        </div>
      )}

      {activeProviderTab === 'pipedrive' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
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
              className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
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
              className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>
        </div>
      )}

      {activeProviderTab === 'salesforce' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
              Salesforce Mode
            </label>
            <select
              value={config.salesforce.mode}
              onChange={(e) =>
                setConfig({
                  ...config,
                  salesforce: {
                    ...config.salesforce,
                    mode: e.target.value as 'web_to_lead' | 'rest_api',
                  },
                })
              }
              className="w-full px-3 py-2 glass-input rounded-xl font-medium"
            >
              <option value="web_to_lead">Web-to-Lead (OID)</option>
              <option value="rest_api">REST API (Instance + Token)</option>
            </select>
          </div>

          {config.salesforce.mode === 'web_to_lead' ? (
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-slate-700 dark:text-slate-300 font-medium">
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
                className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-medium">
                  Instance URL
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
                  placeholder="https://yourorg.my.salesforce.com"
                  className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-medium">
                  Access Token
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
                  placeholder="Paste Salesforce Bearer token..."
                  className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Test Banner */}
      {testBanner && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            testBanner.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/40 text-rose-800 dark:text-rose-300'
          }`}
        >
          {testBanner.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{testBanner.message}</span>
        </div>
      )}

      {/* CRM Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="settings-save-crm-btn"
            type="button"
            onClick={() => handleSaveCrm()}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#155eef] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save CRM Connection</span>
          </button>

          <button
            id="settings-test-crm-btn"
            type="button"
            onClick={handleTestCrm}
            disabled={testing}
            className="px-4 py-2 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>Test CRM</span>
          </button>
        </div>

        <button
          id="settings-sync-crm-now-btn"
          type="button"
          onClick={handleSyncLeadsNow}
          disabled={syncing}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
        >
          {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>Sync Collected Leads to CRM Now</span>
        </button>
      </div>

      {/* Divider: LeadHook External API Key Generator */}
      <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              LeadHook API Keys for External Tools & CRMs
            </h4>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {apiKeys.length} Active Key{apiKeys.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            id="settings-generate-apikey-name-input"
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateApiKey()}
            placeholder="Integration label (e.g. My CRM Auto-Pull, Apollo, Zapier)"
            className="flex-1 px-3 py-2 glass-input rounded-xl text-xs placeholder-slate-400"
          />
          <button
            id="settings-generate-apikey-btn"
            type="button"
            onClick={handleGenerateApiKey}
            disabled={generatingKey}
            className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            {generatingKey ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Create API Key</span>
          </button>
        </div>

        {apiKeys.length > 0 && (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#101730] border border-slate-200/80 dark:border-blue-900/30 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {k.name}
                  </span>
                  <code className="px-2 py-0.5 rounded bg-white dark:bg-[#0b1021] border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-[#155eef] dark:text-blue-300">
                    {k.key}
                  </code>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyText(k.key, k.id)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#162044] hover:bg-blue-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-blue-800/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === k.id ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === k.id ? 'Copied' : 'Copy Key'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevokeApiKey(k.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    title="Revoke Key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ready-to-Use CRM Pull Endpoint */}
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#0d1326] border border-slate-200/70 dark:border-blue-900/30 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[10px]">
              GET
            </span>
            <code className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
              {pullEndpoint}
            </code>
          </div>
          <button
            type="button"
            onClick={() => copyText(pullEndpoint, 'pull_endpoint')}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
          >
            {copiedId === 'pull_endpoint' ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>Copy Endpoint</span>
          </button>
        </div>
      </div>
    </div>
  );
};
