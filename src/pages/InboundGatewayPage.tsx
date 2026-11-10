import React, { useState, useEffect } from 'react';
import {
  Webhook,
  Chrome,
  Bookmark,
  Copy,
  Check,
  Send,
  RefreshCw,
  Terminal,
  Activity,
  Globe,
  Layers,
  ArrowRight,
  ExternalLink,
  Zap,
  Code,
  ShieldCheck,
} from 'lucide-react';
import { InboundWebhookLog } from '../types';

interface InboundGatewayPageProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToResults?: () => void;
}

export const InboundGatewayPage: React.FC<InboundGatewayPageProps> = ({
  onShowToast,
  onNavigateToResults,
}) => {
  const [activeTab, setActiveTab] = useState<'extension' | 'webhook' | 'logs'>('extension');
  const [logs, setLogs] = useState<InboundWebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick Capture Test State
  const [testUrl, setTestUrl] = useState('https://stripe.com');
  const [testTitle, setTestTitle] = useState('Stripe | Financial Infrastructure for the Internet');
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState<any | null>(null);

  // Webhook Test State
  const [webhookCompany, setWebhookCompany] = useState('Databricks Inc');
  const [webhookUrl, setWebhookUrl] = useState('https://databricks.com');
  const [webhookName, setWebhookName] = useState('Ali Ghodsi');
  const [webhookEmail, setWebhookEmail] = useState('ali.g@databricks.com');
  const [isPostingWebhook, setIsPostingWebhook] = useState(false);

  const [bookmarkletCode, setBookmarkletCode] = useState('');

  useEffect(() => {
    loadLogs();
    loadBookmarklet();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inbound/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch {}
    finally {
      setIsLoading(false);
    }
  };

  const loadBookmarklet = async () => {
    try {
      const res = await fetch('/api/inbound/bookmarklet-code');
      if (res.ok) {
        const data = await res.json();
        setBookmarkletCode(data.bookmarklet || '');
      }
    } catch {}
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onShowToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleQuickCaptureTest = async () => {
    setIsCapturing(true);
    try {
      const res = await fetch('/api/inbound/quick-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl, title: testTitle }),
      });
      if (!res.ok) throw new Error('Capture failed');
      const data = await res.json();
      setCaptureResult(data);
      onShowToast(`Captured ${data.contact?.company_name || 'Prospect'}!`, 'success');
      loadLogs();
    } catch (e: any) {
      onShowToast(e.message || 'Capture failed', 'error');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleTestWebhook = async () => {
    setIsPostingWebhook(true);
    try {
      const res = await fetch('/api/inbound/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: webhookCompany,
          url: webhookUrl,
          name: webhookName,
          email: webhookEmail,
        }),
      });
      if (!res.ok) throw new Error('Webhook ingest failed');
      const data = await res.json();
      onShowToast(`Webhook lead ingested successfully!`, 'success');
      loadLogs();
    } catch (e: any) {
      onShowToast(e.message || 'Webhook failed', 'error');
    } finally {
      setIsPostingWebhook(false);
    }
  };

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const webhookEndpoint = `${currentHost}/api/inbound/webhook`;

  const curlExample = `curl -X POST "${webhookEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "company_name": "Acme Corp",
    "url": "https://acme.com",
    "name": "Jane Doe",
    "email": "jane@acme.com"
  }'`;

  return (
    <div id="inbound-gateway-page" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-emerald-200/80 dark:border-emerald-900/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md">
            <Webhook className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Inbound Webhook Listener & Chrome Extension Gateway
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                1-Click Capture
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('extension')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'extension'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Chrome className="w-4 h-4" />
          <span>Chrome Extension & Bookmarklet</span>
        </button>
        <button
          onClick={() => setActiveTab('webhook')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'webhook'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Inbound Webhook API</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Ingestion Audit Log ({logs.length})</span>
        </button>
      </div>

      {/* Tab: Extension & Bookmarklet */}
      {activeTab === 'extension' && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-500" />
              <span>Browser Bookmarklet</span>
            </h2>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-4">
              <a
                href={bookmarkletCode || '#'}
                onClick={(e) => {
                  if (!bookmarkletCode) e.preventDefault();
                }}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md cursor-grab active:cursor-grabbing inline-flex items-center gap-2 select-none"
                title="Drag this button to your Bookmarks Toolbar"
              >
                <Bookmark className="w-4 h-4" />
                <span>+ LeadHook 1-Click Capture</span>
              </a>

              <button
                type="button"
                onClick={() => handleCopy(bookmarkletCode, 'bookmarklet')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedKey === 'bookmarklet' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'bookmarklet' ? 'Copied' : 'Copy JavaScript'}</span>
              </button>
            </div>
          </div>

          {/* Quick Capture Live Test Simulator */}
          <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Simulate Browser Capture</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Active Tab URL
                </label>
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Page Title
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleQuickCaptureTest}
              disabled={isCapturing}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer transition"
            >
              {isCapturing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isCapturing ? 'Capturing & Enriching...' : 'Test Inbound Capture'}</span>
            </button>

            {captureResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Lead Captured: {captureResult.contact?.company_name}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Extracted Contact: {captureResult.contact?.full_name} ({captureResult.contact?.role}) &bull; Phone: {captureResult.contact?.phone} &bull; Email: {captureResult.contact?.email}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Inbound Webhook API */}
      {activeTab === 'webhook' && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>Public Inbound Webhook Endpoint</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Post JSON payloads to this endpoint from Zapier, Make, custom forms, or Typeform to automatically ingest leads into LeadHook.
            </p>

            <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs flex items-center justify-between">
              <span className="truncate">{webhookEndpoint}</span>
              <button
                onClick={() => handleCopy(webhookEndpoint, 'endpoint')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'endpoint' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase text-slate-400">cURL Example</div>
              <pre className="p-3 rounded-xl bg-slate-900 text-slate-300 font-mono text-xs overflow-x-auto">
                {curlExample}
              </pre>
            </div>
          </div>

          {/* Test Webhook Form */}
          <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Send Test Webhook Payload
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Company</label>
                <input
                  type="text"
                  value={webhookCompany}
                  onChange={(e) => setWebhookCompany(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Website</label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={webhookName}
                  onChange={(e) => setWebhookName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={webhookEmail}
                  onChange={(e) => setWebhookEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleTestWebhook}
              disabled={isPostingWebhook}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer transition"
            >
              {isPostingWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Send Payload</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab: Logs Audit Trail */}
      {activeTab === 'logs' && (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase text-slate-500 tracking-wider">
            Inbound Request Stream & Capture Logs
          </div>
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No inbound leads logged yet. Send a test webhook or trigger the Chrome extension above!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/30 transition text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {log.companyName || 'Prospect Company'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                        {log.source.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {log.targetUrl || 'Direct Webhook'} &bull; {log.payloadSummary || 'Processed'}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    {new Date(log.receivedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
