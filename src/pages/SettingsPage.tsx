import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sliders,
  Users,
  Mail,
  Bot,
  RotateCcw,
  Save,
  Info,
  Plus,
  X,
  Cloud,
  LogOut,
  Ban,
  Webhook,
  Send,
} from 'lucide-react';
import { ScrapeSettings, IcpConfig } from '../types';
import { IcpSettingsCard } from '../components/enrichment/IcpSettingsCard';
import { GovFilesSettingsCard } from '../components/verifier/GovFilesSettingsCard';
import { OracleVmWorkerCard } from '../components/OracleVmWorkerCard';
import { CrmAndApiKeySettingsCard } from '../components/settings/CrmAndApiKeySettingsCard';
import { useAuth } from '../context/AuthContext';

const DEFAULT_ICP_CONFIG: IcpConfig = {
  enabled: true,
  target_roles: [
    'CEO',
    'Founder',
    'Owner',
    'Managing Director',
    'President',
    'Vice President',
    'Head of Sales',
    'Head of Marketing',
    'VP Sales',
    'VP Marketing',
    'Operations Director',
    'Chief Technology Officer',
    'CTO',
  ],
  target_industries: [
    'SaaS / Cloud Software',
    'E-Commerce & Retail',
    'Financial Services & Fintech',
    'Healthcare & Biotech',
  ],
  preferred_company_sizes: ['11-50', '51-200', '201-500', '501-1000'],
  min_icp_score: 60,
  weights: {
    roleWeight: 40,
    industryWeight: 20,
    companySizeWeight: 15,
    emailTypeWeight: 15,
    socialWeight: 10,
  },
};

interface SettingsPageProps {
  settings: ScrapeSettings | null;
  onSaveSettings: (settings: Partial<ScrapeSettings>) => Promise<boolean>;
  onTestKey: (key: string) => Promise<{ success: boolean; message: string }>;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
  onTestKey,
  onShowToast,
}) => {
  const { user, userProfile, loginWithGoogle, logout } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Crawler Parameters
  const [maxPages, setMaxPages] = useState(10);
  const [maxContacts, setMaxContacts] = useState(2);
  const [smartDiscovery, setSmartDiscovery] = useState(true);
  const [concurrency, setConcurrency] = useState(3);
  const [requestDelay, setRequestDelay] = useState(1000);
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [retryCount, setRetryCount] = useState(2);

  // Priority Roles & Generic Emails
  const [priorityRoles, setPriorityRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [genericPatterns, setGenericPatterns] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState('');

  // ICP Configuration
  const [icpConfig, setIcpConfig] = useState<IcpConfig>(DEFAULT_ICP_CONFIG);

  // AI Prompt
  const [aiRules, setAiRules] = useState('');
  const [saving, setSaving] = useState(false);

  // Workflow Coordination & Freshness settings
  const [discoveryFreshnessDays, setDiscoveryFreshnessDays] = useState(7);
  const [enrichmentFreshnessDays, setEnrichmentFreshnessDays] = useState(30);
  const [autoEnqueueEnrichment, setAutoEnqueueEnrichment] = useState(true);

  // Do-Not-Contact Suppression & Outbound Webhook
  const [suppressedDomains, setSuppressedDomains] = useState<string[]>([]);
  const [newSuppressedDomain, setNewSuppressedDomain] = useState('');
  const [suppressedEmails, setSuppressedEmails] = useState<string[]>([]);
  const [newSuppressedEmail, setNewSuppressedEmail] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookFilterMode, setWebhookFilterMode] = useState<'all_leads' | 'high_icp_only'>('all_leads');
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    if (settings) {
      setApiKey(settings.gemini_api_key || '');
      setMaxPages(settings.max_pages || 10);
      setMaxContacts(settings.max_contacts ?? 2);
      setSmartDiscovery(settings.smart_discovery !== false);
      setConcurrency(settings.concurrency || 3);
      setRequestDelay(settings.request_delay_ms || 1000);
      setTimeoutMs(settings.timeout_ms || 15000);
      setRetryCount(settings.retry_count ?? 2);
      if (settings.icp_config) {
        setIcpConfig(settings.icp_config);
      }
      setDiscoveryFreshnessDays(settings.discovery_freshness_days ?? 7);
      setEnrichmentFreshnessDays(settings.enrichment_freshness_days ?? 30);
      setAutoEnqueueEnrichment(settings.auto_enqueue_enrichment !== false);
      setSuppressedDomains(settings.suppressed_domains || []);
      setSuppressedEmails(settings.suppressed_emails || []);
      if (settings.outbound_webhook) {
        setWebhookEnabled(Boolean(settings.outbound_webhook.enabled));
        setWebhookUrl(settings.outbound_webhook.url || '');
        setWebhookSecret(settings.outbound_webhook.secret_header || '');
        setWebhookFilterMode(settings.outbound_webhook.filter_mode || 'all_leads');
      }
      setPriorityRoles(
        settings.priority_roles || [
          'CEO',
          'Founder',
          'Owner',
          'Managing Director',
          'Director',
          'General Manager',
          'Finance Manager',
          'Operations Manager',
          'Business Development',
          'Sales Manager',
          'Marketing Manager',
        ]
      );
      setGenericPatterns(
        settings.generic_email_patterns || [
          'info@',
          'contact@',
          'sales@',
          'support@',
          'admin@',
          'inquiries@',
          'office@',
          'hello@',
          'help@',
        ]
      );
      setAiRules(
        settings.ai_agent_rules ||
          `Extract only publicly available business contact information from the supplied website content.
Follow these rules strictly:
1. Only extract information explicitly stated on the page.
2. Never hallucinate or infer emails that do not exist.
3. Classify each email as: Personal, Role-based, or Generic.
4. Extract only full personal names when directly paired with roles or emails.
5. Identify company name accurately from title or navigation headers.`
      );
    }
  }, [settings]);

  const handleTestKey = async () => {
    const keyToTest = apiKey.trim() || settings?.gemini_api_key;
    if (!keyToTest) {
      setTestResult({ success: false, message: 'Please enter an API key to test.' });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await onTestKey(keyToTest);
      setTestResult(res);
      if (res.success) {
        onShowToast('Gemini API key is valid and connected!', 'success');
      } else {
        onShowToast(res.message || 'Key validation failed', 'error');
      }
    } finally {
      setTestingKey(false);
    }
  };

  const handleAddRole = () => {
    if (!newRole.trim()) return;
    if (!priorityRoles.includes(newRole.trim())) {
      setPriorityRoles([...priorityRoles, newRole.trim()]);
    }
    setNewRole('');
  };

  const handleRemoveRole = (role: string) => {
    setPriorityRoles(priorityRoles.filter((r) => r !== role));
  };

  const handleAddPattern = () => {
    if (!newPattern.trim()) return;
    let pat = newPattern.trim().toLowerCase();
    if (!pat.endsWith('@')) pat += '@';
    if (!genericPatterns.includes(pat)) {
      setGenericPatterns([...genericPatterns, pat]);
    }
    setNewPattern('');
  };

  const handleRemovePattern = (pat: string) => {
    setGenericPatterns(genericPatterns.filter((p) => p !== pat));
  };

  const handleAddSuppressedDomain = () => {
    if (!newSuppressedDomain.trim()) return;
    const entries = newSuppressedDomain
      .split(/[\n,]/)
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
      .filter(Boolean);
    const merged = Array.from(new Set([...suppressedDomains, ...entries]));
    setSuppressedDomains(merged);
    setNewSuppressedDomain('');
  };

  const handleRemoveSuppressedDomain = (dom: string) => {
    setSuppressedDomains(suppressedDomains.filter((d) => d !== dom));
  };

  const handleAddSuppressedEmail = () => {
    if (!newSuppressedEmail.trim()) return;
    const entries = newSuppressedEmail
      .split(/[\n,]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    const merged = Array.from(new Set([...suppressedEmails, ...entries]));
    setSuppressedEmails(merged);
    setNewSuppressedEmail('');
  };

  const handleRemoveSuppressedEmail = (em: string) => {
    setSuppressedEmails(suppressedEmails.filter((e) => e !== em));
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      onShowToast('Enter a webhook URL to test.', 'warning');
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await fetch('/api/webhook/test-outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          secret_header: webhookSecret.trim(),
          filter_mode: webhookFilterMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(data.message || 'Webhook test succeeded!', 'success');
      } else {
        onShowToast(data.message || 'Webhook test failed', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Webhook test error', 'error');
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Partial<ScrapeSettings> = {
        gemini_api_key: apiKey.trim(),
        max_pages: maxPages,
        max_contacts: maxContacts,
        smart_discovery: smartDiscovery,
        concurrency,
        request_delay_ms: requestDelay,
        timeout_ms: timeoutMs,
        retry_count: retryCount,
        priority_roles: priorityRoles,
        generic_email_patterns: genericPatterns,
        icp_config: icpConfig,
        ai_agent_rules: aiRules,
        discovery_freshness_days: discoveryFreshnessDays,
        enrichment_freshness_days: enrichmentFreshnessDays,
        auto_enqueue_enrichment: autoEnqueueEnrichment,
        suppressed_domains: suppressedDomains,
        suppressed_emails: suppressedEmails,
        outbound_webhook: {
          enabled: webhookEnabled,
          url: webhookUrl.trim(),
          secret_header: webhookSecret.trim(),
          filter_mode: webhookFilterMode,
        },
      };
      const ok = await onSaveSettings(updated);
      if (ok) {
        onShowToast('Settings saved successfully (persisted to Firestore & local storage).', 'success');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setMaxPages(10);
    setMaxContacts(2);
    setSmartDiscovery(true);
    setConcurrency(3);
    setRequestDelay(1000);
    setTimeoutMs(15000);
    setRetryCount(2);
    setIcpConfig(DEFAULT_ICP_CONFIG);
    setPriorityRoles([
      'CEO',
      'Founder',
      'Owner',
      'Managing Director',
      'Director',
      'General Manager',
      'Finance Manager',
      'Operations Manager',
      'Business Development',
      'Sales Manager',
      'Marketing Manager',
    ]);
    setGenericPatterns([
      'info@',
      'contact@',
      'sales@',
      'support@',
      'admin@',
      'inquiries@',
      'office@',
      'hello@',
      'help@',
    ]);
    setAiRules(
      `Extract only publicly available business contact information from the supplied website content.
Follow these rules strictly:
1. Only extract information explicitly stated on the page.
2. Never hallucinate or infer emails that do not exist.
3. Classify each email as: Personal, Role-based, or Generic.
4. Extract only full personal names when directly paired with roles or emails.
5. Identify company name accurately from title or navigation headers.`
    );
    onShowToast('Reset parameters to recommended defaults. Click "Save Settings" to apply.', 'info');
  };

  return (
    <div id="settings-page" className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Top Header & Save Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card rounded-2xl p-6 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            Application Configuration
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            id="settings-reset-defaults-btn"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            id="settings-save-btn"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Account & Cloud Firestore Synchronization Section */}
      <div className="glass-card rounded-2xl p-6 space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cloud Account & Database Sync</h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${
              user
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800'
                : 'bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/80 dark:border-blue-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                user ? 'bg-emerald-500' : 'bg-[#155eef]'
              }`}
            />
            <span>{user ? 'Google Connected' : 'Unauthenticated'}</span>
          </span>
        </div>

        {!user ? (
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/40">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white">Sign In to sync to Cloud</p>
            </div>
            <button
              type="button"
              id="settings-google-signin-btn"
              onClick={() => loginWithGoogle()}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-2.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        ) : (
          <div className="pt-2 flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={userProfile?.displayName || user.displayName || 'User'}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#155eef] text-white font-bold flex items-center justify-center text-sm">
                  {((userProfile?.displayName || user.displayName || user.email || 'U').charAt(0)).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {userProfile?.displayName || user.displayName || 'Google User'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.email}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Authenticated & Synced with Firestore</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Gemini API Key Section */}
      <div className="glass-card rounded-2xl p-6 space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gemini API Key</h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${
              settings?.has_key
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 dark:border-amber-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                settings?.has_key ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {settings?.has_key ? 'Connected & Ready' : 'Key Required for AI'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              id="settings-gemini-key-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="Paste Gemini API key (AIzaSy...)"
              className="w-full pl-3.5 pr-10 py-2 glass-input rounded-xl text-xs font-mono placeholder-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            type="button"
            id="settings-test-key-btn"
            onClick={handleTestKey}
            disabled={testingKey || !apiKey.trim()}
            className="px-4 py-2 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-50 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            {testingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />}
            <span>Test API Key</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/40 text-rose-800 dark:text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* GovFiles Government Registry Verification Settings */}
      <GovFilesSettingsCard
        initialConfig={settings?.govfiles_config}
        onSaveConfig={async (newConfig) => {
          await onSaveSettings({ govfiles_config: newConfig });
        }}
        onShowToast={onShowToast}
      />

      {/* Crawling Parameters */}
      <div className="glass-card rounded-2xl p-6 space-y-5 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Crawling & Scraping Parameters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Max Pages */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Max Pages Per Company</label>
            <select
              id="settings-max-pages-select"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            >
              <option value={5}>5 pages</option>
              <option value={10}>10 pages</option>
              <option value={20}>20 pages</option>
              <option value={30}>30 pages</option>
            </select>
          </div>

          {/* Max Contacts */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Max Contacts Per Company</label>
            <select
              id="settings-max-contacts-select"
              value={maxContacts}
              onChange={(e) => setMaxContacts(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            >
              <option value={1}>1 contact</option>
              <option value={2}>2 contacts</option>
              <option value={3}>3 contacts</option>
              <option value={5}>5 contacts</option>
              <option value={10}>10 contacts</option>
              <option value={0}>Unlimited</option>
            </select>
          </div>

          {/* Concurrency */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Parallel Concurrency</label>
            <select
              id="settings-concurrency-select"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            >
              <option value={1}>1 website</option>
              <option value={3}>3 websites</option>
              <option value={5}>5 websites</option>
              <option value={10}>10 websites</option>
            </select>
          </div>

          {/* Request Delay */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Request Delay</label>
            <select
              id="settings-delay-select"
              value={requestDelay}
              onChange={(e) => setRequestDelay(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            >
              <option value={0}>0 ms</option>
              <option value={500}>500 ms</option>
              <option value={1000}>1000 ms</option>
              <option value={2000}>2000 ms</option>
              <option value={3000}>3000 ms</option>
            </select>
          </div>

          {/* Timeout */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Page Timeout (ms)</label>
            <input
              id="settings-timeout-input"
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            />
          </div>

          {/* Retry Count */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Retry Count</label>
            <select
              id="settings-retry-select"
              value={retryCount}
              onChange={(e) => setRetryCount(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            >
              <option value={0}>0 retries</option>
              <option value={1}>1 retry</option>
              <option value={2}>2 retries</option>
            </select>
          </div>
        </div>
      </div>

      {/* Workflow Coordination & Freshness Settings */}
      <div className="glass-card rounded-2xl p-6 space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Workflow Coordination & Data Freshness</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            Deduplication & Cache Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Discovery / Activity Freshness */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Recent-Activity Research Freshness</label>
            <select
              value={discoveryFreshnessDays}
              onChange={(e) => setDiscoveryFreshnessDays(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {/* Website Enrichment Freshness */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Website Scraper Enrichment Freshness</label>
            <select
              value={enrichmentFreshnessDays}
              onChange={(e) => setEnrichmentFreshnessDays(Number(e.target.value))}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium focus:outline-none"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          {/* Auto Enqueue Enrichment Toggle */}
          <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Automatic Scraper Enqueue</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoEnqueueEnrichment}
                onChange={(e) => setAutoEnqueueEnrichment(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#155eef]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Priority Roles Manager */}
      <div className="glass-card rounded-2xl p-6 space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Priority Roles</h3>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {priorityRoles.map((role) => (
            <span
              key={role}
              className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 text-[#155eef] dark:text-blue-300 text-xs font-medium flex items-center gap-1.5"
            >
              <span>{role}</span>
              <button
                type="button"
                onClick={() => handleRemoveRole(role)}
                className="text-blue-400 hover:text-[#155eef] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 max-w-md">
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
            placeholder="Add new role (e.g. VP of Sales)"
            className="flex-1 px-3 py-1.5 glass-input rounded-xl text-xs placeholder-slate-400"
          />
          <button
            type="button"
            onClick={handleAddRole}
            className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Generic Email Patterns */}
      <div className="glass-card rounded-2xl p-6 space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Generic Email Prefixes</h3>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {genericPatterns.map((pattern) => (
            <span
              key={pattern}
              className="px-2.5 py-1 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[#155eef] dark:text-blue-300 text-xs font-mono flex items-center gap-1.5"
            >
              <span>{pattern}</span>
              <button
                type="button"
                onClick={() => handleRemovePattern(pattern)}
                className="text-blue-400 hover:text-[#155eef] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 max-w-md">
          <input
            type="text"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
            placeholder="Add prefix (e.g. feedback@)"
            className="flex-1 px-3 py-1.5 glass-input rounded-xl text-xs placeholder-slate-400"
          />
          <button
            type="button"
            onClick={handleAddPattern}
            className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Do-Not-Contact Suppression List */}
      <div id="settings-suppression-card" className="glass-card rounded-2xl p-6 space-y-5 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Do-Not-Contact Suppression List</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40">
            {suppressedDomains.length} domains • {suppressedEmails.length} emails
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Suppressed Domains */}
          <div className="space-y-3">
            <div className="font-semibold text-slate-700 dark:text-slate-300">Blocked Domains</div>
            <div className="flex items-center gap-2">
              <input
                id="settings-suppress-domain-input"
                type="text"
                value={newSuppressedDomain}
                onChange={(e) => setNewSuppressedDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSuppressedDomain()}
                placeholder="competitor.com, client.io"
                className="flex-1 px-3 py-1.5 glass-input rounded-xl text-xs font-mono placeholder-slate-400"
              />
              <button
                type="button"
                onClick={handleAddSuppressedDomain}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Block</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {suppressedDomains.map((dom) => (
                <span
                  key={`supp-dom-${dom}`}
                  className="px-2.5 py-1 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-mono flex items-center gap-1.5"
                >
                  <span>{dom}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSuppressedDomain(dom)}
                    className="text-rose-400 hover:text-rose-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Suppressed Emails */}
          <div className="space-y-3">
            <div className="font-semibold text-slate-700 dark:text-slate-300">Blocked Email Addresses</div>
            <div className="flex items-center gap-2">
              <input
                id="settings-suppress-email-input"
                type="text"
                value={newSuppressedEmail}
                onChange={(e) => setNewSuppressedEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSuppressedEmail()}
                placeholder="optout@domain.com"
                className="flex-1 px-3 py-1.5 glass-input rounded-xl text-xs font-mono placeholder-slate-400"
              />
              <button
                type="button"
                onClick={handleAddSuppressedEmail}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Block</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {suppressedEmails.map((em) => (
                <span
                  key={`supp-em-${em}`}
                  className="px-2.5 py-1 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-mono flex items-center gap-1.5"
                >
                  <span>{em}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSuppressedEmail(em)}
                    className="text-rose-400 hover:text-rose-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Direct CRM & External Tool Integrations + API Keys */}
      <CrmAndApiKeySettingsCard onShowToast={onShowToast} />

      {/* Automated Outbound Webhook Dispatcher */}
      <div id="settings-outbound-webhook-card" className="glass-card rounded-2xl p-6 space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Outbound Webhook Auto-Dispatcher</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={webhookEnabled}
              onChange={(e) => setWebhookEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#155eef]"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Destination Webhook URL</label>
            <input
              id="settings-webhook-url-input"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">Dispatch Trigger Filter</label>
            <select
              value={webhookFilterMode}
              onChange={(e) => setWebhookFilterMode(e.target.value as 'all_leads' | 'high_icp_only')}
              className="w-full px-3 py-2 glass-input rounded-xl font-medium"
            >
              <option value="all_leads">All Extracted Leads</option>
              <option value="high_icp_only">High ICP (≥80%) Leads Only</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-slate-700 dark:text-slate-300 font-medium">X-Webhook-Secret Header (Optional)</label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="w-full px-3 py-2 glass-input rounded-xl font-mono text-xs placeholder-slate-400"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              id="settings-test-webhook-btn"
              onClick={handleTestWebhook}
              disabled={testingWebhook || !webhookUrl.trim()}
              className="w-full px-4 py-2 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-50 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              {testingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Test Webhook</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lead Enrichment & ICP Targeting Matrix */}
      <IcpSettingsCard
        config={icpConfig}
        onChange={setIcpConfig}
        onSave={handleSave}
        saving={saving}
      />

      {/* 24/7 Oracle Cloud VM Worker Integration */}
      <OracleVmWorkerCard onShowToast={onShowToast} />

      {/* AI Agent Rules Prompt */}
      <div className="glass-card rounded-2xl p-6 space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Agent Extraction Rules</h3>
        </div>

        <textarea
          id="settings-ai-rules-textarea"
          rows={6}
          value={aiRules}
          onChange={(e) => setAiRules(e.target.value)}
          className="w-full p-4 glass-input rounded-xl text-xs font-mono placeholder-slate-400 leading-relaxed"
        />
      </div>
    </div>
  );
};
