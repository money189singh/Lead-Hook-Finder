import React from 'react';
import { WebsiteResult, VerificationResult } from '../../types';
import {
  ShieldCheck,
  Globe,
  MapPin,
  Search,
  Landmark,
  Sparkles,
  Calendar,
  ExternalLink,
  Coins,
  FileText,
  Clock,
  Users,
  Building2,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { VerificationStatusBadge } from './VerificationStatusBadge';

interface VerificationDetailModalProps {
  business: WebsiteResult | null;
  onClose: () => void;
  onVerifyNow?: (business: WebsiteResult) => void;
}

export const VerificationDetailModal: React.FC<VerificationDetailModalProps> = ({
  business,
  onClose,
  onVerifyNow,
}) => {
  if (!business) return null;

  const v: Partial<VerificationResult> = business.verification || {};
  const companyName = business.company_name || business.normalized_url || 'Business Entity';

  // Firmographics & Company Profile Evidence
  const rawEmpCount = business.firmographics?.employee_count || business.employee_count;
  const rawEmpRange = business.firmographics?.employee_range || business.firmographics?.employee_tier || business.employee_range;
  const rawFounded = business.firmographics?.founded_year || business.founded_year;

  const empCount = (rawEmpCount && rawEmpCount !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(rawEmpCount)) ? rawEmpCount : undefined;
  const empRange = (rawEmpRange && !/^(unknown|not found|none|n\/a)$/i.test(rawEmpRange)) ? rawEmpRange : undefined;
  const foundedYear = (rawFounded && rawFounded !== '0' && !/^(unknown|not found|none|n\/a)$/i.test(rawFounded)) ? rawFounded : undefined;

  const empSource = business.firmographics?.employee_count_source_url || business.employee_count_source_url;
  const foundedSource = business.firmographics?.founded_year_source_url || business.founded_year_source_url;
  const empConfidence = business.firmographics?.employee_count_confidence || business.employee_count_confidence || (empCount ? 'verified' : (empRange ? 'range' : undefined));
  const foundedConfidence = business.firmographics?.founded_year_confidence || business.founded_year_confidence || (foundedYear ? 'verified' : undefined);
  const lastChecked = business.firmographics?.last_checked_date || business.last_checked_date;
  const industry = business.firmographics?.industry;
  const location = business.firmographics?.location || business.firmographics?.headquarters || business.location;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131122] border border-purple-100 dark:border-purple-900/40 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-100/80 dark:border-purple-900/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{companyName}</h3>
              <a
                href={business.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                <span>{business.url}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Company Overview Card */}
          <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-purple-50/60 dark:from-[#181d38]/80 dark:via-[#191833]/80 dark:to-[#1d1633]/80 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                <Building2 className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
                <span>Company Overview</span>
              </div>
              {lastChecked && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  Checked: {new Date(lastChecked).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Employee Count */}
              <div className="bg-white/80 dark:bg-[#111425]/70 border border-blue-100/80 dark:border-blue-900/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                    <Users className="w-3.5 h-3.5 text-[#155eef] dark:text-blue-400" />
                    <span>Employee Count</span>
                  </div>
                  {empCount || empRange ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {empConfidence || 'Verified'}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Not found
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {empCount ? (
                    <span>
                      {empCount} {empRange && empRange !== empCount ? <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({empRange} range)</span> : 'employees'}
                    </span>
                  ) : empRange ? (
                    <span>{empRange} employees</span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 font-sans font-normal text-xs italic">Unknown</span>
                  )}
                </div>

                {empSource && (
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Source:</span>
                    <a
                      href={empSource}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#155eef] dark:text-blue-400 hover:underline truncate max-w-[170px] inline-flex items-center gap-0.5"
                    >
                      <span className="truncate">{empSource}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              {/* Founded Year */}
              <div className="bg-white/80 dark:bg-[#111425]/70 border border-blue-100/80 dark:border-blue-900/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Founded Year</span>
                  </div>
                  {foundedYear ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {foundedConfidence || 'Verified'}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Not found
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {foundedYear ? (
                    <span>{foundedYear}</span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 font-sans font-normal text-xs italic">Unknown</span>
                  )}
                </div>

                {foundedSource && (
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Source:</span>
                    <a
                      href={foundedSource}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-600 dark:text-purple-400 hover:underline truncate max-w-[170px] inline-flex items-center gap-0.5"
                    >
                      <span className="truncate">{foundedSource}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Extra details: Industry & Location */}
            {(industry || location || business.firmographics?.offering_summary) && (
              <div className="pt-2 border-t border-blue-100/60 dark:border-blue-900/30 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                {industry && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Industry:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{industry}</span>
                  </div>
                )}
                {location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-800 dark:text-slate-200 truncate max-w-[250px]">{location}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Banner */}
          <div className="bg-purple-50/50 dark:bg-[#181628]/60 border border-purple-100/80 dark:border-purple-900/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                Final Business Status
              </div>
              <VerificationStatusBadge
                status={v.final_business_status}
                confidence={v.status_confidence}
                leadEligibility={v.lead_eligibility}
                showEligibility={true}
              />
            </div>

            <div className="text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Last Verified</div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">{v.last_verified || 'Not Verified'}</div>
              {v.next_verification_date && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Next recheck: {v.next_verification_date}</div>
              )}
            </div>
          </div>

          {/* Evidence Summary Card */}
          {v.status_evidence && (
            <div className="bg-purple-50/30 dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Verification Synthesis & Evidence</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">{v.status_evidence}</p>
              {v.status_sources && v.status_sources.length > 0 && (
                <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400">Verified by:</span>
                  {v.status_sources.map((src, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100/60 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Verification Dimensions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Website Status */}
            <div className="bg-white dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Globe className="w-4 h-4 text-indigo-500" />
                <span>Website Health & Recency</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>HTTP Status:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.website_http_status || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Server Last-Modified:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.website_last_modified || 'UNKNOWN'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Latest Content Date:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.latest_website_content_date || 'UNKNOWN'}</span>
                </div>
                {v.website_date_source && v.website_date_source !== 'UNKNOWN' && (
                  <div className="flex justify-between">
                    <span>Date Source:</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-300 capitalize">{v.website_date_source.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {v.website_activity_evidence && (
                  <div className="text-slate-600 dark:text-slate-300 italic pt-1 text-[10px] border-t border-purple-100/70 dark:border-purple-900/30 mt-1">
                    "{v.website_activity_evidence}"
                  </div>
                )}
              </div>
            </div>

            {/* 2. Google Maps / Places */}
            <div className="bg-white dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span>Google Maps Status</span>
                </div>
                {v.google_maps_url && (
                  <a
                    href={v.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                  >
                    View on Maps
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Found on Maps:</span>
                  <span className={`font-semibold ${v.google_maps_found ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {v.google_maps_found ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Operational Status:</span>
                  <span className={`font-semibold ${
                    v.google_maps_status === 'OPEN' ? 'text-emerald-600 dark:text-emerald-400' :
                    v.google_maps_status === 'PERMANENTLY CLOSED' ? 'text-rose-600 dark:text-rose-400' :
                    v.google_maps_status === 'TEMPORARILY CLOSED' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {v.google_maps_status || 'Unverified'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Match Confidence:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.google_maps_match || 'N/A'}</span>
                </div>
                {v.google_maps_business_name && (
                  <div className="flex justify-between">
                    <span>Maps Title:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{v.google_maps_business_name}</span>
                  </div>
                )}
                {v.google_maps_address && (
                  <div className="flex justify-between">
                    <span>Maps Address:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{v.google_maps_address}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Latest Review Date:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.latest_review_date || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* 3. Search Engine Verification */}
            <div className="bg-white dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Search className="w-4 h-4 text-purple-500" />
                <span>Search Query Verification</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Search Outcome:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.search_verification || 'N/A'}</span>
                </div>
                {v.search_evidence && (
                  <div className="text-slate-600 dark:text-slate-300 text-[10px] pt-1 border-t border-purple-100/70 dark:border-purple-900/30 mt-1">
                    {v.search_evidence}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Government Registry (GovFiles) */}
            <div className="bg-white dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Landmark className="w-4 h-4 text-amber-500" />
                <span>Government Registry (GovFiles)</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Entity Found:</span>
                  <span className={`font-semibold ${v.government_entity_found ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {v.government_entity_found ? 'YES' : 'NO'}
                  </span>
                </div>
                {(v.government_legal_name || v.government_entity_name) && (
                  <div className="flex justify-between">
                    <span>Legal Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                      {v.government_legal_name || v.government_entity_name}
                    </span>
                  </div>
                )}
                {v.government_entity_id && (
                  <div className="flex justify-between">
                    <span>Entity ID:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{v.government_entity_id}</span>
                  </div>
                )}
                {v.government_entity_type && (
                  <div className="flex justify-between">
                    <span>Entity Type:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{v.government_entity_type}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Filing Status:</span>
                  <span className={`font-semibold ${
                    v.government_entity_status === 'ACTIVE' || (v.government_entity_status as string) === 'GOOD STANDING'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : v.government_entity_status === 'DISSOLVED' || v.government_entity_status === 'REVOKED'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {v.government_entity_status || 'NOT FOUND'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Government Source:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.government_source || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Filing Date:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{v.government_last_filing_date || 'N/A'}</span>
                </div>
                {v.government_verification_date && (
                  <div className="flex justify-between">
                    <span>Gov Verified On:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{v.government_verification_date}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Verification Execution Trace */}
          {v.verification_trace && (
            <div className="border-t border-purple-100/80 dark:border-purple-900/30 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Verification Ladder Trace</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Target: {v.verification_trace.business_name} | {v.verification_trace.steps?.length || 0} steps executed
                </span>
              </div>
              <div className="space-y-1.5">
                {v.verification_trace.steps?.map((step, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-purple-50/40 dark:bg-[#181628]/60 border border-purple-100/70 dark:border-purple-900/30 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          step.status === 'ok' ? 'bg-emerald-500' :
                          step.status === 'error' ? 'bg-rose-500' :
                          step.status === 'skipped' ? 'bg-slate-400' : 'bg-amber-500'
                        }`} />
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 capitalize">
                          {step.step.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {step.duration_ms}ms
                      </span>
                    </div>
                    {step.details && (
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] pl-4">{step.details}</p>
                    )}
                    {step.error && (
                      <p className="text-rose-500 text-[10px] pl-4">Error: {step.error}</p>
                    )}
                    {step.fallback_used && (
                      <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/40 dark:text-amber-300 ml-4">
                        Fallback Applied
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification History Log */}
          {v.history && v.history.length > 0 && (
            <div className="border-t border-purple-100/80 dark:border-purple-900/30 pt-3 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Verification Audit History</span>
              </div>
              <div className="space-y-2">
                {v.history.map((h, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-purple-50/40 dark:bg-[#181628]/50 border border-purple-100/70 dark:border-purple-900/30 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>{new Date(h.date || h.verification_date).toLocaleString()}</span>
                      <span className="font-bold text-purple-600 dark:text-purple-300">Level: {h.level || h.verification_level}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{h.previous_status}</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-bold text-slate-900 dark:text-white">{h.new_status}</span>
                      {h.confidence && <span className="text-slate-400">({h.confidence})</span>}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">{h.evidence_summary || h.evidence}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-purple-100/80 dark:border-purple-900/30 bg-purple-50/20 dark:bg-[#151325]/80 flex items-center justify-between shrink-0">
          <div className="text-slate-500 dark:text-slate-400 text-xs">
            Credits Used:{' '}
            <span className="font-bold text-slate-900 dark:text-white">{v.credits_used !== undefined ? v.credits_used : '0'}</span>
          </div>

          <div className="flex items-center gap-2">
            {onVerifyNow && (
              <button
                onClick={() => {
                  onVerifyNow(business);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
              >
                VERIFY NOW
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
