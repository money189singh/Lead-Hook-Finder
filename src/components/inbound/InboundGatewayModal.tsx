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
} from 'lucide-react';
import { InboundWebhookLog } from '../../types';

interface InboundGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export const InboundGatewayModal: React.FC<InboundGatewayModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
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
    if (isOpen) {
      loadLogs();
      loadBookmarklet();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const webhookEndpoint = `${currentHost}/api/inbound/webhook`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="glass-card relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0c1322] border border-blue-200/80 dark:border-blue-900/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white shadow-md">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Inbound Webhook Listener & Chrome Extension Gateway
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  v2.0
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('extension')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'extension'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Chrome className="w-3.5 h-3.5" />
            <span>Chrome Extension & Bookmarklet</span>
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'webhook'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Inbound Webhook API</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Ingestion Logs ({logs.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'extension' && (
            <div className="space-y-5">
              {/* 1-Click Bookmarklet Card */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-emerald-600" />
                      <span>1-Click Browser Bookmarklet (Instant Setup)</span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Drag this button directly to your browser's Bookmarks bar. Whenever you are visiting any company website, click it to instantly send the lead into LeadHook with automatic tech-stack detection!
                    </p>
                  </div>

                  <a
                    href={bookmarkletCode || '#'}
                    onClick={(e) => {
                      if (!bookmarkletCode) e.preventDefault();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md whitespace-nowrap cursor-grab select-none flex items-center gap-1.5"
                    title="Drag to bookmarks bar"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>⚡ Drag to Bookmarks Bar</span>
                  </a>
                </div>
              </div>

              {/* Quick Capture Test Playground */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628]">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Test Browser Quick Capture
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Target Website URL</label>
                    <input
                      type="text"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101730] text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Page Title</label>
                    <input
                      type="text"
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101730] text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  onClick={handleQuickCaptureTest}
                  disabled={isCapturing}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isCapturing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Capturing & Enriching...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Execute Quick Capture Test</span>
                    </>
                  )}
                </button>

                {captureResult && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-900 text-slate-200 text-xs font-mono">
                    <div className="text-emerald-400 font-bold mb-1">✓ Capture Success</div>
                    <div>Company: {captureResult.contact?.company_name}</div>
                    <div>Decision Maker: {captureResult.contact?.full_name} ({captureResult.contact?.role})</div>
                    <div>Email: {captureResult.contact?.email}</div>
                    <div>Phone: {captureResult.contact?.phone} ({captureResult.contact?.phone_type})</div>
                    <div>Technologies ({captureResult.technologies?.length || 0}): {captureResult.technologies?.map((t: any) => t.name).join(', ')}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'webhook' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Your Inbound Webhook URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookEndpoint}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#101730] text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    onClick={() => handleCopy(webhookEndpoint, 'webhook')}
                    className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              {/* Interactive Inbound Payload Tester */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628]">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Send Test Webhook Ingest
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={webhookCompany}
                      onChange={(e) => setWebhookCompany(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101730] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Website URL</label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101730] text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={webhookName}
                      onChange={(e) => setWebhookName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101730] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Email</label>
                    <input
                      type="text"
                      value={webhookEmail}
                      onChange={(e) => setWebhookEmail(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101730] text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleTestWebhook}
                  disabled={isPostingWebhook}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Inbound Webhook</span>
                </button>
              </div>

              {/* cURL Example */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  cURL Example
                </label>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-300 font-mono text-[11px] overflow-x-auto">
{`curl -X POST "${webhookEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{"company_name": "Acme Corp", "url": "https://acme.com", "name": "Jane Doe", "email": "jane@acme.com"}'`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No inbound webhooks received yet.</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                        {log.source === 'chrome_extension' ? <Chrome className="w-3.5 h-3.5" /> : <Webhook className="w-3.5 h-3.5" />}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {log.companyName || 'Unknown Prospect'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {log.payloadSummary || log.targetUrl}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {log.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(log.receivedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
