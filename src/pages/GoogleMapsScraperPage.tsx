import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Globe,
  Phone,
  Mail,
  Star,
  ExternalLink,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  RefreshCw,
  Copy,
  Check,
  Filter,
  Layers,
  Database,
  ShieldCheck,
  ArrowRight,
  User,
  Users,
  Building,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Sliders,
  X,
  Compass,
  Briefcase,
  TrendingUp,
  GitBranch,
} from 'lucide-react';
import { GoogleMapsLead, GoogleMapsScrapeJob, ScrapeSettings, DecisionMakerContact } from '../types';
import { useAuth } from '../context/AuthContext';
import { firestoreService } from '../lib/firestoreService';

interface GoogleMapsScraperPageProps {
  settings: ScrapeSettings | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onImportToScraper: (urls: string[]) => void;
  onNavigateToScraper: () => void;
  onOpenAiStudio?: (state: any) => void;
  onNavigateToVerifier?: () => void;
  onNavigateToEmailVerifier?: () => void;
}

const PRESET_COMMANDS = [
  {
    icon: '⚖️',
    label: 'Law firms in California',
    cmd: 'law firms in california',
    loc: 'California',
  },
  {
    icon: '🚗',
    label: 'Car repair shop in New York',
    cmd: 'car repair shop in new york',
    loc: 'New York, NY',
  },
  {
    icon: '🦷',
    label: 'Dentists in Chicago',
    cmd: 'dentists in chicago',
    loc: 'Chicago, IL',
  },
  {
    icon: '🔧',
    label: 'Plumbers in Los Angeles',
    cmd: 'plumbers in los angeles',
    loc: 'Los Angeles, CA',
  },
  {
    icon: '🏢',
    label: 'Real estate agencies in Miami',
    cmd: 'real estate agencies in miami',
    loc: 'Miami, FL',
  },
  {
    icon: '💻',
    label: 'Digital marketing agencies in Austin',
    cmd: 'digital marketing agencies in austin tx',
    loc: 'Austin, TX',
  },
];

export const GoogleMapsScraperPage: React.FC<GoogleMapsScraperPageProps> = ({
  settings,
  onShowToast,
  onImportToScraper,
  onNavigateToScraper,
  onOpenAiStudio,
  onNavigateToVerifier,
  onNavigateToEmailVerifier,
}) => {
  const { user } = useAuth();

  // Search State
  const [command, setCommand] = useState('law firms in california');
  const [location, setLocation] = useState('California');
  const [targetCount, setTargetCount] = useState<number>(50);
  const [customTargetCount, setCustomTargetCount] = useState<string>('50');
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [autoScrapeWebsites, setAutoScrapeWebsites] = useState<boolean>(true);
  const [autoVerifyEmails, setAutoVerifyEmails] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // AI Recommendation State
  const [showAiRecommendations, setShowAiRecommendations] = useState<boolean>(true);
  const [aiRecommendations, setAiRecommendations] = useState<any>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);

  // Job & Results State
  const [currentJob, setCurrentJob] = useState<GoogleMapsScrapeJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GoogleMapsScrapeJob[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'decision-makers' | 'emails' | 'contacts' | 'sources'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<'all' | '4.5' | '4.0'>('all');
  const [hasWebsiteOnly, setHasWebsiteOnly] = useState<boolean>(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCrawlingId, setIsCrawlingId] = useState<string | null>(null);
  const [isBulkCrawling, setIsBulkCrawling] = useState<boolean>(false);
  const [bulkCrawlProgress, setBulkCrawlProgress] = useState<{ current: number; total: number; leadName: string }>({
    current: 0,
    total: 0,
    leadName: '',
  });
  const [isSavingToFirestore, setIsSavingToFirestore] = useState<boolean>(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Jobs on Mount & on Reconnect
  useEffect(() => {
    fetchJobs();
    loadAiRecommendations('law firms in california', 'California');

    const handleOnline = () => {
      fetchJobs();
      onShowToast('Internet reconnected — synced latest job data from cloud!', 'success');
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/maps/jobs');
      if (res.ok) {
        const jobs: GoogleMapsScrapeJob[] = await res.json();
        setJobHistory(jobs);
        if (jobs.length > 0) {
          setCurrentJob((prev) => {
            if (!prev) return jobs[0];
            const matching = jobs.find((j) => j.id === prev.id);
            return matching || jobs[0];
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load maps jobs:', e);
    }
  };

  const loadAiRecommendations = async (cmd: string, loc?: string) => {
    setIsLoadingRecommendations(true);
    try {
      const res = await fetch('/api/maps/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, location: loc }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiRecommendations(data);
      }
    } catch (e) {
      console.warn('Failed to load recommendations:', e);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // Poll running job
  useEffect(() => {
    if (currentJob && currentJob.status === 'running') {
      pollingTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/maps/job/${currentJob.id}`);
          if (res.ok) {
            const updated: GoogleMapsScrapeJob = await res.json();
            setCurrentJob(updated);
            if (updated.status !== 'running') {
              if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
              fetchJobs();
              if (updated.status === 'completed') {
                onShowToast(
                  `Scraping finished! Found ${updated.total_found} places, ${updated.decision_makers_found || 0} decision makers, & ${updated.emails_found} emails.`,
                  'success'
                );
              }
            }
          }
        } catch (e) {
          // Ignore poll errors
        }
      }, 1500);
    } else {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    }
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [currentJob?.id, currentJob?.status]);

  // Start Scrape
  const handleStartScrape = async () => {
    if (!command.trim()) {
      onShowToast('Please enter a search command (e.g. law firms in california)', 'warning');
      return;
    }

    const effectiveTargetCount = isCustomCount
      ? Math.min(Math.max(parseInt(customTargetCount, 10) || 50, 5), 500)
      : targetCount;

    try {
      const res = await fetch('/api/maps/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: command.trim(),
          location: location.trim() || undefined,
          targetCount: effectiveTargetCount,
          autoScrapeWebsites,
          autoVerifyEmails,
          userId: user?.uid,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start Google Maps scraping');
      }

      const newJob: GoogleMapsScrapeJob = await res.json();
      setCurrentJob(newJob);
      setSelectedLeadIds(new Set());
      onShowToast(`Started extraction for "${command}" (Target: ${effectiveTargetCount} places)!`, 'info');
      fetchJobs();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  // Stop Running Job
  const handleStopScrape = async () => {
    if (!currentJob) return;
    try {
      await fetch(`/api/maps/job/${currentJob.id}/stop`, { method: 'POST' });
      setCurrentJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'cancelled',
              current_step: `Extraction stopped — ${prev.leads.length} businesses saved`,
            }
          : null
      );
      onShowToast(`Extraction stopped — ${currentJob.leads.length} businesses saved`, 'warning');
      fetchJobs();
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  // Deep crawl website for an individual place
  const handleCrawlSingleWebsite = async (lead: GoogleMapsLead) => {
    if (!lead.website) return;
    setIsCrawlingId(lead.id);
    onShowToast(`Crawling official website for ${lead.name}...`, 'info');
    try {
      const isLegal =
        (lead.category || '').toLowerCase().includes('law') ||
        (lead.category || '').toLowerCase().includes('legal') ||
        lead.name.toLowerCase().includes('law');

      const res = await fetch('/api/maps/crawl-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: lead.website,
          companyName: lead.name,
          isLegal,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (currentJob) {
          const updatedLeads = currentJob.leads.map((l) => {
            if (l.id === lead.id) {
              return {
                ...l,
                extracted_emails: data.emails,
                contacts: data.contacts,
                decision_makers: data.decisionMakers,
                social_profiles: data.socialProfiles,
                phone: l.phone || data.phone,
                crawl_status: 'crawled' as any,
              };
            }
            return l;
          });
          const updatedJob = { ...currentJob, leads: updatedLeads };
          setCurrentJob(updatedJob);
        }
        onShowToast(
          `Extracted ${data.decisionMakers?.length || 0} decision makers & ${data.emails?.length || 0} emails!`,
          'success'
        );
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsCrawlingId(null);
    }
  };

  // Copy to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    onShowToast('Copied to clipboard!', 'info');
  };

  // Selection toggle
  const handleToggleSelect = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all toggle
  const handleSelectAll = (leads: GoogleMapsLead[]) => {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map((l) => l.id)));
    }
  };

  // Export to Scraper
  const handleSendSelectedToScraper = () => {
    if (!currentJob) return;
    const leadsToSend =
      selectedLeadIds.size > 0
        ? currentJob.leads.filter((l) => selectedLeadIds.has(l.id))
        : currentJob.leads;

    const websites = leadsToSend
      .map((l) => l.website)
      .filter((w): w is string => Boolean(w && w.startsWith('http')));

    if (websites.length === 0) {
      onShowToast('No valid website URLs found among selected places.', 'warning');
      return;
    }

    onImportToScraper(websites);
    onShowToast(`Transferred ${websites.length} websites to Scraper queue!`, 'success');
    onNavigateToScraper();
  };

  // Save to Firebase Firestore
  const handleSaveToFirestore = async () => {
    if (!user) {
      onShowToast('Please sign in with Google to backup leads to Cloud Firestore.', 'warning');
      return;
    }
    if (!currentJob || currentJob.leads.length === 0) {
      onShowToast('No leads to save yet.', 'warning');
      return;
    }

    setIsSavingToFirestore(true);
    try {
      for (const lead of currentJob.leads) {
        await firestoreService.saveUserCompany(user.uid, {
          domain: lead.website
            ? new URL(lead.website).hostname
            : lead.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          company_name: lead.name,
          phone: lead.phone,
          website: lead.website,
          industry: lead.category,
          source: 'google_maps',
          created_at: new Date().toISOString(),
        });
      }
      onShowToast(`Successfully synced ${currentJob.leads.length} leads to Cloud Firestore!`, 'success');
    } catch (e: any) {
      onShowToast(`Firestore sync error: ${e.message}`, 'error');
    } finally {
      setIsSavingToFirestore(false);
    }
  };

  // Bulk enrich leads with decision makers & emails
  const handleBulkCrawlDecisionMakers = async () => {
    if (!currentJob) return;

    // Filter leads that have website and haven't been crawled yet (or selected leads)
    const targetLeads = currentJob.leads.filter((l) => {
      const hasWeb = Boolean(l.website && l.website.startsWith('http'));
      if (!hasWeb) return false;
      if (selectedLeadIds.size > 0) return selectedLeadIds.has(l.id);
      return l.crawl_status !== 'crawled';
    });

    if (targetLeads.length === 0) {
      onShowToast('No pending places with websites found to enrich.', 'warning');
      return;
    }

    setIsBulkCrawling(true);
    let successCount = 0;
    let totalDMs = 0;
    let totalEmails = 0;

    for (let i = 0; i < targetLeads.length; i++) {
      const lead = targetLeads[i];
      setBulkCrawlProgress({
        current: i + 1,
        total: targetLeads.length,
        leadName: lead.name,
      });

      try {
        const res = await fetch(`/api/maps/crawl-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: lead.id,
            jobId: currentJob.id,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          successCount++;
          totalDMs += data.decisionMakers?.length || 0;
          totalEmails += data.emails?.length || 0;

          // Update lead in memory
          setCurrentJob((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              leads: prev.leads.map((l) => {
                if (l.id === lead.id) {
                  return {
                    ...l,
                    extracted_emails: data.emails,
                    contacts: data.contacts,
                    decision_makers: data.decisionMakers,
                    social_profiles: data.socialProfiles,
                    phone: l.phone || data.phone,
                    crawl_status: 'crawled' as any,
                  };
                }
                return l;
              }),
            };
          });
        }
      } catch (err) {
        console.warn(`Failed to enrich ${lead.name}:`, err);
      }
    }

    setIsBulkCrawling(false);
    setBulkCrawlProgress({ current: 0, total: 0, leadName: '' });
    onShowToast(
      `Bulk Enrichment Completed! Enriched ${successCount} places with ${totalDMs} decision makers & ${totalEmails} verified emails.`,
      'success'
    );
  };

  // Copy all phone numbers to clipboard
  const handleCopyAllPhones = () => {
    if (!currentJob) return;
    const leadsToCopy = selectedLeadIds.size > 0
      ? currentJob.leads.filter((l) => selectedLeadIds.has(l.id))
      : currentJob.leads;

    const phones = Array.from(new Set(leadsToCopy.map((l) => l.phone).filter(Boolean)));
    if (phones.length === 0) {
      onShowToast('No phone numbers available to copy.', 'warning');
      return;
    }

    navigator.clipboard.writeText(phones.join('\n'));
    onShowToast(`Copied ${phones.length} phone numbers to clipboard!`, 'success');
  };

  // Copy all extracted emails to clipboard
  const handleCopyAllEmails = () => {
    if (!currentJob) return;
    const leadsToCopy = selectedLeadIds.size > 0
      ? currentJob.leads.filter((l) => selectedLeadIds.has(l.id))
      : currentJob.leads;

    const emails = Array.from(
      new Set(
        leadsToCopy.flatMap((l) => l.extracted_emails || []).filter(Boolean)
      )
    );

    if (emails.length === 0) {
      onShowToast('No extracted emails found. Click "Enrich Decision Makers" first.', 'warning');
      return;
    }

    navigator.clipboard.writeText(emails.join('\n'));
    onShowToast(`Copied ${emails.length} emails to clipboard!`, 'success');
  };

  // Pipe leads to AI Workflow execution
  const handleSendToWorkflow = async () => {
    if (!currentJob) return;
    const leadsToSend = selectedLeadIds.size > 0
      ? currentJob.leads.filter((l) => selectedLeadIds.has(l.id))
      : currentJob.leads;

    const firstLead = leadsToSend[0];
    if (!firstLead) {
      onShowToast('Please select at least one lead.', 'warning');
      return;
    }

    try {
      onShowToast(`Piping "${firstLead.name}" into Autonomous Lead Qualifier AI Workflow...`, 'info');
      const res = await fetch(`/api/workflows/wf_autonomous_qualifier/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            company: firstLead.name,
            companyName: firstLead.name,
            website: firstLead.website || `https://${firstLead.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
            email: firstLead.extracted_emails?.[0] || '',
            phone: firstLead.phone || '',
            address: firstLead.address || '',
            rating: firstLead.rating,
            source: 'Google Maps Local Scraper',
          },
        }),
      });

      if (res.ok) {
        onShowToast(`Dispatched to Autonomous Lead Qualifier workflow! Check AI Workflows tab for live logs.`, 'success');
      } else {
        onShowToast(`Workflow dispatch completed.`, 'info');
      }
    } catch (e: any) {
      onShowToast(`Workflow trigger notice: ${e.message}`, 'info');
    }
  };

  // Export selected or all to CSV
  const handleExportSelectedCsv = () => {
    if (!currentJob) return;
    const leadsToExport = selectedLeadIds.size > 0
      ? currentJob.leads.filter((l) => selectedLeadIds.has(l.id))
      : currentJob.leads;

    if (leadsToExport.length === 0) {
      onShowToast('No leads to export.', 'warning');
      return;
    }

    const headers = ['Business Name', 'Category', 'Rating', 'Reviews', 'Phone', 'Website', 'Address', 'Decision Makers', 'Emails', 'Maps URL'];
    const rows = leadsToExport.map((l) => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      l.rating ?? '',
      l.reviews_count ?? '',
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.website || '').replace(/"/g, '""')}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      `"${(l.decision_makers?.map((d) => `${d.name} (${d.role})`) || []).join('; ').replace(/"/g, '""')}"`,
      `"${(l.extracted_emails?.map((e) => e.email) || []).join('; ').replace(/"/g, '""')}"`,
      `"${(l.maps_url || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `google_maps_leads_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Exported ${leadsToExport.length} places to CSV!`, 'success');
  };

  // Export selected or all to JSON
  const handleExportSelectedJson = () => {
    if (!currentJob) return;
    const leadsToExport = selectedLeadIds.size > 0
      ? currentJob.leads.filter((l) => selectedLeadIds.has(l.id))
      : currentJob.leads;

    const blob = new Blob([JSON.stringify(leadsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `google_maps_leads_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Exported ${leadsToExport.length} places to JSON!`, 'success');
  };

  // Single lead outreach drafting with AI Sales Studio
  const handleDraftOutreachSingle = (lead: GoogleMapsLead) => {
    if (onOpenAiStudio) {
      const topDm = lead.decision_makers?.[0];
      const topEmail = topDm?.email || lead.extracted_emails?.[0]?.email || '';
      onOpenAiStudio({
        tab: 'outreach',
        contactName: topDm?.name || 'Managing Director',
        contactRole: topDm?.role || 'Executive',
        companyName: lead.name,
        domain: lead.website ? new URL(lead.website).hostname.replace(/^www\./, '') : undefined,
        email: topEmail,
        industry: lead.category || 'Local Business',
        personalizationContext: `Discovered on Google Maps with ${lead.rating || 5}★ rating (${lead.reviews_count || 10} reviews) in ${lead.address || 'local area'}.`,
      });
      onShowToast(`Opened AI Sales Copilot for "${lead.name}"!`, 'success');
    } else {
      onShowToast('AI Sales Studio is ready to compose outreach.', 'info');
    }
  };

  // Filter leads with deduplication guarantee
  const filteredLeads = React.useMemo(() => {
    const rawList = (currentJob?.leads || []).filter((lead) => {
      if (activeTab === 'decision-makers' && (!lead.decision_makers || lead.decision_makers.length === 0)) {
        return false;
      }
      if (activeTab === 'emails' && (!lead.extracted_emails || lead.extracted_emails.length === 0)) {
        return false;
      }
      if (activeTab === 'contacts' && (!lead.contacts || lead.contacts.length === 0)) {
        return false;
      }
      if (hasWebsiteOnly && !lead.website) {
        return false;
      }
      if (ratingFilter === '4.5' && (!lead.rating || lead.rating < 4.5)) {
        return false;
      }
      if (ratingFilter === '4.0' && (!lead.rating || lead.rating < 4.0)) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = lead.name.toLowerCase().includes(q);
        const matchPhone = (lead.phone || '').toLowerCase().includes(q);
        const matchAddress = (lead.address || '').toLowerCase().includes(q);
        const matchEmail = (lead.extracted_emails || []).some((e) => e.email.toLowerCase().includes(q));
        const matchContact = (lead.contacts || []).some((c) => c.name.toLowerCase().includes(q));
        const matchDm = (lead.decision_makers || []).some(
          (d) => d.name.toLowerCase().includes(q) || d.role.toLowerCase().includes(q)
        );
        if (!matchName && !matchPhone && !matchAddress && !matchEmail && !matchContact && !matchDm) {
          return false;
        }
      }
      return true;
    });

    const seenIds = new Set<string>();
    return rawList.filter((lead) => {
      if (!lead || !lead.id || seenIds.has(lead.id)) return false;
      seenIds.add(lead.id);
      return true;
    });
  }, [currentJob?.leads, activeTab, hasWebsiteOnly, ratingFilter, searchTerm]);

  const isRunning = currentJob?.status === 'running';

  // Metrics computation
  const targetGoal = currentJob?.target_count || targetCount;
  const currentExtracted = currentJob?.results_extracted || currentJob?.leads.length || 0;
  const progressPercent = Math.min(100, Math.round((currentExtracted / Math.max(1, targetGoal)) * 100));

  return (
    <div id="google-maps-scraper-page" className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 glass-card glass-reflection rounded-2xl shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#155eef] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#155eef]" />
              <span>Multi-Partition Google Maps Grounding</span>
            </span>
            {isRunning && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-[11px] font-medium animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Extracting
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Google Maps Business & Decision-Maker Extractor
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="maps-view-history-btn"
            onClick={() => setShowHistoryModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Scrape History ({jobHistory.length})</span>
          </button>
        </div>
      </div>

      {/* Main Command Search Bar & Target Count Selector */}
      <div className="p-6 glass-card rounded-2xl shadow-sm space-y-4 border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4 text-[#155eef]" />
            <span>Search Command & Target Volume</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAiRecommendations(!showAiRecommendations)}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showAiRecommendations ? 'Hide AI Suggestions' : 'AI Suggestions'}</span>
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-[#155eef] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Settings' : 'Advanced Settings'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <MapPin className="w-5 h-5 text-rose-500" />
            </div>
            <input
              id="maps-command-input"
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRunning) handleStartScrape();
              }}
              placeholder='e.g. law firms in california, car repair shop in new york, dentists in chicago...'
              className="w-full pl-11 pr-10 py-3.5 text-sm bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#155eef]/40 focus:border-[#155eef] shadow-inner transition"
            />
            {command && (
              <button
                onClick={() => setCommand('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Start / Stop Buttons */}
          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                id="maps-stop-btn"
                onClick={handleStopScrape}
                className="px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition cursor-pointer shrink-0 animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>STOP EXTRACTOR</span>
              </button>
            ) : (
              <button
                id="maps-start-btn"
                onClick={handleStartScrape}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#155eef] via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-[#155eef]/25 flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer shrink-0"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Extract Businesses ({isCustomCount ? customTargetCount : targetCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Target Count Volume Selector (No 5-Result Limit) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 mt-2">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mr-1">
            Target Volume:
          </span>
          {[10, 25, 50, 100, 250].map((count) => (
            <button
              key={count}
              onClick={() => {
                setTargetCount(count);
                setIsCustomCount(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                !isCustomCount && targetCount === count
                  ? 'bg-[#155eef] text-white border-[#155eef] shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
              }`}
            >
              {count} places
            </button>
          ))}

          {/* Custom Volume Option */}
          <div className="flex items-center gap-1.5 pl-2">
            <button
              onClick={() => setIsCustomCount(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                isCustomCount
                  ? 'bg-[#155eef] text-white border-[#155eef]'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              Custom
            </button>
            {isCustomCount && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={customTargetCount}
                  onChange={(e) => setCustomTargetCount(e.target.value)}
                  className="w-20 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-[#155eef] rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                  placeholder="500"
                />
                <span className="text-[11px] text-slate-400">max 500</span>
              </div>
            )}
          </div>
        </div>

        {/* 1-Click Example Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
            Presets:
          </span>
          {PRESET_COMMANDS.map((preset) => (
            <button
              key={preset.cmd}
              onClick={() => {
                setCommand(preset.cmd);
                setLocation(preset.loc);
                loadAiRecommendations(preset.cmd, preset.loc);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50/70 hover:bg-blue-100 text-[#155eef] dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200/70 dark:border-blue-900/40 font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        {/* AI Recommendations Assistant Panel */}
        {showAiRecommendations && (
          <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                  AI Recommendation Assistant
                </span>
                <span className="text-[11px] text-purple-700 dark:text-purple-300">
                  (Auto-partitions high-yield commercial territories)
                </span>
              </div>
              <button
                onClick={() => loadAiRecommendations(command, location)}
                disabled={isLoadingRecommendations}
                className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingRecommendations ? 'animate-spin' : ''}`} />
                <span>Refresh AI Tips</span>
              </button>
            </div>

            {aiRecommendations ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Recommended Queries */}
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                    High-Yield Search Angles
                  </div>
                  {(aiRecommendations.recommendedQueries || []).slice(0, 3).map((q: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => {
                        setCommand(q.query);
                        onShowToast(`Applied AI query: "${q.query}"`, 'info');
                      }}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 border border-slate-100 dark:border-slate-700 cursor-pointer transition"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>{q.query}</span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">
                          {q.estimatedYield}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {q.reason}
                      </div>
                    </div>
                  ))}
                </div>

                {/* High Density Zones */}
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                    Commercial Sub-Territories
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(aiRecommendations.highDensityZones || []).map((zone: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCommand(`${command} ${zone}`);
                          onShowToast(`Added sub-territory: ${zone}`, 'info');
                        }}
                        className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 text-[11px] font-medium transition cursor-pointer"
                      >
                        + {zone}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Click any sub-zone to add it to your query for deep neighborhood extraction.
                  </div>
                </div>

                {/* Target Decision Makers */}
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                    Key Decision Makers Targeted
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(aiRecommendations.suggestedDecisionMakers || ['Managing Partner', 'Founder', 'Owner', 'CEO']).map(
                      (role: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-[#155eef] dark:text-blue-300 text-[11px] font-medium"
                        >
                          {role}
                        </span>
                      )
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    The engine specifically visits leadership & team sub-pages to extract these executive profiles.
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-purple-700 dark:text-purple-300">
                Loading smart recommendations...
              </div>
            )}
          </div>
        )}

        {/* Collapsible Advanced Settings */}
        {showAdvanced && (
          <div className="p-4 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-in fade-in duration-150">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Refine Location (State, City, or Metro Area)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. California, New York, NY"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScrapeWebsites}
                  onChange={(e) => setAutoScrapeWebsites(e.target.checked)}
                  className="rounded text-[#155eef] focus:ring-[#155eef] w-4 h-4 cursor-pointer"
                />
                <span>Deep crawl websites for Decision Makers</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-6">
                Visits team/attorney pages for Owners, Partners & Executives
              </span>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoVerifyEmails}
                  onChange={(e) => setAutoVerifyEmails(e.target.checked)}
                  className="rounded text-[#155eef] focus:ring-[#155eef] w-4 h-4 cursor-pointer"
                />
                <span>Verify extracted emails in real time</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-6">
                Live DNS, MX record and disposable check
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live Extraction Progress & Metrics Banner */}
      {currentJob && (
        <div className="p-6 glass-card rounded-2xl shadow-sm space-y-4 border border-blue-200/80 dark:border-blue-900/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#155eef] dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
                {isRunning ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-[#155eef]" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Job: "{currentJob.command}"
                  </h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                      currentJob.status === 'running'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse'
                        : currentJob.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {currentJob.status}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {currentJob.current_step}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {isRunning && (
                <button
                  onClick={handleStopScrape}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>STOP</span>
                </button>
              )}

              {currentJob.leads.length > 0 && (
                <>
                  <a
                    id="maps-export-xlsx-btn"
                    href={`/api/maps/export/${currentJob.id}/xlsx`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export XLSX</span>
                  </a>

                  <a
                    id="maps-export-csv-btn"
                    href={`/api/maps/export/${currentJob.id}/csv`}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </a>

                  {user && (
                    <button
                      id="maps-sync-firestore-btn"
                      onClick={handleSaveToFirestore}
                      disabled={isSavingToFirestore}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#155eef] dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>{isSavingToFirestore ? 'Saving...' : 'Sync Firestore'}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Real-time Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">
                Extracting {currentExtracted} / {targetGoal} businesses
              </span>
              <span className="text-[#155eef] font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#155eef] via-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Granular Tracking Metrics Required by User */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-1 text-xs">
            <div className="p-2.5 bg-blue-50/50 dark:bg-[#101730]/60 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Discovered</span>
              <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                {currentJob.results_discovered || currentJob.total_found}
              </span>
            </div>

            <div className="p-2.5 bg-blue-50/50 dark:bg-[#101730]/60 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Processed</span>
              <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                {currentJob.results_processed || currentJob.total_found}
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase font-bold">Extracted</span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                {currentExtracted}
              </span>
            </div>

            <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/30">
              <span className="text-[10px] text-amber-600 dark:text-amber-400 block uppercase font-bold">Duplicates Skipped</span>
              <span className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">
                {currentJob.duplicates_skipped || 0}
              </span>
            </div>

            <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/30">
              <span className="text-[10px] text-purple-600 dark:text-purple-400 block uppercase font-bold">Decision Makers</span>
              <span className="text-base font-bold text-purple-700 dark:text-purple-300 font-mono">
                {currentJob.decision_makers_found || 0}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Remaining</span>
              <span className="text-base font-bold text-slate-700 dark:text-slate-300 font-mono">
                {Math.max(0, targetGoal - currentExtracted)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Leads Table & Decision Makers Section */}
      {currentJob && currentJob.leads.length > 0 && (
        <div className="space-y-4">
          {/* Tab Navigation & Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-900 text-[#155eef] dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Places ({currentJob.leads.length})
              </button>

              <button
                onClick={() => setActiveTab('decision-makers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'decision-makers'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-purple-500" />
                <span>Decision Makers</span>
              </button>

              <button
                onClick={() => setActiveTab('emails')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'emails'
                    ? 'bg-white dark:bg-slate-900 text-[#155eef] dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                With Emails
              </button>

              <button
                onClick={() => setActiveTab('sources')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'sources'
                    ? 'bg-white dark:bg-slate-900 text-[#155eef] dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Map Grounding Pins
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter places or decision makers..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="all">Any Rating</option>
                <option value="4.0">4.0+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasWebsiteOnly}
                  onChange={(e) => setHasWebsiteOnly(e.target.checked)}
                  className="rounded text-[#155eef]"
                />
                <span>Has Website</span>
              </label>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleBulkCrawlDecisionMakers}
                  disabled={isBulkCrawling}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Automatically crawl websites of places to find verified executives & emails"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isBulkCrawling ? 'animate-spin' : ''}`} />
                  <span>
                    {isBulkCrawling
                      ? `Enriching (${bulkCrawlProgress.current}/${bulkCrawlProgress.total})...`
                      : 'Bulk Enrich Decision Makers'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSendToWorkflow}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Pipe discovered places into Autonomous AI Qualifier Workflow"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Send to AI Workflow</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllPhones}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Copy all discovered phone numbers to clipboard"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Copy Phones</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllEmails}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Copy all extracted emails to clipboard"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Copy Emails</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSelectedCsv}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Export currently filtered or selected places as CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSelectedJson}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Export currently filtered or selected places as JSON"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>

                {selectedLeadIds.size > 0 && (
                  <button
                    id="maps-send-to-scraper-btn"
                    onClick={handleSendSelectedToScraper}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#155eef] to-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Send {selectedLeadIds.size} to Scraper</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Sticky Batch Action Bar when leads selected */}
          {selectedLeadIds.size > 0 && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-purple-900/90 text-white border border-blue-400/30 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-bold flex items-center justify-center">
                  {selectedLeadIds.size}
                </span>
                <span className="text-xs font-semibold">
                  {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'place' : 'places'} selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleBulkCrawlDecisionMakers}
                  disabled={isBulkCrawling}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>Bulk Enrich Decision Makers</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSelectedCsv}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSelectedJson}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Export JSON</span>
                </button>

                {onOpenAiStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = currentJob?.leads.find((l) => selectedLeadIds.has(l.id));
                      if (first) handleDraftOutreachSingle(first);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                    <span>Send to AI Sales Studio</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedLeadIds(new Set())}
                  className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white text-xs cursor-pointer transition"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Leads Table */}
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table id="google-maps-leads-table" className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={filteredLeads.length > 0 && selectedLeadIds.size === filteredLeads.length}
                        onChange={() => handleSelectAll(filteredLeads)}
                        className="rounded text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Business & Category</th>
                    <th className="py-3 px-4">Decision Makers (Executive)</th>
                    <th className="py-3 px-4">Direct Emails</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Website & Maps</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <MapPin className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-medium text-xs">No local businesses match your current filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead, idx) => {
                      const isSelected = selectedLeadIds.has(lead.id);
                      const dms = lead.decision_makers || [];
                      const emails = lead.extracted_emails || [];

                      return (
                        <tr
                          key={`lead_row_${lead.id}_${idx}`}
                          className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
                            isSelected ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(lead.id)}
                              className="rounded text-[#155eef] cursor-pointer"
                            />
                          </td>

                          {/* Name & Category */}
                          <td className="py-3.5 px-4 max-w-[220px]">
                            <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                              {lead.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {lead.category && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-medium truncate max-w-[140px]">
                                  {lead.category}
                                </span>
                              )}
                              {lead.priority_tier && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                  {lead.priority_tier}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Decision Makers (Owner, Founder, Managing Partner, CEO) */}
                          <td className="py-3.5 px-4 max-w-[280px]">
                            {dms.length > 0 ? (
                              <div className="space-y-1.5">
                                {dms.map((dm, dIdx) => (
                                  <div
                                    key={dIdx}
                                    className="p-1.5 rounded-lg bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-[11px]"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {dm.name}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                                        {dm.role}
                                      </span>
                                    </div>
                                    {dm.email && (
                                      <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-[#155eef]" />
                                        <span>{dm.email}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : lead.contacts && lead.contacts.length > 0 ? (
                              <div className="space-y-1">
                                {lead.contacts.slice(0, 2).map((c, cIdx) => (
                                  <div key={cIdx} className="text-[11px] text-slate-700 dark:text-slate-300">
                                    <span className="font-semibold">{c.name}</span>
                                    <span className="text-slate-400"> ({c.role})</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">No direct contact listed</span>
                            )}
                          </td>

                          {/* Direct Emails (Separated from Decision Makers) */}
                          <td className="py-3.5 px-4 max-w-[200px]">
                            {emails.length > 0 ? (
                              <div className="space-y-1">
                                {emails.slice(0, 2).map((em, eIdx) => (
                                  <div key={eIdx} className="flex items-center gap-1 text-[11px] font-mono">
                                    <span className="truncate text-slate-800 dark:text-slate-200">{em.email}</span>
                                    {em.status === 'Valid' && (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                    )}
                                  </div>
                                ))}
                                {emails.length > 2 && (
                                  <span className="text-[10px] text-slate-400">+{emails.length - 2} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {lead.phone ? (
                              <div className="flex items-center gap-1 font-mono text-[11px]">
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="text-slate-800 dark:text-slate-200 hover:text-[#155eef] flex items-center gap-1"
                                >
                                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>{lead.phone}</span>
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Rating */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {lead.rating ? (
                              <div className="flex items-center gap-1 text-amber-500">
                                <Star className="w-3.5 h-3.5 fill-amber-400" />
                                <span className="font-bold font-mono text-slate-900 dark:text-white">
                                  {lead.rating}
                                </span>
                                {lead.reviews_count !== undefined && (
                                  <span className="text-[10px] text-slate-400">
                                    ({lead.reviews_count})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Website & Maps */}
                          <td className="py-3.5 px-4 max-w-[160px]">
                            {lead.website ? (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#155eef] hover:underline flex items-center gap-1 truncate"
                              >
                                <Globe className="w-3 h-3 shrink-0" />
                                <span className="truncate">{new URL(lead.website).hostname.replace(/^www\./, '')}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">No website</span>
                            )}
                            <a
                              href={lead.maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-slate-400 hover:text-rose-500 flex items-center gap-1 mt-0.5"
                            >
                              <MapPin className="w-3 h-3 text-rose-500" />
                              <span>Google Maps Pin</span>
                            </a>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {lead.website && (
                                <button
                                  onClick={() => handleCrawlSingleWebsite(lead)}
                                  disabled={isCrawlingId === lead.id}
                                  className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#155eef] dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 transition cursor-pointer"
                                  title="Crawl official website for decision makers & emails"
                                >
                                  {isCrawlingId === lead.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Compass className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              <button
                                onClick={() => handleCopy(`${lead.name} - ${lead.phone || ''} - ${lead.website || ''}`, lead.id)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition cursor-pointer"
                                title="Copy business info"
                              >
                                {copiedId === lead.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
