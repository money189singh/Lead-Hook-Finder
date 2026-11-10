import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Search,
  Globe,
  Building2,
  Users,
  Mail,
  Phone,
  ArrowRight,
  ExternalLink,
  Download,
  Filter,
  RefreshCw,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  SlidersHorizontal,
  Copy,
  Check,
  ShieldCheck,
  Layers,
  Database,
  History,
  X,
  FileSpreadsheet,
  Edit3,
  FileText,
  TrendingUp,
  UserPlus,
  Handshake,
  DollarSign,
  Megaphone,
  Calendar,
  Zap,
  MapPin,
  Clock,
  Cloud,
  Server,
  Activity,
  RotateCcw,
  GitBranch,
} from 'lucide-react';
import {
  DiscoveryCriteria,
  DiscoveredProspect,
  DiscoveryJob,
  ScrapeSettings,
  CompanyActivityItem,
  WorkerHealthInfo,
  ProspectDossier,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { ScheduledScraperModal } from '../components/discovery/ScheduledScraperModal';
import { ConditionExplainerModal } from '../components/discovery/ConditionExplainerModal';
import { ProspectDossierModal } from '../components/discovery/ProspectDossierModal';
import {
  GlassPanel,
  GlassButton,
  GlassDrawer,
  GlassBadge,
  GlassTabs,
  AnimatedProgress,
} from '../components/glass';

interface DiscoveryPageProps {
  settings: ScrapeSettings | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onImportToScraper: (urls: string[]) => void;
  onNavigateToScraper: () => void;
  onNavigateToMaps?: () => void;
  onOpenAiStudio?: (state: any) => void;
}

const PRESET_PROMPTS = [
  {
    title: 'US B2B SaaS & Founders',
    desc: '10-200 employees, Founders & CEOs in United States',
    prompt: 'Find B2B SaaS software companies in the United States with 10-200 employees and their founders and CEOs.',
  },
  {
    title: 'FinTech in NY & Sales Leaders',
    desc: 'Fast-growing FinTech companies with Sales Directors',
    prompt: 'Discover FinTech and payments technology companies in New York with Sales Directors, VPs of Sales, and Chief Revenue Officers.',
  },
  {
    title: 'California AI & CEOs',
    desc: 'Artificial intelligence startups in California',
    prompt: 'Find artificial intelligence and machine learning software companies in California with CEOs and CTOs.',
  },
];

export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({
  settings,
  onShowToast,
  onImportToScraper,
  onNavigateToScraper,
  onNavigateToMaps,
  onOpenAiStudio,
}) => {
  const { user } = useAuth();

  // Search Criteria State
  const [prompt, setPrompt] = useState('');
  const [isParsingPrompt, setIsParsingPrompt] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [criteria, setCriteria] = useState<DiscoveryCriteria>({
    country: 'United States',
    state: '',
    city: '',
    industry: 'B2B SaaS',
    companyName: '',
    employeeRange: '11-50',
    revenueRange: '',
    jobTitle: 'Founder, CEO, VP of Sales',
    department: 'Executive',
    seniority: 'C-Suite / Executive',
    keywords: '',
    technology: '',
    targetCount: 25,
    maxPagesPerCompany: 3,
    maxQueries: 15,
    autoExtractContacts: true,
    includeGenericEmails: true,
    companyScale: 'startups',
    excludeMegaCaps: true,
    buyingSignalFilter: 'any_signal',
    freshnessMode: 'new_only',
    excludePreviouslyDiscovered: true,
    hiringActive: true,
  });

  // Active Job & History State
  const [currentJob, setCurrentJob] = useState<DiscoveryJob | null>(null);
  const [jobHistory, setJobHistory] = useState<DiscoveryJob[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [scheduledModalInitialTab, setScheduledModalInitialTab] = useState<'schedules' | 'new'>('schedules');
  const [explainingProspect, setExplainingProspect] = useState<DiscoveredProspect | null>(null);
  const [ledgerStats, setLedgerStats] = useState<{ totalSeen: number; lastAdded?: string }>({ totalSeen: 0 });
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set());

  // Cloud Worker Health & Monitoring State
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthInfo | null>(null);
  const [showCloudDashboard, setShowCloudDashboard] = useState<boolean>(true);

  // Result navigation tabs: 'verified' | 'unverified' | 'all' | 'sources'
  const [resultsTab, setResultsTab] = useState<'verified' | 'unverified' | 'all' | 'sources'>('verified');
  const [editingProspect, setEditingProspect] = useState<DiscoveredProspect | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: '',
    website: '',
    industry: '',
    location: '',
    verificationStatus: 'Verified company' as any,
  });
  const [isVerifyingId, setIsVerifyingId] = useState<string | null>(null);
  const [isExtractingId, setIsExtractingId] = useState<string | null>(null);
  const [isBulkExtracting, setIsBulkExtracting] = useState(false);

  const [tableFilter, setTableFilter] = useState<'all' | 'decision_maker' | 'direct_email' | 'email' | 'phone' | 'high_conf' | 'funding' | 'hiring' | 'with_signals'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedActivityProspect, setSelectedActivityProspect] = useState<DiscoveredProspect | null>(null);
  const [selectedDrawerProspect, setSelectedDrawerProspect] = useState<DiscoveredProspect | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'contacts' | 'signals' | 'sources'>('overview');

  // AI Decision-Maker Dossier & Deep Enrichment State
  const [dossierProspect, setDossierProspect] = useState<DiscoveredProspect | null>(null);
  const [dossierData, setDossierData] = useState<ProspectDossier | null>(null);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);
  const [isEnrichingDecisionMakerId, setIsEnrichingDecisionMakerId] = useState<string | null>(null);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load previous jobs list & ledger stats on mount + periodic cloud worker health
  useEffect(() => {
    fetchJobsList();
    fetch('/api/schedules/ledger/stats')
      .then((r) => r.json())
      .then((data) => setLedgerStats(data))
      .catch(() => {});

    const fetchHealth = () => {
      fetch('/api/cloud-worker/health')
        .then((r) => r.json())
        .then((data) => {
          if (data && data.workerId) {
            setWorkerHealth(data);
          }
        })
        .catch(() => {});
    };

    fetchHealth();
    const hTimer = setInterval(fetchHealth, 4000);

    const handleOnline = () => {
      fetchJobsList();
      onShowToast('Internet reconnected — synced latest discovery data from cloud!', 'success');
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(hTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Poll active job status while running, queued, stopping, or retrying
  useEffect(() => {
    const activeStatuses = ['running', 'queued', 'stopping', 'retrying'];
    if (currentJob && activeStatuses.includes(currentJob.status)) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => {
          fetchJobDetails(currentJob.id);
        }, 1500);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [currentJob?.status, currentJob?.id]);

  const fetchJobsList = async () => {
    try {
      const res = await fetch('/api/discovery/jobs');
      const data = await res.json();
      if (data.jobs && Array.isArray(data.jobs)) {
        setJobHistory(data.jobs);
        if (data.jobs.length > 0) {
          setCurrentJob((prev) => {
            if (!prev) return data.jobs[0];
            const matching = data.jobs.find((j: any) => j.id === prev.id);
            return matching || data.jobs[0];
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch discovery jobs list:', e);
    }
  };

  const fetchJobDetails = async (jobId: string) => {
    try {
      const res = await fetch(`/api/discovery/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setCurrentJob(data.job);
        }
      }
    } catch (e) {
      console.warn('Error polling discovery job:', e);
    }
  };

  // Convert Natural Language into structured filters using AI
  const handleParsePrompt = async () => {
    if (!prompt.trim()) {
      onShowToast('Please enter a description of the prospects you want to find.', 'warning');
      return;
    }

    setIsParsingPrompt(true);
    try {
      const res = await fetch('/api/discovery/parse-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();

      if (data.success && data.criteria) {
        setCriteria((prev) => ({
          ...prev,
          ...data.criteria,
          targetCount: data.criteria.targetCount || prev.targetCount,
        }));
        setShowAdvancedFilters(true);
        onShowToast('Structured filters configured from prompt!', 'success');
      } else {
        onShowToast(data.error || 'Could not parse prompt', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to parse prompt with AI', 'error');
    } finally {
      setIsParsingPrompt(false);
    }
  };

  // Start Discovery (Queues job for DigitalOcean background worker)
  const handleStartDiscovery = async () => {
    try {
      const payloadCriteria: DiscoveryCriteria = {
        ...criteria,
        naturalLanguagePrompt: prompt.trim() || criteria.naturalLanguagePrompt,
      };

      const res = await fetch('/api/discovery/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: payloadCriteria,
          userId: user?.uid,
        }),
      });

      const data = await res.json();
      if (data.success && data.job) {
        setCurrentJob(data.job);
        setSelectedProspectIds(new Set());
        onShowToast(`Cloud Discovery job queued (${criteria.targetCount} target prospects). Background worker active.`, 'success');
        fetchJobsList();
      } else {
        onShowToast(data.error || 'Failed to start discovery job', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Network error starting discovery', 'error');
    }
  };

  const handlePause = async () => {
    if (!currentJob) return;
    try {
      const res = await fetch(`/api/discovery/jobs/${currentJob.id}/pause`, { method: 'POST' });
      const data = await res.json();
      if (data.job) setCurrentJob(data.job);
      onShowToast('Discovery paused at checkpoint', 'warning');
      fetchJobsList();
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  const handleResume = async () => {
    if (!currentJob) return;
    try {
      const res = await fetch(`/api/discovery/jobs/${currentJob.id}/resume`, { method: 'POST' });
      const data = await res.json();
      if (data.job) setCurrentJob(data.job);
      onShowToast('Discovery resumed from checkpoint', 'success');
      fetchJobsList();
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  const handleStop = async () => {
    if (!currentJob) return;
    try {
      const res = await fetch(`/api/discovery/jobs/${currentJob.id}/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.job) setCurrentJob(data.job);
      onShowToast('Stop signal sent — worker saving discovered prospects at checkpoint', 'info');
      fetchJobsList();
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  const handleRetryJob = async (jobId?: string) => {
    const id = jobId || currentJob?.id;
    if (!id) return;
    try {
      const res = await fetch(`/api/discovery/jobs/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.job) {
        setCurrentJob(data.job);
        onShowToast('Job queued for retry from checkpoint', 'info');
      }
      fetchJobsList();
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await fetch(`/api/discovery/jobs/${id}`, { method: 'DELETE' });
      onShowToast('Discovery job removed', 'info');
      if (currentJob?.id === id) {
        setCurrentJob(null);
      }
      fetchJobsList();
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  // Selection & Tab filtering helpers
  const prospects = currentJob?.prospects || [];
  const sources = currentJob?.sources || [];

  const verifiedProspects = prospects.filter((p) => p.verificationStatus === 'Verified company');
  const unverifiedProspects = prospects.filter((p) => p.verificationStatus !== 'Verified company');

  const filteredProspects = prospects.filter((p) => {
    // Top Tab filter
    if (resultsTab === 'verified' && p.verificationStatus !== 'Verified company') return false;
    if (resultsTab === 'unverified' && p.verificationStatus === 'Verified company') return false;

    // Quick filters
    if (tableFilter === 'decision_maker' && (!p.personName || p.personName.trim().length <= 2)) return false;
    if (tableFilter === 'direct_email' && (!p.email || p.emailType === 'Generic Business Email')) return false;
    if (tableFilter === 'email' && !p.email) return false;
    if (tableFilter === 'phone' && !p.phone) return false;
    if (tableFilter === 'high_conf' && p.confidence !== 'High') return false;
    if (
      tableFilter === 'funding' &&
      !p.buyingSignals?.some((s) => s.type === 'funding') &&
      !p.recentActivity?.some((a) => a.category === 'funding')
    ) {
      return false;
    }
    if (
      tableFilter === 'hiring' &&
      !p.buyingSignals?.some((s) => s.type === 'hiring') &&
      !p.recentActivity?.some((a) => a.category === 'hiring')
    ) {
      return false;
    }
    if (
      tableFilter === 'with_signals' &&
      (!p.buyingSignals || p.buyingSignals.length === 0) &&
      (!p.recentActivity || p.recentActivity.length === 0)
    ) {
      return false;
    }

    // Search query
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      const match =
        (p.companyName && p.companyName.toLowerCase().includes(q)) ||
        (p.domain && p.domain.toLowerCase().includes(q)) ||
        (p.personName && p.personName.toLowerCase().includes(q)) ||
        (p.jobTitle && p.jobTitle.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.state && p.state.toLowerCase().includes(q)) ||
        (p.country && p.country.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.foundedYear && p.foundedYear.toLowerCase().includes(q)) ||
        (p.employeeCount && p.employeeCount.toLowerCase().includes(q)) ||
        (p.industry && p.industry.toLowerCase().includes(q)) ||
        (p.sourceTitle && p.sourceTitle.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const toggleSelectProspect = (id: string) => {
    setSelectedProspectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProspectIds.size === filteredProspects.length && filteredProspects.length > 0) {
      setSelectedProspectIds(new Set());
    } else {
      setSelectedProspectIds(new Set(filteredProspects.map((p) => p.id)));
    }
  };

  // Re-verify official website for a specific company
  const handleVerifyProspect = async (prospectId: string) => {
    if (!currentJob) return;
    setIsVerifyingId(prospectId);
    try {
      const res = await fetch(`/api/discovery/job/${currentJob.id}/verify-prospect/${prospectId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.job) {
        setCurrentJob(data.job);
        onShowToast(
          data.prospect?.verificationStatus === 'Verified company'
            ? `Verified official website: ${data.prospect.domain}`
            : 'Could not verify official website from web search',
          data.prospect?.verificationStatus === 'Verified company' ? 'success' : 'warning'
        );
      } else {
        onShowToast(data.error || 'Verification request failed', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsVerifyingId(null);
    }
  };

  // Run existing crawler on a single verified company website
  const handleCrawlSingle = async (prospectId: string) => {
    if (!currentJob) return;
    setIsExtractingId(prospectId);
    try {
      const res = await fetch(`/api/discovery/job/${currentJob.id}/crawl-prospect/${prospectId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.job) {
        setCurrentJob(data.job);
        onShowToast(`Extracted contacts for ${data.prospect?.companyName}`, 'success');
      } else {
        onShowToast(data.error || 'Extraction failed', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsExtractingId(null);
    }
  };

  // Open AI Executive Dossier Modal
  const handleOpenDossier = async (p: DiscoveredProspect) => {
    setDossierProspect(p);
    setIsLoadingDossier(true);
    setDossierData(null);
    try {
      const res = await fetch('/api/discovery/generate-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect: p }),
      });
      const data = await res.json();
      if (data.success && data.dossier) {
        setDossierData(data.dossier);
      } else {
        throw new Error(data.error || 'Failed to generate dossier');
      }
    } catch (e: any) {
      onShowToast(`Dossier notice: ${e.message}`, 'warning');
    } finally {
      setIsLoadingDossier(false);
    }
  };

  // AI Deep Search: Enrich Decision Maker for a single prospect
  const handleEnrichDecisionMaker = async (prospectId: string) => {
    if (!currentJob) return;
    setIsEnrichingDecisionMakerId(prospectId);
    try {
      const res = await fetch(`/api/discovery/job/${currentJob.id}/enrich-decision-maker/${prospectId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.job) {
        setCurrentJob(data.job);
        if (selectedDrawerProspect?.id === prospectId && data.prospect) {
          setSelectedDrawerProspect(data.prospect);
        }
        onShowToast(
          `Enriched ${data.prospect.companyName}: ${data.prospect.personName || 'Decision Maker'} (${data.prospect.jobTitle || 'Executive'})`,
          'success'
        );
      } else {
        throw new Error(data.error || 'Failed to enrich decision maker');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsEnrichingDecisionMakerId(null);
    }
  };

  // AI Deep Search: Bulk Enrich Decision Makers
  const handleBulkEnrichDecisionMakers = async () => {
    if (!currentJob) return;
    setIsBulkEnriching(true);
    try {
      const ids = selectedProspectIds.size > 0 ? Array.from(selectedProspectIds) : undefined;
      onShowToast(
        `AI enriching decision makers & firmographics for ${ids ? ids.length : currentJob.prospects.length} companies...`,
        'info'
      );
      const res = await fetch(`/api/discovery/job/${currentJob.id}/bulk-enrich-decision-makers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: ids }),
      });
      const data = await res.json();
      if (data.success && data.job) {
        setCurrentJob(data.job);
        onShowToast(
          `Successfully enriched ${data.enrichedCount} decision makers with verified direct emails & firmographics!`,
          'success'
        );
      } else {
        throw new Error(data.error || 'Bulk enrichment failed');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsBulkEnriching(false);
    }
  };

  // Bulk extract contacts on all verified company websites
  const handleBulkExtractVerified = async () => {
    if (!currentJob) return;
    const targets = (currentJob.prospects || []).filter(
      (p) => p.verificationStatus === 'Verified company' && p.website && p.crawlStatus !== 'completed'
    );
    if (targets.length === 0) {
      onShowToast('All verified company websites have already been crawled.', 'info');
      return;
    }

    setIsBulkExtracting(true);
    onShowToast(`Starting contact extraction for ${targets.length} verified company website(s)...`, 'info');

    for (const p of targets) {
      try {
        const res = await fetch(`/api/discovery/job/${currentJob.id}/crawl-prospect/${p.id}`, {
          method: 'POST',
        });
        const data = await res.json();
        if (data.success && data.job) {
          setCurrentJob(data.job);
        }
      } catch (e) {
        console.warn(`Extraction error for ${p.domain}:`, e);
      }
    }

    setIsBulkExtracting(false);
    onShowToast('Finished extracting contacts from verified company websites!', 'success');
  };

  // One-way handoff: Enqueue Website Scraper for selected or all eligible verified companies
  const handleEnqueueEnrichmentBatch = async () => {
    if (!currentJob) return;
    const targetIds = selectedProspectIds.size > 0 ? Array.from(selectedProspectIds) : undefined;
    setIsBulkExtracting(true);
    try {
      const res = await fetch(`/api/discovery/job/${currentJob.id}/enqueue-enrichment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: targetIds }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(`Enqueued ${data.enqueuedCount} company website(s) into Website Scraper!`, 'success');
        if (data.job) setCurrentJob(data.job);
      } else {
        onShowToast(data.error || 'Failed to enqueue enrichment', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsBulkExtracting(false);
    }
  };

  // Edit Company modal handlers
  const handleOpenEdit = (p: DiscoveredProspect) => {
    setEditingProspect(p);
    setEditForm({
      companyName: p.companyName || '',
      website: p.website || '',
      industry: p.industry || '',
      location: p.location || '',
      verificationStatus: p.verificationStatus || 'Verified company',
    });
  };

  const handleSaveEdit = async () => {
    if (!currentJob || !editingProspect) return;
    try {
      const res = await fetch(`/api/discovery/job/${currentJob.id}/prospect/${editingProspect.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success && data.job) {
        setCurrentJob(data.job);
        setEditingProspect(null);
        onShowToast('Company record updated', 'success');
      } else {
        onShowToast(data.error || 'Failed to update record', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  // Import to Scraper
  const handleImportToCrm = async () => {
    // Only import prospects that have an actual company domain / website
    const targets = prospects
      .filter((p) => (selectedProspectIds.size === 0 ? true : selectedProspectIds.has(p.id)))
      .filter((p) => Boolean(p.website || p.domain));

    if (targets.length === 0) {
      onShowToast('No verified company domains available to import.', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/discovery/import-to-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: targets }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(`Imported ${data.count} verified company website(s) to Scraper!`, 'success');
        onNavigateToScraper();
      } else {
        onShowToast(data.error || 'Failed to import to CRM', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message || 'Import error', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const isRunning = currentJob?.status === 'running' || currentJob?.status === 'queued';
  const isPaused = currentJob?.status === 'paused';
  const progressPercent = currentJob
    ? Math.min(Math.round(((currentJob.uniqueCompanies || 0) / (currentJob.criteria.targetCount || 25)) * 100), 100)
    : 0;

  const activeFilterChips = [
    criteria.country ? { label: criteria.country, onRemove: () => setCriteria((c) => ({ ...c, country: '' })) } : null,
    criteria.industry ? { label: criteria.industry, onRemove: () => setCriteria((c) => ({ ...c, industry: '' })) } : null,
    criteria.employeeRange ? { label: `${criteria.employeeRange} employees`, onRemove: () => setCriteria((c) => ({ ...c, employeeRange: '' })) } : null,
    criteria.jobTitle ? { label: criteria.jobTitle, onRemove: () => setCriteria((c) => ({ ...c, jobTitle: '' })) } : null,
    criteria.companyScale && criteria.companyScale !== 'all' ? { label: criteria.companyScale === 'startups' ? 'Startups' : criteria.companyScale, onRemove: () => setCriteria((c) => ({ ...c, companyScale: 'all' })) } : null,
    criteria.excludeMegaCaps ? { label: 'No Mega-Caps', onRemove: () => setCriteria((c) => ({ ...c, excludeMegaCaps: false })) } : null,
    criteria.freshnessMode === 'new_only' ? { label: 'Fresh only', onRemove: () => setCriteria((c) => ({ ...c, freshnessMode: 'all', excludePreviouslyDiscovered: false })) } : null,
    criteria.keywords ? { label: `Keywords: ${criteria.keywords}`, onRemove: () => setCriteria((c) => ({ ...c, keywords: '' })) } : null,
    criteria.technology ? { label: `Tech: ${criteria.technology}`, onRemove: () => setCriteria((c) => ({ ...c, technology: '' })) } : null,
  ].filter(Boolean) as { label: string; onRemove: () => void }[];

  const activeFilterCount = activeFilterChips.length;

  return (
    <div id="ai-prospect-discovery-page" className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Floating Glass Command Center (Hero Workspace) */}
      <GlassPanel
        variant="elevated"
        rounded="xl"
        className="p-6 md:p-7 space-y-5 shadow-lg border-white/70 dark:border-white/10 relative overflow-hidden"
      >
        {/* Subtle atmospheric ambient glow inside hero */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Command Center Header & Context */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/50 dark:border-white/5">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#155eef] dark:text-blue-400 drop-shadow-[0_0_8px_rgba(21,94,239,0.4)]" />
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                AI Prospect Discovery
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                Live Web Grounding
              </span>

              {/* DigitalOcean Cloud Worker Status Badge */}
              <div
                id="cloud-worker-status-badge"
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                  workerHealth?.status === 'online'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                }`}
                title={`Cloud Worker: ${workerHealth?.workerId || 'leadhook-worker-01'} · Heartbeat: ${workerHealth?.secondsSinceHeartbeat ?? 0}s ago · Active: ${workerHealth?.activeJobs ?? 0} · Queued: ${workerHealth?.queuedJobs ?? 0}`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {workerHealth?.status === 'online' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                      workerHealth?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                </span>
                <span className="font-semibold">
                  {workerHealth?.status === 'online' ? 'Cloud Worker: Online' : 'Cloud Worker: Offline'}
                </span>
                <span className="text-slate-400 hidden lg:inline">
                  ({workerHealth?.workerId || 'leadhook-worker-01'})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GlassButton
              size="xs"
              variant={showCloudDashboard ? 'primary' : 'secondary'}
              onClick={() => setShowCloudDashboard(!showCloudDashboard)}
              icon={<Cloud className="w-3.5 h-3.5 text-blue-500" />}
            >
              Cloud Jobs ({jobHistory.length})
            </GlassButton>
            <GlassButton
              size="xs"
              variant="secondary"
              onClick={() => {
                setScheduledModalInitialTab('schedules');
                setShowScheduledModal(true);
              }}
              icon={<Clock className="w-3.5 h-3.5 text-indigo-500" />}
            >
              Schedules
            </GlassButton>
            <GlassButton
              size="xs"
              variant="secondary"
              onClick={() => setShowHistoryModal(true)}
              icon={<History className="w-3.5 h-3.5 text-slate-400" />}
            >
              History
            </GlassButton>
          </div>
        </div>

        {/* Natural Language Search Area */}
        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#155eef]" />
              <span>Describe the prospects you're looking for...</span>
            </label>
            <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
              Natural language or structured criteria
            </span>
          </div>

          <div className="relative group">
            <textarea
              id="discovery-prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Find B2B SaaS companies in the US with 10–200 employees and identify founders, CEOs, and VPs."'
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#155eef] focus:ring-4 focus:ring-[#155eef]/10 shadow-xs transition-all duration-200 resize-none"
            />
          </div>

          {/* Quick preset templates */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mr-1">Templates:</span>
            {PRESET_PROMPTS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(preset.prompt)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-white/60 dark:border-white/5 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls & Active Filter Chips Bar */}
        <div className="relative z-10 pt-2 border-t border-slate-200/50 dark:border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GlassButton
                id="discovery-filters-btn"
                size="sm"
                variant={showAdvancedFilters ? 'primary' : 'secondary'}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              >
                Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
              </GlassButton>

              <GlassButton
                id="discovery-parse-prompt-btn"
                size="sm"
                variant="secondary"
                onClick={handleParsePrompt}
                disabled={isParsingPrompt || !prompt.trim()}
                isLoading={isParsingPrompt}
                loadingText="Parsing with AI..."
                icon={<Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
              >
                AI Filter Sync
              </GlassButton>
            </div>

            {/* Action Buttons: Schedule (Hourly) & Discover */}
            <div className="flex items-center gap-2">
              <GlassButton
                id="discovery-schedule-hourly-btn"
                size="md"
                variant="secondary"
                onClick={() => {
                  setScheduledModalInitialTab('new');
                  setShowScheduledModal(true);
                }}
                icon={<Clock className="w-3.5 h-3.5 text-indigo-500" />}
                className="font-semibold text-xs border-indigo-500/20 hover:border-indigo-500/40"
                title="Schedule this search to run automatically on an hourly basis (after 1 hour, 2 hours, etc.)"
              >
                <span className="hidden sm:inline">Schedule (Hourly)</span>
                <span className="sm:hidden">Schedule</span>
              </GlassButton>

              {isRunning ? (
                <div className="flex items-center gap-1.5">
                  <GlassButton
                    id="discovery-pause-btn"
                    size="md"
                    variant="secondary"
                    onClick={handlePause}
                    icon={<Pause className="w-4 h-4 text-amber-500" />}
                    className="font-semibold text-xs border-amber-500/30 hover:border-amber-500/60 text-amber-600 dark:text-amber-400"
                    title="Pause discovery at current checkpoint"
                  >
                    Pause
                  </GlassButton>
                  <GlassButton
                    id="discovery-stop-btn"
                    size="md"
                    variant="danger"
                    onClick={handleStop}
                    icon={<Square className="w-4 h-4 text-white fill-current" />}
                    className="px-5 py-2.5 font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 border border-rose-500 animate-pulse"
                    title="Stop discovery now and keep all collected prospects safe"
                  >
                    Stop Discovery
                  </GlassButton>
                </div>
              ) : isPaused ? (
                <div className="flex items-center gap-1.5">
                  <GlassButton
                    id="discovery-resume-btn"
                    size="md"
                    variant="primary"
                    onClick={handleResume}
                    icon={<Play className="w-4 h-4" />}
                    className="px-5 py-2.5 font-bold text-xs"
                    title="Resume discovery from checkpoint"
                  >
                    Resume Discovery
                  </GlassButton>
                  <GlassButton
                    id="discovery-stop-btn"
                    size="md"
                    variant="danger"
                    onClick={handleStop}
                    icon={<Square className="w-4 h-4 text-white fill-current" />}
                    className="px-4 py-2.5 font-bold text-xs"
                    title="Stop discovery"
                  >
                    Stop
                  </GlassButton>
                </div>
              ) : (
                <GlassButton
                  id="discovery-start-btn"
                  size="md"
                  variant="glow"
                  onClick={handleStartDiscovery}
                  disabled={isRunning}
                  isLoading={isRunning}
                  loadingText="Discovering..."
                  rightIcon={<ArrowRight className="w-4 h-4 ml-0.5" />}
                  className="px-6 py-2.5 font-bold text-xs"
                >
                  Discover
                </GlassButton>
              )}
            </div>
          </div>

          {/* Active Filter Chips (Section 7) */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 animate-in fade-in duration-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mr-1">Active Criteria:</span>
              {activeFilterChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium glass-panel-subtle text-slate-700 dark:text-slate-300 border border-white/60 dark:border-white/10 shadow-2xs transition-all hover:bg-white/80 dark:hover:bg-slate-800/80 group"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    title="Remove filter"
                    className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 group-hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Structured Filters Drawer */}
        {showAdvancedFilters && (
          <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#155eef]" />
                <span>Structured Search Criteria</span>
              </h4>
              <span className="text-[10px] text-slate-400">Generates targeted search queries without hallucination</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Country */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Country</label>
                <input
                  type="text"
                  value={criteria.country || ''}
                  onChange={(e) => setCriteria({ ...criteria, country: e.target.value })}
                  placeholder="e.g. United States"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              {/* State */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">State / Region</label>
                <input
                  type="text"
                  value={criteria.state || ''}
                  onChange={(e) => setCriteria({ ...criteria, state: e.target.value })}
                  placeholder="e.g. California, Texas"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              {/* City */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">City</label>
                <input
                  type="text"
                  value={criteria.city || ''}
                  onChange={(e) => setCriteria({ ...criteria, city: e.target.value })}
                  placeholder="e.g. Austin, San Francisco"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              {/* Industry */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Industry</label>
                <input
                  type="text"
                  value={criteria.industry || ''}
                  onChange={(e) => setCriteria({ ...criteria, industry: e.target.value })}
                  placeholder="e.g. SaaS, FinTech, HealthTech"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              {/* Employee Range */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Employee Count Range</label>
                <select
                  value={criteria.employeeRange || ''}
                  onChange={(e) => setCriteria({ ...criteria, employeeRange: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                >
                  <option value="">Any Size</option>
                  <option value="1-10">1 - 10 employees (Micro)</option>
                  <option value="11-50">11 - 50 employees (Early Growth)</option>
                  <option value="51-200">51 - 200 employees (Scaleup)</option>
                  <option value="201-500">201 - 500 employees (Mid-Market)</option>
                  <option value="501-1000">501 - 1,000 employees</option>
                  <option value="1000+">1,000+ employees (Enterprise)</option>
                </select>
              </div>

              {/* Job Titles */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Target Job Titles</label>
                <input
                  type="text"
                  value={criteria.jobTitle || ''}
                  onChange={(e) => setCriteria({ ...criteria, jobTitle: e.target.value })}
                  placeholder="e.g. CEO, Founder, VP Sales"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              {/* Department */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Department</label>
                <select
                  value={criteria.department || ''}
                  onChange={(e) => setCriteria({ ...criteria, department: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                >
                  <option value="">Any Department</option>
                  <option value="Executive">Executive / Founders</option>
                  <option value="Sales">Sales & Business Development</option>
                  <option value="Marketing">Marketing & Growth</option>
                  <option value="Engineering">Engineering & Technology</option>
                  <option value="Finance">Finance & Operations</option>
                </select>
              </div>

              {/* Target Count */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Prospects Goal</label>
                <select
                  value={criteria.targetCount}
                  onChange={(e) => setCriteria({ ...criteria, targetCount: parseInt(e.target.value, 10) || 25 })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                >
                  <option value={10}>10 Prospects (Quick Test)</option>
                  <option value={25}>25 Prospects (Recommended)</option>
                  <option value={50}>50 Prospects</option>
                  <option value={100}>100 Prospects</option>
                  <option value={250}>250 Prospects</option>
                  <option value={500}>500 Prospects (Deep Run)</option>
                </select>
              </div>

              {/* Keywords */}
              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Keywords & Tags</label>
                <input
                  type="text"
                  value={criteria.keywords || ''}
                  onChange={(e) => setCriteria({ ...criteria, keywords: e.target.value })}
                  placeholder="e.g. B2B SaaS, cloud security, AI automation"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              {/* Technology Stack */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Technology Stack</label>
                <input
                  type="text"
                  value={criteria.technology || ''}
                  onChange={(e) => setCriteria({ ...criteria, technology: e.target.value })}
                  placeholder="e.g. AWS, React, Salesforce"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              {/* Company Scale Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Company Scale & Stage</label>
                <select
                  value={criteria.companyScale || 'startups'}
                  onChange={(e) => setCriteria({ ...criteria, companyScale: e.target.value as any })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                >
                  <option value="startups">🚀 Startups & Early Stage (Seed/Series A)</option>
                  <option value="smb">🏢 SMBs (10 - 50 Employees)</option>
                  <option value="mid_market">📈 Mid-Market (50 - 250 Employees)</option>
                  <option value="all">🌐 All Scales (Include Enterprise)</option>
                </select>
              </div>

              {/* Daily Buying Signal Filter */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Daily Buying Signal Trigger</label>
                <select
                  value={criteria.buyingSignalFilter || 'any_signal'}
                  onChange={(e) => setCriteria({ ...criteria, buyingSignalFilter: e.target.value as any })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                >
                  <option value="any_signal">⚡ Any Active Signal (Funding, Hiring, Launch)</option>
                  <option value="funding">💰 Recent Funding Raised (Seed, Series A/B)</option>
                  <option value="hiring">👥 Actively Hiring (Open SDR & Tech Roles)</option>
                  <option value="product_launch">🚀 New Product / Major Feature Launch</option>
                  <option value="leadership_change">👔 Executive Leadership Transitions</option>
                  <option value="all">🔍 All (No Signal Requirement)</option>
                </select>
              </div>
            </div>

            {/* Special Behavioral Checkboxes */}
            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={criteria.excludeMegaCaps ?? true}
                  onChange={(e) => setCriteria({ ...criteria, excludeMegaCaps: e.target.checked })}
                  className="w-4 h-4 rounded text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                />
                <span>🚫 Exclude Mega-Caps (No Microsoft, Salesforce, Stripe, etc.)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={criteria.freshnessMode === 'new_only'}
                  onChange={(e) =>
                    setCriteria({
                      ...criteria,
                      freshnessMode: e.target.checked ? 'new_only' : 'all',
                      excludePreviouslyDiscovered: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                />
                <span>⚡ Brand New Companies Only (Cross-job deduplication active: {ledgerStats.totalSeen} excluded)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200 select-none">
                <input
                  type="checkbox"
                  id="auto-extract-toggle"
                  checked={criteria.autoExtractContacts}
                  onChange={(e) => setCriteria({ ...criteria, autoExtractContacts: e.target.checked })}
                  className="w-4 h-4 rounded text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                />
                <span>✉️ Auto-Extract Contacts & Verified Emails from Website</span>
              </label>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Cloud Jobs & DigitalOcean Background Worker Dashboard (Section 23 & 24) */}
      {showCloudDashboard && (
        <GlassPanel
          variant="subtle"
          rounded="xl"
          className="p-5 md:p-6 space-y-4 border-slate-200/70 dark:border-white/10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Cloud Background Discovery
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      workerHealth?.status === 'online'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    }`}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      {workerHealth?.status === 'online' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                          workerHealth?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                    </span>
                    <span>{workerHealth?.status === 'online' ? 'Online' : 'Offline'}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Worker: <span className="font-mono">{workerHealth?.workerId || 'leadhook-worker-01'}</span> · Heartbeat: {workerHealth ? `${workerHealth.secondsSinceHeartbeat}s ago` : 'connecting...'} · Active Jobs: {workerHealth?.activeJobs ?? 0} · Queued: {workerHealth?.queuedJobs ?? 0}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden md:inline">
                Jobs run continuously in background
              </span>
              <button
                type="button"
                onClick={fetchJobsList}
                className="px-2.5 py-1 text-xs font-medium rounded-lg glass-panel hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 transition cursor-pointer"
                title="Refresh jobs list from persistent database"
              >
                <RefreshCw className="w-3 h-3 text-slate-400" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Cloud Reassurance Note */}
          <div className="p-3 rounded-lg bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/15 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Zap className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-600 dark:text-blue-400">Always-On Cloud Execution: </span>
              LeadHook executes prospect discovery in an independent background worker. You can safely close your browser or disconnect from the internet anytime; checkpoints and prospects are saved directly to the database as they are found.
            </div>
          </div>

          {/* Cloud Jobs Table */}
          {jobHistory.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No discovery jobs created yet. Click "Discover" above to launch a background job.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-white/5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="py-2 px-3">Job / Search Query</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Progress</th>
                    <th className="py-2 px-3">Worker</th>
                    <th className="py-2 px-3">Started</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                  {jobHistory.slice(0, 8).map((job) => {
                    const isSelected = currentJob?.id === job.id;
                    const jobStatus = job.status;
                    const goal = job.criteria?.targetCount || job.targetCount || 25;
                    const found = job.uniqueCompanies || 0;

                    return (
                      <tr
                        key={job.id}
                        className={`transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-500/10 dark:bg-blue-500/15 font-medium'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                        onClick={() => setCurrentJob(job)}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">
                              {job.criteria?.naturalLanguagePrompt || job.searchQuery || job.criteria?.industry || job.id}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {job.id}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {jobStatus === 'running' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Running in Cloud
                            </span>
                          )}
                          {jobStatus === 'queued' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Queued
                            </span>
                          )}
                          {jobStatus === 'stopping' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Stopping...
                            </span>
                          )}
                          {jobStatus === 'paused' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Paused
                            </span>
                          )}
                          {jobStatus === 'stopped' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                              Stopped by user
                            </span>
                          )}
                          {jobStatus === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              ✓ Completed
                            </span>
                          )}
                          {jobStatus === 'retrying' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Retrying...
                            </span>
                          )}
                          {jobStatus === 'failed' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                              ✕ Failed
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full bg-[#155eef] rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.round((found / goal) * 100))}%` }}
                              />
                            </div>
                            <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                              {found}/{goal}
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                          {job.workerId || (workerHealth?.status === 'online' ? workerHealth.workerId : 'cloud-daemon')}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {jobStatus === 'running' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handlePause()}
                                  className="p-1 rounded text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                                  title="Pause job"
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStop()}
                                  className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                                  title="Stop job and keep discovered prospects"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {jobStatus === 'paused' && (
                              <button
                                type="button"
                                onClick={() => handleResume()}
                                className="p-1 rounded text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                title="Resume job from checkpoint"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(jobStatus === 'stopped' || jobStatus === 'failed') && (
                              <button
                                type="button"
                                onClick={() => handleRetryJob(job.id)}
                                className="p-1 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                title="Resume discovery from checkpoint"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteJob(job.id)}
                              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete job record"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Live Discovery Progress Workspace (Section 10) */}
      {currentJob && (
        <GlassPanel
          variant="elevated"
          rounded="xl"
          className="p-5 md:p-6 space-y-5 shadow-lg border-blue-500/20 dark:border-blue-400/20 relative overflow-hidden"
        >
          {/* Subtle live pulse accent background */}
          {isRunning && (
            <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
          )}

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {(isRunning || currentJob.status === 'retrying') && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      currentJob.status === 'running'
                        ? 'bg-emerald-500'
                        : currentJob.status === 'queued'
                        ? 'bg-blue-500'
                        : currentJob.status === 'paused'
                        ? 'bg-amber-500'
                        : currentJob.status === 'stopping'
                        ? 'bg-amber-500 animate-pulse'
                        : currentJob.status === 'stopped'
                        ? 'bg-slate-500'
                        : currentJob.status === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-red-500'
                    }`}
                  />
                </span>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>
                    {currentJob.status === 'running' && 'Running in Cloud (Firebase / Cloud VM)'}
                    {currentJob.status === 'queued' && 'Queued for Cloud Worker'}
                    {currentJob.status === 'stopping' && 'Stopping at Checkpoint...'}
                    {currentJob.status === 'paused' && 'Discovery Paused at Checkpoint'}
                    {currentJob.status === 'stopped' && `Discovery Stopped — ${currentJob.prospects.length} prospects saved`}
                    {currentJob.status === 'completed' && 'Discovery Completed in Cloud'}
                    {currentJob.status === 'retrying' && 'Retrying from Checkpoint...'}
                    {currentJob.status === 'failed' && 'Discovery Failed'}
                  </span>
                </h3>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {currentJob.id}
                </span>

                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 flex items-center gap-1">
                  <Cloud className="w-2.5 h-2.5" />
                  <span>{currentJob.workerId || workerHealth?.workerId || 'leadhook-worker-01'}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Current Task:</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {currentJob.currentTask || currentJob.currentStepText || 'Processing web discovery pipeline...'}
                </span>
              </div>

              {/* Offline Resilience Reassurance */}
              {(currentJob.status === 'running' || currentJob.status === 'queued') && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  💡 This job executes in the cloud. You can close your laptop or browser tab anytime; progress continues independently.
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {currentJob.status === 'running' && (
                <GlassButton
                  size="xs"
                  variant="secondary"
                  onClick={handlePause}
                  icon={<Pause className="w-3 h-3 text-amber-500" />}
                >
                  Pause
                </GlassButton>
              )}

              {currentJob.status === 'paused' && (
                <GlassButton
                  size="xs"
                  variant="primary"
                  onClick={handleResume}
                  icon={<Play className="w-3 h-3" />}
                >
                  Resume
                </GlassButton>
              )}

              {(currentJob.status === 'running' || currentJob.status === 'queued') && (
                <GlassButton
                  size="xs"
                  variant="danger"
                  onClick={handleStop}
                  icon={<Square className="w-3 h-3" />}
                >
                  Stop
                </GlassButton>
              )}

              {(currentJob.status === 'stopped' || currentJob.status === 'failed') && (
                <GlassButton
                  size="xs"
                  variant="primary"
                  onClick={() => handleRetryJob(currentJob.id)}
                  icon={<RotateCcw className="w-3 h-3" />}
                >
                  Resume from Checkpoint
                </GlassButton>
              )}

              <a
                href={`/api/discovery/export-csv/${currentJob.id}`}
                className="px-2.5 py-1 text-[11px] rounded-lg glass-panel hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3 h-3 text-slate-400" />
                CSV
              </a>
              <a
                href={`/api/discovery/export-xlsx/${currentJob.id}`}
                className="px-2.5 py-1 text-[11px] rounded-lg glass-panel hover:bg-white/80 dark:hover:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 border border-slate-200/80 dark:border-slate-800 font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-500" />
                Excel
              </a>
            </div>
          </div>

          {/* Section 10: Live Pipeline State Indicator */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 py-1">
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                isRunning
                  ? 'glass-panel border-blue-500/30 shadow-xs'
                  : 'glass-panel-subtle border-white/40 dark:border-white/5'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span>Searching web</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-1 block">
                {currentJob.queriesExecuted || 0} queries run
              </span>
            </div>

            <div className="p-2.5 rounded-xl glass-panel border border-white/40 dark:border-white/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Companies found</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-1 block">
                {currentJob.companiesDiscovered || 0} candidates
              </span>
            </div>

            <div className="p-2.5 rounded-xl glass-panel border border-white/40 dark:border-white/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Websites verified</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-1 block">
                {currentJob.uniqueCompanies || 0} official sites
              </span>
            </div>

            <div className="p-2.5 rounded-xl glass-panel border border-white/40 dark:border-white/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isRunning ? 'animate-spin' : ''}`} />
                <span>Finding decision-makers</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-1 block">
                {currentJob.peopleFound || 0} people · {currentJob.emailsFound || 0} emails
              </span>
            </div>
          </div>

          {/* Animated Progress Indicator */}
          <AnimatedProgress
            value={progressPercent}
            label={`Discovery Progress: ${currentJob.uniqueCompanies || 0} / ${
              currentJob.criteria.targetCount || 25
            } unique companies`}
            statusText={isRunning ? 'Live streaming discoveries...' : undefined}
            variant="brand"
          />

          {/* Subtle Glass Micro-Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1 border-t border-slate-200/50 dark:border-white/5">
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block truncate">Queries</span>
              <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">{currentJob.queriesExecuted || 0}</span>
            </div>
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block truncate">Candidates</span>
              <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">{currentJob.companiesDiscovered || 0}</span>
            </div>
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-[#155eef] dark:text-blue-300 font-semibold block truncate">Verified Sites</span>
              <span className="text-sm font-bold text-[#155eef] dark:text-blue-300 font-mono">{currentJob.uniqueCompanies || 0}</span>
            </div>
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block truncate">Crawled</span>
              <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">{currentJob.websitesProcessed || 0}</span>
            </div>
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-indigo-500 font-semibold block truncate">Contacts</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">{currentJob.peopleFound || 0}</span>
            </div>
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-semibold block truncate">Emails</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">{currentJob.emailsFound || 0}</span>
            </div>
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block truncate">Phones</span>
              <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">{currentJob.phonesFound || 0}</span>
            </div>
            <div className="p-2 rounded-lg glass-panel-subtle text-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block truncate">Pruned</span>
              <span className="text-sm font-bold text-slate-400 font-mono">{currentJob.duplicatesRemoved || 0}</span>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Discovered Prospects Table & Sources Section (Section 9) */}
      <GlassPanel variant="default" rounded="xl" className="shadow-lg border-white/70 dark:border-white/10 overflow-hidden">
        {/* Primary Filter Tabs: Verified | Needs Verification | All Companies | Sources Used */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-4 pt-3 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setResultsTab('verified')}
            className={`pb-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              resultsTab === 'verified'
                ? 'border-[#155eef] text-[#155eef] dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Verified Companies</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono">
              {verifiedProspects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setResultsTab('unverified')}
            className={`pb-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              resultsTab === 'unverified'
                ? 'border-[#155eef] text-[#155eef] dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Needs Verification / Unverified</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono">
              {unverifiedProspects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setResultsTab('all')}
            className={`pb-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              resultsTab === 'all'
                ? 'border-[#155eef] text-[#155eef] dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4 text-indigo-500" />
            <span>All Discovered Companies</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
              {prospects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setResultsTab('sources')}
            className={`pb-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              resultsTab === 'sources'
                ? 'border-[#155eef] text-[#155eef] dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-500" />
            <span>Sources Used</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono">
              {sources.length}
            </span>
          </button>
        </div>

        {/* Table Control Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-wrap items-center gap-3">
            {resultsTab !== 'sources' && (
              <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setTableFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    tableFilter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({filteredProspects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('decision_maker')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    tableFilter === 'decision_maker' ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  👤 Decision Makers ({prospects.filter((p) => Boolean(p.personName && p.personName.length > 2)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('direct_email')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    tableFilter === 'direct_email' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ✉️ Direct Email ({prospects.filter((p) => Boolean(p.email && p.emailType !== 'Generic Business Email')).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('with_signals')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    tableFilter === 'with_signals' ? 'bg-white dark:bg-slate-900 text-amber-500 dark:text-amber-400 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                  Signals ({prospects.filter((p) => Boolean(p.buyingSignals?.length || p.recentActivity?.length)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('funding')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    tableFilter === 'funding' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  💰 Funding ({prospects.filter((p) => p.buyingSignals?.some((s) => s.type === 'funding') || p.recentActivity?.some((a) => a.category === 'funding')).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('hiring')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    tableFilter === 'hiring' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  👥 Hiring ({prospects.filter((p) => p.buyingSignals?.some((s) => s.type === 'hiring') || p.recentActivity?.some((a) => a.category === 'hiring')).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('email')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    tableFilter === 'email' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Emails ({prospects.filter((p) => Boolean(p.email)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('high_conf')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    tableFilter === 'high_conf' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  High Fit ({prospects.filter((p) => (p.fitScore || 0) >= 80 || p.confidence === 'High').length})
                </button>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {resultsTab !== 'sources' && (
              <>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search by city, state, country, role, name, year..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef] w-48 sm:w-64"
                  />
                </div>

                {/* AI Decision Maker Deep Enrich Button */}
                <button
                  type="button"
                  onClick={handleBulkEnrichDecisionMakers}
                  disabled={isBulkEnriching || prospects.length === 0}
                  className="px-3.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 hover:from-purple-100 hover:to-indigo-100 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  title="AI Deep Search: Enrich decision makers, direct emails, city, state, country, founded year, and headcount"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-purple-600 dark:text-purple-400 ${isBulkEnriching ? 'animate-spin' : ''}`} />
                  <span>
                    {isBulkEnriching
                      ? 'Enriching...'
                      : selectedProspectIds.size > 0
                      ? `AI Enrich Selected (${selectedProspectIds.size})`
                      : 'AI Enrich Decision Makers'}
                  </span>
                </button>

                {/* One-Way Handoff: Enqueue Website Scraper on Verified Websites */}
                <button
                  type="button"
                  id="enqueue-scraper-btn"
                  onClick={handleEnqueueEnrichmentBatch}
                  disabled={isBulkExtracting || verifiedProspects.length === 0}
                  className="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  title="One-way handoff: Enqueue confirmed official company websites into the website scraper without duplicate discovery"
                >
                  <Zap className={`w-3.5 h-3.5 text-[#155eef] ${isBulkExtracting ? 'animate-spin' : ''}`} />
                  <span>
                    {isBulkExtracting
                      ? 'Enqueueing Scraper...'
                      : selectedProspectIds.size > 0
                      ? `Enrich Selected (${selectedProspectIds.size})`
                      : `Enrich Verified (${verifiedProspects.length})`}
                  </span>
                </button>

                {/* Import to Scraper Workspace */}
                <button
                  type="button"
                  id="import-to-scraper-btn"
                  onClick={handleImportToCrm}
                  disabled={isImporting || prospects.length === 0}
                  className="px-4 py-1.5 rounded-xl bg-[#155eef] hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Send discovered company domains into your existing Scraper workspace"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>
                    {selectedProspectIds.size > 0
                      ? `Import Selected (${selectedProspectIds.size})`
                      : `Import to Scraper (${verifiedProspects.length})`}
                  </span>
                </button>

                {/* Direct Table Export CSV & Excel */}
                {currentJob && (
                  <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-slate-800">
                    <a
                      href={`/api/discovery/export-csv/${currentJob.id}`}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                      title="Download complete prospect dataset with decision makers, emails, city, state, country, founded year, employee count as CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>CSV</span>
                    </a>
                    <a
                      href={`/api/discovery/export-xlsx/${currentJob.id}`}
                      className="px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                      title="Download complete prospect dataset as Excel Spreadsheet"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Excel</span>
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* VIEW 1: Sources Used View */}
        {resultsTab === 'sources' ? (
          <div className="p-5 space-y-4">
            {sources.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No external directory or article sources recorded yet for this run.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                            {src.sourceType}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{src.domain}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1 line-clamp-2">
                          {src.title || src.url}
                        </h4>
                      </div>

                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#155eef] text-slate-600 dark:text-slate-300 hover:text-[#155eef] text-[11px] font-semibold flex items-center gap-1 shrink-0"
                      >
                        <span>Open Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {src.companiesFound} {src.companiesFound === 1 ? 'company' : 'companies'} extracted
                      </span>
                    </div>

                    {src.extractedCompanyNames && src.extractedCompanyNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {src.extractedCompanyNames.map((name, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: Discovered Prospects Table */
          <>
            {filteredProspects.length === 0 ? (
              <div className="py-16 text-center space-y-3 px-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                  {currentJob ? 'No prospects matching the current tab or filter' : 'No prospects discovered yet'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {resultsTab === 'verified'
                    ? 'No companies with verified official websites match the filter.'
                    : resultsTab === 'unverified'
                    ? 'No unverified companies found.'
                    : 'Start a discovery job above to find real companies from the public web.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedProspectIds.size === filteredProspects.length && filteredProspects.length > 0}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 rounded text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Official Website</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Headcount & Est.</th>
                      <th className="py-3 px-4">Decision Maker</th>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4 text-right">AI Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredProspects.map((p) => {
                      const isSelected = selectedProspectIds.has(p.id);
                      const isVerified = p.verificationStatus === 'Verified company' && Boolean(p.website || p.domain);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedDrawerProspect(p)}
                          className={`hover:bg-white/80 dark:hover:bg-slate-800/60 transition-all duration-150 cursor-pointer group select-none ${
                            isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectProspect(p.id)}
                              className="w-3.5 h-3.5 rounded text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                            />
                          </td>

                          {/* Company Name & Industry */}
                          <td className="py-3.5 px-4 font-medium">
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 flex items-center justify-center shrink-0 text-[#155eef] font-bold text-xs uppercase">
                                {p.companyName ? p.companyName.charAt(0) : 'C'}
                              </div>
                              <div className="space-y-1">
                                <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                                  <span>{p.companyName}</span>
                                  {p.industry && (
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                      {p.industry}
                                    </span>
                                  )}
                                  {p.isNewDiscovery !== false && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Fresh Lead
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExplainingProspect(p);
                                    }}
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1 transition cursor-pointer"
                                    title="Click to see why this company was discovered"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>{p.fitScore || p.matchExplanation?.matchScore || 85}% Match</span>
                                  </button>
                                </div>
                                {p.description && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">
                                    {p.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Official Website */}
                          <td className="py-3.5 px-4">
                            {isVerified && p.domain ? (
                              <a
                                href={p.website || `https://${p.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-[#155eef] dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                <Globe className="w-3 h-3 shrink-0" />
                                <span>{p.domain}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                                  Unverified
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyProspect(p.id)}
                                  disabled={isVerifyingId === p.id}
                                  className="p-1 rounded text-slate-400 hover:text-[#155eef] transition-colors cursor-pointer"
                                  title="Search official website"
                                >
                                  <RefreshCw className={`w-3 h-3 ${isVerifyingId === p.id ? 'animate-spin' : ''}`} />
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Location (City, State, Country) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="text-xs font-semibold truncate max-w-[130px]" title={[p.city, p.state, p.country].filter(Boolean).join(', ') || p.location}>
                                {[p.city, p.state].filter(Boolean).join(', ') || p.city || p.location || p.country || '—'}
                              </span>
                            </div>
                            {p.country && (
                              <span className="text-[10px] text-slate-400 block truncate pl-5">
                                {p.country}
                              </span>
                            )}
                          </td>

                          {/* Headcount & Founded Year */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{p.employeeCount || '11-50'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{p.foundedYear ? `Est. ${p.foundedYear}` : '—'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Decision Maker (Name & Role) */}
                          <td className="py-3.5 px-4">
                            {p.personName ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                                  <span>{p.personName}</span>
                                  {p.seniority && (
                                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                      {p.seniority}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] font-medium text-[#155eef] dark:text-blue-400">
                                  {p.jobTitle || 'Executive'}
                                </p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnrichDecisionMaker(p.id);
                                }}
                                disabled={isEnrichingDecisionMakerId === p.id}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 flex items-center gap-1 cursor-pointer transition border border-purple-200 dark:border-purple-800"
                              >
                                <Sparkles className={`w-3 h-3 ${isEnrichingDecisionMakerId === p.id ? 'animate-spin' : ''}`} />
                                <span>Find Executive</span>
                              </button>
                            )}
                          </td>

                          {/* Email */}
                          <td className="py-3.5 px-4">
                            {p.email ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs text-slate-900 dark:text-slate-100 select-all font-semibold">
                                    {p.email}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(p.email!, `email_${p.id}`);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded cursor-pointer"
                                    title="Copy email"
                                  >
                                    {copiedId === `email_${p.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block ${
                                  p.emailType === 'Generic Business Email'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                }`}>
                                  {p.emailType || 'Direct Email'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No email</span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="py-3.5 px-4">
                            {p.phone ? (
                              <span className="font-mono text-slate-700 dark:text-slate-300 font-medium text-xs">
                                {p.phone}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">—</span>
                            )}
                          </td>

                          {/* Row Actions */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* AI Executive Dossier */}
                              <button
                                type="button"
                                onClick={() => handleOpenDossier(p)}
                                className="px-2 py-1 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 dark:from-purple-950/40 dark:to-indigo-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/40 text-[11px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                title="Generate AI Executive Dossier & Outreach Sequences"
                              >
                                <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                <span>AI Dossier</span>
                              </button>

                              {/* AI Enrich Decision Maker */}
                              <button
                                type="button"
                                onClick={() => handleEnrichDecisionMaker(p.id)}
                                disabled={isEnrichingDecisionMakerId === p.id}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-purple-600 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                title="AI Deep Enrich Decision Maker & Firmographics"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isEnrichingDecisionMakerId === p.id ? 'animate-spin text-purple-600' : ''}`} />
                              </button>

                              {/* Extract Contacts */}
                              {isVerified && (
                                <button
                                  type="button"
                                  onClick={() => handleCrawlSingle(p.id)}
                                  disabled={isExtractingId === p.id}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                                  title="Extract website contacts"
                                >
                                  <Mail className={`w-3.5 h-3.5 ${isExtractingId === p.id ? 'animate-spin' : ''}`} />
                                </button>
                              )}

                              {/* Edit Company */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                                title="Edit Company / Website"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </GlassPanel>

      {/* Company Detail Glass Drawer (Section 11) */}
      <GlassDrawer
        isOpen={Boolean(selectedDrawerProspect)}
        onClose={() => setSelectedDrawerProspect(null)}
        title={selectedDrawerProspect?.companyName || 'Company Details'}
        subtitle={selectedDrawerProspect?.domain || selectedDrawerProspect?.industry || 'Verified Prospect'}
        width="xl"
        badge={
          selectedDrawerProspect?.verificationStatus === 'Verified company' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Verified Company
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Needs Verification
            </span>
          )
        }
        footer={
          selectedDrawerProspect && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedDrawerProspect.website && (
                  <a
                    href={selectedDrawerProspect.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 glass-panel-subtle text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#155eef] flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    <span>Visit Website</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 text-slate-400" />
                  </a>
                )}
                <GlassButton
                  size="xs"
                  variant="secondary"
                  onClick={() => handleOpenEdit(selectedDrawerProspect)}
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                >
                  Edit Record
                </GlassButton>
              </div>

              <div className="flex items-center gap-2">
                {selectedDrawerProspect.verificationStatus === 'Verified company' && (
                  <GlassButton
                    size="xs"
                    variant="secondary"
                    onClick={() => handleCrawlSingle(selectedDrawerProspect.id)}
                    disabled={isExtractingId === selectedDrawerProspect.id}
                    isLoading={isExtractingId === selectedDrawerProspect.id}
                    loadingText="Extracting..."
                    icon={<Mail className="w-3.5 h-3.5 text-emerald-500" />}
                  >
                    Extract Contacts
                  </GlassButton>
                )}
                {onOpenAiStudio && (
                  <GlassButton
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      onOpenAiStudio({
                        tab: 'dossier',
                        companyName: selectedDrawerProspect.companyName,
                        domain: selectedDrawerProspect.domain,
                        industry: selectedDrawerProspect.industry,
                      });
                    }}
                    icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                  >
                    AI Dossier
                  </GlassButton>
                )}
                <GlassButton
                  size="xs"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      onShowToast(`Piping "${selectedDrawerProspect.companyName}" to Autonomous Lead Qualifier AI Workflow...`, 'info');
                      const res = await fetch(`/api/workflows/wf_autonomous_qualifier/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          payload: {
                            company: selectedDrawerProspect.companyName,
                            companyName: selectedDrawerProspect.companyName,
                            website: selectedDrawerProspect.website || `https://${selectedDrawerProspect.domain}`,
                            domain: selectedDrawerProspect.domain,
                            email: selectedDrawerProspect.contacts?.[0]?.email || '',
                            industry: selectedDrawerProspect.industry,
                            employeeCount: selectedDrawerProspect.employeeRange,
                            score: selectedDrawerProspect.matchScore || 85,
                            source: 'AI Prospect Discovery',
                          },
                        }),
                      });
                      if (res.ok) {
                        onShowToast(`Triggered AI Workflow for ${selectedDrawerProspect.companyName}! Check AI Workflows tab.`, 'success');
                      }
                    } catch (e: any) {
                      onShowToast(`Workflow dispatch: ${e.message}`, 'info');
                    }
                  }}
                  icon={<GitBranch className="w-3.5 h-3.5 text-cyan-400" />}
                >
                  AI Workflow
                </GlassButton>
                <GlassButton
                  size="xs"
                  variant="primary"
                  onClick={() => {
                    if (selectedDrawerProspect.website || selectedDrawerProspect.domain) {
                      onImportToScraper([selectedDrawerProspect.website || `https://${selectedDrawerProspect.domain}`]);
                      onShowToast(`Sent ${selectedDrawerProspect.companyName} to Website Scraper!`, 'success');
                      onNavigateToScraper();
                    }
                  }}
                  icon={<Zap className="w-3.5 h-3.5 fill-white" />}
                >
                  Send to Scraper
                </GlassButton>
              </div>
            </div>
          )
        }
      >
        {selectedDrawerProspect && (
          <div className="space-y-6">
            {/* Drawer Tabs Navigation */}
            <div className="flex items-center gap-1 p-1 rounded-xl glass-panel-subtle border border-white/60 dark:border-white/5">
              {[
                { id: 'overview', label: 'Company' },
                { id: 'contacts', label: 'Contacts & Emails' },
                {
                  id: 'signals',
                  label: 'Signals & News',
                  count:
                    selectedDrawerProspect.buyingSignals?.length ||
                    selectedDrawerProspect.recentActivity?.length ||
                    undefined,
                },
                { id: 'sources', label: 'Sources & Proof' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDrawerTab(tab.id as any)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none flex items-center justify-center gap-1.5 ${
                    drawerTab === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-[#155eef] dark:bg-blue-900/60 dark:text-blue-300 font-mono">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* TAB: Company Overview */}
            {drawerTab === 'overview' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Firmographics Card */}
                <div className="p-4 rounded-xl glass-panel space-y-3 border border-white/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Executive & Firmographics Intelligence
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEnrichDecisionMaker(selectedDrawerProspect.id)}
                      disabled={isEnrichingDecisionMakerId === selectedDrawerProspect.id}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1 cursor-pointer transition"
                    >
                      <RefreshCw className={`w-3 h-3 ${isEnrichingDecisionMakerId === selectedDrawerProspect.id ? 'animate-spin' : ''}`} />
                      <span>AI Deep Enrich</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Decision Maker</span>
                      <span className="font-bold text-slate-900 dark:text-white block truncate">
                        {selectedDrawerProspect.personName || '—'}
                      </span>
                      {selectedDrawerProspect.jobTitle && (
                        <span className="text-[10px] text-[#155eef] dark:text-blue-400 block truncate">
                          {selectedDrawerProspect.jobTitle}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Direct Email</span>
                      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate select-all">
                        {selectedDrawerProspect.decisionMakerEmail || selectedDrawerProspect.email || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">City</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {selectedDrawerProspect.city || (selectedDrawerProspect.location?.split(',')[0]?.trim()) || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">State / Region</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {selectedDrawerProspect.state || (selectedDrawerProspect.location?.split(',')[1]?.trim()) || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Country</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {selectedDrawerProspect.country || 'United States'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Founded Year</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {selectedDrawerProspect.foundedYear ? `Est. ${selectedDrawerProspect.foundedYear}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">No. of Employees</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {selectedDrawerProspect.employeeCount || '11-50 employees'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Industry</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {selectedDrawerProspect.industry || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Phone</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 block truncate">
                        {selectedDrawerProspect.phone || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2">
                    <GlassButton
                      size="xs"
                      variant="primary"
                      onClick={() => handleOpenDossier(selectedDrawerProspect)}
                      icon={<Sparkles className="w-3.5 h-3.5 fill-white" />}
                    >
                      Generate AI Sales Dossier
                    </GlassButton>
                  </div>
                </div>

                {/* Description */}
                {selectedDrawerProspect.description && (
                  <div className="p-4 rounded-xl glass-panel space-y-2 border border-white/60 dark:border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Description
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedDrawerProspect.description}
                    </p>
                  </div>
                )}

                {/* Match Score & Explanation */}
                <div className="p-4 rounded-xl glass-panel space-y-2 border border-white/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Relevance & Condition Match
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                      {selectedDrawerProspect.fitScore || selectedDrawerProspect.matchExplanation?.matchScore || 85}% Match
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {selectedDrawerProspect.matchExplanation?.summary ||
                      selectedDrawerProspect.explanation ||
                      'Matched target discovery parameters and verified official website domain.'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB: Contacts & Decision Makers */}
            {drawerTab === 'contacts' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Decision Maker Card */}
                <div className="p-4 rounded-xl glass-panel space-y-3 border border-white/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Identified Executive / Decision Maker
                    </span>
                    {selectedDrawerProspect.seniority && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        {selectedDrawerProspect.seniority}
                      </span>
                    )}
                  </div>

                  {selectedDrawerProspect.personName ? (
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedDrawerProspect.personName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedDrawerProspect.jobTitle || 'Executive'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No individual executive contact identified yet. Run website contact extraction below.
                    </p>
                  )}
                </div>

                {/* Email Card */}
                <div className="p-4 rounded-xl glass-panel space-y-2 border border-white/60 dark:border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Verified Email Address
                  </span>
                  {selectedDrawerProspect.email ? (
                    <div className="flex items-center justify-between p-2.5 rounded-lg glass-panel-subtle">
                      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 select-all">
                        {selectedDrawerProspect.email}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            selectedDrawerProspect.email!,
                            `drawer_email_${selectedDrawerProspect.id}`
                          )
                        }
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="Copy email"
                      >
                        {copiedId === `drawer_email_${selectedDrawerProspect.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No email found on homepage.</p>
                  )}
                </div>

                {/* Phone Card */}
                {selectedDrawerProspect.phone && (
                  <div className="p-4 rounded-xl glass-panel space-y-2 border border-white/60 dark:border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Phone Number
                    </span>
                    <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDrawerProspect.phone}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Signals & Recent Activity */}
            {drawerTab === 'signals' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {selectedDrawerProspect.buyingSignals && selectedDrawerProspect.buyingSignals.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Buying Signals
                    </span>
                    {selectedDrawerProspect.buyingSignals.map((sig, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl glass-panel border border-white/60 dark:border-white/5 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Zap className="w-2.5 h-2.5 fill-amber-500" />
                            {sig.badgeLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono capitalize">{sig.type}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 pt-1">{sig.detail}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDrawerProspect.recentActivity && selectedDrawerProspect.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Public News & Signals Timeline
                    </span>
                    {selectedDrawerProspect.recentActivity.map((act, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl glass-panel border border-white/60 dark:border-white/5 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#155eef] dark:text-blue-400">
                            {act.category || 'News'}
                          </span>
                          {act.url && (
                            <a
                              href={act.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-slate-400 hover:text-[#155eef] inline-flex items-center gap-1 font-medium"
                            >
                              <span>Source</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                        <h5 className="font-semibold text-slate-900 dark:text-white">{act.title}</h5>
                        {act.summary && (
                          <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                            {act.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !selectedDrawerProspect.buyingSignals?.length && (
                    <p className="text-center text-xs text-slate-400 py-8">
                      No buying signals or recent news recorded.
                    </p>
                  )
                )}
              </div>
            )}

            {/* TAB: Sources & Verification */}
            {drawerTab === 'sources' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl glass-panel space-y-3 border border-white/60 dark:border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Domain Verification Evidence
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Official Domain:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {selectedDrawerProspect.domain || selectedDrawerProspect.website || '—'}
                      </span>
                    </div>
                    {selectedDrawerProspect.verificationEvidence && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 p-2.5 rounded-lg glass-panel-subtle font-mono">
                        {selectedDrawerProspect.verificationEvidence}
                      </p>
                    )}
                  </div>
                </div>

                {selectedDrawerProspect.sourceUrl && (
                  <div className="p-4 rounded-xl glass-panel space-y-2 border border-white/60 dark:border-white/5 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Discovered From
                    </span>
                    <a
                      href={selectedDrawerProspect.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#155eef] dark:text-blue-400 hover:underline flex items-center gap-1.5 font-medium"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {selectedDrawerProspect.sourceTitle || selectedDrawerProspect.sourceUrl}
                      </span>
                      <ExternalLink className="w-3 h-3 shrink-0 ml-0.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </GlassDrawer>

      {/* Edit Company / Website Modal */}
      {editingProspect && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#155eef]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Company Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProspect(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                  Company Name
                </label>
                <input
                  type="text"
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                  Official Website URL
                </label>
                <input
                  type="text"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  placeholder="https://company.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Must be the company's official domain. Do not enter directory or social links.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={editForm.industry}
                    onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                  Verification Status
                </label>
                <select
                  value={editForm.verificationStatus}
                  onChange={(e) => setEditForm({ ...editForm, verificationStatus: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                >
                  <option value="Verified company">Verified company</option>
                  <option value="Company found, website unverified">Company found, website unverified</option>
                  <option value="Needs review">Needs review</option>
                </select>
              </div>

              {editingProspect.sourceUrl && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-500 font-semibold block">Discovered From Source:</span>
                  <a
                    href={editingProspect.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#155eef] dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5 truncate"
                  >
                    <span className="truncate">{editingProspect.sourceTitle || editingProspect.sourceUrl}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setEditingProspect(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-[#155eef] hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Evidence Modal */}
      {selectedActivityProspect && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center border border-amber-200 dark:border-amber-800/40">
                  <Zap className="w-4 h-4 fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedActivityProspect.companyName} — Recent Activity
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Public news, announcements, hiring, and business activity signals
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActivityProspect(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
              {!selectedActivityProspect.recentActivity || selectedActivityProspect.recentActivity.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">
                  No recent activity signals recorded for this prospect.
                </p>
              ) : (
                selectedActivityProspect.recentActivity.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {act.category || 'news'}
                        </span>
                        {act.confidence && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {Math.round(act.confidence * 100)}% match
                          </span>
                        )}
                        {act.publishedDate && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {act.publishedDate}
                          </span>
                        )}
                      </div>

                      {act.url && (
                        <a
                          href={act.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#155eef] hover:underline flex items-center gap-1 text-[11px] font-medium shrink-0"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      {act.title}
                    </h4>

                    {act.summary && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {act.summary}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-500">
                Discovered from public sources without launching deep website crawling
              </span>
              <button
                type="button"
                onClick={() => setSelectedActivityProspect(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discovery History Drawer / Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#155eef]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Previous Discovery Runs</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {jobHistory.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No previous discovery runs found.</p>
              ) : (
                jobHistory.map((h) => (
                  <div
                    key={h.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 cursor-pointer ${
                      currentJob?.id === h.id
                        ? 'border-[#155eef] bg-blue-50/40 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                    onClick={() => {
                      setCurrentJob(h);
                      setShowHistoryModal(false);
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {h.criteria?.naturalLanguagePrompt || `${h.criteria?.industry || 'Prospects'} Discovery`}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                            h.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {h.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(h.created_at).toLocaleString()} • {h.uniqueCompanies || 0} companies • {h.emailsFound || 0} emails
                      </p>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(h.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Delete run"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Scheduled / Auto-Recurring Scraper Modal */}
      <ScheduledScraperModal
        isOpen={showScheduledModal}
        onClose={() => setShowScheduledModal(false)}
        currentCriteria={criteria}
        initialTab={scheduledModalInitialTab}
        onShowToast={onShowToast}
        onViewJob={(jobId) => {
          fetchJobDetails(jobId);
        }}
      />

      {/* Criteria & Condition Explainer Modal */}
      <ConditionExplainerModal
        prospect={explainingProspect}
        onClose={() => setExplainingProspect(null)}
      />

      {/* AI Decision-Maker Dossier & Multi-Channel Outreach Modal */}
      <ProspectDossierModal
        prospect={dossierProspect}
        dossier={dossierData}
        isLoading={isLoadingDossier}
        onClose={() => {
          setDossierProspect(null);
          setDossierData(null);
        }}
        onSendToCopilot={(data) => {
          if (onOpenAiStudio) {
            onOpenAiStudio({
              tab: 'outreach',
              ...data,
            });
          }
        }}
        onShowToast={onShowToast}
        onRefreshDossier={() => {
          if (dossierProspect) {
            handleOpenDossier(dossierProspect);
          }
        }}
      />
    </div>
  );
};
