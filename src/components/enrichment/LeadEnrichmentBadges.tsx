import React, { useState } from 'react';
import {
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Github,
  Instagram,
  ExternalLink,
  Award,
  Building2,
  Users2,
  MapPin,
  Info,
  Crown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { RoleTier, IcpTier, SocialProfiles, CompanyFirmographics, EmailType, RuleEvaluationItem } from '../../types';

// Role Tier Badge
export const RoleTierBadge: React.FC<{ tier?: RoleTier }> = ({ tier = 'Other Staff' }) => {
  const styles: Record<RoleTier, string> = {
    'C-Suite / Executive': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    'Sales & Marketing': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'Procurement & Operations': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    'Technical / Engineering': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    'Finance & Legal': 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    'General Management': 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    'Other Staff': 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1 whitespace-nowrap ${
        styles[tier] || styles['Other Staff']
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{tier}</span>
    </span>
  );
};

// Email Classification Badge with deterministic reason tooltip
export const EmailClassificationBadge: React.FC<{
  type?: EmailType | string;
  reason?: string;
  identityVerified?: boolean;
}> = ({ type = 'Unknown', reason, identityVerified }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let style = 'bg-slate-800 text-slate-400 border-slate-700';
  let label = type;

  if (type === 'Professional Personal Email' || type === 'Personal') {
    style = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    label = 'Professional Personal';
  } else if (type === 'Generic Business Email' || type === 'Generic') {
    style = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    label = 'Generic Business';
  } else if (type === 'Personal Email Provider') {
    style = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    label = 'Personal Provider';
  } else {
    style = 'bg-slate-800 text-slate-400 border-slate-700';
    label = 'Unknown Email';
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border inline-flex items-center gap-1 cursor-pointer transition-colors ${style}`}
      >
        {identityVerified && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
        <span>{label}</span>
        {reason && <Info className="w-2.5 h-2.5 opacity-60 ml-0.5" />}
      </button>

      {showTooltip && (
        <div className="absolute z-50 left-0 bottom-full mb-1.5 w-64 p-2.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-[11px] text-slate-300 text-left pointer-events-none animate-in fade-in-50">
          <div className="font-bold text-slate-400 uppercase text-[9px] mb-1 flex items-center justify-between">
            <span>Classification Evidence</span>
            <span className={identityVerified ? 'text-emerald-400' : 'text-slate-400'}>
              {identityVerified ? 'Identity Verified' : 'Unverified Person'}
            </span>
          </div>
          <p className="text-slate-300 leading-tight">{reason || `Determined as ${type} via deterministic syntax & identity checks.`}</p>
        </div>
      )}
    </div>
  );
};

// Decision Maker Badge
export const DecisionMakerBadge: React.FC<{
  isDecisionMaker?: boolean;
  tier?: string;
  score?: number;
  reasons?: string[];
}> = ({ isDecisionMaker, tier, score, reasons = [] }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isDecisionMaker) {
    return <span className="text-slate-500 text-[10px]">—</span>;
  }

  let badgeColor = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  let icon = <Crown className="w-3 h-3 text-amber-400" />;

  if (tier === 'Owner / Founder') {
    badgeColor = 'bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-xs shadow-amber-500/10';
  } else if (tier === 'C-Suite') {
    badgeColor = 'bg-purple-500/20 text-purple-200 border-purple-500/40';
  } else if (tier === 'VP / Director') {
    badgeColor = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 cursor-pointer transition-colors ${badgeColor}`}
      >
        {icon}
        <span>{tier || 'Decision-Maker'}</span>
        {score !== undefined && score > 0 && (
          <span className="font-mono text-[9px] opacity-80">{score}pts</span>
        )}
      </button>

      {showTooltip && reasons.length > 0 && (
        <div className="absolute z-50 left-0 bottom-full mb-1.5 w-60 p-2.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-[11px] text-slate-300 text-left pointer-events-none animate-in fade-in-50">
          <div className="font-bold text-slate-400 uppercase text-[9px] mb-1">Decision-Maker Factors</div>
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={`dm-factor-${i}-${r}`} className="flex items-start gap-1">
                <span className="text-amber-400">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ICP Filter Status Badge
export const IcpFilterStatusBadge: React.FC<{
  status?: 'INCLUDED' | 'EXCLUDED' | 'UNKNOWN';
  reasons?: string[];
}> = ({ status = 'INCLUDED', reasons = [] }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let style = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  let icon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;

  if (status === 'EXCLUDED') {
    style = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    icon = <XCircle className="w-3 h-3 text-rose-400" />;
  } else if (status === 'UNKNOWN') {
    style = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    icon = <HelpCircle className="w-3 h-3 text-amber-400" />;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 cursor-pointer transition-colors ${style}`}
      >
        {icon}
        <span>{status}</span>
        {reasons.length > 0 && <Info className="w-2.5 h-2.5 opacity-60 ml-0.5" />}
      </button>

      {showTooltip && reasons.length > 0 && (
        <div className="absolute z-50 left-0 bottom-full mb-1.5 w-64 p-2.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-[11px] text-slate-300 text-left pointer-events-none animate-in fade-in-50">
          <div className="font-bold text-slate-400 uppercase text-[9px] mb-1">ICP Filter Policy Evaluation</div>
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={`icp-policy-${i}-${r}`} className="flex items-start gap-1">
                <span className={status === 'EXCLUDED' ? 'text-rose-400' : 'text-emerald-400'}>•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ICP Score Badge with hover match reasons
export const IcpScoreBadge: React.FC<{
  score?: number;
  tier?: IcpTier;
  reasons?: string[];
}> = ({ score = 0, tier = 'Unmatched', reasons = [] }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
  if (score >= 80) {
    badgeColor = 'bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-sm shadow-purple-500/10';
  } else if (score >= 60) {
    badgeColor = 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
  } else if (score >= 40) {
    badgeColor = 'bg-blue-500/15 text-blue-200 border-blue-500/30';
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border inline-flex items-center gap-1 cursor-pointer transition-all ${badgeColor}`}
      >
        <Award className="w-3 h-3 text-amber-400" />
        <span>{score}%</span>
        {tier !== 'Unmatched' && (
          <span className="text-[9px] font-normal opacity-80 uppercase tracking-tight">
            ({tier.replace(' Match', '')})
          </span>
        )}
      </button>

      {showTooltip && reasons.length > 0 && (
        <div className="absolute z-40 left-0 bottom-full mb-2 w-64 p-3 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-left pointer-events-none animate-in fade-in-50 zoom-in-95">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>ICP Score Breakdown</span>
            <span className="font-mono text-purple-400">{score}/100</span>
          </div>
          <ul className="space-y-1 text-[11px] text-slate-300">
            {reasons.map((r, i) => (
              <li key={`icp-score-item-${i}-${r}`} className="flex items-start gap-1.5 leading-tight">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Social Profile Link Buttons
export const SocialLinksGroup: React.FC<{
  profiles?: SocialProfiles;
  linkedinUrl?: string;
  twitterUrl?: string;
  size?: 'sm' | 'md';
}> = ({ profiles, linkedinUrl, twitterUrl, size = 'sm' }) => {
  const mergedLinkedin = linkedinUrl || profiles?.linkedin;
  const mergedTwitter = twitterUrl || profiles?.twitter;
  const facebook = profiles?.facebook;
  const youtube = profiles?.youtube;
  const instagram = profiles?.instagram;
  const github = profiles?.github;

  const hasAny = Boolean(mergedLinkedin || mergedTwitter || facebook || youtube || instagram || github);

  if (!hasAny) {
    return <span className="text-slate-600 text-[10px]">—</span>;
  }

  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const btnClass =
    size === 'sm'
      ? 'p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors'
      : 'p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors';

  return (
    <div className="inline-flex items-center gap-1">
      {mergedLinkedin && (
        <a
          href={mergedLinkedin}
          target="_blank"
          rel="noreferrer"
          className={`${btnClass} hover:text-blue-400 hover:border-blue-500/40`}
          title={`LinkedIn: ${mergedLinkedin}`}
        >
          <Linkedin className={iconClass} />
        </a>
      )}
      {mergedTwitter && (
        <a
          href={mergedTwitter}
          target="_blank"
          rel="noreferrer"
          className={`${btnClass} hover:text-sky-400 hover:border-sky-500/40`}
          title={`Twitter / X: ${mergedTwitter}`}
        >
          <Twitter className={iconClass} />
        </a>
      )}
      {facebook && (
        <a
          href={facebook}
          target="_blank"
          rel="noreferrer"
          className={`${btnClass} hover:text-indigo-400 hover:border-indigo-500/40`}
          title={`Facebook: ${facebook}`}
        >
          <Facebook className={iconClass} />
        </a>
      )}
      {youtube && (
        <a
          href={youtube}
          target="_blank"
          rel="noreferrer"
          className={`${btnClass} hover:text-rose-400 hover:border-rose-500/40`}
          title={`YouTube: ${youtube}`}
        >
          <Youtube className={iconClass} />
        </a>
      )}
      {github && (
        <a
          href={github}
          target="_blank"
          rel="noreferrer"
          className={`${btnClass} hover:text-slate-200 hover:border-slate-500/40`}
          title={`GitHub: ${github}`}
        >
          <Github className={iconClass} />
        </a>
      )}
      {instagram && (
        <a
          href={instagram}
          target="_blank"
          rel="noreferrer"
          className={`${btnClass} hover:text-pink-400 hover:border-pink-500/40`}
          title={`Instagram: ${instagram}`}
        >
          <Instagram className={iconClass} />
        </a>
      )}
    </div>
  );
};

// Firmographics Summary Pill Group
export const FirmographicsBadges: React.FC<{
  firmographics?: CompanyFirmographics;
  compact?: boolean;
}> = ({ firmographics, compact = false }) => {
  const [showOffering, setShowOffering] = useState(false);

  if (!firmographics || (!firmographics.industry && !firmographics.employee_count && !firmographics.employee_range && !firmographics.employee_tier && !firmographics.founded_year && !firmographics.headquarters)) {
    return <span className="text-slate-500 text-[10px]">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {firmographics.industry && (
        <span
          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-slate-300 text-[10px] font-medium inline-flex items-center gap-1"
          title={`Industry: ${firmographics.industry}`}
        >
          <Building2 className="w-3 h-3 text-cyan-400" />
          <span>{firmographics.industry}</span>
        </span>
      )}

      {(firmographics.employee_count || firmographics.employee_range || firmographics.employee_tier) && (
        <span
          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-slate-300 text-[10px] font-medium inline-flex items-center gap-1"
          title={`Employees: ${firmographics.employee_count || firmographics.employee_range || firmographics.employee_tier}`}
        >
          <Users2 className="w-3 h-3 text-purple-400" />
          <span>{firmographics.employee_count ? `${firmographics.employee_count} emp` : `${firmographics.employee_range || firmographics.employee_tier} emp`}</span>
        </span>
      )}

      {firmographics.founded_year && (
        <span
          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-blue-300 text-[10px] font-medium inline-flex items-center gap-1"
          title={`Founded Year: ${firmographics.founded_year}`}
        >
          <span>Est. {firmographics.founded_year}</span>
        </span>
      )}

      {firmographics.headquarters && (
        <span
          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-slate-300 text-[10px] font-medium inline-flex items-center gap-1"
          title={`HQ: ${firmographics.headquarters}${firmographics.country_code ? ` (${firmographics.country_code})` : ''}`}
        >
          <MapPin className="w-3 h-3 text-amber-400" />
          <span>{firmographics.headquarters}</span>
          {firmographics.country_code && (
            <span className="text-slate-400 font-mono">({firmographics.country_code})</span>
          )}
        </span>
      )}

      {firmographics.offering_summary && (
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setShowOffering(!showOffering)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-[10px] inline-flex items-center gap-1"
            title="View core offering summary"
          >
            <Info className="w-2.5 h-2.5 text-blue-400" />
            <span>Offering</span>
          </button>
          {showOffering && (
            <div className="absolute z-40 left-0 mt-1 w-64 p-3 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-[11px] text-slate-300 leading-relaxed">
              <div className="font-bold text-slate-400 text-[10px] uppercase mb-1">
                Products & Services
              </div>
              <p>{firmographics.offering_summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
