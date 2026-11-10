import React, { useState } from 'react';
import { AppLogo } from './AppLogo';
import { Key, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface FirstRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveKey: (key: string) => Promise<boolean>;
  onTestKey: (key: string) => Promise<{ success: boolean; message: string }>;
}

export const FirstRunModal: React.FC<FirstRunModalProps> = ({
  isOpen,
  onClose,
  onSaveKey,
  onTestKey,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter a key to test.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestKey(apiKey.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter your Gemini API key.' });
      return;
    }
    setSaving(true);
    try {
      const ok = await onSaveKey(apiKey.trim());
      if (ok) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="first-run-setup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <AppLogo size={46} withContainer className="shadow-lg shadow-blue-500/10 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Welcome to LeadHook
            </h2>
          </div>
        </div>

        {/* Description */}
        <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          Enter your Gemini API key to enable AI-powered contact extraction, structured role classification, and verified email identification.
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label htmlFor="first-run-gemini-key" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-blue-400" />
            Gemini API Key
          </label>
          <div className="relative">
            <input
              id="first-run-gemini-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="Paste your Gemini API key (e.g. AIzaSy...)"
              className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#155eef] transition-colors font-mono"
            />
            <button
              type="button"
              id="first-run-toggle-show-key"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Stored locally in backend settings. Never exposed to scraped websites.</span>
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            id="first-run-test-result"
            className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testResult.success ? 'Success' : 'Validation Error'}</p>
              <p className="text-slate-300 mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            id="first-run-skip-btn"
            onClick={onClose}
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Skip for now (rule-based extraction)
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="first-run-test-btn"
              onClick={handleTest}
              disabled={testing || !apiKey.trim()}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Test API Key</span>
            </button>

            <button
              type="button"
              id="first-run-save-btn"
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="px-4 py-2 rounded-lg bg-[#155eef] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-[#155eef]/30 flex items-center gap-1.5 transition-all"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save & Continue</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
