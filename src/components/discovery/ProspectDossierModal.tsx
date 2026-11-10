import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Building2,
  Users,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Copy,
  Check,
  ExternalLink,
  X,
  Target,
  Zap,
  Send,
  FileText,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { DiscoveredProspect, ProspectDossier } from '../../types';
import { GlassButton } from '../glass/GlassButton';

interface ProspectDossierModalProps {
  prospect: DiscoveredProspect | null;
  dossier: ProspectDossier | null;
  isLoading: boolean;
  onClose: () => void;
  onSendToCopilot?: (data: any) => void;
  onShowToast?: (msg: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onRefreshDossier?: () => void;
}

export const ProspectDossierModal: React.FC<ProspectDossierModalProps> = ({
  prospect,
  dossier,
  isLoading,
  onClose,
  onSendToCopilot,
  onShowToast,
  onRefreshDossier,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeChannelTab, setActiveChannelTab] = useState<'email' | 'linkedin' | 'call'>('email');

  if (!prospect) return null;

  const copyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (onShowToast) {
      onShowToast(`Copied ${label} to clipboard!`, 'success');
    }
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const person = dossier?.decisionMakerName || prospect.personName || 'Executive';
  const role = dossier?.decisionMakerTitle || prospect.jobTitle || 'Executive / Decision Maker';
  const email = dossier?.decisionMakerEmail || prospect.decisionMakerEmail || prospect.email || '';
  const city = dossier?.location.city || prospect.city || (prospect.location?.split(',')[0]?.trim()) || 'HQ';
  const state = dossier?.location.state || prospect.state || (prospect.location?.split(',')[1]?.trim()) || '';
  const country = dossier?.location.country || prospect.country || 'United States';
  const founded = dossier?.firmographics.foundedYear || prospect.foundedYear || '2020';
  const headcount = dossier?.firmographics.employeeCount || prospect.employeeCount || '11-50 employees';
  const domain = dossier?.domain || prospect.domain || prospect.website || '';
  const company = dossier?.companyName || prospect.companyName || domain;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-purple-50/40 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#155eef] to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/25 shrink-0">
              <Sparkles className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {company}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-[#155eef] dark:text-blue-400 border border-blue-500/20">
                  AI Executive Dossier
                </span>
                {domain && (
                  <a
                    href={prospect.website || `https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-slate-500 hover:text-[#155eef] flex items-center gap-1"
                  >
                    <span>{domain}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                AI Prospect Intelligence & Decision-Maker Profile
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefreshDossier && (
              <button
                onClick={onRefreshDossier}
                disabled={isLoading}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Regenerate AI Dossier"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-[#155eef] animate-spin" />
                <Sparkles className="w-6 h-6 text-[#155eef] absolute inset-0 m-auto" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                  Synthesizing Executive Intelligence...
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Analyzing {company}'s decision maker profile, location footprint, headcount scale, and crafting personalized outreach.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Top Row: Executive Card & Firmographics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Decision Maker Card */}
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Target className="w-3 h-3 text-[#155eef]" />
                      Decision Maker Identity
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Verified Contact
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{person}</span>
                      <button
                        onClick={() => copyText(person, 'personName', 'Decision Maker Name')}
                        className="text-slate-400 hover:text-slate-600 transition p-1"
                        title="Copy Name"
                      >
                        {copiedKey === 'personName' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </h4>
                    <p className="text-xs font-medium text-[#155eef] dark:text-blue-400 mt-0.5">
                      {role}
                    </p>
                  </div>

                  {/* Email & Phone */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-mono text-slate-700 dark:text-slate-200 truncate select-all">
                          {email || 'Email unlisted'}
                        </span>
                      </div>
                      {email && (
                        <button
                          onClick={() => copyText(email, 'email', 'Decision Maker Email')}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0"
                          title="Copy Email"
                        >
                          {copiedKey === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>

                    {prospect.phone && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="font-mono text-slate-700 dark:text-slate-200 truncate select-all">
                            {prospect.phone}
                          </span>
                        </div>
                        <button
                          onClick={() => copyText(prospect.phone!, 'phone', 'Phone Number')}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0"
                        >
                          {copiedKey === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Firmographics Details Card */}
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-purple-500" />
                    Verified Business Details
                  </span>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 block">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        Location
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate mt-0.5">
                        {[city, state].filter(Boolean).join(', ') || country}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {country}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 block">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        Founded Year
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block mt-0.5">
                        Est. {founded}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date().getFullYear() - parseInt(founded || '2020', 10)} years active
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 block">
                        <Users className="w-3 h-3 text-blue-500" />
                        No. of Employees
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block mt-0.5">
                        {headcount}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 block">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        Industry & Fit
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate mt-0.5">
                        {prospect.industry || 'B2B Software'}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-500 block">
                        {prospect.fitScore || 85}% ICP Match
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Mandate / Bio */}
              {dossier?.executiveBio && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-white dark:from-slate-800/60 dark:to-slate-800/40 border border-blue-100 dark:border-white/10 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#155eef] dark:text-blue-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Executive Leadership Profile
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {dossier.executiveBio}
                  </p>
                </div>
              )}

              {/* 3 Strategic Personalization Angles (Referencing City, Founded Year, Employee Count) */}
              {dossier?.personalizedAngles && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Strategic Personalization Hooks (City · Founded Year · Headcount)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/10 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-[11px]">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        <span>Location Angle ({city})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                        {dossier.personalizedAngles.locationAngle}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/10 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-[11px]">
                        <Users className="w-3 h-3 text-blue-500" />
                        <span>Scale Angle ({headcount})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                        {dossier.personalizedAngles.scalingAngle}
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/10 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-[11px]">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        <span>Founded Angle (Est. {founded})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                        {dossier.personalizedAngles.foundingAngle}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-Channel Outreach Sequences */}
              {dossier?.sequences && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      1-Click AI Outreach Sequences
                    </span>
                    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10">
                      <button
                        onClick={() => setActiveChannelTab('email')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          activeChannelTab === 'email'
                            ? 'bg-white dark:bg-slate-700 text-[#155eef] dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Cold Email
                      </button>
                      <button
                        onClick={() => setActiveChannelTab('linkedin')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          activeChannelTab === 'linkedin'
                            ? 'bg-white dark:bg-slate-700 text-[#155eef] dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        LinkedIn Note
                      </button>
                      <button
                        onClick={() => setActiveChannelTab('call')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          activeChannelTab === 'call'
                            ? 'bg-white dark:bg-slate-700 text-[#155eef] dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Cold Call Opener
                      </button>
                    </div>
                  </div>

                  {activeChannelTab === 'email' && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-semibold">Subject:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                            {dossier.sequences.coldEmail.subject}
                          </span>
                        </div>
                        <button
                          onClick={() => copyText(dossier.sequences.coldEmail.subject, 'subject', 'Email Subject')}
                          className="p-1 text-slate-400 hover:text-slate-600 transition"
                          title="Copy Subject"
                        >
                          {copiedKey === 'subject' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="relative">
                        <pre className="text-xs text-slate-700 dark:text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                          {dossier.sequences.coldEmail.body}
                        </pre>
                        <button
                          onClick={() =>
                            copyText(
                              `Subject: ${dossier.sequences.coldEmail.subject}\n\n${dossier.sequences.coldEmail.body}`,
                              'emailBody',
                              'Full Email'
                            )
                          }
                          className="absolute top-0 right-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-[#155eef] transition"
                          title="Copy Full Email"
                        >
                          {copiedKey === 'emailBody' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeChannelTab === 'linkedin' && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold">
                          Connection Note ({dossier.sequences.linkedinMessage.length} chars)
                        </span>
                        <button
                          onClick={() => copyText(dossier.sequences.linkedinMessage, 'linkedinMsg', 'LinkedIn Note')}
                          className="p-1 text-slate-400 hover:text-slate-600 transition"
                          title="Copy Note"
                        >
                          {copiedKey === 'linkedinMsg' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                        {dossier.sequences.linkedinMessage}
                      </p>
                    </div>
                  )}

                  {activeChannelTab === 'call' && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold">
                          30-Second Cold Call Hook
                        </span>
                        <button
                          onClick={() => copyText(dossier.sequences.coldCallOpener, 'callOpener', 'Call Opener')}
                          className="p-1 text-slate-400 hover:text-slate-600 transition"
                          title="Copy Opener"
                        >
                          {copiedKey === 'callOpener' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans italic">
                        "{dossier.sequences.coldCallOpener}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {dossier ? `Dossier compiled for ${person} at ${company}` : 'AI Executive Brief'}
          </div>

          <div className="flex items-center gap-2">
            {onSendToCopilot && (
              <GlassButton
                size="sm"
                variant="primary"
                onClick={() => {
                  onSendToCopilot({
                    contactName: person,
                    contactRole: role,
                    companyName: company,
                    industry: prospect.industry || 'B2B Software',
                    domain: domain,
                    email: email,
                    city,
                    state,
                    country,
                    foundedYear: founded,
                    employeeCount: headcount,
                    personalizationContext: `Headquartered in ${city}, ${state}. Founded ${founded} with ${headcount}.`,
                  });
                  onClose();
                }}
                icon={<Send className="w-3.5 h-3.5" />}
              >
                Open in AI Sales Copilot
              </GlassButton>
            )}
            <GlassButton size="sm" variant="secondary" onClick={onClose}>
              Done
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
