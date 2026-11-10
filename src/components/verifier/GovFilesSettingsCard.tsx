import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Power,
  RotateCw,
  Info,
  Layers,
} from 'lucide-react';
import { GovFilesConfig } from '../../types';

interface GovFilesSettingsCardProps {
  initialConfig?: GovFilesConfig;
  onSaveConfig?: (config: GovFilesConfig) => Promise<void>;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const GovFilesSettingsCard: React.FC<GovFilesSettingsCardProps> = ({
  initialConfig,
  onSaveConfig,
  onShowToast,
}) => {
  const [enabled, setEnabled] = useState<boolean>(initialConfig?.enabled ?? true);
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [status, setStatus] = useState<'active' | 'quota_exceeded' | 'error' | 'disabled' | 'untested'>(
    initialConfig?.status || (initialConfig?.has_key ? 'active' : 'untested')
  );
  const [testing, setTesting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [fallbackStatus, setFallbackStatus] = useState<string>(
    initialConfig?.fallback_active ? 'Fallback Active (Search/State registry)' : 'Direct GovFiles API Primary'
  );

  useEffect(() => {
    if (initialConfig) {
      setEnabled(initialConfig.enabled !== false);
      setStatus(initialConfig.status || (initialConfig.has_key ? 'active' : 'untested'));
    }
  }, [initialConfig]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestMessage(null);
    try {
      const res = await fetch('/api/verifier/govfiles/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      setTestMessage({
        ok: data.ok,
        message: data.message || (data.ok ? 'Connection established successfully' : 'Connection failed'),
      });
      if (data.ok) {
        setStatus('active');
        setFallbackStatus('Direct GovFiles API Primary');
        onShowToast?.('GovFiles API key verified and active', 'success');
      } else {
        setStatus('error');
        setFallbackStatus('Fallback Engaged (Web Search & Public Registries)');
        onShowToast?.(data.message || 'GovFiles connection failed', 'warning');
      }
    } catch (err: any) {
      setTestMessage({ ok: false, message: err.message || 'Network error testing GovFiles' });
      setStatus('error');
      setFallbackStatus('Fallback Engaged (Web Search & Public Registries)');
      onShowToast?.(err.message || 'Failed to test GovFiles', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/verifier/govfiles/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          apiKey: apiKey.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApiKey(''); // Clear entered key from field to preserve privacy
        onShowToast?.('GovFiles settings updated safely', 'success');
        if (onSaveConfig && data.govfiles_config) {
          await onSaveConfig(data.govfiles_config);
        }
      } else {
        onShowToast?.(data.error || 'Failed to save GovFiles settings', 'error');
      }
    } catch (err: any) {
      onShowToast?.(err.message || 'Failed to save GovFiles settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5 shadow-sm border border-purple-100/80 dark:border-purple-900/30">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-100 dark:border-purple-900/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Government Registry Verification: GovFiles</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/40">
                Official Entity Lookup
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct integration with government registries for legal entity validation, registration status, and filing dates.
            </p>
          </div>
        </div>

        {/* Enable / Disable Switch */}
        <div className="flex items-center gap-3 bg-purple-50/50 dark:bg-[#131122] border border-purple-100 dark:border-purple-900/30 px-3 py-1.5 rounded-xl">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {enabled ? 'Provider Enabled' : 'Provider Disabled'}
          </span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
              enabled ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: API Key Configuration */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">GovFiles API Key</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Key className="w-4 h-4" />
            </div>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={initialConfig?.has_key ? 'gf_live_••••••••••••••••••••••••' : 'Enter gf_live_... key'}
              className="w-full pl-9 pr-10 py-2.5 glass-input rounded-xl text-xs placeholder-slate-400 transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Key is securely masked and never exposed in logs, outputs, or AI prompts.</span>
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-purple-50 dark:bg-[#181628] dark:hover:bg-[#201d36] text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save GovFiles Settings'}
            </button>
          </div>
        </div>

        {/* Right: Provider & Fallback Status */}
        <div className="space-y-3 bg-purple-50/30 dark:bg-[#131122]/60 border border-purple-100 dark:border-purple-900/30 rounded-xl p-4">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Provider Status & Health</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                  : status === 'error'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {status}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between items-center py-1 border-b border-purple-100 dark:border-purple-900/20">
              <span>GovFiles Registry Mode:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{enabled ? 'Active Registry' : 'Disabled'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-purple-100 dark:border-purple-900/20">
              <span>Fallback Strategy:</span>
              <span className="font-semibold text-purple-700 dark:text-purple-300">{fallbackStatus}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>Entity Resolution:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Normalized Name + State Matching</span>
            </div>
          </div>

          {testMessage && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                testMessage.ok
                  ? 'bg-emerald-50 border border-emerald-200/80 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300'
                  : 'bg-rose-50 border border-rose-200/80 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/40 dark:text-rose-300'
              }`}
            >
              {testMessage.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              )}
              <div className="flex-1 text-[11px] leading-relaxed">{testMessage.message}</div>
            </div>
          )}
        </div>
      </div>

      {/* Verification Rules Reference */}
      <div className="bg-purple-50/20 dark:bg-[#131122]/40 border border-purple-100/60 dark:border-purple-900/20 rounded-xl p-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
        <div className="font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Core Verification Rules Enforced by Engine:</span>
        </div>
        <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-600 dark:text-slate-400">
          <li><strong>Government NOT FOUND</strong> does not automatically mark a business as closed (e.g. unregistered DBA or out-of-state).</li>
          <li><strong>Government ACTIVE</strong> does not automatically prove physical daily operations (a dissolved business may still have an active website, or an active LLC may have shuttered storefront).</li>
          <li><strong>A working website alone</strong> does not prove operating status without corroborating fresh content or reviews.</li>
        </ul>
      </div>
    </div>
  );
};
