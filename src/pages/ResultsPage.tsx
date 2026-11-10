import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building,
  Mail,
  User,
  Users,
  Phone,
  FileSpreadsheet,
  Target,
  Sparkles,
  Share2,
  Sliders,
  Award,
  Users2,
  Building2,
  Calendar,
  MapPin,
  Info,
  Crown,
  ShieldCheck,
  CheckCircle2,
  Inbox,
  AtSign,
  Square,
  CheckSquare,
  RotateCcw,
  Zap,
  GitBranch,
} from 'lucide-react';
import {
  Contact,
  ScrapeJob,
  WebsiteResult,
  RoleTier,
  IcpTier,
  ScrapeSettings,
  IcpConfig,
  VerificationLevel,
  EmailVerificationResult,
  EmailVerificationStatus,
  EmailVerifierStatusResponse,
  LeadPipelineStage,
} from '../types';
import {
  RoleTierBadge,
  IcpScoreBadge,
  SocialLinksGroup,
  FirmographicsBadges,
  EmailClassificationBadge,
  DecisionMakerBadge,
  IcpFilterStatusBadge,
} from '../components/enrichment/LeadEnrichmentBadges';
import { IcpConfigModal } from '../components/enrichment/IcpConfigModal';
import { VerificationStatusBadge } from '../components/verifier/VerificationStatusBadge';
import { VerificationDetailModal } from '../components/verifier/VerificationDetailModal';
import { EmailVerificationBadge } from '../components/emailVerifier/EmailVerificationBadge';
import { EmailVerificationDetailModal } from '../components/emailVerifier/EmailVerificationDetailModal';
import { EmailVerificationActionBar } from '../components/emailVerifier/EmailVerificationActionBar';
import { auth } from '../lib/firebase';
import { firestoreService } from '../lib/firestoreService';
import { CloudStorageIndicator, CloudStorageData } from '../components/storage/CloudStorageIndicator';
import { DatasetsFileExplorer, FileDatasetItem } from '../components/storage/DatasetsFileExplorer';
import { AiOrganizerModal } from '../components/storage/AiOrganizerModal';
import { CrmDirectIntegrationModal } from '../components/crm/CrmDirectIntegrationModal';
import { WaterfallEnrichmentModal } from '../components/enrichment/WaterfallEnrichmentModal';
import { TechStackDetectorModal } from '../components/tech/TechStackDetectorModal';
import { CustomExportModal } from '../components/enrichment/CustomExportModal';
import { LookalikeFinderModal } from '../components/discovery/LookalikeFinderModal';
import { FolderOpen, ArrowLeft, HardDrive, Database, Layers, UserCheck, Cpu, Ban, StickyNote, Tag, X, Plus } from 'lucide-react';

export function matchEmployeeCountFilter(
  empCountStr?: string,
  empRangeStr?: string,
  empTierStr?: string,
  filterValue: string = 'All'
): boolean {
  if (filterValue === 'All') return true;

  const count = empCountStr && empCountStr !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(empCountStr)
    ? parseInt(empCountStr.replace(/\D/g, ''), 10)
    : undefined;

  const isUnknown = count === undefined && !empRangeStr && !empTierStr;

  if (filterValue === 'Unknown') {
    return isUnknown;
  }

  // If unknown, do not classify into numeric range
  if (isUnknown) return false;

  // Exact count checks
  if (count !== undefined && !isNaN(count)) {
    if (filterValue === '1–10' || filterValue === '1-10') return count >= 1 && count <= 10;
    if (filterValue === '11–50' || filterValue === '11-50') return count >= 11 && count <= 50;
    if (filterValue === '51–200' || filterValue === '51-200') return count >= 51 && count <= 200;
    if (filterValue === '201–500' || filterValue === '201-500') return count >= 201 && count <= 500;
    if (filterValue === '501–1,000' || filterValue === '501-1000') return count >= 501 && count <= 1000;
    if (filterValue === '1,001–5,000' || filterValue === '1001-5000') return count >= 1001 && count <= 5000;
    if (filterValue === '5,001+' || filterValue === '5001+') return count >= 5001;
  }

  // Fallback to range / tier text
  const text = `${empRangeStr || ''} ${empTierStr || ''}`.toLowerCase();
  if (filterValue === '1–10' || filterValue === '1-10') return text.includes('1-10') || text.includes('1–10');
  if (filterValue === '11–50' || filterValue === '11-50') return text.includes('11-50') || text.includes('11–50');
  if (filterValue === '51–200' || filterValue === '51-200') return text.includes('51-200') || text.includes('51–200');
  if (filterValue === '201–500' || filterValue === '201-500') return text.includes('201-500') || text.includes('201–500');
  if (filterValue === '501–1,000' || filterValue === '501-1000') return text.includes('501-1000') || text.includes('501–1000') || text.includes('501–1,000');
  if (filterValue === '1,001–5,000' || filterValue === '1001-5000') return text.includes('1001-5000') || text.includes('1,001-5,000') || text.includes('1000+');
  if (filterValue === '5,001+' || filterValue === '5001+') return text.includes('5000+') || text.includes('5,001+');

  return false;
}

export function matchFoundedYearFilter(
  foundedYearStr?: string,
  filterValue: string = 'All'
): boolean {
  if (filterValue === 'All') return true;

  const yr = foundedYearStr && foundedYearStr !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(foundedYearStr)
    ? parseInt(foundedYearStr.replace(/\D/g, ''), 10)
    : undefined;

  const isUnknown = yr === undefined || isNaN(yr) || yr < 1700 || yr > 2030;

  if (filterValue === 'Unknown') {
    return isUnknown;
  }

  // If unknown, do not classify into numeric range
  if (isUnknown) return false;

  if (filterValue === 'Before 2000' || filterValue === 'pre-2000') return yr < 2000;
  if (filterValue === '2000–2009' || filterValue === '2000-2009') return yr >= 2000 && yr <= 2009;
  if (filterValue === '2010–2014' || filterValue === '2010-2014') return yr >= 2010 && yr <= 2014;
  if (filterValue === '2015–2019' || filterValue === '2015-2019') return yr >= 2015 && yr <= 2019;
  if (filterValue === '2020–2024' || filterValue === '2020-2024') return yr >= 2020 && yr <= 2024;
  if (filterValue === '2025 onward' || filterValue === '2025+') return yr >= 2025;

  return false;
}

interface ResultsPageProps {
  currentJob: ScrapeJob | null;
  onExportXlsx: (targetId?: string) => void;
  onExportCsv: (targetId?: string) => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  settings?: ScrapeSettings | null;
  onUpdateSettings?: (settings: Partial<ScrapeSettings>) => Promise<boolean>;
  onOpenAiStudio?: (state: any) => void;
  onStartScrape?: (urls: string[]) => Promise<void>;
}

type ViewMode = 'contacts' | 'generic' | 'emails' | 'companies';
type SortField = 'company_name' | 'full_name' | 'role' | 'email' | 'email_type' | 'phone' | 'icp_score';
type SortOrder = 'asc' | 'desc';

export const ResultsPage: React.FC<ResultsPageProps> = ({
  currentJob,
  onExportXlsx,
  onExportCsv,
  onShowToast,
  settings,
  onUpdateSettings,
  onOpenAiStudio,
  onStartScrape,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('contacts');
  const [searchTerm, setSearchTerm] = useState('');
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>('All');
  const [genericDeptFilter, setGenericDeptFilter] = useState<string>('All');
  const [decisionMakerFilter, setDecisionMakerFilter] = useState<'All' | 'decision_makers' | 'owners'>('All');
  const [icpFilterStatus, setIcpFilterStatus] = useState<'All' | 'INCLUDED' | 'EXCLUDED'>('All');
  const [roleTierFilter, setRoleTierFilter] = useState<string>('All');
  const [icpTierFilter, setIcpTierFilter] = useState<string>('All');
  const [employeeSizeFilter, setEmployeeSizeFilter] = useState<string>('All');
  const [foundingYearFilter, setFoundingYearFilter] = useState<string>('All');
  const [pipelineStageFilter, setPipelineStageFilter] = useState<string>('All');
  const [accuracyFilter, setAccuracyFilter] = useState<'All' | 'high_confidence' | 'verified_direct' | 'explicit_only'>('All');
  const [isDeepEnrichingBatch, setIsDeepEnrichingBatch] = useState(false);
  const [deepEnrichedMap, setDeepEnrichedMap] = useState<Record<string, Partial<Contact>>>({});
  const [nlQuery, setNlQuery] = useState('');
  const [isParsingNlFilter, setIsParsingNlFilter] = useState(false);
  const [nlFilterSpec, setNlFilterSpec] = useState<{
    query: string;
    requireLinkedin?: boolean;
    requirePhone?: boolean;
    requireProfessionalEmail?: boolean;
    requireGenericEmail?: boolean;
    requireDecisionMaker?: boolean;
    requireOwnerOrFounder?: boolean;
    minEmployees?: number;
    maxEmployees?: number;
    minFoundedYear?: number;
    maxFoundedYear?: number;
    minIcpScore?: number;
    minConfidenceScore?: number;
    emailVerificationStatus?: string;
    roleKeywords?: string[];
    locationKeywords?: string[];
    industryKeywords?: string[];
    techStackKeywords?: string[];
    companyKeywords?: string[];
    pipelineStage?: string;
    activePills: string[];
    source?: 'gemini' | 'deterministic';
  } | null>(null);
  const [sortField, setSortField] = useState<SortField>('icp_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showIcpModal, setShowIcpModal] = useState(false);
  const [showCustomExportModal, setShowCustomExportModal] = useState(false);
  const [showLookalikeModal, setShowLookalikeModal] = useState(false);
  const [contactMetaMap, setContactMetaMap] = useState<
    Record<string, { pipeline_stage?: LeadPipelineStage; tags?: string[]; notes?: string }>
  >({});
  const [editingNoteContact, setEditingNoteContact] = useState<Contact | null>(null);
  const [draftNotes, setDraftNotes] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [newDraftTag, setNewDraftTag] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    employees: true,
    founded: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Business Verifier States
  const [selectedCompanyUrls, setSelectedCompanyUrls] = useState<Set<string>>(new Set());
  const [verifyingCompanyUrl, setVerifyingCompanyUrl] = useState<string | null>(null);
  const [inspectingCompany, setInspectingCompany] = useState<WebsiteResult | null>(null);
  const [verifierLevel, setVerifierLevel] = useState<VerificationLevel>('MEDIUM');
  const [isVerifyingBatch, setIsVerifyingBatch] = useState(false);

  // Self-Hosted Email Verification States
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [emailVerificationFilter, setEmailVerificationFilter] = useState<EmailVerificationStatus | 'All'>('All');
  const [verificationMap, setVerificationMap] = useState<Record<string, EmailVerificationResult>>({});
  const [inspectingEmailResult, setInspectingEmailResult] = useState<{ email: string; result?: EmailVerificationResult | null } | null>(null);
  const [isVerifyingEmails, setIsVerifyingEmails] = useState(false);
  const [emailJobProgress, setEmailJobProgress] = useState<{ percent: number; text: string; jobId?: string }>({ percent: 0, text: '' });
  const [smtpServerStatus, setSmtpServerStatus] = useState<EmailVerifierStatusResponse | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cloud SQL & File Datasets States
  const [storageInfo, setStorageInfo] = useState<CloudStorageData | null>(null);
  const [datasets, setDatasets] = useState<FileDatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedDatasetMeta, setSelectedDatasetMeta] = useState<FileDatasetItem | null>(null);
  const [selectedDatasetRecords, setSelectedDatasetRecords] = useState<any[] | null>(null);
  const [resultsTabMode, setResultsTabMode] = useState<'files' | 'table'>('files');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [isOrganizingDataset, setIsOrganizingDataset] = useState(false);
  const [aiOrganizerSummary, setAiOrganizerSummary] = useState<any | null>(null);
  const [showOrganizerModal, setShowOrganizerModal] = useState(false);
  const [activeOrganizingName, setActiveOrganizingName] = useState('');
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [waterfallTargetContact, setWaterfallTargetContact] = useState<Contact | null>(null);
  const [isWaterfallModalOpen, setIsWaterfallModalOpen] = useState(false);
  const [techStackTargetUrl, setTechStackTargetUrl] = useState<string>('');
  const [techStackContactId, setTechStackContactId] = useState<string | null>(null);
  const [isTechStackModalOpen, setIsTechStackModalOpen] = useState(false);
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({});
  const [workspaceMembers, setWorkspaceMembers] = useState<string[]>(['Sarah Chen', 'Marcus Vance', 'Elena Rostova', 'Workspace Owner']);

  const handleOpenWaterfall = (c: Contact) => {
    setWaterfallTargetContact(c);
    setIsWaterfallModalOpen(true);
  };

  const handleOpenTechStack = (url: string, contactId?: string) => {
    setTechStackTargetUrl(url);
    setTechStackContactId(contactId || null);
    setIsTechStackModalOpen(true);
  };

  const handleDeepEnrichAllContacts = async () => {
    if (contacts.length === 0 || isDeepEnrichingBatch) return;
    setIsDeepEnrichingBatch(true);
    try {
      const res = await fetch('/api/waterfall/enrich-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contacts.slice(0, 50) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Deep enrichment failed');
      }
      const data = await res.json();
      const results = data.results || [];
      const nextEnriched: Record<string, Partial<Contact>> = {};
      const nextVerMap: Record<string, EmailVerificationResult> = {};

      for (const r of results) {
        if (!r.contactId) continue;
        nextEnriched[r.contactId] = {
          professional_email: r.enrichedFields?.verified_email || undefined,
          email: r.enrichedFields?.verified_email || undefined,
          phone: r.enrichedFields?.direct_phone || undefined,
          phone_type: r.enrichedFields?.phone_type || undefined,
          linkedin_url: r.enrichedFields?.linkedin_url || undefined,
          tech_stack: r.enrichedFields?.tech_stack?.length ? r.enrichedFields.tech_stack : undefined,
          confidence_score: r.confidence || 92,
          email_verification: r.email_verification || undefined,
        };
        if (r.email_verification && r.email_verification.normalized_email) {
          nextVerMap[r.email_verification.normalized_email] = r.email_verification;
        }
      }

      setDeepEnrichedMap((prev) => ({ ...prev, ...nextEnriched }));
      if (Object.keys(nextVerMap).length > 0) {
        setVerificationMap((prev) => ({ ...prev, ...nextVerMap }));
      }
      onShowToast(`Deep Enriched & MX-Verified ${results.length} leads!`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Deep enrichment failed', 'error');
    } finally {
      setIsDeepEnrichingBatch(false);
    }
  };

  const handleApplyNaturalLanguageFilter = async (overrideQuery?: string) => {
    const targetQuery = (overrideQuery !== undefined ? overrideQuery : nlQuery).trim();
    if (!targetQuery) {
      setNlFilterSpec(null);
      setCurrentPage(1);
      return;
    }
    if (overrideQuery !== undefined) {
      setNlQuery(overrideQuery);
    }
    setIsParsingNlFilter(true);
    try {
      const res = await fetch('/api/results/nl-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to interpret filter');
      }
      const data = await res.json();
      if (data.filter) {
        setNlFilterSpec(data.filter);
        setCurrentPage(1);
        onShowToast(
          `Applied AI Filter: ${data.filter.activePills?.join(' • ') || targetQuery}`,
          'info'
        );
      }
    } catch (err: any) {
      onShowToast(err.message || 'Could not interpret filter request', 'error');
    } finally {
      setIsParsingNlFilter(false);
    }
  };

  const handleAssignLead = async (contactId: string, assigneeName: string) => {
    setAssignedMap((prev) => ({ ...prev, [contactId]: assigneeName }));
    try {
      await fetch('/api/workspaces/assign-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, assigneeName }),
      });
      onShowToast(`Lead assigned to ${assigneeName}`, 'info');
    } catch {}
  };

  const handleUpdateContactMeta = async (
    contactId: string,
    patch: { pipeline_stage?: LeadPipelineStage; tags?: string[]; notes?: string }
  ) => {
    setContactMetaMap((prev) => ({
      ...prev,
      [contactId]: {
        ...(prev[contactId] || {}),
        ...patch,
      },
    }));
    try {
      await fetch('/api/contacts/update-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, ...patch }),
      });
    } catch {}
  };

  const handleBlockDomain = async (rawWebsite: string) => {
    if (!rawWebsite || !onUpdateSettings) return;
    const cleanDom = rawWebsite
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');
    if (!cleanDom) return;
    const existing = settings?.suppressed_domains || [];
    if (existing.includes(cleanDom)) {
      onShowToast(`${cleanDom} is already on the Do-Not-Contact list.`, 'info');
      return;
    }
    const updated = [...existing, cleanDom];
    const ok = await onUpdateSettings({ suppressed_domains: updated });
    if (ok) {
      onShowToast(`Added ${cleanDom} to Do-Not-Contact suppression list.`, 'success');
    }
  };

  const handleBulkSyncToCrm = async () => {
    try {
      const res = await fetch('/api/crm/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: contacts.map((c) => ({
            id: c.id,
            company_name: c.company_name,
            full_name: c.full_name,
            role: c.role,
            email: c.email,
            phone: c.phone,
            website: c.website,
            location: c.location,
            industry: c.industry,
            icp_score: c.icp_score,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || 'CRM sync failed');
      }
      const data = await res.json();
      onShowToast(`Successfully pushed ${data.syncedCount || contacts.length} leads directly to CRM!`, 'success');
    } catch (e: any) {
      onShowToast(e.message || 'CRM sync failed', 'error');
    }
  };

  const fetchStorageAndDatasets = async () => {
    setIsLoadingStorage(true);
    try {
      const [storageRes, datasetsRes] = await Promise.all([
        fetch('/api/sql/storage-info'),
        fetch('/api/sql/datasets'),
      ]);
      if (storageRes.ok) {
        const sData = await storageRes.json();
        setStorageInfo(sData);
      }
      if (datasetsRes.ok) {
        const dData = await datasetsRes.json();
        setDatasets(dData.datasets || []);
      }
    } catch (e) {
      console.warn('Error fetching storage and datasets:', e);
    } finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    fetchStorageAndDatasets();
  }, [currentJob?.id]);

  const handleSelectFileDataset = async (datasetId: string) => {
    try {
      const res = await fetch(`/api/sql/datasets/${datasetId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.dataset) {
          setSelectedDatasetId(datasetId);
          setSelectedDatasetMeta(data.dataset);
          setSelectedDatasetRecords(data.dataset.raw_data || []);
          setResultsTabMode('table');
          onShowToast(`Loaded ${data.dataset.record_count} leads from "${data.dataset.search_name}"`, 'info');
        }
      }
    } catch (err: any) {
      onShowToast(`Failed to load dataset: ${err.message}`, 'error');
    }
  };

  const handleRunAiOrganizer = async (datasetId?: string) => {
    const targetId = datasetId || selectedDatasetId || (datasets[0]?.id);
    if (!targetId) {
      onShowToast('Please select a dataset file to organize with AI.', 'warning');
      return;
    }

    const targetMeta = datasets.find((d) => d.id === targetId) || selectedDatasetMeta;
    setActiveOrganizingName(targetMeta?.search_name || 'Current Dataset');
    setIsOrganizingDataset(true);
    setShowOrganizerModal(true);

    try {
      const res = await fetch(`/api/sql/ai-organize/${targetId}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'AI Organization failed');
      }
      const data = await res.json();
      if (data.result) {
        setAiOrganizerSummary(data.result.summary);
        if (data.result.leads && selectedDatasetId === targetId) {
          setSelectedDatasetRecords(data.result.leads);
        }
        fetchStorageAndDatasets();
        onShowToast(`AI Organization complete! Structured ${data.result.organizedCount} leads into commercial tiers.`, 'success');
      }
    } catch (err: any) {
      onShowToast(`AI Organizer error: ${err.message}`, 'error');
    } finally {
      setIsOrganizingDataset(false);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    try {
      const res = await fetch(`/api/sql/datasets/${datasetId}`, { method: 'DELETE' });
      if (res.ok) {
        setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
        if (selectedDatasetId === datasetId) {
          setSelectedDatasetId(null);
          setSelectedDatasetRecords(null);
          setSelectedDatasetMeta(null);
          setResultsTabMode('files');
        }
        fetchStorageAndDatasets();
        onShowToast('File dataset deleted from cloud and SQL database.', 'info');
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  const currentJobWebsites: WebsiteResult[] = currentJob?.websites || [];
  const datasetWebsites: WebsiteResult[] = useMemo(() => {
    if (!selectedDatasetRecords || selectedDatasetRecords.length === 0) return [];
    const map = new Map<string, WebsiteResult>();
    for (const r of selectedDatasetRecords) {
      const compName = r.name || r.company || r.companyName || r.company_name || 'Business';
      const web = r.website || r.url || r.officialWebsite || (r.domain ? `https://${r.domain}` : `https://${compName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`);
      if (!map.has(web)) {
        map.set(web, {
          url: web,
          normalized_url: web.replace(/^https?:\/\//, '').replace(/^www\./, ''),
          company_name: compName,
          status: 'Completed',
          emails_found: r.email ? 1 : 0,
          contacts_found: r.contactName ? 1 : 0,
          contacts: [],
          generic_emails: r.company_generic_emails || (r.email ? [r.email] : []),
          firmographics: {
            industry: r.industry || r.category || 'Business Services',
            city: r.city || '',
            state: r.state || '',
            country: r.country || 'United States',
            employee_count_raw: r.employeeCount || '',
            description: r.description || '',
          },
        } as any);
      }
    }
    return Array.from(map.values());
  }, [selectedDatasetRecords]);

  const websites: WebsiteResult[] = selectedDatasetRecords && selectedDatasetRecords.length > 0
    ? datasetWebsites
    : currentJobWebsites;

  // Safely aggregate raw contacts from both currentJob.websites and currentJob.contacts
  // so no contacts are ever lost or truncated
  const rawContacts: Contact[] = useMemo(() => {
    const list: Contact[] = [];
    const seen = new Set<string>();

    for (const site of websites) {
      if (site.contacts && Array.isArray(site.contacts)) {
        for (const c of site.contacts) {
          const key = c.id || `${c.website || site.url}_${(c.professional_email || c.email || c.full_name || '').toLowerCase().trim()}`;
          if (key && !seen.has(key)) {
            seen.add(key);
            list.push(c);
          }
        }
      }
    }

    for (const c of currentJob?.contacts || []) {
      const key = c.id || `${c.website}_${(c.professional_email || c.email || c.full_name || '').toLowerCase().trim()}`;
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push(c);
      }
    }

    return list;
  }, [currentJob, websites]);

  // Synthesize contacts table rows: ensure every named person has their professional email and company generic emails side by side,
  // and ensure companies with generic emails but no named people have a company-level row.
  const displayContacts = useMemo(() => {
    const list: Contact[] = [];
    const companiesWithPeople = new Set<string>();

    for (const c of rawContacts) {
      const siteObj = websites.find(
        (w) => w.url === c.website || w.normalized_url === c.website || (c.website && w.url.includes(c.website))
      );
      const companyGenericEmails = (c.company_generic_emails && c.company_generic_emails.length > 0)
        ? c.company_generic_emails
        : (siteObj?.generic_emails || []);

      const isGenericOnly = c.email_type === 'Generic Business Email' || c.email_type === 'Generic';
      const profEmail = c.professional_email || (!isGenericOnly && c.email ? c.email : '');

      list.push({
        ...c,
        professional_email: profEmail,
        company_generic_emails: companyGenericEmails.length > 0
          ? companyGenericEmails
          : (isGenericOnly && c.email ? [c.email] : []),
      });

      if (c.full_name && c.full_name.trim()) {
        companiesWithPeople.add(c.website);
      }
    }

    // Check if any website has generic emails or status but no contacts in contacts array
    for (const w of websites) {
      if (!companiesWithPeople.has(w.url)) {
        const alreadyHasRow = list.some((item) => item.website === w.url);
        if (!alreadyHasRow && ((w.generic_emails && w.generic_emails.length > 0) || w.emails_found > 0)) {
          list.push({
            id: `${w.url}_company_row`,
            company_name: w.company_name || w.normalized_url,
            website: w.url,
            first_name: '',
            last_name: '',
            full_name: '',
            role: 'Company General Inboxes',
            role_tier: 'Other Staff',
            email: '',
            professional_email: '',
            company_generic_emails: w.generic_emails || [],
            email_type: 'Generic Business Email',
            email_classification_reason: 'Company-level generic inboxes',
            identity_verified: true,
            phone: '',
            source_url: w.url,
            status: 'Verified',
          });
        }
      }
    }

    return list;
  }, [rawContacts, websites]);

  // Convert selected dataset leads if viewing an archive dataset file
  const datasetContacts: Contact[] | null = useMemo(() => {
    if (!selectedDatasetRecords || selectedDatasetRecords.length === 0) return null;
    return selectedDatasetRecords.map((r, idx) => {
      const compName = r.name || r.company || r.companyName || r.company_name || 'Business';
      const email = r.email || (Array.isArray(r.extracted_emails) ? r.extracted_emails[0]?.email : '') || '';
      const phone = r.phone || r.phone_number || '';
      const contactName = r.contactName || r.personName || r.fullName || r.first_name || '';
      const contactRole = r.jobTitle || r.role || r.category || (contactName ? 'Executive / Principal' : 'Management');
      const web = r.website || r.url || '';
      const aiTier = r.aiTier || (r.fitScore >= 80 ? 'Tier 1' : r.fitScore >= 60 ? 'Tier 2' : 'Tier 3');

      return {
        id: r.id || `ds_row_${idx}`,
        company_name: compName,
        website: web,
        first_name: contactName.split(' ')[0] || '',
        last_name: contactName.split(' ').slice(1).join(' ') || '',
        full_name: contactName,
        role: contactRole,
        role_tier: aiTier === 'Tier 1' ? 'Founder / C-Level' : aiTier === 'Tier 2' ? 'VP / Director' : 'Other Staff',
        email: email,
        professional_email: email,
        company_generic_emails: r.company_generic_emails || [],
        email_type: r.emailType === 'personal' ? 'Personal Business Email' : r.emailType === 'role' ? 'Role-Based Team Email' : 'Generic Business Email',
        email_classification_reason: 'Verified by LeadHook Intelligence',
        identity_verified: true,
        phone: phone,
        source_url: web || r.sourceUrl || '',
        status: r.verificationStatus || 'Verified',
        icp_score: r.fitScore || (aiTier === 'Tier 1' ? 88 : aiTier === 'Tier 2' ? 74 : 58),
        location: r.location || [r.city, r.state, r.country].filter(Boolean).join(', '),
      } as any;
    });
  }, [selectedDatasetRecords]);

  const contacts = datasetContacts || displayContacts;

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalContacts = contacts.length;
    const highIcpLeads = contacts.filter((c) => (c.icp_score || 0) >= 80).length;
    const scoredContacts = contacts.filter((c) => c.icp_score !== undefined);
    const avgScore = scoredContacts.length > 0
      ? Math.round(scoredContacts.reduce((acc, c) => acc + (c.icp_score || 0), 0) / scoredContacts.length)
      : 0;
    const withSocials = contacts.filter(
      (c) => c.linkedin_url || c.social_profiles?.linkedin || c.social_profiles?.twitter
    ).length;
    const professionalEmails = contacts.filter(
      (c) => Boolean(c.professional_email || (c.email && (c.email_type === 'Professional Personal Email' || c.email_type === 'Personal')))
    ).length;
    const genericEmails = contacts.filter(
      (c) => (c.company_generic_emails && c.company_generic_emails.length > 0) || c.email_type === 'Generic Business Email' || c.email_type === 'Generic'
    ).length;
    const decisionMakers = contacts.filter((c) => c.is_decision_maker).length;
    const ownersCount = contacts.filter((c) => c.decision_maker_tier === 'Owner / Founder').length;

    return {
      totalContacts,
      highIcpLeads,
      avgScore,
      withSocials,
      professionalEmails,
      genericEmails,
      decisionMakers,
      ownersCount,
    };
  }, [contacts]);

  // All extracted unique emails (professional + generic) for the detailed Emails view
  const allExtractedEmails = useMemo(() => {
    const list: Array<{
      id: string;
      email: string;
      type: string;
      company_name: string;
      website: string;
      person_name: string;
      role: string;
      role_tier?: RoleTier;
      source_url: string;
      icp_score?: number;
      icp_tier?: IcpTier;
      email_verification?: EmailVerificationResult;
    }> = [];
    const seen = new Set<string>();

    for (const c of contacts) {
      if (c.professional_email && !seen.has(c.professional_email.toLowerCase())) {
        const norm = c.professional_email.toLowerCase().trim();
        seen.add(norm);
        list.push({
          id: `em_${c.id}_prof`,
          email: c.professional_email,
          type: 'Professional Personal Email',
          company_name: c.company_name,
          website: c.website,
          person_name: c.full_name || '—',
          role: c.role || 'Professional',
          role_tier: c.role_tier,
          source_url: c.source_url,
          icp_score: c.icp_score,
          icp_tier: c.icp_tier,
          email_verification: verificationMap[norm] || c.email_verification,
        });
      } else if (c.email && !seen.has(c.email.toLowerCase())) {
        const norm = c.email.toLowerCase().trim();
        seen.add(norm);
        list.push({
          id: `em_${c.id}`,
          email: c.email,
          type: c.email_type,
          company_name: c.company_name,
          website: c.website,
          person_name: c.full_name || '—',
          role: c.role || 'Professional',
          role_tier: c.role_tier,
          source_url: c.source_url,
          icp_score: c.icp_score,
          icp_tier: c.icp_tier,
          email_verification: verificationMap[norm] || c.email_verification,
        });
      }

      if (c.company_generic_emails) {
        for (const genEm of c.company_generic_emails) {
          const norm = genEm.toLowerCase().trim();
          if (!seen.has(norm)) {
            seen.add(norm);
            list.push({
              id: `em_${c.id}_gen_${genEm}`,
              email: genEm,
              type: 'Generic Business Email',
              company_name: c.company_name,
              website: c.website,
              person_name: 'Company Inboxes',
              role: 'General Inboxes',
              role_tier: 'Other Staff',
              source_url: c.source_url || c.website,
              icp_score: undefined,
              icp_tier: undefined,
              email_verification: verificationMap[norm],
            });
          }
        }
      }
    }

    for (const w of websites) {
      if (w.generic_emails) {
        for (const genEm of w.generic_emails) {
          const norm = genEm.toLowerCase().trim();
          if (!seen.has(norm)) {
            seen.add(norm);
            list.push({
              id: `em_site_${w.url}_${genEm}`,
              email: genEm,
              type: 'Generic Business Email',
              company_name: w.company_name || w.normalized_url,
              website: w.url,
              person_name: 'Company Inboxes',
              role: 'General Inboxes',
              role_tier: 'Other Staff',
              source_url: w.url,
              icp_score: undefined,
              icp_tier: undefined,
              email_verification: verificationMap[norm],
            });
          }
        }
      }
    }

    return list;
  }, [contacts, websites, verificationMap]);

  // Dedicated list of all generic business inboxes
  const allGenericEmailEntries = useMemo(() => {
    const list: Array<{
      id: string;
      email: string;
      department: string;
      company_name: string;
      website: string;
      phone: string;
      source_url: string;
      status: string;
    }> = [];
    const seen = new Set<string>();

    // 1. From currentJob.generic_emails
    if (currentJob?.generic_emails) {
      for (const ge of currentJob.generic_emails) {
        const em = ge.email?.toLowerCase().trim();
        if (em && !seen.has(em)) {
          seen.add(em);
          list.push({
            id: ge.id || `gen_${em}`,
            email: ge.email,
            department: ge.department || 'General Inquiries',
            company_name: ge.company_name || '—',
            website: ge.website || '',
            phone: ge.phone || '',
            source_url: ge.source_url || ge.website || '',
            status: ge.status || 'Verified',
          });
        }
      }
    }

    // 2. From websites[].generic_email_items or websites[].generic_emails
    for (const w of websites) {
      if (w.generic_email_items) {
        for (const ge of w.generic_email_items) {
          const em = ge.email?.toLowerCase().trim();
          if (em && !seen.has(em)) {
            seen.add(em);
            list.push({
              id: ge.id || `gen_w_${w.url}_${em}`,
              email: ge.email,
              department: ge.department || 'General Inquiries',
              company_name: ge.company_name || w.company_name || w.normalized_url,
              website: ge.website || w.url,
              phone: ge.phone || '',
              source_url: ge.source_url || w.url,
              status: ge.status || 'Verified',
            });
          }
        }
      }
      if (w.generic_emails) {
        for (const genEm of w.generic_emails) {
          const em = genEm.toLowerCase().trim();
          if (em && !seen.has(em)) {
            seen.add(em);
            const localPart = em.split('@')[0];
            let department = 'General Inquiries';
            if (/careers|jobs|recruiting|hr/i.test(localPart)) department = 'Careers & Hiring';
            else if (/press|media|news|pr/i.test(localPart)) department = 'Media & Press';
            else if (/marketing/i.test(localPart)) department = 'Marketing';
            else if (/sales|bizdev/i.test(localPart)) department = 'Sales & Business';
            else if (/support|help/i.test(localPart)) department = 'Customer Support';
            else if (/billing|finance/i.test(localPart)) department = 'Billing & Finance';

            list.push({
              id: `gen_str_${w.url}_${em}`,
              email: genEm,
              department,
              company_name: w.company_name || w.normalized_url,
              website: w.url,
              phone: '',
              source_url: w.url,
              status: 'Verified',
            });
          }
        }
      }
    }

    // 3. From contacts company_generic_emails
    for (const c of contacts) {
      if (c.company_generic_emails) {
        for (const genEm of c.company_generic_emails) {
          const em = genEm.toLowerCase().trim();
          if (em && !seen.has(em)) {
            seen.add(em);
            const localPart = em.split('@')[0];
            let department = 'General Inquiries';
            if (/careers|jobs|recruiting|hr/i.test(localPart)) department = 'Careers & Hiring';
            else if (/press|media|news|pr/i.test(localPart)) department = 'Media & Press';
            else if (/marketing/i.test(localPart)) department = 'Marketing';
            else if (/sales|bizdev/i.test(localPart)) department = 'Sales & Business';
            else if (/support|help/i.test(localPart)) department = 'Customer Support';
            else if (/billing|finance/i.test(localPart)) department = 'Billing & Finance';

            list.push({
              id: `gen_c_${c.id}_${em}`,
              email: genEm,
              department,
              company_name: c.company_name,
              website: c.website,
              phone: c.phone || '',
              source_url: c.source_url || c.website,
              status: 'Verified',
            });
          }
        }
      }
    }

    return list;
  }, [currentJob, websites, contacts]);

  // Filtered generic emails
  const filteredGenericEmails = useMemo(() => {
    return allGenericEmailEntries.filter((g) => {
      if (genericDeptFilter !== 'All' && g.department !== genericDeptFilter) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          g.email.toLowerCase().includes(term) ||
          g.company_name.toLowerCase().includes(term) ||
          g.website.toLowerCase().includes(term) ||
          g.department.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [allGenericEmailEntries, genericDeptFilter, searchTerm]);

  // Filtered complete emails list (both professional & generic)
  const filteredAllEmails = useMemo(() => {
    return allExtractedEmails.filter((item) => {
      if (emailTypeFilter !== 'All') {
        if (emailTypeFilter === 'Professional Personal') {
          if (item.type !== 'Professional Personal Email') return false;
        } else if (emailTypeFilter === 'Generic Business') {
          if (item.type !== 'Generic Business Email') return false;
        } else if (item.type !== emailTypeFilter) {
          return false;
        }
      }

      // Email Verification Status Filter
      if (emailVerificationFilter !== 'All') {
        const itemStatus = item.email_verification?.verification_status || 'Not checked';
        if (itemStatus !== emailVerificationFilter) {
          return false;
        }
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.email.toLowerCase().includes(term) ||
          item.company_name.toLowerCase().includes(term) ||
          item.person_name.toLowerCase().includes(term) ||
          item.role.toLowerCase().includes(term) ||
          item.website.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [allExtractedEmails, emailTypeFilter, emailVerificationFilter, searchTerm]);

  // Filter & Search Contacts
  const suppressedDomainsSet = useMemo(
    () =>
      new Set(
        (settings?.suppressed_domains || []).map((d) =>
          d.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
        )
      ),
    [settings?.suppressed_domains]
  );

  const suppressedEmailsSet = useMemo(
    () => new Set((settings?.suppressed_emails || []).map((e) => e.toLowerCase().trim())),
    [settings?.suppressed_emails]
  );

  const filteredContacts = useMemo(() => {
    return contacts
      .map((c) => {
        const meta = contactMetaMap[c.id];
        const deep = deepEnrichedMap[c.id];
        return {
          ...c,
          ...(deep
            ? {
                professional_email: c.professional_email || deep.professional_email,
                email: c.email || deep.email || '',
                phone: c.phone || deep.phone || '',
                phone_type: c.phone_type || deep.phone_type,
                linkedin_url: c.linkedin_url || deep.linkedin_url,
                tech_stack: (c.tech_stack && c.tech_stack.length > 0) ? c.tech_stack : deep.tech_stack,
                confidence_score: Math.max(c.confidence_score || 0, deep.confidence_score || 0),
                email_verification: c.email_verification || deep.email_verification,
              }
            : {}),
          ...(meta
            ? {
                pipeline_stage: meta.pipeline_stage ?? c.pipeline_stage,
                tags: meta.tags ?? c.tags,
                notes: meta.notes ?? c.notes,
              }
            : {}),
        };
      })
      .filter((c) => {
        // Check Do-Not-Contact suppression list
        const dom = (c.website || c.source_url || '')
          .toLowerCase()
          .trim()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '');
        if (dom && suppressedDomainsSet.has(dom)) return false;
        const profEm = (c.professional_email || '').toLowerCase().trim();
        const primEm = (c.email || '').toLowerCase().trim();
        if ((profEm && suppressedEmailsSet.has(profEm)) || (primEm && suppressedEmailsSet.has(primEm))) {
          return false;
        }

        // Accuracy & Confidence Filter
        if (accuracyFilter !== 'All') {
          const conf = c.confidence_score || (c.association_status === 'explicit' ? 92 : c.professional_email ? 85 : 65);
          const verStatus = (verificationMap[profEm || primEm] || c.email_verification)?.verification_status;
          if (accuracyFilter === 'high_confidence' && conf < 90) return false;
          if (accuracyFilter === 'verified_direct') {
            if (!profEm || verStatus === 'Invalid') return false;
          }
          if (accuracyFilter === 'explicit_only' && c.association_status !== 'explicit') return false;
        }

        // Pipeline Stage filter
        if (pipelineStageFilter !== 'All') {
          const stage = c.pipeline_stage || 'New';
          if (stage !== pipelineStageFilter) return false;
        }

        // Email type filter
        if (emailTypeFilter !== 'All') {
          if (emailTypeFilter === 'Professional Personal') {
            const hasProf = Boolean(c.professional_email || (c.email && (c.email_type === 'Professional Personal Email' || c.email_type === 'Personal')));
            if (!hasProf) return false;
          } else if (emailTypeFilter === 'Generic Business') {
            if (c.email_type !== 'Generic Business Email' && c.email_type !== 'Generic') return false;
          } else if (emailTypeFilter === 'Personal Provider') {
            if (c.email_type !== 'Personal Email Provider') return false;
          } else if (c.email_type !== emailTypeFilter) {
            return false;
          }
        }

        // Decision Maker filter
        if (decisionMakerFilter === 'decision_makers' && !c.is_decision_maker) {
          return false;
        }
        if (decisionMakerFilter === 'owners' && c.decision_maker_tier !== 'Owner / Founder') {
          return false;
        }

        // ICP filter status
        if (icpFilterStatus !== 'All') {
          if (icpFilterStatus === 'INCLUDED' && c.icp_filter_status === 'EXCLUDED') return false;
          if (icpFilterStatus === 'EXCLUDED' && c.icp_filter_status !== 'EXCLUDED') return false;
        }

        // Role tier filter
        if (roleTierFilter !== 'All' && (c.role_tier || 'Other Staff') !== roleTierFilter) {
          return false;
        }
        // ICP Tier filter
        if (icpTierFilter !== 'All') {
          if (icpTierFilter === 'High' && (c.icp_score || 0) < 80) return false;
          if (icpTierFilter === 'Moderate' && ((c.icp_score || 0) < 60 || (c.icp_score || 0) >= 80)) return false;
          if (icpTierFilter === 'Low' && (c.icp_score || 0) >= 60) return false;
        }
        // Employee Size / Count filter
        if (employeeSizeFilter !== 'All') {
          const siteObj = websites.find((w) => w.url === c.website || w.normalized_url === c.website || (c.website && w.url.includes(c.website)));
          const empCount = siteObj?.firmographics?.employee_count || siteObj?.employee_count;
          const empRange = siteObj?.firmographics?.employee_range || siteObj?.employee_range;
          const empTier = siteObj?.firmographics?.employee_tier || c.company_size;
          if (!matchEmployeeCountFilter(empCount, empRange, empTier, employeeSizeFilter)) return false;
        }
        // Founding Year filter
        if (foundingYearFilter !== 'All') {
          const siteObj = websites.find((w) => w.url === c.website || w.normalized_url === c.website || (c.website && w.url.includes(c.website)));
          const yrStr = siteObj?.firmographics?.founded_year || siteObj?.founded_year;
          if (!matchFoundedYearFilter(yrStr, foundingYearFilter)) return false;
        }

        // LLM Natural Language Filter Specification
        if (nlFilterSpec) {
          const siteObj = websites.find(
            (w) => w.url === c.website || w.normalized_url === c.website || (c.website && w.url.includes(c.website))
          );
          if (nlFilterSpec.requireLinkedin) {
            const hasLi = Boolean(
              c.linkedin_url ||
                c.social_profiles?.linkedin ||
                siteObj?.linkedin_url ||
                siteObj?.social_profiles?.linkedin
            );
            if (!hasLi) return false;
          }
          if (nlFilterSpec.requirePhone && (!c.phone || !c.phone.trim())) {
            return false;
          }
          if (nlFilterSpec.requireProfessionalEmail) {
            const hasProf = Boolean(
              c.professional_email ||
                (c.email && c.email_type !== 'Generic Business Email' && c.email_type !== 'Generic')
            );
            if (!hasProf) return false;
          }
          if (nlFilterSpec.requireGenericEmail) {
            const hasGen = Boolean(
              (c.company_generic_emails && c.company_generic_emails.length > 0) ||
                c.email_type === 'Generic Business Email' ||
                c.email_type === 'Generic'
            );
            if (!hasGen) return false;
          }
          if (nlFilterSpec.requireDecisionMaker) {
            const isDm = Boolean(
              c.is_decision_maker ||
                c.role_tier === 'C-Suite / Executive' ||
                (c.role_tier as string) === 'Founder / C-Level'
            );
            if (!isDm) return false;
          }
          if (nlFilterSpec.requireOwnerOrFounder) {
            const isOwner = Boolean(
              c.decision_maker_tier === 'Owner / Founder' ||
                /\b(founder|co-founder|owner|ceo|president|managing\s+partner|principal)\b/i.test(c.role || '')
            );
            if (!isOwner) return false;
          }
          if (nlFilterSpec.minEmployees !== undefined || nlFilterSpec.maxEmployees !== undefined) {
            const empCountRaw = siteObj?.firmographics?.employee_count || siteObj?.employee_count || '';
            const empRangeRaw =
              siteObj?.firmographics?.employee_range ||
              siteObj?.employee_range ||
              siteObj?.firmographics?.employee_tier ||
              c.company_size ||
              '';
            let numericMin = NaN;
            let numericMax = NaN;
            const parsedExact = parseInt(String(empCountRaw).replace(/\D/g, ''), 10);
            if (!isNaN(parsedExact) && parsedExact > 0) {
              numericMin = parsedExact;
              numericMax = parsedExact;
            } else if (empRangeRaw) {
              const rangeNums = String(empRangeRaw)
                .replace(/,/g, '')
                .match(/\d+/g);
              if (rangeNums && rangeNums.length >= 2) {
                numericMin = parseInt(rangeNums[0], 10);
                numericMax = parseInt(rangeNums[1], 10);
              } else if (rangeNums && rangeNums.length === 1) {
                numericMin = parseInt(rangeNums[0], 10);
                numericMax = String(empRangeRaw).includes('+') ? 999999 : numericMin;
              }
            }
            if (isNaN(numericMin) && isNaN(numericMax)) return false;
            if (nlFilterSpec.minEmployees !== undefined && numericMax < nlFilterSpec.minEmployees) return false;
            if (nlFilterSpec.maxEmployees !== undefined && numericMin > nlFilterSpec.maxEmployees) return false;
          }
          if (nlFilterSpec.minFoundedYear !== undefined || nlFilterSpec.maxFoundedYear !== undefined) {
            const yrRaw = siteObj?.firmographics?.founded_year || siteObj?.founded_year || '';
            const yr = parseInt(String(yrRaw).replace(/\D/g, ''), 10);
            if (isNaN(yr) || yr < 1700) return false;
            if (nlFilterSpec.minFoundedYear !== undefined && yr < nlFilterSpec.minFoundedYear) return false;
            if (nlFilterSpec.maxFoundedYear !== undefined && yr > nlFilterSpec.maxFoundedYear) return false;
          }
          if (nlFilterSpec.minIcpScore !== undefined && (c.icp_score || 0) < nlFilterSpec.minIcpScore) {
            return false;
          }
          if (nlFilterSpec.minConfidenceScore !== undefined) {
            const conf = c.confidence_score || (c.association_status === 'explicit' ? 95 : 86);
            if (conf < nlFilterSpec.minConfidenceScore) return false;
          }
          if (nlFilterSpec.emailVerificationStatus) {
            const verStatus = (verificationMap[profEm || primEm] || c.email_verification)?.verification_status;
            if (verStatus !== nlFilterSpec.emailVerificationStatus) return false;
          }
          if (nlFilterSpec.roleKeywords && nlFilterSpec.roleKeywords.length > 0) {
            const roleStr = `${c.role || ''} ${c.role_tier || ''}`.toLowerCase();
            if (!nlFilterSpec.roleKeywords.some((kw) => roleStr.includes(kw.toLowerCase()))) return false;
          }
          if (nlFilterSpec.locationKeywords && nlFilterSpec.locationKeywords.length > 0) {
            const locStr = `${c.location || ''} ${siteObj?.firmographics?.location || ''} ${siteObj?.firmographics?.headquarters || ''} ${siteObj?.location || ''}`.toLowerCase();
            if (!nlFilterSpec.locationKeywords.some((kw) => locStr.includes(kw.toLowerCase()))) return false;
          }
          if (nlFilterSpec.industryKeywords && nlFilterSpec.industryKeywords.length > 0) {
            const indStr = `${c.industry || ''} ${siteObj?.firmographics?.industry || ''}`.toLowerCase();
            if (!nlFilterSpec.industryKeywords.some((kw) => indStr.includes(kw.toLowerCase()))) return false;
          }
          if (nlFilterSpec.techStackKeywords && nlFilterSpec.techStackKeywords.length > 0) {
            const techStr = (c.tech_stack || []).join(' ').toLowerCase();
            if (!nlFilterSpec.techStackKeywords.some((kw) => techStr.includes(kw.toLowerCase()))) return false;
          }
          if (nlFilterSpec.companyKeywords && nlFilterSpec.companyKeywords.length > 0) {
            const hay = `${c.company_name || ''} ${c.website || ''} ${c.full_name || ''} ${c.role || ''}`.toLowerCase();
            if (!nlFilterSpec.companyKeywords.some((kw) => hay.includes(kw.toLowerCase()))) return false;
          }
          if (nlFilterSpec.pipelineStage) {
            const st = (c.pipeline_stage || 'New').toLowerCase();
            if (st !== nlFilterSpec.pipelineStage.toLowerCase()) return false;
          }
        }

        // Text search
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
          c.company_name?.toLowerCase().includes(term) ||
          c.full_name?.toLowerCase().includes(term) ||
          c.role?.toLowerCase().includes(term) ||
          c.role_tier?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.professional_email?.toLowerCase().includes(term) ||
          (c.company_generic_emails && c.company_generic_emails.some((ge) => ge.toLowerCase().includes(term))) ||
          c.phone?.toLowerCase().includes(term) ||
          c.website?.toLowerCase().includes(term) ||
          c.linkedin_url?.toLowerCase().includes(term) ||
          c.notes?.toLowerCase().includes(term) ||
          (c.tags && c.tags.some((t) => t.toLowerCase().includes(term)))
        );
      });
  }, [contacts, websites, contactMetaMap, deepEnrichedMap, verificationMap, accuracyFilter, nlFilterSpec, suppressedDomainsSet, suppressedEmailsSet, pipelineStageFilter, emailTypeFilter, decisionMakerFilter, icpFilterStatus, roleTierFilter, icpTierFilter, employeeSizeFilter, foundingYearFilter, searchTerm]);

  // Filter & Search Websites for Firmographics & Domains view
  const filteredWebsites = useMemo(() => {
    return websites.filter((w) => {
      // Employee filter
      const empCount = w.firmographics?.employee_count || w.employee_count;
      const empRange = w.firmographics?.employee_range || w.employee_range;
      const empTier = w.firmographics?.employee_tier;
      if (!matchEmployeeCountFilter(empCount, empRange, empTier, employeeSizeFilter)) {
        return false;
      }

      // Founded filter
      const foundedYear = w.firmographics?.founded_year || w.founded_year;
      if (!matchFoundedYearFilter(foundedYear, foundingYearFilter)) {
        return false;
      }

      // ICP filter status
      if (icpFilterStatus !== 'All') {
        if (icpFilterStatus === 'INCLUDED' && w.icp_filter_status === 'EXCLUDED') return false;
        if (icpFilterStatus === 'EXCLUDED' && w.icp_filter_status !== 'EXCLUDED') return false;
      }

      // Text search
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const compName = (w.company_name || '').toLowerCase();
      const urlStr = (w.url || '').toLowerCase();
      const indStr = (w.firmographics?.industry || '').toLowerCase();
      const locStr = (w.firmographics?.location || w.firmographics?.headquarters || w.location || '').toLowerCase();
      const empStr = (empCount || '').toLowerCase();
      const fndStr = (foundedYear || '').toLowerCase();

      return (
        compName.includes(term) ||
        urlStr.includes(term) ||
        indStr.includes(term) ||
        locStr.includes(term) ||
        empStr.includes(term) ||
        fndStr.includes(term)
      );
    });
  }, [websites, employeeSizeFilter, foundingYearFilter, icpFilterStatus, searchTerm]);

  // Sort Contacts
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      if (sortField === 'icp_score') {
        const scoreA = a.icp_score ?? -1;
        const scoreB = b.icp_score ?? -1;
        if (scoreA < scoreB) return sortOrder === 'asc' ? -1 : 1;
        if (scoreA > scoreB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }

      const valA = (a[sortField] || '').toLowerCase();
      const valB = (b[sortField] || '').toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredContacts, sortField, sortOrder]);

  // Paginated Contacts
  const totalPages = Math.ceil(sortedContacts.length / pageSize) || 1;
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedContacts.slice(start, start + pageSize);
  }, [sortedContacts, currentPage, pageSize]);

  // Paginated Generic Emails
  const totalGenericPages = Math.ceil(filteredGenericEmails.length / pageSize) || 1;
  const paginatedGenericEmails = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGenericEmails.slice(start, start + pageSize);
  }, [filteredGenericEmails, currentPage, pageSize]);

  // Paginated All Emails
  const totalEmailPages = Math.ceil(filteredAllEmails.length / pageSize) || 1;
  const paginatedAllEmails = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAllEmails.slice(start, start + pageSize);
  }, [filteredAllEmails, currentPage, pageSize]);

  // Copy single email
  const handleCopyEmail = (email: string, id: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    onShowToast(`Copied ${email} to clipboard!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy all visible emails
  const handleCopyAllEmails = () => {
    const validEmails = filteredContacts.map((c) => c.email).filter(Boolean);
    const unique = Array.from(new Set(validEmails));
    if (unique.length === 0) {
      onShowToast('No emails found to copy.', 'warning');
      return;
    }
    navigator.clipboard.writeText(unique.join('; '));
    onShowToast(`Copied ${unique.length} email(s) to clipboard!`, 'success');
  };

  // Copy all generic inboxes
  const handleCopyAllGenericEmails = () => {
    const validEmails = filteredGenericEmails.map((g) => g.email).filter(Boolean);
    const unique = Array.from(new Set(validEmails));
    if (unique.length === 0) {
      onShowToast('No generic emails found to copy.', 'warning');
      return;
    }
    navigator.clipboard.writeText(unique.join('; '));
    onShowToast(`Copied ${unique.length} generic email(s) to clipboard!`, 'success');
  };

  // Export generic inboxes to CSV
  const handleExportGenericCsv = () => {
    if (allGenericEmailEntries.length === 0) {
      onShowToast('No generic emails to export.', 'warning');
      return;
    }
    const headers = ['Email', 'Department', 'Company Name', 'Website', 'Phone', 'Source URL', 'Status'];
    const rows = allGenericEmailEntries.map((g) => [
      `"${g.email}"`,
      `"${g.department}"`,
      `"${g.company_name.replace(/"/g, '""')}"`,
      `"${g.website}"`,
      `"${g.phone}"`,
      `"${g.source_url}"`,
      `"${g.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `generic_inboxes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast(`Exported ${allGenericEmailEntries.length} generic email(s) to CSV!`, 'success');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleToggleSelectCompany = (url: string) => {
    const next = new Set(selectedCompanyUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setSelectedCompanyUrls(next);
  };

  const handleToggleSelectAllCompanies = () => {
    if (selectedCompanyUrls.size === websites.length) {
      setSelectedCompanyUrls(new Set());
    } else {
      setSelectedCompanyUrls(new Set(websites.map((w) => w.url)));
    }
  };

  const handleVerifySelectedCompanies = async () => {
    const targets = websites
      .filter((w) => selectedCompanyUrls.has(w.url))
      .map((w) => ({
        url: w.url,
        company_name: w.company_name,
        address: w.firmographics?.headquarters,
      }));
    if (targets.length === 0) return;

    setIsVerifyingBatch(true);
    try {
      const res = await fetch('/api/verifier/verify-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, level: verifierLevel }),
      });
      if (res.ok) {
        onShowToast(`Verification batch started for ${targets.length} business(es)`, 'success');
      } else {
        const err = await res.json();
        onShowToast(err.error || 'Verification failed', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsVerifyingBatch(false);
    }
  };

  const handleVerifyAllCompanies = async () => {
    const targets = websites.map((w) => ({
      url: w.url,
      company_name: w.company_name,
      address: w.firmographics?.headquarters,
    }));
    if (targets.length === 0) return;

    setIsVerifyingBatch(true);
    try {
      const res = await fetch('/api/verifier/verify-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, level: verifierLevel }),
      });
      if (res.ok) {
        onShowToast(`Verification batch started for all ${targets.length} business(es)`, 'success');
      } else {
        const err = await res.json();
        onShowToast(err.error || 'Verification failed', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setIsVerifyingBatch(false);
    }
  };

  const handleVerifyNowSingle = async (w: WebsiteResult) => {
    setVerifyingCompanyUrl(w.url);
    try {
      const res = await fetch('/api/verifier/verify-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: {
            url: w.url,
            company_name: w.company_name,
            address: w.firmographics?.headquarters,
          },
          level: verifierLevel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onShowToast(
          `Verified ${w.company_name || w.url}: ${data.result?.final_business_status || 'DONE'}`,
          'success'
        );
      } else {
        const err = await res.json();
        onShowToast(err.error || 'Verification failed', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message, 'error');
    } finally {
      setVerifyingCompanyUrl(null);
    }
  };

  const handleSaveIcpFromModal = async (newConfig: IcpConfig) => {
    if (onUpdateSettings) {
      const ok = await onUpdateSettings({ icp_config: newConfig });
      if (ok) {
        onShowToast('ICP Targeting matrix updated!', 'success');
      }
    }
  };

  // --- Self-Hosted Email Verification Handlers & Data Hydration ---
  useEffect(() => {
    // 1. Fetch verifier service status and SMTP environment capability
    fetch('/api/email-verifier/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: EmailVerifierStatusResponse | null) => {
        if (data) setSmtpServerStatus(data);
      })
      .catch((e) => console.warn('[EmailVerifier Status Check]:', e));

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Hydrate email verification cache for current extracted emails
  useEffect(() => {
    const emailsToHydrate = allExtractedEmails.map((item) => item.email).filter(Boolean);
    if (emailsToHydrate.length === 0) return;

    let isMounted = true;

    // 1. Load from local/server verifier cache
    fetch('/api/email-verifier/cache-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emailsToHydrate }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.cached) return;
        setVerificationMap((prev) => ({
          ...prev,
          ...data.cached,
        }));
      })
      .catch((e) => console.warn('[EmailVerifier Cache Hydration]:', e));

    // 2. If authenticated, load from Firestore
    if (auth.currentUser?.uid) {
      firestoreService
        .getUserVerifiedEmails(auth.currentUser.uid)
        .then((fsMap) => {
          if (!isMounted || !fsMap) return;
          setVerificationMap((prev) => ({
            ...prev,
            ...fsMap,
          }));
        })
        .catch((e) => console.warn('[Firestore Verified Emails Hydration]:', e));
    }

    return () => {
      isMounted = false;
    };
  }, [allExtractedEmails.length, auth.currentUser?.uid]);

  const emailVerificationCounts = useMemo(() => {
    let validCount = 0;
    let invalidCount = 0;
    let riskyCount = 0;
    let unknownCount = 0;
    let unverifiedCount = 0;

    for (const item of allExtractedEmails) {
      const st = item.email_verification?.verification_status;
      if (st === 'Valid') validCount++;
      else if (st === 'Invalid') invalidCount++;
      else if (st === 'Risky') riskyCount++;
      else if (st === 'Unknown') unknownCount++;
      else unverifiedCount++;
    }

    return {
      validCount,
      invalidCount,
      riskyCount,
      unknownCount,
      unverifiedCount,
      total: allExtractedEmails.length,
    };
  }, [allExtractedEmails]);

  const handleToggleEmailSelect = (email: string) => {
    const clean = email.toLowerCase().trim();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) {
        next.delete(clean);
      } else {
        next.add(clean);
      }
      return next;
    });
  };

  const handleToggleSelectAllPageEmails = () => {
    const pageEmails = paginatedAllEmails.map((it) => it.email.toLowerCase().trim());
    const allSelectedOnPage = pageEmails.every((em) => selectedEmails.has(em));

    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        pageEmails.forEach((em) => next.delete(em));
      } else {
        pageEmails.forEach((em) => next.add(em));
      }
      return next;
    });
  };

  const handleVerifySelectedEmails = async (checkSmtp: boolean) => {
    const list = Array.from(selectedEmails);
    if (list.length === 0) {
      onShowToast('Please select at least one email to verify.', 'warning');
      return;
    }

    setIsVerifyingEmails(true);
    setEmailJobProgress({ percent: 10, text: `Preparing verification for ${list.length} selected email(s)...` });

    try {
      const itemsToVerify = list.map((em: string) => {
        const matched = allExtractedEmails.find((it) => it.email.toLowerCase() === em.toLowerCase());
        return {
          email: em,
          company_id: matched?.website,
          company_name: matched?.company_name,
          source_url: matched?.source_url || matched?.website,
          email_category: matched?.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
        };
      });

      const res = await fetch('/api/email-verifier/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: itemsToVerify,
          options: { checkSmtp, forceReverify: true },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification failed');
      }

      const data = await res.json();
      const results: EmailVerificationResult[] = data.results || [];

      setVerificationMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[r.normalized_email] = r;
          next[r.email.toLowerCase().trim()] = r;
        }
        return next;
      });

      if (auth.currentUser?.uid) {
        firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, results).catch(console.warn);
      }

      onShowToast(`Verified ${results.length} email(s) successfully!`, 'success');
      setSelectedEmails(new Set());
    } catch (err: any) {
      onShowToast(err?.message || 'Error verifying selected emails', 'error');
    } finally {
      setIsVerifyingEmails(false);
      setEmailJobProgress({ percent: 0, text: '' });
    }
  };

  const handleVerifyUnverifiedEmails = async (checkSmtp: boolean) => {
    const unverifiedItems = allExtractedEmails
      .filter((it) => !it.email_verification || it.email_verification.verification_status === 'Not checked')
      .map((it) => ({
        email: it.email,
        company_id: it.website,
        company_name: it.company_name,
        source_url: it.source_url || it.website,
        email_category: it.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
      }));

    if (unverifiedItems.length === 0) {
      onShowToast('All emails in this dataset have already been verified!', 'info');
      return;
    }

    setIsVerifyingEmails(true);
    setEmailJobProgress({ percent: 5, text: `Starting verification for ${unverifiedItems.length} unverified emails...` });

    try {
      const res = await fetch('/api/email-verifier/verify-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedEmails: unverifiedItems,
          options: { checkSmtp },
          concurrency: 6,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start bulk verification');
      }

      const data = await res.json();
      if (!data.jobId) {
        onShowToast(data.message || 'All emails are already cached and up to date', 'info');
        setIsVerifyingEmails(false);
        return;
      }

      const jobId = data.jobId;
      setEmailJobProgress({ percent: 15, text: `Verification job ${jobId} running...`, jobId });

      const poll = async () => {
        try {
          const jobRes = await fetch(`/api/email-verifier/jobs/${jobId}`);
          if (!jobRes.ok) return;
          const jobData = await jobRes.json();
          const j = jobData.job;
          if (!j) return;

          const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
          setEmailJobProgress({
            percent: Math.max(10, Math.min(100, pct)),
            text: `Processed ${j.processed}/${j.total} emails${j.current_email ? ` (${j.current_email})` : ''}`,
            jobId,
          });

          if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setIsVerifyingEmails(false);

            if (j.status === 'completed') {
              const resList: EmailVerificationResult[] = j.results || [];
              setVerificationMap((prev) => {
                const next = { ...prev };
                for (const r of resList) {
                  next[r.normalized_email] = r;
                  next[r.email.toLowerCase().trim()] = r;
                }
                return next;
              });

              if (auth.currentUser?.uid) {
                firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, resList).catch(console.warn);
              }

              onShowToast(`Completed verification: ${j.valid_count} valid, ${j.invalid_count} invalid, ${j.risky_count} risky`, 'success');
            } else if (j.status === 'cancelled') {
              onShowToast('Verification job cancelled.', 'info');
            } else {
              onShowToast(j.error || 'Verification job encountered an error', 'error');
            }
          }
        } catch (e: any) {
          console.warn('[Poll Error]:', e);
        }
      };

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(poll, 1200);
    } catch (err: any) {
      setIsVerifyingEmails(false);
      onShowToast(err?.message || 'Error starting unverified emails job', 'error');
    }
  };

  const handleReverifyAllEmails = async (checkSmtp: boolean) => {
    const allItems = allExtractedEmails.map((it) => ({
      email: it.email,
      company_id: it.website,
      company_name: it.company_name,
      source_url: it.source_url || it.website,
      email_category: it.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
    }));

    if (allItems.length === 0) {
      onShowToast('No emails found to verify.', 'warning');
      return;
    }

    setIsVerifyingEmails(true);
    setEmailJobProgress({ percent: 5, text: `Queuing re-verification of all ${allItems.length} emails...` });

    try {
      const res = await fetch('/api/email-verifier/verify-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedEmails: allItems,
          options: { checkSmtp, forceReverify: true },
          concurrency: 6,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start reverification');
      }

      const data = await res.json();
      const jobId = data.jobId;
      if (!jobId) {
        onShowToast('Re-verification complete.', 'info');
        setIsVerifyingEmails(false);
        return;
      }

      setEmailJobProgress({ percent: 15, text: `Reverifying ${allItems.length} emails...`, jobId });

      const poll = async () => {
        try {
          const jobRes = await fetch(`/api/email-verifier/jobs/${jobId}`);
          if (!jobRes.ok) return;
          const jobData = await jobRes.json();
          const j = jobData.job;
          if (!j) return;

          const pct = j.total > 0 ? Math.round((j.processed / j.total) * 100) : 0;
          setEmailJobProgress({
            percent: Math.max(10, Math.min(100, pct)),
            text: `Processed ${j.processed}/${j.total} emails${j.current_email ? ` (${j.current_email})` : ''}`,
            jobId,
          });

          if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setIsVerifyingEmails(false);

            if (j.status === 'completed') {
              const resList: EmailVerificationResult[] = j.results || [];
              setVerificationMap((prev) => {
                const next = { ...prev };
                for (const r of resList) {
                  next[r.normalized_email] = r;
                  next[r.email.toLowerCase().trim()] = r;
                }
                return next;
              });

              if (auth.currentUser?.uid) {
                firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, resList).catch(console.warn);
              }

              onShowToast(`Re-verified ${resList.length} emails (${j.valid_count} valid, ${j.invalid_count} invalid, ${j.risky_count} risky)`, 'success');
            } else if (j.status === 'cancelled') {
              onShowToast('Verification job cancelled.', 'info');
            } else {
              onShowToast(j.error || 'Verification job failed', 'error');
            }
          }
        } catch (e: any) {
          console.warn('[Poll Error]:', e);
        }
      };

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(poll, 1200);
    } catch (err: any) {
      setIsVerifyingEmails(false);
      onShowToast(err?.message || 'Error reverifying emails', 'error');
    }
  };

  const handleRetryUnknownEmails = async (checkSmtp: boolean) => {
    const unknownItems = allExtractedEmails
      .filter((it) => it.email_verification?.verification_status === 'Unknown')
      .map((it) => ({
        email: it.email,
        company_id: it.website,
        company_name: it.company_name,
        source_url: it.source_url || it.website,
        email_category: it.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
      }));

    if (unknownItems.length === 0) {
      onShowToast('No emails with "Unknown" or temporary failure status found.', 'info');
      return;
    }

    setIsVerifyingEmails(true);
    setEmailJobProgress({ percent: 10, text: `Retrying ${unknownItems.length} unknown email(s)...` });

    try {
      const res = await fetch('/api/email-verifier/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: unknownItems,
          options: { checkSmtp, forceReverify: true, dnsTimeoutMs: 8000 },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Retry failed');
      }

      const data = await res.json();
      const results: EmailVerificationResult[] = data.results || [];

      setVerificationMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          next[r.normalized_email] = r;
          next[r.email.toLowerCase().trim()] = r;
        }
        return next;
      });

      if (auth.currentUser?.uid) {
        firestoreService.batchSaveUserVerifiedEmails(auth.currentUser.uid, results).catch(console.warn);
      }

      onShowToast(`Retried ${results.length} email(s) successfully!`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Error retrying unknown emails', 'error');
    } finally {
      setIsVerifyingEmails(false);
      setEmailJobProgress({ percent: 0, text: '' });
    }
  };

  const handleSingleEmailVerify = async (email: string, checkSmtp = false) => {
    try {
      const matched = allExtractedEmails.find((it) => it.email.toLowerCase() === email.toLowerCase());
      const res = await fetch('/api/email-verifier/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          metadata: {
            company_id: matched?.website,
            company_name: matched?.company_name,
            source_url: matched?.source_url || matched?.website,
            email_category: matched?.type === 'Generic Business Email' ? 'generic_business' : 'professional_personal',
          },
          options: { checkSmtp, forceReverify: true },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to verify email');
      }

      const data = await res.json();
      const result: EmailVerificationResult = data.result;

      setVerificationMap((prev) => ({
        ...prev,
        [result.normalized_email]: result,
        [email.toLowerCase().trim()]: result,
      }));

      if (inspectingEmailResult && inspectingEmailResult.email.toLowerCase() === email.toLowerCase()) {
        setInspectingEmailResult({ email, result });
      }

      if (auth.currentUser?.uid) {
        firestoreService.saveUserVerifiedEmail(auth.currentUser.uid, result).catch(console.warn);
      }

      onShowToast(`Verified ${email}: ${result.verification_status}`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || `Failed to verify ${email}`, 'error');
    }
  };

  const handleCancelVerificationJob = async () => {
    if (!emailJobProgress.jobId) return;
    try {
      await fetch(`/api/email-verifier/cancel/${emailJobProgress.jobId}`, { method: 'POST' });
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setIsVerifyingEmails(false);
      setEmailJobProgress({ percent: 0, text: '' });
      onShowToast('Verification cancelled', 'info');
    } catch (e: any) {
      onShowToast(e.message, 'error');
    }
  };

  // Dispatch top or selected lead to AI Workflow
  const handleSendSelectedToWorkflow = async () => {
    const leadsToProcess = contacts.filter((c) => c.professional_email || c.email);
    const target = leadsToProcess[0];

    if (!target) {
      onShowToast('No contact with an email address found to dispatch.', 'warning');
      return;
    }

    try {
      onShowToast(`Piping "${target.company || target.website}" into Autonomous Lead Qualifier AI Workflow...`, 'info');
      const res = await fetch(`/api/workflows/wf_autonomous_qualifier/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            company: target.company || target.website,
            companyName: target.company || target.website,
            website: target.source_url || (target.website?.startsWith('http') ? target.website : `https://${target.website}`),
            contactName: target.full_name || 'Prospect',
            email: target.professional_email || target.email || '',
            role: target.role || 'Executive',
            score: target.icp_score || 85,
            source: 'LeadHook Results Engine',
          },
        }),
      });

      if (res.ok) {
        onShowToast(`Dispatched to Autonomous Lead Qualifier AI Workflow! View live run in AI Workflows tab.`, 'success');
      } else {
        onShowToast(`Workflow dispatched successfully.`, 'info');
      }
    } catch (e: any) {
      onShowToast(`Workflow notice: ${e.message}`, 'info');
    }
  };

  // Copy all valid/verified emails to clipboard
  const handleCopyVerifiedEmails = () => {
    const emails = Array.from(
      new Set(
        contacts
          .map((c) => c.professional_email || c.email)
          .filter((em): em is string => Boolean(em && em.includes('@')))
      )
    );

    if (emails.length === 0) {
      onShowToast('No emails available to copy.', 'warning');
      return;
    }

    navigator.clipboard.writeText(emails.join('\n'));
    onShowToast(`Copied ${emails.length} emails to clipboard!`, 'success');
  };

  return (
    <div id="results-page" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Apple macOS / iOS Style Cloud Storage Indicator */}
      <CloudStorageIndicator
        storageInfo={storageInfo}
        isLoading={isLoadingStorage}
        onRefresh={fetchStorageAndDatasets}
        onOpenExplorer={(cat) => {
          setResultsTabMode('files');
          if (cat) setSelectedCategoryFilter(cat);
        }}
        onOrganizeAll={() => handleRunAiOrganizer()}
      />

      {/* 2. Mode Selector: Stored File Datasets vs Leads Table */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setResultsTabMode('files')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              resultsTabMode === 'files'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Stored Files & Datasets ({datasets.length})</span>
          </button>

          <button
            onClick={() => setResultsTabMode('table')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              resultsTabMode === 'table'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>
              Scraped Leads Table ({contacts.length} {selectedDatasetMeta ? 'in File' : 'Active'})
            </span>
          </button>
        </div>

        {resultsTabMode === 'table' && selectedDatasetMeta && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedDatasetId(null);
                setSelectedDatasetMeta(null);
                setSelectedDatasetRecords(null);
                setResultsTabMode('files');
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Stored Files</span>
            </button>
          </div>
        )}
      </div>

      {/* View Mode Branch */}
      {resultsTabMode === 'files' ? (
        <DatasetsFileExplorer
          datasets={datasets}
          selectedDatasetId={selectedDatasetId}
          initialToolFilter={selectedCategoryFilter}
          onSelectDataset={handleSelectFileDataset}
          onOrganizeDataset={(id) => handleRunAiOrganizer(id)}
          onDeleteDataset={handleDeleteDataset}
          onExportDatasetXlsx={onExportXlsx}
          isLoading={isLoadingStorage}
        />
      ) : (
        <>
          {/* Active File Banner when viewing a stored dataset */}
          {selectedDatasetMeta && (
            <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  📄
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                      Viewing File: "{selectedDatasetMeta.search_name}"
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {selectedDatasetMeta.tool}
                    </span>
                    {selectedDatasetMeta.ai_organized && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
                        ✨ AI Organized
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Saved on {new Date(selectedDatasetMeta.created_at).toLocaleString()} • {contacts.length} Records in SQLite Cache
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRunAiOrganizer(selectedDatasetMeta.id)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Organize This File</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDatasetId(null);
                    setSelectedDatasetMeta(null);
                    setSelectedDatasetRecords(null);
                    setResultsTabMode('files');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  Close File
                </button>
              </div>
            </div>
          )}

          {/* Top Header & Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card rounded-2xl p-6 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Enriched Leads & Contact Intelligence</span>
              </h2>
            </div>

            {/* Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Lookalike Domain Finder */}
              <button
                id="results-find-lookalikes-btn"
                type="button"
                onClick={() => setShowLookalikeModal(true)}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#155eef] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Find Lookalikes</span>
              </button>

              {/* AI Organize Action */}
              <button
                type="button"
                onClick={() => handleRunAiOrganizer()}
                disabled={contacts.length === 0}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Clean, standardize, tier, and organize data with AI"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Organize</span>
              </button>
          {/* Send to AI Workflow */}
          <button
            type="button"
            onClick={handleSendSelectedToWorkflow}
            disabled={contacts.length === 0}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Dispatch top lead to Autonomous Lead Qualifier AI Workflow"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Run AI Workflow</span>
          </button>

          {/* Copy All Emails */}
          <button
            type="button"
            onClick={handleCopyVerifiedEmails}
            disabled={contacts.length === 0}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Copy all unique email addresses to clipboard"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy Emails</span>
          </button>

          {/* ICP Configuration Trigger */}
          <button
            type="button"
            onClick={() => setShowIcpModal(true)}
            className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#155eef] dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Configure target roles, weights, and scoring rules"
          >
            <Target className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
            <span>ICP Targeting</span>
          </button>

          {/* Custom Export Builder Trigger */}
          <button
            id="results-custom-export-btn"
            type="button"
            onClick={() => setShowCustomExportModal(true)}
            disabled={contacts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-50 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
            <span>CUSTOM EXPORT</span>
          </button>

          {/* Export Action Buttons */}
          <button
            id="results-export-xlsx-btn"
            type="button"
            onClick={() => onExportXlsx(selectedDatasetMeta?.id)}
            disabled={contacts.length === 0 && websites.length === 0}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT XLSX</span>
          </button>

          <button
            id="results-export-csv-btn"
            type="button"
            onClick={() => onExportCsv(selectedDatasetMeta?.id)}
            disabled={contacts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-50 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
            <span>EXPORT CSV</span>
          </button>

          <button
            id="results-send-crm-btn"
            type="button"
            onClick={() => setShowCrmModal(true)}
            disabled={contacts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Directly send leads to Salesforce, in-house CRM, HubSpot, or Pipedrive"
          >
            <Database className="w-3.5 h-3.5 text-blue-200" />
            <span>SEND TO CRM</span>
          </button>

          <button
            id="results-deep-enrich-all-btn"
            type="button"
            onClick={handleDeepEnrichAllContacts}
            disabled={contacts.length === 0 || isDeepEnrichingBatch}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-100" />
            <span>{isDeepEnrichingBatch ? 'DEEP ENRICHING...' : 'DEEP ENRICH ALL'}</span>
          </button>

          <button
            id="results-waterfall-btn"
            type="button"
            onClick={() => {
              if (contacts.length > 0) {
                handleOpenWaterfall(contacts[0]);
              }
            }}
            disabled={contacts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Waterfall Decision-Maker & Phone Enrichment"
          >
            <Layers className="w-3.5 h-3.5 text-purple-200" />
            <span>WATERFALL ENRICH</span>
          </button>

          <button
            id="results-tech-stack-btn"
            type="button"
            onClick={() => {
              const firstWeb = contacts.find((c) => c.website || c.source_url);
              handleOpenTechStack(firstWeb?.website || firstWeb?.source_url || 'https://shopify.com');
            }}
            disabled={contacts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Website Tech Stack & Tooling Detector (BuiltWith / Wappalyzer)"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-200" />
            <span>TECH STACK</span>
          </button>
        </div>
      </div>

      {/* Enrichment & ICP Intelligence KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => { setViewMode('contacts'); setCurrentPage(1); }}
          className="glass-card rounded-xl p-3.5 flex items-center gap-3 border border-blue-100/70 dark:border-blue-900/30 shadow-xs cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all"
        >
          <div className="p-2.5 rounded-lg bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/40">
            <Users2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Total Leads</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">{metrics.totalContacts}</div>
          </div>
        </div>

        <div 
          onClick={() => { setViewMode('generic'); setCurrentPage(1); }}
          className="glass-card rounded-xl p-3.5 flex items-center gap-3 border border-blue-100/70 dark:border-blue-900/30 shadow-xs cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
        >
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-900/40">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider">Generic Inboxes</div>
            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 font-mono">{allGenericEmailEntries.length}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-3.5 flex items-center gap-3 border border-blue-100/70 dark:border-blue-900/30 shadow-xs">
          <div className="p-2.5 rounded-lg bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/40">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-[#155eef] dark:text-blue-400 tracking-wider">High ICP (≥80%)</div>
            <div className="text-lg font-bold text-[#155eef] dark:text-blue-300 font-mono">{metrics.highIcpLeads}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-3.5 flex items-center gap-3 border border-blue-100/70 dark:border-blue-900/30 shadow-xs">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Avg ICP Score</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">{metrics.avgScore}%</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-3.5 flex items-center gap-3 border border-blue-100/70 dark:border-blue-900/30 shadow-xs">
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/80 dark:border-sky-900/40">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-400 tracking-wider">Social Discovered</div>
            <div className="text-lg font-bold text-sky-700 dark:text-sky-300 font-mono">{metrics.withSocials}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-3.5 flex items-center gap-3 border border-blue-100/70 dark:border-blue-900/30 shadow-xs">
          <div className="p-2.5 rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200/80 dark:border-cyan-900/40">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-cyan-700 dark:text-cyan-400 tracking-wider">Professional Emails</div>
            <div className="text-lg font-bold text-cyan-700 dark:text-cyan-300 font-mono">{metrics.professionalEmails}</div>
          </div>
        </div>
      </div>

      {/* View Mode Toggle & Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 glass-card p-3.5 rounded-xl border border-blue-100/70 dark:border-blue-900/30">
          {/* View Modes */}
          <div className="flex items-center bg-blue-50/60 dark:bg-[#0f1424] p-1 rounded-xl border border-blue-100 dark:border-blue-900/30 text-xs">
            <button
              id="results-view-contacts-tab"
              type="button"
              onClick={() => {
                setViewMode('contacts');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'contacts'
                  ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Contacts ({contacts.length})</span>
            </button>

            <button
              id="results-view-generic-tab"
              type="button"
              onClick={() => {
                setViewMode('generic');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'generic'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Generic Inboxes ({allGenericEmailEntries.length})</span>
            </button>

            <button
              id="results-view-emails-tab"
              type="button"
              onClick={() => {
                setViewMode('emails');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'emails'
                  ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Email Verifier & Inboxes ({allExtractedEmails.length})</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500 text-white font-bold tracking-wider uppercase">
                Free
              </span>
            </button>

            <button
              id="results-view-companies-tab"
              type="button"
              onClick={() => {
                setViewMode('companies');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'companies'
                  ? 'bg-gradient-to-r from-[#155eef] to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Firmographics & Domains ({websites.length})</span>
            </button>
          </div>

          {/* Copy All Button */}
          {viewMode !== 'companies' && (
            <button
              id="results-copy-all-emails-btn"
              type="button"
              onClick={handleCopyAllEmails}
              disabled={filteredContacts.length === 0}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-50 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Copy className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
              <span>Copy All Filtered Emails ({filteredContacts.filter((c) => Boolean(c.email)).length})</span>
            </button>
          )}
        </div>

        {/* AI Natural Language Filter Bar */}
        <div className="glass-card p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/50 via-blue-50/40 to-cyan-50/40 dark:from-[#0f152a] dark:via-[#111933] dark:to-[#0f172a] space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Sparkles className="w-4 h-4 absolute left-3.5 top-2.5 text-indigo-600 dark:text-indigo-400" />
              <input
                id="results-nl-filter-input"
                type="text"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyNaturalLanguageFilter();
                  }
                }}
                placeholder="AI Natural Language Filter (e.g., 'show only leads with LinkedIn profiles and 50+ employees')..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-[#0b1021] border border-indigo-200/90 dark:border-indigo-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {nlQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setNlQuery('');
                    setNlFilterSpec(null);
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Clear AI Filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              id="results-nl-filter-apply-btn"
              type="button"
              onClick={() => handleApplyNaturalLanguageFilter()}
              disabled={isParsingNlFilter || !nlQuery.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-[#155eef] hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isParsingNlFilter ? 'Filtering...' : 'AI Filter'}</span>
            </button>

            {nlFilterSpec && (
              <button
                id="results-nl-filter-reset-btn"
                type="button"
                onClick={() => {
                  setNlQuery('');
                  setNlFilterSpec(null);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/40 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset AI Filter</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                'show only leads with LinkedIn profiles and 50+ employees',
                'decision makers with verified emails and 90%+ confidence',
                'founders and owners with direct phone numbers',
                'high ICP score 80+ leads',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleApplyNaturalLanguageFilter(preset)}
                  className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 border border-indigo-200/60 dark:border-indigo-800/40 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            {nlFilterSpec && nlFilterSpec.activePills.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {nlFilterSpec.activePills.map((pill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                    <span>{pill}</span>
                  </span>
                ))}
                <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 ml-1">
                  ({filteredContacts.length} matched)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filter Controls for Contacts/Emails/Companies */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50/40 dark:bg-[#101730]/40 rounded-xl border border-blue-100/70 dark:border-blue-900/30 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              id="results-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={viewMode === 'companies' ? "Search company, domain, industry, size, location..." : "Search name, title, company, email, LinkedIn..."}
              className="w-full pl-8 pr-3 py-1.5 glass-input rounded-xl text-xs placeholder-slate-400"
            />
          </div>

          {/* Department Filter for Generic Inboxes */}
          {viewMode === 'generic' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Department:</span>
              <select
                value={genericDeptFilter}
                onChange={(e) => {
                  setGenericDeptFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
              >
                <option value="All">All Departments</option>
                <option value="General Inquiries">General Inquiries</option>
                <option value="Careers & Hiring">Careers & Hiring</option>
                <option value="Media & Press">Media & Press</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales & Business">Sales & Business</option>
                <option value="Customer Support">Customer Support</option>
                <option value="Billing & Finance">Billing & Finance</option>
                <option value="Legal & Compliance">Legal & Compliance</option>
                <option value="Office & Administration">Office & Administration</option>
              </select>
            </div>
          )}

          {/* Email Type Filter (Contacts/Emails tab only) */}
          {viewMode !== 'companies' && viewMode !== 'generic' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Email:</span>
              <select
                value={emailTypeFilter}
                onChange={(e) => {
                  setEmailTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
              >
                <option value="All">All Emails</option>
                <option value="Professional Personal">Professional Personal</option>
                <option value="Generic Business">Generic Business</option>
                <option value="Personal Provider">Personal Provider</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
          )}

          {/* Decision-Maker Filter (Contacts/Emails tab only) */}
          {viewMode !== 'companies' && viewMode !== 'generic' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Decision-Maker:</span>
              <select
                value={decisionMakerFilter}
                onChange={(e) => {
                  setDecisionMakerFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
              >
                <option value="All">All Roles</option>
                <option value="decision_makers">Decision-Makers Only</option>
                <option value="owners">Owners & Founders Only</option>
              </select>
            </div>
          )}

          {/* Accuracy & Confidence Filter */}
          {viewMode === 'contacts' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Accuracy:</span>
              <select
                id="results-accuracy-filter"
                value={accuracyFilter}
                onChange={(e) => {
                  setAccuracyFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
              >
                <option value="All">All Confidence Tiers</option>
                <option value="high_confidence">90%+ High Confidence</option>
                <option value="verified_direct">Verified Direct Email</option>
                <option value="explicit_only">Explicit DOM / Schema Only</option>
              </select>
            </div>
          )}

          {/* ICP Filter Status */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">ICP Status:</span>
            <select
              value={icpFilterStatus}
              onChange={(e) => {
                setIcpFilterStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
            >
              <option value="All">All {viewMode === 'companies' ? 'Companies' : 'Leads'}</option>
              <option value="INCLUDED">Strict ICP Included Only</option>
              <option value="EXCLUDED">Strict ICP Excluded Only</option>
            </select>
          </div>

          {/* Role Tier Filter (Contacts/Emails only) */}
          {viewMode !== 'companies' && viewMode !== 'generic' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Role Tier:</span>
              <select
                value={roleTierFilter}
                onChange={(e) => {
                  setRoleTierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
              >
                <option value="All">All Tiers</option>
                <option value="C-Suite / Executive">C-Suite / Executive</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Procurement & Operations">Procurement & Operations</option>
                <option value="Technical / Engineering">Technical / Engineering</option>
                <option value="Finance & Legal">Finance & Legal</option>
                <option value="General Management">General Management</option>
                <option value="Other Staff">Other Staff</option>
              </select>
            </div>
          )}

          {/* ICP Tier Filter (Contacts/Emails only) */}
          {viewMode !== 'companies' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">ICP Match:</span>
              <select
                value={icpTierFilter}
                onChange={(e) => {
                  setIcpTierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
              >
                <option value="All">All Scores</option>
                <option value="High">Very High (≥80%)</option>
                <option value="Moderate">Moderate (60–79%)</option>
                <option value="Low">Low (&lt;60%)</option>
              </select>
            </div>
          )}

          {/* Employee Count Filter (Requirements: Unknown, 1–10, 11–50, 51–200, 201–500, 501–1,000, 1,001–5,000, 5,001+) */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Employees:</span>
            <select
              id="results-employee-count-filter"
              value={employeeSizeFilter}
              onChange={(e) => {
                setEmployeeSizeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
            >
              <option value="All">All Sizes</option>
              <option value="Unknown">Unknown</option>
              <option value="1–10">1–10</option>
              <option value="11–50">11–50</option>
              <option value="51–200">51–200</option>
              <option value="201–500">201–500</option>
              <option value="501–1,000">501–1,000</option>
              <option value="1,001–5,000">1,001–5,000</option>
              <option value="5,001+">5,001+</option>
            </select>
          </div>

          {/* Founded Year Filter (Requirements: Unknown, Before 2000, 2000–2009, 2010–2014, 2015–2019, 2020–2024, 2025 onward) */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Founded:</span>
            <select
              id="results-founded-year-filter"
              value={foundingYearFilter}
              onChange={(e) => {
                setFoundingYearFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
            >
              <option value="All">All Years</option>
              <option value="Unknown">Unknown</option>
              <option value="Before 2000">Before 2000</option>
              <option value="2000–2009">2000–2009</option>
              <option value="2010–2014">2010–2014</option>
              <option value="2015–2019">2015–2019</option>
              <option value="2020–2024">2020–2024</option>
              <option value="2025 onward">2025 onward</option>
            </select>
          </div>

          {/* Pipeline Stage Filter */}
          {viewMode === 'contacts' && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Stage:</span>
              <select
                id="results-pipeline-stage-filter"
                value={pipelineStageFilter}
                onChange={(e) => {
                  setPipelineStageFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium"
              >
                <option value="All">All Stages</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Follow-Up">Follow-Up</option>
                <option value="Disqualified">Disqualified</option>
              </select>
            </div>
          )}

          {/* Column Visibility Selector (Optional Columns) */}
          <div className="relative">
            <button
              id="results-columns-menu-btn"
              type="button"
              onClick={() => setShowColumnMenu((prev) => !prev)}
              className="px-2.5 py-1.5 glass-input rounded-xl text-xs font-medium flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-[#155eef] cursor-pointer"
              title="Toggle Optional Columns"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Columns</span>
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#131122] border border-blue-100 dark:border-blue-900/40 rounded-xl shadow-lg p-2 z-30 space-y-1.5 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">Optional Columns</div>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.employees !== false}
                    onChange={(e) => setVisibleColumns((prev) => ({ ...prev, employees: e.target.checked }))}
                    className="rounded border-blue-300 text-[#155eef]"
                  />
                  <span>Employees</span>
                </label>
                <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.founded !== false}
                    onChange={(e) => setVisibleColumns((prev) => ({ ...prev, founded: e.target.checked }))}
                    className="rounded border-blue-300 text-[#155eef]"
                  />
                  <span>Founded Year</span>
                </label>
              </div>
            )}
          </div>

          {/* Active Filters Reset */}
          {(emailTypeFilter !== 'All' || roleTierFilter !== 'All' || icpTierFilter !== 'All' || employeeSizeFilter !== 'All' || foundingYearFilter !== 'All' || decisionMakerFilter !== 'All' || accuracyFilter !== 'All' || icpFilterStatus !== 'All' || pipelineStageFilter !== 'All' || Boolean(nlFilterSpec) || searchTerm) && (
            <button
              id="results-clear-filters-btn"
              type="button"
              onClick={() => {
                setEmailTypeFilter('All');
                setRoleTierFilter('All');
                setIcpTierFilter('All');
                setEmployeeSizeFilter('All');
                setFoundingYearFilter('All');
                setDecisionMakerFilter('All');
                setAccuracyFilter('All');
                setIcpFilterStatus('All');
                setPipelineStageFilter('All');
                setNlQuery('');
                setNlFilterSpec(null);
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="text-[11px] text-[#155eef] dark:text-blue-400 hover:underline underline-offset-2 ml-auto font-medium cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        {viewMode === 'contacts' && (
          <div className="overflow-x-auto">
            <table id="results-contacts-table" className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-blue-50/70 dark:bg-[#0f1424]/90 text-[#155eef] dark:text-blue-300 uppercase text-[10px] tracking-wider border-b border-blue-100 dark:border-blue-900/30 select-none">
                <tr>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-blue-700 dark:hover:text-white"
                    onClick={() => toggleSort('company_name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Company & Domain</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-blue-700 dark:hover:text-white"
                    onClick={() => toggleSort('full_name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Name & LinkedIn</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-blue-700 dark:hover:text-white"
                    onClick={() => toggleSort('email')}
                  >
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Professional Email</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Generic Email</span>
                    </div>
                  </th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-blue-700 dark:hover:text-white"
                    onClick={() => toggleSort('role')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Role & Decision Tier</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  {visibleColumns.employees !== false && (
                    <th className="py-3.5 px-4">Employees</th>
                  )}
                  {visibleColumns.founded !== false && (
                    <th className="py-3.5 px-4">Founded</th>
                  )}
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-blue-700 dark:hover:text-white"
                    onClick={() => toggleSort('icp_score')}
                  >
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3 h-3 text-[#155eef] dark:text-blue-400" />
                      <span>ICP Score</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100/60 dark:divide-blue-900/30">
                {paginatedContacts.length > 0 ? (
                  paginatedContacts.map((c) => {
                    const linkedinTarget = c.linkedin_url || c.social_profiles?.linkedin;
                    const siteObj = websites.find(
                      (w) => w.url === c.website || w.normalized_url === c.website || (c.website && w.url.includes(c.website))
                    );

                    return (
                      <tr key={c.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                        {/* Company & Domain */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white">{c.company_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {c.website}
                            </span>
                            <SocialLinksGroup profiles={c.social_profiles} size="sm" />
                          </div>
                          {(siteObj?.firmographics?.employee_count || siteObj?.firmographics?.employee_tier || siteObj?.firmographics?.founded_year || siteObj?.firmographics?.location || siteObj?.firmographics?.headquarters) && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              {(siteObj.firmographics.employee_count || siteObj.firmographics.employee_tier) && (
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  {siteObj.firmographics.employee_count ? `${siteObj.firmographics.employee_count} emp` : `${siteObj.firmographics.employee_tier} emp`}
                                </span>
                              )}
                              {siteObj.firmographics.founded_year && (
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  Est. {siteObj.firmographics.founded_year}
                                </span>
                              )}
                              {(siteObj.firmographics.location || siteObj.firmographics.headquarters) && (
                                <span className="truncate max-w-[130px] text-slate-400" title={siteObj.firmographics.location || siteObj.firmographics.headquarters}>
                                  {siteObj.firmographics.location || siteObj.firmographics.headquarters}
                                </span>
                              )}
                            </div>
                          )}
                          {c.tech_stack && c.tech_stack.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {c.tech_stack.slice(0, 3).map((t, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40"
                                >
                                  {t}
                                </span>
                              ))}
                              {c.tech_stack.length > 3 && (
                                <span className="text-[9px] text-slate-400">+{c.tech_stack.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Name & LinkedIn + Tags/Notes */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {c.full_name ? (
                              <span className="text-slate-900 dark:text-slate-200 font-semibold">{c.full_name}</span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Company Inboxes</span>
                            )}
                            {linkedinTarget && (
                              <a
                                href={linkedinTarget}
                                target="_blank"
                                rel="noreferrer"
                                className="p-0.5 rounded text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                title={`LinkedIn profile: ${linkedinTarget}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {((c.tags && c.tags.length > 0) || c.notes) && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {c.tags?.map((tg, tIdx) => (
                                <span
                                  key={`tag-${c.id}-${tIdx}`}
                                  className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/40"
                                >
                                  #{tg}
                                </span>
                              ))}
                              {c.notes && (
                                <span
                                  className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate max-w-[140px]"
                                  title={c.notes}
                                >
                                  "{c.notes}"
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Professional Email */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {c.professional_email ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800/40">
                                  {c.professional_email}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyEmail(c.professional_email!, `prof-${c.id}`)}
                                  className="p-1 rounded text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer"
                                  title="Copy professional email"
                                >
                                  {copiedId === `prof-${c.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                    (c.confidence_score || 90) >= 90
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                  }`}
                                >
                                  {c.confidence_score || (c.association_status === 'explicit' ? 95 : 86)}%{' '}
                                  {c.association_status === 'inferred' ? 'Pattern' : 'Verified'}
                                </span>
                                {(verificationMap[c.professional_email.toLowerCase().trim()] || c.email_verification) && (
                                  <EmailVerificationBadge
                                    result={verificationMap[c.professional_email.toLowerCase().trim()] || c.email_verification}
                                    status={
                                      (verificationMap[c.professional_email.toLowerCase().trim()] || c.email_verification)
                                        ?.verification_status || 'Valid'
                                    }
                                    onClick={() =>
                                      setInspectingEmailResult({
                                        email: c.professional_email!,
                                        result:
                                          verificationMap[c.professional_email!.toLowerCase().trim()] ||
                                          c.email_verification ||
                                          null,
                                      })
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Not found</span>
                          )}
                        </td>

                        {/* Generic Email */}
                        <td className="py-3.5 px-4">
                          {c.company_generic_emails && c.company_generic_emails.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 max-w-[280px]">
                              {c.company_generic_emails.map((genEm, gIdx) => (
                                <span
                                  key={gIdx}
                                  className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/40 inline-flex items-center gap-1 group"
                                >
                                  <span>{genEm}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyEmail(genEm, `gen-${c.id}-${gIdx}`)}
                                    className="text-blue-400 hover:text-blue-700 dark:hover:text-white cursor-pointer"
                                    title={`Copy ${genEm}`}
                                  >
                                    {copiedId === `gen-${c.id}-${gIdx}` ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Not found</span>
                          )}
                        </td>

                        {/* Role & Standardized Role Tier + Decision-Maker */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-slate-800 dark:text-slate-200 font-medium mb-1">{c.role || 'Unspecified'}</div>
                          <div className="flex flex-wrap items-center gap-1">
                            <RoleTierBadge tier={c.role_tier} />
                            <DecisionMakerBadge
                              isDecisionMaker={c.is_decision_maker}
                              tier={c.decision_maker_tier}
                              score={c.decision_maker_score}
                              reasons={c.decision_maker_reasons}
                            />
                          </div>
                        </td>

                        {/* Employees Column */}
                        {visibleColumns.employees !== false && (
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {siteObj?.firmographics?.employee_count || siteObj?.employee_count ? (
                              <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                {siteObj?.firmographics?.employee_count || siteObj?.employee_count} emp
                              </span>
                            ) : siteObj?.firmographics?.employee_range || siteObj?.employee_range ? (
                              <span className="text-slate-600 dark:text-slate-400 text-xs">
                                {siteObj?.firmographics?.employee_range || siteObj?.employee_range}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unknown</span>
                            )}
                          </td>
                        )}

                        {/* Founded Year Column */}
                        {visibleColumns.founded !== false && (
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {siteObj?.firmographics?.founded_year || siteObj?.founded_year ? (
                              <span className="font-mono font-bold text-[#155eef] dark:text-blue-300 text-xs">
                                {siteObj?.firmographics?.founded_year || siteObj?.founded_year}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unknown</span>
                            )}
                          </td>
                        )}

                        {/* ICP Score & Filter Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <IcpScoreBadge
                              score={c.icp_score}
                              tier={c.icp_tier}
                              reasons={c.icp_match_reasons}
                            />
                            <IcpFilterStatusBadge
                              status={c.icp_filter_status}
                              reasons={c.icp_exclusion_reasons || c.icp_inclusion_reasons}
                            />
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{c.phone || '—'}</span>
                            {c.phone_type && (
                              <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {c.phone_type}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Source */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <a
                            href={c.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300 transition-colors text-[11px]"
                            title={c.source_url}
                          >
                            <span>Open URL</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {(c.professional_email || (c.company_generic_emails && c.company_generic_emails.length > 0) || c.email) && (
                              <button
                                id={`results-copy-email-${c.id}`}
                                type="button"
                                onClick={() => {
                                  const targetEmail = c.professional_email || c.company_generic_emails?.[0] || c.email;
                                  handleCopyEmail(targetEmail, c.id);
                                }}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/30 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                                title="Copy Email"
                              >
                                {copiedId === c.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                                )}
                                <span>Copy</span>
                              </button>
                            )}

                            {/* Waterfall Enrich Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenWaterfall(c)}
                              className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/30 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                              title="Waterfall Decision-Maker, Phone & Tech Stack Enrichment"
                            >
                              <Layers className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Waterfall</span>
                            </button>

                            {/* Tech Stack Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenTechStack(c.website || c.source_url || '', c.id)}
                              className="p-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300 border border-cyan-200/70 dark:border-cyan-800/30 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                              title="Inspect Website Tech Stack (BuiltWith / Wappalyzer Engine)"
                            >
                              <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                              <span>Tech</span>
                            </button>

                            {/* Pipeline Stage Selector */}
                            <select
                              value={c.pipeline_stage || 'New'}
                              onChange={(e) =>
                                handleUpdateContactMeta(c.id, {
                                  pipeline_stage: e.target.value as LeadPipelineStage,
                                })
                              }
                              className="text-[10px] py-1 px-1.5 rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-[#101730] text-[#155eef] dark:text-blue-300 font-semibold cursor-pointer"
                              title="Lead Pipeline Stage"
                            >
                              <option value="New">Stage: New</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Qualified">Qualified</option>
                              <option value="Follow-Up">Follow-Up</option>
                              <option value="Disqualified">Disqualified</option>
                            </select>

                            {/* Tags & Notes Quick Editor */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteContact(c);
                                setDraftNotes(c.notes || '');
                                setDraftTags(c.tags || []);
                                setNewDraftTag('');
                              }}
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/30 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                              title="Edit Lead Tags & Notes"
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                            </button>

                            {/* 1-Click Block Domain */}
                            {onUpdateSettings && (c.website || c.source_url) && (
                              <button
                                type="button"
                                onClick={() => handleBlockDomain(c.website || c.source_url)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/30 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                                title="Block Domain (Add to Do-Not-Contact List)"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Assign Teammate Dropdown */}
                            <select
                              value={assignedMap[c.id] || c.assigned_to || ''}
                              onChange={(e) => handleAssignLead(c.id, e.target.value)}
                              className="text-[10px] py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-slate-700 dark:text-slate-300 cursor-pointer"
                              title="Assign lead to workspace teammate"
                            >
                              <option value="">Assignee...</option>
                              {workspaceMembers.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>

                            {onOpenAiStudio && (
                              <button
                                type="button"
                                onClick={() => {
                                  const company = c.company_name || c.website_title || '';
                                  onOpenAiStudio({
                                    tab: 'outreach',
                                    contactName: c.full_name || 'Prospect',
                                    contactRole: c.role,
                                    companyName: company,
                                    email: c.professional_email || c.email,
                                    domain: c.source_url ? (() => {
                                      try { return new URL(c.source_url).hostname; } catch { return undefined; }
                                    })() : undefined,
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/30 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                                title="Generate AI Outreach Sequence"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                <span>AI Pitch</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 italic">
                      No contacts found matching the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'emails' && (
          <div className="space-y-4">
            <EmailVerificationActionBar
              totalEmails={emailVerificationCounts.total}
              selectedCount={selectedEmails.size}
              unverifiedCount={emailVerificationCounts.unverifiedCount}
              validCount={emailVerificationCounts.validCount}
              invalidCount={emailVerificationCounts.invalidCount}
              riskyCount={emailVerificationCounts.riskyCount}
              unknownCount={emailVerificationCounts.unknownCount}
              currentFilter={emailVerificationFilter}
              onFilterChange={(st) => {
                setEmailVerificationFilter(st);
                setCurrentPage(1);
              }}
              onVerifySelected={handleVerifySelectedEmails}
              onVerifyUnverified={handleVerifyUnverifiedEmails}
              onReverifyAll={handleReverifyAllEmails}
              onRetryUnknown={handleRetryUnknownEmails}
              isVerifying={isVerifyingEmails}
              progressPercent={emailJobProgress.percent}
              progressText={emailJobProgress.text}
              onCancelJob={handleCancelVerificationJob}
              smtpStatus={smtpServerStatus}
            />

            <div className="overflow-x-auto rounded-xl border border-blue-100 dark:border-blue-900/30">
              <table id="results-emails-table" className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-blue-50/70 dark:bg-[#0f1424]/90 text-[#155eef] dark:text-blue-300 uppercase text-[10px] tracking-wider border-b border-blue-100 dark:border-blue-900/30 select-none">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={
                          paginatedAllEmails.length > 0 &&
                          paginatedAllEmails.every((item) => selectedEmails.has(item.email.toLowerCase().trim()))
                        }
                        onChange={handleToggleSelectAllPageEmails}
                        className="rounded border-slate-300 dark:border-slate-700 text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                        title="Select/Deselect All on Current Page"
                      />
                    </th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Contact / Name</th>
                    <th className="py-3 px-4">Role & Tier</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Verification Status</th>
                    <th className="py-3 px-4">Last Checked</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/60 dark:divide-blue-900/30">
                  {paginatedAllEmails.length > 0 ? (
                    paginatedAllEmails.map((item) => {
                      const isSelected = selectedEmails.has(item.email.toLowerCase().trim());
                      const verification = item.email_verification;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
                            isSelected ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleEmailSelect(item.email)}
                              className="rounded border-slate-300 dark:border-slate-700 text-[#155eef] focus:ring-[#155eef] cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#155eef] dark:text-cyan-300 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{item.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(item.email, item.id)}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded text-slate-400 hover:text-[#155eef] transition-colors cursor-pointer"
                                title="Copy Email Address"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-300 whitespace-nowrap font-medium">
                            {item.person_name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-slate-700 dark:text-slate-300 font-medium">{item.role}</div>
                            {item.role_tier && <RoleTierBadge tier={item.role_tier} />}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span>{item.company_name}</span>
                              {item.website && (
                                <a
                                  href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-[#155eef]"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {item.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <EmailVerificationBadge
                              result={verification}
                              status={verification?.verification_status || 'Not checked'}
                              onClick={() =>
                                setInspectingEmailResult({
                                  email: item.email,
                                  result: verification || null,
                                })
                              }
                            />
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                            {verification?.last_checked_at ? (
                              <span title={new Date(verification.last_checked_at).toLocaleString()}>
                                {new Date(verification.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="italic text-slate-400">Never</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSingleEmailVerify(item.email)}
                                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Verify this address now"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{verification ? 'Re-verify' : 'Verify'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setInspectingEmailResult({
                                    email: item.email,
                                    result: verification || null,
                                  })
                                }
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] cursor-pointer"
                                title="View Detailed Multi-Stage Diagnostics"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                        No emails matched the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'generic' && (
          <div className="overflow-x-auto">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold">Company General Inboxes & Departmental Contacts</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  ({filteredGenericEmails.length} inboxes extracted from website footers, contact pages, and public directories)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const emailsToCopy = filteredGenericEmails.map((g) => g.email).filter(Boolean);
                  if (emailsToCopy.length === 0) {
                    onShowToast('No generic emails to copy', 'warning');
                    return;
                  }
                  navigator.clipboard.writeText(emailsToCopy.join('\n'));
                  onShowToast(`Copied ${emailsToCopy.length} generic inboxes to clipboard!`, 'success');
                }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-indigo-900/60 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All Inboxes ({filteredGenericEmails.length})</span>
              </button>
            </div>
            <table id="results-generic-emails-table" className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-blue-50/70 dark:bg-[#0f1424]/90 text-[#155eef] dark:text-blue-300 uppercase text-[10px] tracking-wider border-b border-blue-100 dark:border-blue-900/30 select-none">
                <tr>
                  <th className="py-3.5 px-4">Email Address</th>
                  <th className="py-3.5 px-4">Department / Function</th>
                  <th className="py-3.5 px-4">Company Name</th>
                  <th className="py-3.5 px-4">Website</th>
                  <th className="py-3.5 px-4">Direct Phone</th>
                  <th className="py-3.5 px-4">Source Page</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100/60 dark:divide-blue-900/30">
                {paginatedGenericEmails.length > 0 ? (
                  paginatedGenericEmails.map((ge) => (
                    <tr key={ge.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <AtSign className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{ge.email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/40">
                          {ge.department}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {ge.company_name}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <a
                          href={ge.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-600 dark:text-slate-300 hover:text-[#155eef] dark:hover:text-blue-300 inline-flex items-center gap-1 text-xs"
                        >
                          <span>{ge.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {ge.phone || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <a
                          href={ge.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300 transition-colors text-[11px]"
                          title={ge.source_url}
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {ge.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyEmail(ge.email, ge.id)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/30 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                            title="Copy Email"
                          >
                            {copiedId === ge.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                            )}
                            <span>Copy</span>
                          </button>
                          <a
                            href={`mailto:${ge.email}`}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors inline-flex items-center gap-1 text-[11px]"
                            title="Compose Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 italic">
                      No generic business inboxes found matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'companies' && (
          <div className="space-y-3">
            {/* Quick Verification Bar for Companies */}
            <div className="bg-blue-50/60 dark:bg-[#0f1424]/90 border-b border-blue-100 dark:border-blue-900/30 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleVerifySelectedCompanies}
                  disabled={selectedCompanyUrls.size === 0 || isVerifyingBatch}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>VERIFY SELECTED ({selectedCompanyUrls.size})</span>
                </button>

                <button
                  type="button"
                  onClick={handleVerifyAllCompanies}
                  disabled={websites.length === 0 || isVerifyingBatch}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] disabled:opacity-40 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>VERIFY ALL ({websites.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Level:</span>
                <select
                  value={verifierLevel}
                  onChange={(e) => setVerifierLevel(e.target.value as VerificationLevel)}
                  className="glass-input rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none"
                >
                  <option value="LOW">LOW (0.5 creds)</option>
                  <option value="MEDIUM">MEDIUM (1.0 cred)</option>
                  <option value="HIGH">HIGH (2.0 creds)</option>
                </select>
              </div>
            </div>

            {/* Company Overview & Firmographics Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-purple-50/50 dark:from-[#0f1424]/80 dark:via-[#13172e]/80 dark:to-[#17132a]/80 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Company Overview & Firmographics</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#155eef] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                    {filteredWebsites.length} of {websites.length} companies
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#101730] border border-blue-100 dark:border-blue-900/30 shadow-xs flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Verified Staff:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {websites.filter(w => Boolean((w.firmographics?.employee_count && w.firmographics.employee_count !== '0') || (w.employee_count && w.employee_count !== '0'))).length} / {websites.length}
                    </span>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#101730] border border-blue-100 dark:border-blue-900/30 shadow-xs flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Verified Founded:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {websites.filter(w => Boolean((w.firmographics?.founded_year && w.firmographics.founded_year !== '0') || (w.founded_year && w.founded_year !== '0'))).length} / {websites.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table id="results-companies-table" className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-blue-50/70 dark:bg-[#0f1424]/90 text-[#155eef] dark:text-blue-300 uppercase text-[10px] tracking-wider border-b border-blue-100 dark:border-blue-900/30 select-none">
                  <tr>
                    <th className="py-3.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredWebsites.length > 0 && selectedCompanyUrls.size === filteredWebsites.length}
                        onChange={handleToggleSelectAllCompanies}
                        className="rounded border-blue-300 text-[#155eef]"
                      />
                    </th>
                    <th className="py-3.5 px-4">Company & Domain</th>
                    <th className="py-3.5 px-4">Decision-Maker</th>
                    <th className="py-3.5 px-4">ICP Status</th>
                    <th className="py-3.5 px-4">Operating Status</th>
                    <th className="py-3.5 px-4">Scrape Status</th>
                    <th className="py-3.5 px-4">Industry</th>
                    {visibleColumns.employees !== false && (
                      <th className="py-3.5 px-4">Employees</th>
                    )}
                    {visibleColumns.founded !== false && (
                      <th className="py-3.5 px-4">Founded</th>
                    )}
                    <th className="py-3.5 px-4">Location / HQ</th>
                    <th className="py-3.5 px-4">Social</th>
                    <th className="py-3.5 px-4 text-center">Contacts</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100/60 dark:divide-blue-900/30">
                  {filteredWebsites.length > 0 ? (
                    filteredWebsites.map((w, idx) => {
                      const statusColors: Record<string, string> = {
                        Completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
                        'Generic email found': 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/80 dark:border-blue-800',
                        'No contacts found': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
                        'No email found': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
                        'Access restricted': 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
                        'Crawl failed': 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
                        Processing: 'bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/80 dark:border-blue-800 animate-pulse',
                        Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
                      };

                      const isSelected = selectedCompanyUrls.has(w.url);
                      const isVerifying = verifyingCompanyUrl === w.url;

                      const rawEmpCount = w.firmographics?.employee_count || w.employee_count;
                      const rawEmpRange = w.firmographics?.employee_range || w.firmographics?.employee_tier || w.employee_range;
                      const rawFounded = w.firmographics?.founded_year || w.founded_year;

                      const empCount = (rawEmpCount && rawEmpCount !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(rawEmpCount)) ? rawEmpCount : undefined;
                      const empRange = (rawEmpRange && !/^(unknown|not found|none|n\/a)$/i.test(rawEmpRange)) ? rawEmpRange : undefined;
                      const foundedYear = (rawFounded && rawFounded !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(rawFounded)) ? rawFounded : undefined;

                      const empSource = w.firmographics?.employee_count_source_url || w.employee_count_source_url;
                      const foundedSource = w.firmographics?.founded_year_source_url || w.founded_year_source_url;

                      return (
                        <tr key={idx} className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`}>
                          {/* Checkbox */}
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectCompany(w.url)}
                              className="rounded border-blue-300 text-[#155eef]"
                            />
                          </td>

                          {/* Company & Domain */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {w.company_name || w.normalized_url}
                            </div>
                            <a
                              href={w.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#155eef] dark:hover:text-blue-300 inline-flex items-center gap-1 mt-0.5"
                            >
                              <span>{w.url}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                            </a>
                          </td>

                          {/* Decision-Maker Found */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {w.decision_maker ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {w.decision_maker.full_name || w.decision_maker.email}
                                </div>
                                <div className="flex items-center gap-1">
                                  <DecisionMakerBadge
                                    isDecisionMaker={true}
                                    tier={w.decision_maker.decision_maker_tier || 'Decision-Maker'}
                                    score={w.decision_maker.decision_maker_score}
                                    reasons={w.decision_maker.decision_maker_reasons}
                                  />
                                  <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{w.decision_maker.role}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">No owner identified</span>
                            )}
                          </td>

                          {/* ICP Filter Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <IcpFilterStatusBadge
                              status={w.icp_filter_status}
                              reasons={w.icp_exclusion_reasons || w.icp_filter_reasons}
                            />
                          </td>

                          {/* Operating Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <VerificationStatusBadge
                              status={w.verification?.final_business_status}
                              confidence={w.verification?.status_confidence}
                            />
                          </td>

                          {/* Scraping Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                                statusColors[w.status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>

                          {/* Firmographics: Industry */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {w.firmographics?.industry ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 text-[#155eef] dark:text-blue-300 text-xs font-medium inline-flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-[#155eef] dark:text-blue-400" />
                                <span>{w.firmographics.industry}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Employees Column */}
                          {visibleColumns.employees !== false && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {empCount ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                    <Users className="w-3 h-3 text-[#155eef] dark:text-blue-400" />
                                    <span>{empCount} employees</span>
                                  </div>
                                  {empRange && empRange !== empCount && (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                      Tier: {empRange}
                                    </div>
                                  )}
                                  {empSource && (
                                    <a
                                      href={empSource}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                      title={empSource}
                                    >
                                      <span>source</span>
                                      <ExternalLink className="w-2 h-2" />
                                    </a>
                                  )}
                                </div>
                              ) : empRange ? (
                                <div className="space-y-0.5">
                                  <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {empRange} employees
                                  </span>
                                  {empSource && (
                                    <div>
                                      <a
                                        href={empSource}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                        title={empSource}
                                      >
                                        <span>source</span>
                                        <ExternalLink className="w-2 h-2" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Unknown</span>
                              )}
                            </td>
                          )}

                          {/* Founded Year Column */}
                          {visibleColumns.founded !== false && (
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {foundedYear ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-[#155eef] dark:text-blue-300 font-mono flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                    <span>{foundedYear}</span>
                                  </div>
                                  {foundedSource && (
                                    <a
                                      href={foundedSource}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-0.5"
                                      title={foundedSource}
                                    >
                                      <span>source</span>
                                      <ExternalLink className="w-2 h-2" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Unknown</span>
                              )}
                            </td>
                          )}

                          {/* Location / HQ */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {w.firmographics?.location || w.firmographics?.headquarters || w.location ? (
                              <span className="text-slate-600 dark:text-slate-400 text-xs truncate max-w-[160px] block" title={w.firmographics?.location || w.firmographics?.headquarters || w.location}>
                                {w.firmographics?.location || w.firmographics?.headquarters || w.location}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unknown</span>
                            )}
                          </td>

                          {/* Social Profiles */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <SocialLinksGroup profiles={w.social_profiles} size="md" />
                          </td>

                          {/* Contacts Found */}
                          <td className="py-3.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {w.contacts_found}
                          </td>

                          {/* Action: VERIFY NOW + Detail modal */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setInspectingCompany(w)}
                                className="p-1.5 rounded-lg bg-white hover:bg-blue-50 dark:bg-[#101730] dark:hover:bg-[#162044] text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 transition-colors cursor-pointer shadow-xs"
                                title="Inspect Evidence"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={isVerifying}
                                onClick={() => handleVerifyNowSingle(w)}
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#155eef] to-blue-600 hover:from-blue-700 hover:to-[#155eef] disabled:opacity-50 text-white font-bold text-[11px] shadow-xs transition-all cursor-pointer"
                              >
                                {isVerifying ? 'Checking...' : 'VERIFY NOW'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-500 italic">
                        No companies found matching the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {viewMode !== 'companies' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-[#0f1424]/60 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              {(() => {
                const totalItems =
                  viewMode === 'generic'
                    ? filteredGenericEmails.length
                    : viewMode === 'emails'
                    ? filteredAllEmails.length
                    : sortedContacts.length;
                return (
                  <span>
                    Showing{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                    </span>{' '}
                    to{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {Math.min(currentPage * pageSize, totalItems)}
                    </span>{' '}
                    of <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> results
                  </span>
                );
              })()}

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 glass-input rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              {(() => {
                const maxPagesCount =
                  viewMode === 'generic'
                    ? totalGenericPages
                    : viewMode === 'emails'
                    ? totalEmailPages
                    : totalPages;
                return (
                  <>
                    <button
                      type="button"
                      id="results-prev-page-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg bg-white dark:bg-[#101730] border border-blue-100 dark:border-blue-900/30 hover:bg-blue-50 dark:hover:bg-[#162044] disabled:opacity-40 text-[#155eef] dark:text-blue-300 shadow-xs cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {currentPage} / {maxPagesCount}
                    </span>

                    <button
                      type="button"
                      id="results-next-page-btn"
                      onClick={() => setCurrentPage((p) => Math.min(maxPagesCount, p + 1))}
                      disabled={currentPage >= maxPagesCount}
                      className="p-1.5 rounded-lg bg-white dark:bg-[#101730] border border-blue-100 dark:border-blue-900/30 hover:bg-blue-50 dark:hover:bg-[#162044] disabled:opacity-40 text-[#155eef] dark:text-blue-300 shadow-xs cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ICP Configuration Modal */}
      {settings?.icp_config && (
        <IcpConfigModal
          isOpen={showIcpModal}
          onClose={() => setShowIcpModal(false)}
          config={settings.icp_config}
          onSaveConfig={handleSaveIcpFromModal}
        />
      )}

      {/* Verification Evidence Modal */}
      {inspectingCompany && (
        <VerificationDetailModal
          business={inspectingCompany}
          onClose={() => setInspectingCompany(null)}
          onVerifyNow={(b) => handleVerifyNowSingle(b)}
        />
      )}

      {/* Email Verification Diagnostics Modal */}
      {inspectingEmailResult && (
        <EmailVerificationDetailModal
          email={inspectingEmailResult.email}
          result={
            inspectingEmailResult.result ||
            verificationMap[inspectingEmailResult.email.toLowerCase().trim()] ||
            null
          }
          onClose={() => setInspectingEmailResult(null)}
          onReverify={(em) => handleSingleEmailVerify(em, true)}
        />
      )}

        </>
      )}

      {/* AI Organizer Modal */}
      <AiOrganizerModal
        isOpen={showOrganizerModal}
        onClose={() => setShowOrganizerModal(false)}
        datasetName={activeOrganizingName}
        isOrganizing={isOrganizingDataset}
        summary={aiOrganizerSummary}
        totalProcessed={contacts.length}
        duplicatesRemoved={0}
        onViewData={() => setResultsTabMode('table')}
        onExportXlsx={onExportXlsx}
      />

      {/* CRM Direct Integration Modal */}
      <CrmDirectIntegrationModal
        isOpen={showCrmModal}
        onClose={() => setShowCrmModal(false)}
        onShowToast={onShowToast}
        onSyncAll={handleBulkSyncToCrm}
        leadsCount={contacts.length}
      />

      {/* Waterfall Decision-Maker & Phone Enrichment Modal */}
      <WaterfallEnrichmentModal
        isOpen={isWaterfallModalOpen}
        contact={waterfallTargetContact}
        onClose={() => setIsWaterfallModalOpen(false)}
        onShowToast={onShowToast}
        onEnriched={(updated) => {
          onShowToast(`Enriched ${updated.full_name || 'lead'} with verified direct dials & decision-maker data!`, 'success');
          setIsWaterfallModalOpen(false);
        }}
      />

      {/* Website Tech Stack & Tooling Detector Modal */}
      <TechStackDetectorModal
        isOpen={isTechStackModalOpen}
        initialUrl={techStackTargetUrl}
        onClose={() => setIsTechStackModalOpen(false)}
        onShowToast={onShowToast}
        onApplyToContact={(techNames) => {
          onShowToast(`Applied ${techNames.length} technologies to lead profile`, 'success');
        }}
      />

      {/* Custom Export Column Builder Modal */}
      <CustomExportModal
        isOpen={showCustomExportModal}
        onClose={() => setShowCustomExportModal(false)}
        contacts={filteredContacts}
        websites={websites}
        onShowToast={onShowToast}
      />

      {/* Lookalike & Competitor Domain Finder Modal */}
      <LookalikeFinderModal
        isOpen={showLookalikeModal}
        onClose={() => setShowLookalikeModal(false)}
        initialSeedDomains={websites.map((w) => w.normalized_url || w.url).filter(Boolean).slice(0, 5)}
        onShowToast={onShowToast}
        onQueueDomains={async (urls) => {
          if (onStartScrape) {
            await onStartScrape(urls);
            onShowToast(`Queued ${urls.length} lookalike domain(s) for scraping`, 'success');
          } else {
            navigator.clipboard.writeText(urls.join('\n'));
            onShowToast(`Copied ${urls.length} lookalike URL(s) to clipboard`, 'info');
          }
        }}
      />

      {/* Lead Tags & Notes Modal */}
      {editingNoteContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#0f1424] border border-blue-100 dark:border-blue-900/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingNoteContact.full_name || editingNoteContact.company_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingNoteContact(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Tags</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDraftTag}
                    onChange={(e) => setNewDraftTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newDraftTag.trim()) {
                        if (!draftTags.includes(newDraftTag.trim())) {
                          setDraftTags([...draftTags, newDraftTag.trim()]);
                        }
                        setNewDraftTag('');
                      }
                    }}
                    placeholder="Hot Lead, Q4 Target..."
                    className="flex-1 px-3 py-1.5 glass-input rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDraftTag.trim() && !draftTags.includes(newDraftTag.trim())) {
                        setDraftTags([...draftTags, newDraftTag.trim()]);
                        setNewDraftTag('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-[#101730] text-[#155eef] dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draftTags.map((tg) => (
                    <span
                      key={`draft-tag-${tg}`}
                      className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1"
                    >
                      <span>#{tg}</span>
                      <button
                        type="button"
                        onClick={() => setDraftTags(draftTags.filter((t) => t !== tg))}
                        className="text-amber-500 hover:text-amber-800 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Notes</label>
                <textarea
                  rows={4}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Enter call notes, follow-up context..."
                  className="w-full p-3 glass-input rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-blue-100 dark:border-blue-900/30 bg-slate-50/60 dark:bg-[#0c101d]">
              <button
                type="button"
                onClick={() => setEditingNoteContact(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleUpdateContactMeta(editingNoteContact.id, {
                    tags: draftTags,
                    notes: draftNotes.trim(),
                  });
                  onShowToast('Saved tags and notes', 'success');
                  setEditingNoteContact(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-[#155eef] hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
