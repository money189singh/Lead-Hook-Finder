import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Mail,
  Copy,
  Check,
  Building2,
  Users,
  Target,
  Phone,
  FileText,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Download,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Search,
  Sliders,
  HelpCircle,
  Flame,
  ArrowRight,
  Zap,
} from 'lucide-react';
import {
  OutreachGenerationRequest,
  OutreachSequenceResult,
  AccountDossierResult,
  IcpArchitectResult,
  ObjectionHandlerResult,
  OutreachTone,
  ScrapeJob,
  HistoryItem,
} from '../types';
import { aiCopilotApi } from '../services/aiCopilotApi';

export interface AiSalesStudioInitialState {
  tab?: 'outreach' | 'dossier' | 'icp' | 'objections';
  contactName?: string;
  contactRole?: string;
  companyName?: string;
  industry?: string;
  domain?: string;
  email?: string;
  city?: string;
  state?: string;
  country?: string;
  foundedYear?: string;
  employeeCount?: string;
  personalizationContext?: string;
}

interface AiSalesStudioPageProps {
  initialState?: AiSalesStudioInitialState | null;
  currentJob?: ScrapeJob | null;
  history?: HistoryItem[];
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToDiscovery?: (query?: string, location?: string) => void;
  onNavigateToGoogleMaps?: (query?: string, location?: string) => void;
}

export const AiSalesStudioPage: React.FC<AiSalesStudioPageProps> = ({
  initialState,
  currentJob,
  history,
  onShowToast,
  onNavigateToDiscovery,
  onNavigateToGoogleMaps,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'outreach' | 'dossier' | 'icp' | 'objections'>(
    initialState?.tab || 'outreach'
  );

  // --- OUTREACH STATE ---
  const [outreachForm, setOutreachForm] = useState<OutreachGenerationRequest>({
    contactName: initialState?.contactName || 'Sarah Jenkins',
    contactRole: initialState?.contactRole || 'VP of Sales',
    companyName: initialState?.companyName || 'CloudMatrix Systems',
    industry: initialState?.industry || 'B2B SaaS / Enterprise Software',
    valueProposition: 'reducing outbound contact bounce rate from 28% to under 2% with real-time verification',
    tone: 'consultative',
    targetDomain: initialState?.domain || 'cloudmatrix.io',
    personalizationContext: 'Saw their recent hiring push for 10+ Account Executives and expansion into EMEA.',
  });
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [outreachResult, setOutreachResult] = useState<OutreachSequenceResult | null>(null);
  const [selectedOutreachChannel, setSelectedOutreachChannel] = useState<
    'email' | 'linkedin_conn' | 'linkedin_inmail' | 'cold_call' | 'followups'
  >('email');

  // --- DOSSIER STATE ---
  const [dossierCompany, setDossierCompany] = useState(initialState?.companyName || 'Datadog');
  const [dossierDomain, setDossierDomain] = useState(initialState?.domain || 'datadoghq.com');
  const [dossierIndustry, setDossierIndustry] = useState(initialState?.industry || 'Cloud Monitoring & DevOps');
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false);
  const [dossierResult, setDossierResult] = useState<AccountDossierResult | null>(null);

  // --- ICP ARCHITECT STATE ---
  const [icpProductDesc, setIcpProductDesc] = useState(
    'Real-time automated B2B sales intelligence and email verification engine for high-velocity outbound teams'
  );
  const [icpPriceTier, setIcpPriceTier] = useState<'SMB' | 'Mid-Market' | 'Enterprise' | 'All'>('Mid-Market');
  const [isGeneratingIcp, setIsGeneratingIcp] = useState(false);
  const [icpResult, setIcpResult] = useState<IcpArchitectResult | null>(null);

  // --- OBJECTION BUSTER STATE ---
  const [selectedObjectionPreset, setSelectedObjectionPreset] = useState<string>(
    'We already use ZoomInfo / Apollo and are locked into an annual contract.'
  );
  const [customObjection, setCustomObjection] = useState('');
  const [isHandlingObjection, setIsHandlingObjection] = useState(false);
  const [objectionResult, setObjectionResult] = useState<ObjectionHandlerResult | null>(null);

  // --- COPY TRACKER ---
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onShowToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Sync initial state if provided
  useEffect(() => {
    if (initialState) {
      if (initialState.tab) setActiveSubTab(initialState.tab);
      if (initialState.contactName || initialState.companyName) {
        setOutreachForm((prev) => ({
          ...prev,
          contactName: initialState.contactName || prev.contactName,
          contactRole: initialState.contactRole || prev.contactRole,
          companyName: initialState.companyName || prev.companyName,
          industry: initialState.industry || prev.industry,
          targetDomain: initialState.domain || prev.targetDomain,
          personalizationContext:
            initialState.personalizationContext ||
            (initialState.city || initialState.foundedYear || initialState.employeeCount
              ? `Based in ${initialState.city || 'HQ'}${initialState.state ? `, ${initialState.state}` : ''}. Founded in ${initialState.foundedYear || '2020'} with ${initialState.employeeCount || 'growing team'}.`
              : prev.personalizationContext),
        }));
      }
      if (initialState.companyName) {
        setDossierCompany(initialState.companyName);
        if (initialState.domain) setDossierDomain(initialState.domain);
        if (initialState.industry) setDossierIndustry(initialState.industry);
      }
    }
  }, [initialState]);

  // Handle Generate Outreach
  const handleGenerateOutreach = async () => {
    if (!outreachForm.contactName.trim() || !outreachForm.companyName.trim()) {
      onShowToast('Please enter both contact name and company name', 'warning');
      return;
    }
    setIsGeneratingOutreach(true);
    try {
      const res = await aiCopilotApi.generateOutreach(outreachForm);
      setOutreachResult(res);
      onShowToast('AI Outreach Sequence generated successfully!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Generation failed', 'error');
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  // Handle Generate Dossier
  const handleGenerateDossier = async () => {
    if (!dossierCompany.trim()) {
      onShowToast('Please enter a target company name', 'warning');
      return;
    }
    setIsGeneratingDossier(true);
    try {
      const res = await aiCopilotApi.generateAccountDossier({
        companyName: dossierCompany,
        domain: dossierDomain,
        industry: dossierIndustry,
      });
      setDossierResult(res);
      onShowToast(`Account Dossier created for ${dossierCompany}`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Dossier generation failed', 'error');
    } finally {
      setIsGeneratingDossier(false);
    }
  };

  // Handle Architect ICP
  const handleArchitectIcp = async () => {
    if (!icpProductDesc.trim()) {
      onShowToast('Please provide a description of your product or service', 'warning');
      return;
    }
    setIsGeneratingIcp(true);
    try {
      const res = await aiCopilotApi.architectIcp({
        productDescription: icpProductDesc,
        targetPriceTier: icpPriceTier,
      });
      setIcpResult(res);
      onShowToast('Ideal Customer Profile & search matrix generated!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'ICP architecture failed', 'error');
    } finally {
      setIsGeneratingIcp(false);
    }
  };

  // Handle Objection Buster
  const handleObjectionBuster = async () => {
    const finalObjection = customObjection.trim() || selectedObjectionPreset;
    if (!finalObjection) {
      onShowToast('Please select or write an objection', 'warning');
      return;
    }
    setIsHandlingObjection(true);
    try {
      const res = await aiCopilotApi.handleObjection({
        objection: finalObjection,
        productOrService: outreachForm.valueProposition,
        prospectRole: outreachForm.contactRole,
      });
      setObjectionResult(res);
      onShowToast('Objection psychology & battlecards generated!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Objection handling failed', 'error');
    } finally {
      setIsHandlingObjection(false);
    }
  };

  // Pre-load a contact from recent job if available
  const availableContacts = currentJob?.contacts || [];

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900/80 border border-purple-500/20 p-6 md:p-8 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Revenue & Sales Intelligence Suite</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              AI Sales Copilot
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono">
                Gemini 3.8 & Multi-LLM
              </span>
            </h1>
          </div>

          {/* Quick Stats or Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => {
                setActiveSubTab('outreach');
                if (!outreachResult) handleGenerateOutreach();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-purple-600/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 text-purple-200" />
              <span>Instant Pitch Generator</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-8 pt-4 border-t border-slate-700/60 overflow-x-auto scrollbar-none">
          {[
            { id: 'outreach', label: 'Multi-Channel Outreach', icon: Mail, tag: 'HIGH CONVERSION' },
            { id: 'dossier', label: 'Account Dossier & Intelligence', icon: Building2, tag: 'DEEP DIVE' },
            { id: 'icp', label: 'ICP & Query Architect', icon: Target, tag: 'STRATEGY' },
            { id: 'objections', label: 'Live Objection Battlecards', icon: ShieldCheck, tag: 'SALES COACH' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.tag && (
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-purple-700 text-purple-100' : 'bg-slate-700/80 text-slate-400'
                    }`}
                  >
                    {tab.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HYPER-PERSONALIZED MULTI-CHANNEL OUTREACH */}
      {/* ========================================================================= */}
      {activeSubTab === 'outreach' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Send className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">Prospect Target Context</h3>
                    <p className="text-xs text-slate-400">Configure target details for personalized angles</p>
                  </div>
                </div>

                {/* Quick lead prefill if available */}
                {availableContacts.length > 0 && (
                  <select
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      if (!isNaN(idx) && availableContacts[idx]) {
                        const c = availableContacts[idx];
                        setOutreachForm((prev) => ({
                          ...prev,
                          contactName: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Prospect',
                          contactRole: c.role || 'Executive',
                          targetDomain: c.source_url ? new URL(c.source_url).hostname : prev.targetDomain,
                        }));
                        onShowToast(`Loaded contact: ${c.full_name || c.email}`, 'info');
                      }
                    }}
                    className="text-xs bg-slate-800 border border-slate-700 text-purple-300 rounded-lg px-2.5 py-1.5 outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Prefill from Leads ({availableContacts.length})
                    </option>
                    {availableContacts.slice(0, 15).map((c, i) => (
                      <option key={i} value={i}>
                        {c.full_name || c.email} ({c.role || 'Contact'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Target Contact Name *</label>
                    <input
                      type="text"
                      value={outreachForm.contactName}
                      onChange={(e) => setOutreachForm({ ...outreachForm, contactName: e.target.value })}
                      placeholder="e.g. John Miller"
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Job Title / Role</label>
                    <input
                      type="text"
                      value={outreachForm.contactRole || ''}
                      onChange={(e) => setOutreachForm({ ...outreachForm, contactRole: e.target.value })}
                      placeholder="e.g. VP of Sales"
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={outreachForm.companyName}
                      onChange={(e) => setOutreachForm({ ...outreachForm, companyName: e.target.value })}
                      placeholder="e.g. Stripe"
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Target Domain / Website</label>
                    <input
                      type="text"
                      value={outreachForm.targetDomain || ''}
                      onChange={(e) => setOutreachForm({ ...outreachForm, targetDomain: e.target.value })}
                      placeholder="e.g. stripe.com"
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Industry Vertical</label>
                  <input
                    type="text"
                    value={outreachForm.industry || ''}
                    onChange={(e) => setOutreachForm({ ...outreachForm, industry: e.target.value })}
                    placeholder="e.g. B2B SaaS, FinTech, Legal Services"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Value Proposition / What You're Pitching *
                  </label>
                  <textarea
                    rows={2}
                    value={outreachForm.valueProposition}
                    onChange={(e) => setOutreachForm({ ...outreachForm, valueProposition: e.target.value })}
                    placeholder="e.g. Helping sales teams identify verified decision makers with zero email bounce rate"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Personalization Angle / Recent News (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={outreachForm.personalizationContext || ''}
                    onChange={(e) => setOutreachForm({ ...outreachForm, personalizationContext: e.target.value })}
                    placeholder="e.g. Saw your recent Series A announcement or podcast appearance on SaaS scaling"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Outbound Tone & Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'consultative', label: 'Consultative', desc: 'Diagnostic & Peer' },
                      { id: 'direct', label: 'Direct', desc: 'Punchy, No Fluff' },
                      { id: 'executive', label: 'Executive', desc: 'C-Suite Brief' },
                      { id: 'challenger', label: 'Challenger', desc: 'Status Quo Break' },
                      { id: 'conversational', label: 'Casual', desc: 'Warm & Relatable' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setOutreachForm({ ...outreachForm, tone: t.id as OutreachTone })}
                        className={`px-2.5 py-2 rounded-xl text-left border transition-all ${
                          outreachForm.tone === t.id
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                            : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold">{t.label}</div>
                        <div className="text-[10px] text-slate-500">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGenerateOutreach}
                  disabled={isGeneratingOutreach}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingOutreach ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Multi-Channel Pitch...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>Generate Multi-Channel Outbound Sequence</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Results Column */}
          <div className="lg:col-span-7 space-y-5">
            {outreachResult ? (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl space-y-6">
                {/* Channel Selector Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                    {[
                      { id: 'email', label: 'Cold Email', icon: Mail },
                      { id: 'linkedin_conn', label: 'LinkedIn Connect', icon: Users },
                      { id: 'linkedin_inmail', label: 'InMail', icon: FileText },
                      { id: 'cold_call', label: 'Cold Call Script', icon: Phone },
                      { id: 'followups', label: 'Follow-ups (x3)', icon: RotateCcw },
                    ].map((ch) => {
                      const Icon = ch.icon;
                      const isSel = selectedOutreachChannel === ch.id;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedOutreachChannel(ch.id as any)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSel ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const content = `# Multi-Touch Outreach Sequence: ${outreachForm.contactName} (${outreachForm.companyName})
Domain: ${outreachForm.targetDomain || 'N/A'}
Role: ${outreachForm.contactRole || 'Decision Maker'}
Industry: ${outreachForm.industry || 'B2B'}
Generated by LeadHook AI Sales Copilot

---

## 1. Subject Line Options
${outreachResult.subjectLines.map((s, i) => `${i + 1}. ${s.text} (${s.style} — Est. Open: ${s.openRateEstimate})`).join('\n')}

---

## 2. Cold Email
${outreachResult.coldEmailBody}

---

## 3. LinkedIn Connection Note (Under 300 chars)
${outreachResult.linkedInConnectionNote}

---

## 4. LinkedIn InMail
${outreachResult.linkedInInMail}

---

## 5. Phone Cold Call Script
Opener: ${outreachResult.coldCallScript.opener}
Pain Pitch: ${outreachResult.coldCallScript.painPointHook}
Close: ${outreachResult.coldCallScript.askForMeeting}

---

## 6. Follow-up Cadence
${outreachResult.followUpSequence.map((f) => `### Step ${f.step} (Day ${f.delayDays}): "${f.subject}"\n${f.body}\n`).join('\n')}
`;
                        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `outreach_sequence_${(outreachForm.companyName || 'prospect').toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        onShowToast('Exported complete multi-channel outreach sequence to Markdown!', 'success');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download complete sequence as Markdown file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Sequence</span>
                    </button>

                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      {outreachResult.metadata?.modelUsed || 'AI Model'}
                    </span>
                  </div>
                </div>

                {/* Sub-channel Content */}
                {selectedOutreachChannel === 'email' && (
                  <div className="space-y-4">
                    {/* Subject Line Variations */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          <span>Tested Subject Lines (High Open Rate)</span>
                        </label>
                      </div>
                      <div className="space-y-2">
                        {outreachResult.subjectLines.map((sub, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all group"
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium text-slate-200">{sub.text}</p>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="text-purple-400 font-medium">{sub.style}</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-emerald-400 font-semibold">{sub.openRateEstimate}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopy(sub.text, `sub_${idx}`)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                              title="Copy Subject"
                            >
                              {copiedKey === `sub_${idx}` ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Primary Cold Email Pitch
                        </label>
                        <button
                          onClick={() => handleCopy(outreachResult.coldEmail.fullText, 'full_email')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-all"
                        >
                          {copiedKey === 'full_email' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>Copy Full Email</span>
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-sm text-slate-200 whitespace-pre-wrap leading-relaxed selection:bg-purple-500/30">
                        {outreachResult.coldEmail.fullText}
                      </div>

                      {/* Structural breakdown badges */}
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 text-xs">
                          <span className="text-purple-400 font-semibold block mb-0.5">Hook Angle</span>
                          <span className="text-slate-400 text-[11px] line-clamp-2">
                            {outreachResult.coldEmail.hook}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 text-xs">
                          <span className="text-indigo-400 font-semibold block mb-0.5">Value Core</span>
                          <span className="text-slate-400 text-[11px] line-clamp-2">
                            {outreachResult.coldEmail.body}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 text-xs">
                          <span className="text-emerald-400 font-semibold block mb-0.5">Low-Friction CTA</span>
                          <span className="text-slate-400 text-[11px] line-clamp-2">
                            {outreachResult.coldEmail.callToAction}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* LinkedIn Connection */}
                {selectedOutreachChannel === 'linkedin_conn' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold text-white">LinkedIn Connection Note</h4>
                        <p className="text-xs text-slate-400">
                          Personalized note under the 300 character LinkedIn limit (
                          <span className="text-emerald-400 font-mono">
                            {outreachResult.linkedInConnection.characterCount} chars
                          </span>
                          )
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopy(outreachResult.linkedInConnection.message, 'li_conn')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-all"
                      >
                        {copiedKey === 'li_conn' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy Note</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {outreachResult.linkedInConnection.message}
                    </div>

                    <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-xs text-blue-300 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>
                        Pro Tip: Keep connection notes focused on their recent momentum or content rather than pitching
                        on the first touch. Acceptance rate averages ~48% with this formula.
                      </span>
                    </div>
                  </div>
                )}

                {/* LinkedIn InMail */}
                {selectedOutreachChannel === 'linkedin_inmail' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">Direct LinkedIn InMail / Message</h4>
                      <button
                        onClick={() =>
                          handleCopy(
                            `Subject: ${outreachResult.linkedInInMail.subject}\n\n${outreachResult.linkedInInMail.body}`,
                            'li_inmail'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-all"
                      >
                        {copiedKey === 'li_inmail' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy InMail</span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                      <span className="text-slate-500 font-semibold">Subject: </span>
                      <span className="text-purple-300 font-mono">{outreachResult.linkedInInMail.subject}</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {outreachResult.linkedInInMail.body}
                    </div>
                  </div>
                )}

                {/* Cold Call Script */}
                {selectedOutreachChannel === 'cold_call' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">30-Second Cold Call Phone Script</h4>
                      <button
                        onClick={() =>
                          handleCopy(
                            `OPENING:\n${outreachResult.coldCallScript.openingHook}\n\nPITCH:\n${outreachResult.coldCallScript.pitch}\n\nDISCOVERY QUESTION:\n${outreachResult.coldCallScript.qualifyingQuestion}\n\nOBJECTION PIVOT:\n${outreachResult.coldCallScript.objectionPivot}`,
                            'cc_script'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-all"
                      >
                        {copiedKey === 'cc_script' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy Script</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">
                          Step 1: Permission Opening Hook
                        </span>
                        <p className="text-sm text-slate-200 italic">{outreachResult.coldCallScript.openingHook}</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
                          Step 2: 15-Second Value Drop
                        </span>
                        <p className="text-sm text-slate-200 italic">{outreachResult.coldCallScript.pitch}</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                          Step 3: Diagnostic Qualifying Question
                        </span>
                        <p className="text-sm text-slate-200 font-medium">
                          {outreachResult.coldCallScript.qualifyingQuestion}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                          Step 4: Immediate Objection Pivot ("Already have a tool")
                        </span>
                        <p className="text-sm text-slate-300 italic">{outreachResult.coldCallScript.objectionPivot}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Follow-up Sequence */}
                {selectedOutreachChannel === 'followups' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">Automated Follow-Up Sequence</h4>
                      <button
                        onClick={() => {
                          const fullSeq = outreachResult.followUps
                            .map((f) => `--- Day ${f.day}: ${f.label} ---\nSubject: ${f.subject}\n\n${f.body}\n`)
                            .join('\n');
                          handleCopy(fullSeq, 'all_followups');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-all"
                      >
                        {copiedKey === 'all_followups' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy All Follow-ups</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {outreachResult.followUps.map((f, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold">
                                Day {f.day}
                              </span>
                              <span className="text-xs font-semibold text-slate-300">{f.label}</span>
                            </div>
                            <button
                              onClick={() => handleCopy(`Subject: ${f.subject}\n\n${f.body}`, `fu_${i}`)}
                              className="text-slate-400 hover:text-white p-1"
                              title="Copy this touch"
                            >
                              {copiedKey === `fu_${i}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-xs text-slate-400 font-mono">Subject: {f.subject}</div>
                          <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-mono bg-slate-900/60 p-2.5 rounded-lg">
                            {f.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[420px] rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-8 text-center bg-slate-900/20">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">No Sequence Generated Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                  Fill in your target prospect details on the left, select your tone, and click "Generate Multi-Channel
                  Outbound Sequence".
                </p>
                <button
                  onClick={handleGenerateOutreach}
                  disabled={isGeneratingOutreach}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all shadow-md"
                >
                  Generate Demo Sequence
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACCOUNT INTELLIGENCE & DOSSIER */}
      {/* ========================================================================= */}
      {activeSubTab === 'dossier' && (
        <div className="space-y-6">
          {/* Company Search Input */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-300">Target Company Name</label>
                <input
                  type="text"
                  value={dossierCompany}
                  onChange={(e) => setDossierCompany(e.target.value)}
                  placeholder="e.g. Ramp, Figma, Snowflake"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-300">Domain / URL (Optional)</label>
                <input
                  type="text"
                  value={dossierDomain}
                  onChange={(e) => setDossierDomain(e.target.value)}
                  placeholder="e.g. ramp.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 outline-none"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-300">Industry Context</label>
                <input
                  type="text"
                  value={dossierIndustry}
                  onChange={(e) => setDossierIndustry(e.target.value)}
                  placeholder="e.g. Financial Software / Spend Management"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 outline-none"
                />
              </div>
              <button
                onClick={handleGenerateDossier}
                disabled={isGeneratingDossier}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 whitespace-nowrap self-stretch md:self-end disabled:opacity-50"
              >
                {isGeneratingDossier ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Researching Account...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Build Executive Dossier</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dossier Report */}
          {dossierResult ? (
            <div className="space-y-6">
              {/* Top Score & Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="w-28 h-28 rounded-full border-4 border-purple-500/30 flex flex-col items-center justify-center relative mb-3 bg-slate-950">
                    <span className="text-3xl font-extrabold text-white">{dossierResult.icpFitScore}</span>
                    <span className="text-[10px] text-purple-300 uppercase tracking-wider font-semibold">ICP Match</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                    {dossierResult.icpTier} Account
                  </span>
                  <p className="text-xs text-slate-400">High propensity to convert based on team scale & pains</p>
                </div>

                <div className="md:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {dossierResult.companyName}
                        <span className="text-xs font-normal text-slate-400">({dossierResult.domain})</span>
                      </h3>
                      <button
                        onClick={() =>
                          handleCopy(JSON.stringify(dossierResult, null, 2), 'full_dossier_json')
                        }
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        {copiedKey === 'full_dossier_json' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy Dossier JSON</span>
                      </button>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{dossierResult.executiveSummary}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800/80">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Likely Tech Stack & Infrastructure
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {dossierResult.likelyTechStack.map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Buying Committee & Pain Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Buying Committee */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h4 className="font-semibold text-white text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>Buying Committee Blueprint</span>
                  </h4>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400">Economic Buyer (Signs the Check)</span>
                        <span className="text-xs font-medium text-white">
                          {dossierResult.buyingCommittee.economicBuyer.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {dossierResult.buyingCommittee.economicBuyer.priorities}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400">Internal Champion (Advocate)</span>
                        <span className="text-xs font-medium text-white">
                          {dossierResult.buyingCommittee.champion.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{dossierResult.buyingCommittee.champion.priorities}</p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">Potential Blocker (Security / IT)</span>
                        <span className="text-xs font-medium text-white">{dossierResult.buyingCommittee.blocker.title}</span>
                      </div>
                      <p className="text-xs text-slate-400">{dossierResult.buyingCommittee.blocker.risks}</p>
                    </div>
                  </div>
                </div>

                {/* Core Pain Points & Strategic Wedge */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h4 className="font-semibold text-white text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    <span>Operational Pains & Strategic Wedge</span>
                  </h4>

                  <div className="space-y-2.5">
                    {dossierResult.corePainPoints.map((p, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200">{p.title}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              p.severity === 'High'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {p.severity} Severity
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{p.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 space-y-1">
                    <span className="text-xs font-bold text-purple-300 block">Competitive Displacement Angle</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{dossierResult.competitiveWedge}</p>
                  </div>
                </div>
              </div>

              {/* Ready-to-Use Icebreakers */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
                <h4 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Verified Cold Outreach Icebreakers</span>
                </h4>
                <div className="space-y-2">
                  {dossierResult.icebreakers.map((ice, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/70"
                    >
                      <p className="text-xs text-slate-200 font-mono italic">"{ice}"</p>
                      <button
                        onClick={() => handleCopy(ice, `ice_${idx}`)}
                        className="text-slate-400 hover:text-white p-1 ml-2"
                      >
                        {copiedKey === `ice_${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-[300px] rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-8 text-center bg-slate-900/20">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Enter a Target Company to Analyze</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                Generate buying committee maps, likely tech stack, ICP score, and competitor wedge angles in seconds.
              </p>
              <button
                onClick={handleGenerateDossier}
                disabled={isGeneratingDossier}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all shadow-md"
              >
                Analyze Demo (Datadog)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ICP & QUERY ARCHITECT */}
      {/* ========================================================================= */}
      {activeSubTab === 'icp' && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">Ideal Customer Profile & Query Matrix Architect</h3>
              <p className="text-xs text-slate-400">
                Input your product or service description. AI will define your ICP, decision-maker hierarchy, and
                ready-to-run search strings for AI Discovery and Google Maps.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  What do you sell / What problem do you solve? *
                </label>
                <textarea
                  rows={2}
                  value={icpProductDesc}
                  onChange={(e) => setIcpProductDesc(e.target.value)}
                  placeholder="e.g. Automated bookkeeping and cashflow forecasting software for dental and medical clinics"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Target Segment:</span>
                  {(['SMB', 'Mid-Market', 'Enterprise', 'All'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setIcpPriceTier(tier)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        icpPriceTier === tier
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleArchitectIcp}
                  disabled={isGeneratingIcp}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingIcp ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Architecting Strategy...</span>
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4" />
                      <span>Generate ICP & Search Matrix</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ICP Results */}
          {icpResult && (
            <div className="space-y-6">
              {/* Overview Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    Core Target Verticals
                  </span>
                  <div className="space-y-1.5 pt-1">
                    {icpResult.coreIndustries.map((ind, i) => (
                      <div key={i} className="text-xs text-slate-200 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>{ind}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    Sweet Spot Sub-Niches
                  </span>
                  <div className="space-y-1.5 pt-1">
                    {icpResult.subNiches.map((niche, i) => (
                      <div key={i} className="text-xs text-slate-200 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>{niche}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Company Size & Revenue
                  </span>
                  <div className="space-y-2 pt-1 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Employee Range:</span>
                      <span className="font-semibold text-white">{icpResult.employeeSizeRange}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Annual Revenue:</span>
                      <span className="font-semibold text-white">{icpResult.revenueRange}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decision-Maker Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider block">
                    Priority 1 Titles (Economic Buyers)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {icpResult.keyTitles.primary.map((t, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block pt-2">
                    Secondary Titles (Champions)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {icpResult.keyTitles.secondary.map((t, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">
                    Disqualifiers & Negative Filters (Avoid)
                  </span>
                  <div className="space-y-2">
                    {icpResult.disqualifiers.map((dq, i) => (
                      <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <span>{dq}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ready-to-Run Queries (Direct Integration to Discovery & Maps) */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span>Live Search Queries Ready to Run</span>
                  </h4>
                  <span className="text-xs text-slate-400">Launch directly into Discovery or Maps</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Discovery Queries */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-purple-400 block">AI Prospect Discovery Queries</span>
                    <div className="space-y-2">
                      {icpResult.searchQueries.discoveryQueries.map((q, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                        >
                          <span className="text-xs text-slate-200 font-mono truncate mr-2">{q}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleCopy(q, `dq_${i}`)}
                              className="text-slate-400 hover:text-white p-1"
                              title="Copy query"
                            >
                              {copiedKey === `dq_${i}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {onNavigateToDiscovery && (
                              <button
                                onClick={() => onNavigateToDiscovery(q)}
                                className="px-2 py-1 rounded bg-purple-600/30 hover:bg-purple-600 text-purple-200 text-[11px] font-medium flex items-center gap-1 transition-all"
                              >
                                <span>Run</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Google Maps Queries */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-indigo-400 block">Google Maps Scraper Queries</span>
                    <div className="space-y-2">
                      {icpResult.searchQueries.googleMapsQueries.map((q, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                        >
                          <span className="text-xs text-slate-200 font-mono truncate mr-2">{q}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleCopy(q, `mq_${i}`)}
                              className="text-slate-400 hover:text-white p-1"
                              title="Copy query"
                            >
                              {copiedKey === `mq_${i}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {onNavigateToGoogleMaps && (
                              <button
                                onClick={() => onNavigateToGoogleMaps(q)}
                                className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 text-[11px] font-medium flex items-center gap-1 transition-all"
                              >
                                <span>Scrape</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* LinkedIn Boolean String */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="truncate">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold mb-0.5">
                      LinkedIn Recruiter / Sales Navigator Boolean Query:
                    </span>
                    <span className="text-xs text-purple-300 font-mono truncate block">
                      {icpResult.searchQueries.booleanLinkedinQuery}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(icpResult.searchQueries.booleanLinkedinQuery, 'li_bool')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium flex items-center gap-1.5 flex-shrink-0"
                  >
                    {copiedKey === 'li_bool' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy Boolean</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: OBJECTION BUSTER & BATTLECARDS */}
      {/* ========================================================================= */}
      {activeSubTab === 'objections' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-white text-base">Select or Enter Sales Objection</h3>
                <p className="text-xs text-slate-400">
                  Generate instant psychological rebuttals, risk reframes, and discovery questions.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 block">Common Presets</label>
                {[
                  'We already use ZoomInfo / Apollo and are locked into an annual contract.',
                  'No budget allocated this quarter / spending freeze.',
                  'Just send me some information via email.',
                  'Not interested / We do not do outbound sales.',
                  'How did you get my direct phone number and email?',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedObjectionPreset(preset);
                      setCustomObjection('');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border ${
                      selectedObjectionPreset === preset && !customObjection
                        ? 'bg-purple-600/20 border-purple-500 text-white font-medium'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    "{preset}"
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Or Type Any Custom Pushback / Objection
                </label>
                <textarea
                  rows={2}
                  value={customObjection}
                  onChange={(e) => setCustomObjection(e.target.value)}
                  placeholder="e.g. Our legal team doesn't allow scraping external directory data..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              <button
                onClick={handleObjectionBuster}
                disabled={isHandlingObjection}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isHandlingObjection ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Formulating Battlecards...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-purple-200" />
                    <span>Analyze & Generate Rebuttals</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {objectionResult ? (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl space-y-5">
                {/* Psychology Analysis */}
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/40 space-y-1">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                    Underlying Prospect Psychology
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">{objectionResult.psychologicalAnalysis}</p>
                </div>

                {/* Tactical Frameworks */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Tactical Response Scripts
                  </h4>

                  {objectionResult.frameworks.map((fw, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              fw.riskLevel === 'Bold'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : fw.riskLevel === 'Consultative'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {fw.riskLevel} Framework
                          </span>
                          <span className="text-xs font-bold text-white">{fw.name}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(fw.script, `fw_${idx}`)}
                          className="p-1 text-slate-400 hover:text-white"
                          title="Copy script"
                        >
                          {copiedKey === `fw_${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 italic">Strategy: {fw.strategy}</p>

                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/70 text-xs text-slate-100 font-mono leading-relaxed">
                        {fw.script}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Follow up discovery question */}
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/30 space-y-1">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                    Regain Control: Discovery Follow-Up Question
                  </span>
                  <p className="text-xs text-emerald-200 font-medium">{objectionResult.followUpDiscoveryQuestion}</p>
                </div>

                {/* Pitfalls to Avoid */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
                    Critical Pitfalls to Avoid
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {objectionResult.pitfallsToAvoid.map((pit, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-400">•</span>
                        <span>{pit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="min-h-[360px] rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-8 text-center bg-slate-900/20">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Live Objection Coach</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                  Choose a common prospect objection or enter your own to see psychology breakdowns and battlecard scripts.
                </p>
                <button
                  onClick={handleObjectionBuster}
                  disabled={isHandlingObjection}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all shadow-md"
                >
                  Test Demo Objection
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
