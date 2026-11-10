import React, { useState, useEffect } from 'react';
import {
  Radar,
  Radio,
  Search,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Mail,
  Phone,
  Building2,
  User,
  MapPin,
  Clock,
  Sparkles,
  Download,
  Flame,
  CheckCircle2,
  Copy,
  Check,
  Filter,
  DollarSign,
  AlertCircle,
  Share2,
  Send,
  Zap,
  Globe,
  Briefcase,
  ChevronDown,
  Layers,
  ArrowRight,
  TrendingUp,
  PlusCircle,
  ShieldCheck,
  Trash2,
  Webhook,
  FileSpreadsheet,
  Terminal,
  ArrowUpRight,
  Database,
  Cloud,
} from 'lucide-react';
import {
  SocialDemandLead,
  SocialRadarStats,
  SocialDemandPlatform,
  DemandAudienceType,
  DemandUrgency,
} from '../types';
import { CrmDirectIntegrationModal } from '../components/crm/CrmDirectIntegrationModal';

interface SocialDemandRadarPageProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigateToResults: () => void;
}

const PRESET_QUERIES = [
  { label: '💼 Accountant / CPA Needed', query: 'accountant CPA taxes', category: 'Accounting & Bookkeeping', audience: 'ALL' },
  { label: '💻 Web & App Developer', query: 'developer React Nextjs hire', category: 'Web & Software Development', audience: 'B2B' },
  { label: '🚀 B2B SaaS SEO & Growth', query: 'SEO agency marketing growth', category: 'SEO & Digital Marketing', audience: 'B2B' },
  { label: '👤 Personal Tax CPA (B2C)', query: 'accountant personal 1040 crypto taxes', category: 'Accounting & Bookkeeping', audience: 'B2C' },
  { label: '🛠️ Home Services / Plumber', query: 'plumber water heater contractor', category: 'Residential Home Services', audience: 'B2C' },
  { label: '⚖️ Business / Legal Counsel', query: 'lawyer attorney startup contracts', category: 'Legal & Compliance', audience: 'B2B' },
];

export const SocialDemandRadarPage: React.FC<SocialDemandRadarPageProps> = ({
  onShowToast,
  onNavigateToResults,
}) => {
  // State
  const [leads, setLeads] = useState<SocialDemandLead[]>([]);
  const [stats, setStats] = useState<SocialRadarStats>({
    totalLeads: 0,
    b2bCount: 0,
    b2cCount: 0,
    immediateCount: 0,
    redditCount: 0,
    linkedinCount: 0,
    twitterCount: 0,
    forumsCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Search Controls
  const [searchQuery, setSearchQuery] = useState<string>('accountant CPA');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedAudience, setSelectedAudience] = useState<'ALL' | 'B2B' | 'B2C'>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [textFilter, setTextFilter] = useState<string>('');

  // Ingest Modal State
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [ingestUrl, setIngestUrl] = useState<string>('');
  const [ingestText, setIngestText] = useState<string>('');
  const [ingestPlatform, setIngestPlatform] = useState<SocialDemandPlatform>('reddit');
  const [isIngesting, setIsIngesting] = useState<boolean>(false);

  // Pitch Modal State
  const [activePitchLead, setActivePitchLead] = useState<SocialDemandLead | null>(null);
  const [pitchChannel, setPitchChannel] = useState<'reddit_dm' | 'linkedin_msg' | 'cold_email'>('reddit_dm');
  const [pitchText, setPitchText] = useState<string>('');
  const [pitchSubject, setPitchSubject] = useState<string>('');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Integrations & Export Modal State
  const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState<boolean>(false);
  const [integrationTab, setIntegrationTab] = useState<'webhook' | 'crm' | 'internal' | 'api'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('leadhook_social_webhook_url') || '';
    } catch {
      return '';
    }
  });
  const [isSendingWebhook, setIsSendingWebhook] = useState<boolean>(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message?: string; error?: string; status?: number; latencyMs?: number; leadsDelivered?: number } | null>(null);
  const [isPushingToResults, setIsPushingToResults] = useState<boolean>(false);

  // Direct CRM Modal and Sync State
  const [isCrmModalOpen, setIsCrmModalOpen] = useState<boolean>(false);
  const [syncingLeadId, setSyncingLeadId] = useState<string | null>(null);
  const [isSyncingAllCrm, setIsSyncingAllCrm] = useState<boolean>(false);

  // Initial Load
  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [selectedPlatform, selectedAudience, selectedUrgency]);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPlatform !== 'ALL') params.append('platform', selectedPlatform);
      if (selectedAudience !== 'ALL') params.append('audience', selectedAudience);
      if (selectedUrgency !== 'ALL') params.append('urgency', selectedUrgency);
      if (textFilter.trim()) params.append('query', textFilter.trim());

      const res = await fetch(`/api/social-radar/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data || []);
      }
    } catch (e) {
      console.warn('Failed to load social leads:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/social-radar/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data || {});
      }
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
  };

  const handleRunScan = async (
    overrideQuery?: string,
    overrideCategory?: string,
    overrideAudience?: 'ALL' | 'B2B' | 'B2C'
  ) => {
    const q = overrideQuery || searchQuery;
    if (!q.trim()) {
      onShowToast('Please enter what service or profession you want to find buyers for.', 'warning');
      return;
    }

    setIsScanning(true);
    onShowToast(`Scanning live feeds (Reddit, RemoteOK & YC) for "${q}"...`, 'info');

    try {
      const res = await fetch('/api/social-radar/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          serviceCategory: overrideCategory || (selectedCategory !== 'All' ? selectedCategory : undefined),
          audienceType: overrideAudience || selectedAudience,
          limit: 15,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to scan social demand');
      }

      const result = await res.json();
      if ((result.discoveredCount || 0) > 0) {
        onShowToast(`Discovered ${result.discoveredCount} verified real demand leads!`, 'success');
      } else {
        onShowToast('Scan completed. No live posts matched this exact query right now. Use the 1-Click Launchpad below to search Reddit or LinkedIn directly!', 'info');
      }
      fetchLeads();
      fetchStats();
    } catch (err: any) {
      onShowToast(err.message || 'Scan error', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleIngestPost = async () => {
    if (!ingestText.trim()) {
      onShowToast('Please paste the post text or quote to analyze.', 'warning');
      return;
    }

    setIsIngesting(true);
    try {
      const res = await fetch('/api/social-radar/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: ingestUrl.trim() || undefined,
          text: ingestText.trim(),
          platform: ingestPlatform,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to analyze post');
      }

      const newLead: SocialDemandLead = await res.json();
      onShowToast(`Successfully imported verified demand lead from ${newLead.author.displayName || 'post'}!`, 'success');
      setIsIngestModalOpen(false);
      setIngestUrl('');
      setIngestText('');
      fetchLeads();
      fetchStats();
      handleOpenPitchModal(newLead);
    } catch (err: any) {
      onShowToast(err.message || 'Ingest failed', 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleUpdateStatus = async (leadId: string, status: 'new' | 'contacted' | 'saved' | 'dismissed') => {
    try {
      const res = await fetch(`/api/social-radar/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
        onShowToast(`Lead marked as ${status}`, 'success');
      }
    } catch {
      onShowToast('Failed to update status', 'error');
    }
  };

  const handleOpenPitchModal = async (lead: SocialDemandLead) => {
    setActivePitchLead(lead);
    const defaultChan = lead.platform === 'reddit' ? 'reddit_dm' : lead.platform === 'linkedin' ? 'linkedin_msg' : 'cold_email';
    setPitchChannel(defaultChan);

    if (lead.aiDraftOutreach?.message) {
      setPitchText(lead.aiDraftOutreach.message);
      setPitchSubject(lead.aiDraftOutreach.subject || '');
    } else {
      loadPitchForChannel(lead.id, defaultChan);
    }
  };

  const loadPitchForChannel = async (leadId: string, channel: 'reddit_dm' | 'linkedin_msg' | 'cold_email') => {
    setIsGeneratingPitch(true);
    try {
      const res = await fetch('/api/social-radar/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, channel }),
      });
      if (res.ok) {
        const data = await res.json();
        setPitchText(data.message || '');
        setPitchSubject(data.subject || '');
      }
    } catch (e) {
      console.warn('Failed to generate pitch:', e);
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onShowToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExportXlsx = async () => {
    try {
      onShowToast('Generating Excel export...', 'info');
      const res = await fetch('/api/social-radar/export-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform !== 'ALL' ? selectedPlatform : undefined,
          audience: selectedAudience !== 'ALL' ? selectedAudience : undefined,
          urgency: selectedUrgency !== 'ALL' ? selectedUrgency : undefined,
          query: textFilter.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verified_social_demands_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      onShowToast('Excel file downloaded successfully!', 'success');
    } catch (e: any) {
      onShowToast(e.message || 'Export failed', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      onShowToast('Generating CSV export for CRMs...', 'info');
      const res = await fetch('/api/social-radar/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform !== 'ALL' ? selectedPlatform : undefined,
          audience: selectedAudience !== 'ALL' ? selectedAudience : undefined,
          urgency: selectedUrgency !== 'ALL' ? selectedUrgency : undefined,
          query: textFilter.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('CSV export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verified_social_demands_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      onShowToast('CSV downloaded! Ready for HubSpot, Instantly, Smartlead & CRM import.', 'success');
    } catch (e: any) {
      onShowToast(e.message || 'CSV export failed', 'error');
    }
  };

  const handlePushToResults = async () => {
    if (leads.length === 0) {
      onShowToast('No leads available to transfer. Run a scan first.', 'warning');
      return;
    }
    setIsPushingToResults(true);
    try {
      const res = await fetch('/api/social-radar/push-to-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: leads.map((l) => l.id),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to transfer leads');
      }

      const data = await res.json();
      onShowToast(data.message || 'Transferred to Leads & Results!', 'success');
      if (onNavigateToResults) {
        setTimeout(() => onNavigateToResults(), 600);
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to transfer leads', 'error');
    } finally {
      setIsPushingToResults(false);
    }
  };

  const handleTriggerWebhook = async () => {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      onShowToast('Please enter a valid HTTP or HTTPS webhook URL (Zapier, Make, n8n, etc.).', 'warning');
      return;
    }
    setIsSendingWebhook(true);
    setWebhookResult(null);
    try {
      try {
        localStorage.setItem('leadhook_social_webhook_url', webhookUrl);
      } catch {}

      const res = await fetch('/api/social-radar/webhook-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          leadIds: leads.map((l) => l.id),
        }),
      });

      const data = await res.json();
      setWebhookResult(data);
      if (res.ok && data.success) {
        onShowToast(`Delivered ${data.leadsDelivered} leads to external webhook!`, 'success');
      } else {
        onShowToast(data.error || 'Webhook returned an issue', 'error');
      }
    } catch (err: any) {
      setWebhookResult({ success: false, error: err.message });
      onShowToast(err.message || 'Webhook failed to send', 'error');
    } finally {
      setIsSendingWebhook(false);
    }
  };

  const handleSyncSingleLeadToCrm = async (lead: SocialDemandLead) => {
    setSyncingLeadId(lead.id);
    try {
      const res = await fetch('/api/crm/send-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, lead }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === lead.id
              ? {
                  ...l,
                  status: 'saved',
                  crmSyncStatus: {
                    synced: true,
                    provider: data.provider || 'CRM',
                    syncedAt: new Date().toISOString(),
                    externalId: data.externalId,
                  },
                }
              : l
          )
        );
        onShowToast(`Dispatched to CRM: ${data.message}`, 'success');
      } else {
        onShowToast(data.message || data.error || 'Failed to dispatch to CRM', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'CRM dispatch failed', 'error');
    } finally {
      setSyncingLeadId(null);
    }
  };

  const handleSyncAllToCrm = async () => {
    if (leads.length === 0) {
      onShowToast('No leads available to sync.', 'warning');
      return;
    }
    setIsSyncingAllCrm(true);
    try {
      const res = await fetch('/api/crm/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: leads.map((l) => l.id),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onShowToast(`Successfully dispatched ${data.successful} leads to your CRM!`, 'success');
        fetchLeads();
      } else {
        onShowToast(data.error || 'Failed to sync leads to CRM', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'CRM bulk sync failed', 'error');
    } finally {
      setIsSyncingAllCrm(false);
    }
  };

  const getPlatformBadge = (platform: SocialDemandPlatform) => {
    switch (platform) {
      case 'reddit':
        return { label: 'Reddit', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' };
      case 'linkedin':
        return { label: 'LinkedIn', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'twitter':
        return { label: 'X / Twitter', bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' };
      case 'hackernews':
        return { label: 'Hacker News (YC)', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      default:
        return { label: 'Verified Demand Board', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
    }
  };

  const getUrgencyBadge = (urgency: DemandUrgency) => {
    switch (urgency) {
      case 'Immediate':
        return { label: 'Immediate ⚡', bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold' };
      case 'High':
        return { label: 'High Intent 🔥', bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      default:
        return { label: 'Exploring ⏱️', bg: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' };
    }
  };

  // Client-side text filtering
  const filteredLeads = leads.filter((lead) => {
    if (!textFilter.trim()) return true;
    const q = textFilter.toLowerCase();
    return (
      lead.postTitle.toLowerCase().includes(q) ||
      lead.postContent.toLowerCase().includes(q) ||
      lead.author.displayName.toLowerCase().includes(q) ||
      lead.author.username.toLowerCase().includes(q) ||
      (lead.author.companyName && lead.author.companyName.toLowerCase().includes(q)) ||
      lead.sourceChannel.toLowerCase().includes(q) ||
      lead.serviceCategory.toLowerCase().includes(q)
    );
  });

  // Deep Link Launchpad URLs for user's active query
  const cleanTerm = searchQuery.trim() || 'accountant';
  const redditLiveUrl = `https://www.reddit.com/search/?q=${encodeURIComponent(cleanTerm)}&sort=new`;
  const linkedInLiveUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(cleanTerm)}&sortBy=%22date_posted%22`;
  const twitterLiveUrl = `https://twitter.com/search?q=${encodeURIComponent(cleanTerm)}&f=live`;
  const googleDorkUrl = `https://www.google.com/search?q=${encodeURIComponent(`(site:reddit.com OR site:linkedin.com) "${cleanTerm}"`)}&tbs=qdr:w`;
  const hnLiveUrl = `https://hn.algolia.com/?q=${encodeURIComponent(cleanTerm)}&sort=byDate`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-8 border border-white/60 dark:border-white/10 shadow-xl bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-cyan-500/5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>AUTHENTIC SOCIAL INTENT • 100% VERIFIED LIVE POSTS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Social Demand Radar
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsCrmModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Configure and directly send leads to your In-House tool or Salesforce CRM"
            >
              <Database className="w-4 h-4" />
              <span>Direct CRM / In-House</span>
            </button>
            <button
              onClick={handleSyncAllToCrm}
              disabled={leads.length === 0 || isSyncingAllCrm}
              className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50"
              title="Sync all discovered leads directly to your active CRM"
            >
              <Send className={`w-3.5 h-3.5 ${isSyncingAllCrm ? 'animate-spin' : ''}`} />
              <span>{isSyncingAllCrm ? 'Syncing...' : 'Sync All to CRM'}</span>
            </button>
            <button
              onClick={() => setIsIntegrationsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-sm shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Integrate with Zapier, Make, n8n, CRMs or Webhooks"
            >
              <Webhook className="w-4 h-4" />
              <span>Webhooks & Zapier</span>
            </button>
            <button
              onClick={() => setIsIngestModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-medium text-sm border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4 text-indigo-500" />
              <span>Import Real Post</span>
            </button>
            <button
              onClick={() => handleRunScan()}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Live Feeds...' : 'Scan Live Demands'}</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={leads.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-white/60 dark:border-white/10 transition-colors disabled:opacity-50"
              title="Download CSV formatted for CRMs and outreach tools"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportXlsx}
              disabled={leads.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-white/60 dark:border-white/10 transition-colors disabled:opacity-50"
              title="Download full Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handlePushToResults}
              disabled={leads.length === 0 || isPushingToResults}
              className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-50"
              title="Send leads into LeadHook Results table for verification"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>{isPushingToResults ? 'Sending...' : 'To Results'}</span>
            </button>
          </div>
        </div>

        {/* Real-Time Stats Strip */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/60 dark:border-white/5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Verified Leads</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.totalLeads}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Real Intent Posts
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/60 dark:border-white/5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Immediate Urgency</div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{stats.immediateCount}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
              <Flame className="w-3 h-3 text-rose-500" /> Need provider ASAP
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/60 dark:border-white/5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">B2B Businesses</div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{stats.b2bCount}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
              <Building2 className="w-3 h-3 text-indigo-500" /> Startups & SMBs
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/60 dark:border-white/5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">B2C Consumers</div>
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">{stats.b2cCount}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
              <User className="w-3 h-3 text-cyan-500" /> Individuals & Home
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/60 dark:border-white/5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Reddit Signals</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-0.5">{stats.redditCount}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
              <MessageSquare className="w-3 h-3 text-orange-500" /> Real submissions
            </div>
          </div>

          <div className="p-3.5 rounded-2xl glass-panel-subtle border border-white/60 dark:border-white/5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Boards & Tech</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{stats.forumsCount + stats.linkedinCount}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
              <Globe className="w-3 h-3 text-blue-500" /> RemoteOK & YC
            </div>
          </div>
        </div>
      </div>

      {/* 2. Scanner Controls & Presets */}
      <div className="glass-panel rounded-2xl p-6 border border-white/60 dark:border-white/10 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunScan()}
              placeholder="Enter service or intent query (e.g. accountant CPA, react developer, seo marketing, plumber)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Audience Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setSelectedAudience('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedAudience === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Audiences
            </button>
            <button
              onClick={() => setSelectedAudience('B2B')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedAudience === 'B2B'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🏢 B2B Only
            </button>
            <button
              onClick={() => setSelectedAudience('B2C')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedAudience === 'B2C'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              👤 B2C Only
            </button>
          </div>

          <button
            onClick={() => handleRunScan()}
            disabled={isScanning}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-md flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Search Intent</span>
              </>
            )}
          </button>
        </div>

        {/* 1-Click Live Social Search Launchpad */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>1-Click Live Social Launchpad (Opens your exact query in live social feeds):</span>
            </div>
            <span className="text-[11px] text-slate-500">Query: "{cleanTerm}"</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <a
              href={redditLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/25 text-xs font-semibold transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Search Reddit (Newest)</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={linkedInLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-semibold transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Search LinkedIn Posts (Live)</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={twitterLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/25 text-xs font-semibold transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Search X / Twitter (Live)</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={googleDorkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Google Social Dork</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={hnLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-xs font-semibold transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Hacker News Algolia</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Popular Commercial Categories:</div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_QUERIES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setSearchQuery(preset.query);
                  setSelectedCategory(preset.category);
                  setSelectedAudience(preset.audience as any);
                  handleRunScan(preset.query, preset.category, preset.audience as any);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium glass-panel-subtle hover:bg-indigo-500/10 hover:border-indigo-500/30 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Filter & View Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform Filter */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            {['ALL', 'reddit', 'linkedin', 'hackernews', 'web_forum'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                  selectedPlatform === p
                    ? 'bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {p === 'ALL' ? 'All Channels' : p === 'hackernews' ? 'Hacker News' : p === 'web_forum' ? 'Demand Boards' : p}
              </button>
            ))}
          </div>

          {/* Urgency Filter */}
          <select
            value={selectedUrgency}
            onChange={(e) => setSelectedUrgency(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Urgencies</option>
            <option value="Immediate">⚡ Immediate Urgency</option>
            <option value="High">🔥 High Intent</option>
            <option value="Medium">⏱️ Exploring</option>
          </select>

          {/* Search Filter input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              placeholder="Filter leads..."
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 w-36 sm:w-48 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
          <span>Showing {filteredLeads.length} verified leads</span>
          <button
            onClick={fetchLeads}
            title="Refresh Leads"
            className="p-1.5 rounded-lg glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Leads Grid / List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 glass-panel rounded-2xl">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading verified social leads...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="py-16 text-center glass-panel rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-4 p-8">
          <Radar className="w-12 h-12 text-indigo-500 mx-auto opacity-70" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No Fabricated or Fake Results Here
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
              LeadHook does NOT invent fake prospects or simulate email addresses. All leads displayed here come from authentic live posts.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleRunScan()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all inline-flex items-center gap-2 shadow-md"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Scan Live Verified Demands</span>
            </button>
            <button
              onClick={() => setIsIngestModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all inline-flex items-center gap-2 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span>Import a Real Post URL</span>
            </button>
            <a
              href={redditLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/25 text-xs font-semibold transition-all inline-flex items-center gap-2"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Search Reddit Live</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLeads.map((lead) => {
            const platformBadge = getPlatformBadge(lead.platform);
            const urgencyBadge = getUrgencyBadge(lead.demandDetails.urgency);

            return (
              <div
                key={lead.id}
                className="group rounded-2xl glass-panel p-5 border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Top Row: Platform, Channel, Audience, Urgency */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${platformBadge.bg}`}>
                        {platformBadge.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {lead.sourceChannel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          lead.audienceType === 'B2B'
                            ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                            : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        }`}
                      >
                        {lead.audienceType === 'B2B' ? '🏢 B2B' : '👤 B2C'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] border ${urgencyBadge.bg}`}>
                        {urgencyBadge.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {lead.demandDetails.buyingIntentScore}% Intent
                      </span>
                    </div>
                  </div>

                  {/* Post Headline / Quote */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {lead.postTitle}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 italic">
                      "{lead.postContent}"
                    </p>
                  </div>

                  {/* Specific Need & Budget Pill */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {lead.demandDetails.budget && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold">
                        <DollarSign className="w-3 h-3" />
                        <span>Budget: {lead.demandDetails.budget}</span>
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Category: {lead.serviceCategory}
                    </span>
                  </div>
                </div>

                {/* Author & Extracted Contact Details */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {lead.author.displayName || lead.author.username}
                        </span>
                        {lead.author.username && lead.author.username !== lead.author.displayName && (
                          <span className="text-[11px] text-slate-400">({lead.author.username})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                        {lead.author.companyName && (
                          <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {lead.author.companyName}
                          </span>
                        )}
                        {lead.author.role && <span>• {lead.author.role}</span>}
                        {lead.author.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {lead.author.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* View Original Verified Post Link */}
                    <a
                      href={lead.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shrink-0"
                      title="Open Verified Original Post"
                    >
                      <span>View Live Post</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Real Contact Channel Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Email if genuinely found */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                          {lead.contactPoints.email ? lead.contactPoints.email : 'Direct DM via Platform'}
                        </span>
                      </div>
                      {lead.contactPoints.email && (
                        <button
                          onClick={() => handleCopy(lead.contactPoints.email!, `email_${lead.id}`)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Copy Email"
                        >
                          {copiedKey === `email_${lead.id}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Direct Message Link to Real Poster */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate text-slate-700 dark:text-slate-300 text-[11px]">
                          {lead.platform === 'reddit'
                            ? 'Reddit Direct Message'
                            : lead.platform === 'hackernews'
                            ? 'YC Hacker News Thread'
                            : 'Direct Message / Application'}
                        </span>
                      </div>
                      {lead.contactPoints.directMessageUrl && (
                        <a
                          href={lead.contactPoints.directMessageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions: AI Outreach Pitch, Direct CRM Send & Status */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => handleOpenPitchModal(lead)}
                      className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium text-xs border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Draft Outreach Pitch</span>
                    </button>

                    <button
                      onClick={() => handleSyncSingleLeadToCrm(lead)}
                      disabled={syncingLeadId === lead.id}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                        lead.crmSyncStatus?.synced
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      }`}
                      title={
                        lead.crmSyncStatus?.synced
                          ? `Synced to ${lead.crmSyncStatus.provider || 'CRM'} (Record: ${lead.crmSyncStatus.externalId || 'Saved'})`
                          : 'Directly send this lead to configured In-House Tool / Salesforce CRM'
                      }
                    >
                      {syncingLeadId === lead.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Syncing...</span>
                        </>
                      ) : lead.crmSyncStatus?.synced ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>In CRM</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5 text-blue-500" />
                          <span>Send to CRM</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateStatus(lead.id, lead.status === 'contacted' ? 'new' : 'contacted')}
                        className={`p-2 rounded-xl text-xs border transition-colors ${
                          lead.status === 'contacted'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'glass-panel-subtle text-slate-500 hover:text-emerald-600 border-slate-200 dark:border-slate-800'
                        }`}
                        title="Mark as Contacted"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Ingest Real Post Modal */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl glass-panel p-6 sm:p-7 border border-white/60 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>IMPORT REAL SOCIAL DEMAND POST</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Extract Lead from Live Post
                </h3>
                <p className="text-xs text-slate-500">
                  Found someone asking for your services on Reddit, LinkedIn, or Twitter? Paste their post text below to extract intent, budget, and draft a response.
                </p>
              </div>

              <button
                onClick={() => setIsIngestModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Post URL (Optional)</label>
                <input
                  type="url"
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                  placeholder="https://reddit.com/r/startups/comments/... or linkedin.com/posts/..."
                  className="w-full mt-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Platform</label>
                <div className="flex items-center gap-2 mt-1">
                  {(['reddit', 'linkedin', 'twitter', 'web_forum'] as SocialDemandPlatform[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setIngestPlatform(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs capitalize font-medium transition-all ${
                        ingestPlatform === p
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p === 'twitter' ? 'X / Twitter' : p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Post Text / Content *</label>
                <textarea
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  rows={5}
                  placeholder="Paste the genuine post title and body text here (e.g. 'Looking for a CPA to help with our Delaware C-Corp startup taxes. Budget around $1,500/mo...')"
                  className="w-full mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsIngestModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIngestPost}
                disabled={isIngesting || !ingestText.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Post...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Extract & Save Lead</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. AI Outreach Pitch Drafter Modal */}
      {activePitchLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-3xl glass-panel p-6 sm:p-7 border border-white/60 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-900 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI OUTREACH PITCH GENERATOR</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Pitch for {activePitchLead.author.displayName || activePitchLead.author.username}
                </h3>
                <p className="text-xs text-slate-500">
                  Tailored specifically to address their post on <strong>{activePitchLead.sourceChannel}</strong> regarding <em>"{activePitchLead.demandDetails.specificNeed}"</em>.
                </p>
              </div>

              <button
                onClick={() => setActivePitchLead(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Channel Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium">
              <button
                onClick={() => {
                  setPitchChannel('reddit_dm');
                  loadPitchForChannel(activePitchLead.id, 'reddit_dm');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  pitchChannel === 'reddit_dm'
                    ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Reddit DM / Reply
              </button>
              <button
                onClick={() => {
                  setPitchChannel('linkedin_msg');
                  loadPitchForChannel(activePitchLead.id, 'linkedin_msg');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  pitchChannel === 'linkedin_msg'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                LinkedIn Message
              </button>
              <button
                onClick={() => {
                  setPitchChannel('cold_email');
                  loadPitchForChannel(activePitchLead.id, 'cold_email');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  pitchChannel === 'cold_email'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Direct Outreach / Email
              </button>
            </div>

            {/* Pitch Subject Line (if email/DM) */}
            {pitchSubject && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Subject Line</label>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>{pitchSubject}</span>
                  <button
                    onClick={() => handleCopy(pitchSubject, 'subject')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Copy Subject"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Pitch Content Area */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Message Body</label>
              {isGeneratingPitch ? (
                <div className="h-44 flex flex-col items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                  <p className="mt-2 text-xs text-slate-500">Crafting personalized outreach pitch...</p>
                </div>
              ) : (
                <textarea
                  value={pitchText}
                  onChange={(e) => setPitchText(e.target.value)}
                  rows={7}
                  className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500">
                Contact Method: <strong className="text-slate-700 dark:text-slate-300">{activePitchLead.contactPoints.email || `${activePitchLead.platform.toUpperCase()} DM`}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(pitchText, 'pitch_body')}
                  className="px-4 py-2 rounded-xl glass-panel-subtle hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 transition-colors"
                >
                  {copiedKey === 'pitch_body' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Pitch</span>
                    </>
                  )}
                </button>

                {activePitchLead.contactPoints.directMessageUrl && (
                  <a
                    href={activePitchLead.contactPoints.directMessageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleUpdateStatus(activePitchLead.id, 'contacted')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <span>Open Thread & Reply</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Integrations & Export Modal */}
      {isIntegrationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel p-6 sm:p-8 border border-white/60 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-900 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Webhook className="w-3.5 h-3.5" />
                  <span>EXTERNAL TOOL INTEGRATIONS</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Connect With Your Tools
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sync verified social demand leads directly into your CRM, email sequence tool, automation platform, or custom backend.
                </p>
              </div>

              <button
                onClick={() => setIsIntegrationsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Integration Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
              <button
                onClick={() => setIntegrationTab('webhook')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  integrationTab === 'webhook'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Webhook className="w-3.5 h-3.5" />
                <span>Zapier / Make / n8n</span>
              </button>
              <button
                onClick={() => setIntegrationTab('crm')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  integrationTab === 'crm'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CRM & Cold Email</span>
              </button>
              <button
                onClick={() => setIntegrationTab('internal')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  integrationTab === 'internal'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>LeadHook Pipeline</span>
              </button>
              <button
                onClick={() => setIntegrationTab('api')}
                className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  integrationTab === 'api'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>REST API / cURL</span>
              </button>
            </div>

            {/* Tab 1: Webhook Dispatcher */}
            {integrationTab === 'webhook' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Live Webhook Dispatcher</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Paste any incoming webhook URL from <strong>Zapier ("Catch Hook")</strong>, <strong>Make.com ("Custom Webhook")</strong>, <strong>n8n ("Webhook node")</strong>, or Slack/Discord to push all {leads.length} discovered leads with a single click.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Webhook Target URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.zapier.com/hooks/catch/... or https://hook.make.com/..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleTriggerWebhook}
                      disabled={isSendingWebhook || !webhookUrl.trim() || leads.length === 0}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                    >
                      {isSendingWebhook ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Leads Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Webhook Response Banner */}
                {webhookResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs border ${
                      webhookResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500/30 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{webhookResult.success ? '✓ Webhook Delivered Successfully' : '✕ Webhook Error'}</span>
                      {webhookResult.latencyMs && (
                        <span className="text-[11px] font-mono opacity-80">{webhookResult.latencyMs}ms latency</span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">
                      {webhookResult.message || webhookResult.error}
                    </div>
                  </div>
                )}

                {/* Step by step for common tools */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-xs font-bold text-orange-600 dark:text-orange-400">⚡ Zapier</div>
                    <p className="text-[11px] text-slate-500">
                      1. Trigger: <strong>Webhooks by Zapier (Catch Hook)</strong><br />
                      2. Paste URL above and click Send<br />
                      3. Action: Create lead in HubSpot / Salesforce
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400">🌀 Make.com</div>
                    <p className="text-[11px] text-slate-500">
                      1. Module: <strong>Custom Webhook</strong><br />
                      2. Paste webhook address above<br />
                      3. Route to Google Sheets, Airtable, or CRM
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400">🐙 n8n</div>
                    <p className="text-[11px] text-slate-500">
                      1. Node: <strong>Webhook (POST)</strong><br />
                      2. Copy Test/Production Webhook URL<br />
                      3. Trigger downstream cold email sequences
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: CRM & Cold Outreach */}
            {integrationTab === 'crm' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Direct CRM & Cold Outreach Export</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Import authentic social leads into your CRM (HubSpot, Salesforce, Pipedrive, Close, GoHighLevel) or Cold Email Sequencer (Instantly.ai, Smartlead.ai, Lemlist, Apollo).
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleExportCsv}
                    disabled={leads.length === 0}
                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Download CRM Formatted CSV ({leads.length} Leads)</span>
                  </button>

                  <button
                    onClick={handleExportXlsx}
                    disabled={leads.length === 0}
                    className="flex-1 py-3 px-4 rounded-xl glass-panel-subtle hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Excel Workbook (.xlsx)</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pre-Mapped Columns for 1-Click Import:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Author Name → Contact Name
                    </div>
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Company → Organization
                    </div>
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Email → Lead Email
                    </div>
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Post URL → Source / Reference
                    </div>
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Urgency → Priority / Tag
                    </div>
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Intent Score → Custom Lead Score
                    </div>
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Snippet → Deal Note / Summary
                    </div>
                    <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      Budget → Deal Value (Est.)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: LeadHook Internal Pipeline */}
            {integrationTab === 'internal' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/15 space-y-2">
                  <h4 className="text-xs font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-500" />
                    <span>LeadHook Cross-Tool Integration</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Connect Social Demand Radar with LeadHook's other built-in features: Email Verifier, Business Registry Verifier, and AI Sales Copilot.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Push to Leads & Results Table</div>
                      <div className="text-[11px] text-slate-500">Converts social demand records into LeadHook Contact entities to run full deliverability & business verification.</div>
                    </div>
                    <button
                      onClick={handlePushToResults}
                      disabled={leads.length === 0 || isPushingToResults}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{isPushingToResults ? 'Transferring...' : 'Transfer Leads'}</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Automatic SQLite Datasets Sync</div>
                    <div className="text-[11px] text-slate-500">
                      Every time you run a scan, results are automatically stored in LeadHook's embedded SQLite database under <code>Social Demand Radar</code>, accessible in the Datasets Explorer.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: REST API / cURL */}
            {integrationTab === 'api' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15 space-y-2">
                  <h4 className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-500" />
                    <span>REST API Endpoint</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Query or stream social demand leads programmatically into any Python script, Node.js worker, or backend service.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>GET JSON Leads:</span>
                    <button
                      onClick={() => handleCopy(`curl -X GET "${window.location.origin}/api/social-radar/leads?urgency=Immediate"`, 'api_curl_json')}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      {copiedKey === 'api_curl_json' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copy cURL</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`curl -X GET "${window.location.origin}/api/social-radar/leads?urgency=Immediate" \\
  -H "Accept: application/json"`}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>GET Live CSV:</span>
                    <button
                      onClick={() => handleCopy(`curl -X GET "${window.location.origin}/api/social-radar/export-csv" -o leads.csv`, 'api_curl_csv')}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      {copiedKey === 'api_curl_csv' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copy cURL</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`curl -X GET "${window.location.origin}/api/social-radar/export-csv" -o leads.csv`}
                  </pre>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsIntegrationsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Direct CRM & In-House Tool Integration Modal */}
      <CrmDirectIntegrationModal
        isOpen={isCrmModalOpen}
        onClose={() => {
          setIsCrmModalOpen(false);
          fetchLeads();
        }}
        onShowToast={onShowToast}
        onSyncAll={handleSyncAllToCrm}
        leadsCount={leads.length}
      />
    </div>
  );
};
