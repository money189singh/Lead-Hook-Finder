import * as XLSX from 'xlsx';
import { Contact, ScrapeJob, WebsiteResult } from '../src/types';

export function generateExcelWorkbook(job: ScrapeJob): Buffer {
  const wb = XLSX.utils.book_new();

  const mapContactRow = (c: Contact) => ({
    'First Name': c.first_name || '',
    'Last Name': c.last_name || '',
    'Full Name': c.full_name || '',
    'Professional Email': c.professional_email || (c.email_type !== 'Generic Business Email' && c.email_type !== 'Generic' ? c.email : '') || 'Not found',
    'Generic Email': (c.company_generic_emails && c.company_generic_emails.length > 0)
      ? c.company_generic_emails.join('; ')
      : (c.email_type === 'Generic Business Email' || c.email_type === 'Generic' ? c.email : 'Not found'),
    'Association Status': c.association_status || (c.professional_email ? 'explicit' : 'none'),
    'Confidence Score': c.confidence_score !== undefined ? `${c.confidence_score}%` : 'N/A',
    'Departmental Inboxes': (c.departmental_emails || []).join('; '),
    'Job Title / Role': c.role || '',
    'Role Tier': c.role_tier || 'Other Staff',
    'Email Address': c.email || '',
    'Email Classification': c.email_type || 'Unknown',
    'Email Classification Reason': c.email_classification_reason || '',
    'Identity Verification Status': c.identity_verified ? 'VERIFIED' : 'UNVERIFIED',
    'Identity Verification Evidence': c.identity_verification_evidence || c.email_classification_reason || '',
    'Company Name': c.company_name || '',
    'Company Website': c.website || '',
    'Company Size / Employee Count': c.company_size || 'Unknown',
    'Industry': c.industry || 'Unknown',
    'Phone Number': c.phone || '',
    'LinkedIn Profile': c.linkedin_url || c.social_profiles?.linkedin || '',
    'Page Source URL': c.source_url || '',
    'Decision-Maker Status': c.is_decision_maker ? `YES (${c.decision_maker_tier || 'Executive'})` : 'NO',
    'Decision-Maker Tier': c.decision_maker_tier || 'None',
    'Decision-Maker Score': c.decision_maker_score || 0,
    'Decision-Maker Reasons': (c.decision_maker_reasons || []).join('; '),
    'ICP Filter Match Status': c.icp_filter_status || 'INCLUDED',
    'Reason for Inclusion / Exclusion': [
      ...(c.icp_inclusion_reasons || []),
      ...(c.icp_exclusion_reasons || []),
      ...(c.icp_match_reasons || []),
    ].join('; '),
    'ICP Match Score': c.icp_score !== undefined ? `${c.icp_score}%` : 'N/A',
    'ICP Tier': c.icp_tier || 'Unmatched',
    'AI Provider': c.provider || 'Unified Router',
    'AI Model': c.model || 'Deterministic',
    'Attempts': c.attempts || 1,
    'Latency (ms)': c.latency_ms || 0,
    // Business Verification Columns
    'Google Maps Found': c.google_maps_found ? 'YES' : 'NO',
    'Google Maps Status': c.google_maps_status || 'Unverified',
    'Google Maps Match Confidence': c.google_maps_match || 'N/A',
    'Google Maps URL': c.google_maps_url || '',
    'Government Entity Found': c.government_entity_found ? 'YES' : 'NO',
    'Legal Business Name': c.government_legal_name || c.government_entity_name || '',
    'Government Entity ID': c.government_entity_id || '',
    'Government Entity Status': c.government_entity_status || 'NOT FOUND',
    'Government Source': c.government_source || 'N/A',
    'Final Business Status': c.final_business_status || 'UNCERTAIN',
    'Status Confidence': c.status_confidence || 'LOW',
    'Status Evidence': c.status_evidence || '',
    'Lead Eligibility': c.lead_eligibility || (c.final_business_status === 'OPEN' ? 'KEEP' : 'VERIFY'),
  });

  const allContacts = job.contacts || [];
  const professionalContacts = allContacts.filter(
    (c) => c.email_type === 'Professional Personal Email' || c.email_type === 'Personal'
  );
  const genericAndOtherContacts = allContacts.filter(
    (c) => c.email_type !== 'Professional Personal Email' && c.email_type !== 'Personal'
  );

  // Sheet 1: Professional Personal Contacts
  const wsProf = XLSX.utils.json_to_sheet(
    professionalContacts.length > 0
      ? professionalContacts.map(mapContactRow)
      : [{ 'Note': 'No professional personal email contacts found in this batch' }]
  );
  XLSX.utils.book_append_sheet(wb, wsProf, 'Professional Personal Emails');

  // Sheet 2: Generic & Other Contacts
  const wsGeneric = XLSX.utils.json_to_sheet(
    genericAndOtherContacts.length > 0
      ? genericAndOtherContacts.map(mapContactRow)
      : [{ 'Note': 'No generic or uncategorized contacts found in this batch' }]
  );
  XLSX.utils.book_append_sheet(wb, wsGeneric, 'Generic & Other Emails');

  // Sheet 3: All Contacts Master
  const wsAllContacts = XLSX.utils.json_to_sheet(
    allContacts.length > 0
      ? allContacts.map(mapContactRow)
      : [{ 'Note': 'No contacts extracted in this job' }]
  );
  XLSX.utils.book_append_sheet(wb, wsAllContacts, 'All Contacts (Master)');

  // Sheet 4: Companies
  const companiesData = (job.websites || []).map((w) => {
    const v = w.verification;
    return {
      'Company Name': w.company_name || w.normalized_url,
      'Website': w.url,
      'Status': w.status,
      'Industry': w.firmographics?.industry || 'Unspecified',
      'Exact Employee Count': w.firmographics?.employee_count || w.employee_count || 'Unknown',
      'Employee Range': w.firmographics?.employee_range || w.firmographics?.employee_tier || w.employee_range || 'Unknown',
      'Founded Year': w.firmographics?.founded_year || w.founded_year || 'Unknown',
      'Corporate Location': w.firmographics?.location || w.firmographics?.headquarters || w.location || 'Unknown',
      'Company Size / Employees': w.firmographics?.employee_count || w.employee_count || w.firmographics?.employee_tier || 'Unknown',
      'Headquarters': w.firmographics?.headquarters || 'N/A',
      'Country Code': w.firmographics?.country_code || 'N/A',
      'Offering Summary': w.firmographics?.offering_summary || 'N/A',
      'Decision Maker Identified': w.decision_maker ? 'YES' : 'NO',
      'Decision Maker Name': w.decision_maker?.full_name || 'N/A',
      'Decision Maker Role': w.decision_maker?.role || 'N/A',
      'Decision Maker Tier': w.decision_maker?.decision_maker_tier || 'N/A',
      'Decision Maker Email': w.decision_maker?.email || 'N/A',
      'Decision Maker Email Classification': w.decision_maker?.email_type || 'N/A',
      'ICP Filter Status': w.icp_filter_status || 'INCLUDED',
      'ICP Filter Reasons': (w.icp_filter_reasons || []).join('; '),
      'Average ICP Score': w.avg_icp_score !== undefined ? `${w.avg_icp_score}%` : 'N/A',
      'High ICP Leads': w.high_icp_contacts_count || 0,
      'Total Contacts': w.contacts_found,
      'Emails Found': w.emails_found,
      'Pages Crawled': w.pages_crawled,
      'Pages Discovered': w.pages_discovered,
      'AI Provider': w.extraction_metadata?.providerName || 'N/A',
      'AI Model': w.extraction_metadata?.model || 'N/A',
      'Extraction Latency (ms)': w.extraction_metadata?.latencyMs || 0,
      'Google Maps Found': v?.google_maps_found ? 'YES' : 'NO',
      'Google Maps Status': v?.google_maps_status || 'Unverified',
      'Government Entity Found': v?.government_entity_found ? 'YES' : 'NO',
      'Government Entity Status': v?.government_entity_status || 'NOT FOUND',
      'Final Business Status': v?.final_business_status || 'UNCERTAIN',
      'Lead Eligibility': v?.lead_eligibility || (v?.final_business_status === 'OPEN' ? 'KEEP' : 'VERIFY'),
    };
  });

  const wsCompanies = XLSX.utils.json_to_sheet(
    companiesData.length > 0
      ? companiesData
      : [{ 'Note': 'No company records found' }]
  );
  XLSX.utils.book_append_sheet(wb, wsCompanies, 'Companies');

  // Sheet 5: Scraping & Rules Summary
  const personalCount = allContacts.filter(
    (c) => c.email_type === 'Professional Personal Email' || c.email_type === 'Personal'
  ).length;
  const genericCount = allContacts.filter(
    (c) => c.email_type === 'Generic Business Email' || c.email_type === 'Generic'
  ).length;
  const providerCount = allContacts.filter((c) => c.email_type === 'Personal Email Provider').length;
  const unknownCount = allContacts.filter((c) => !c.email_type || c.email_type === 'Unknown').length;
  const decisionMakersCount = allContacts.filter((c) => c.is_decision_maker).length;

  const summaryData = [
    { Metric: 'Job ID', Value: job.id },
    { Metric: 'Execution Date', Value: job.created_at || new Date().toLocaleString() },
    { Metric: 'Job Status', Value: job.status.toUpperCase() },
    { Metric: 'Active AI Provider', Value: job.active_provider || 'Unified AI Router' },
    { Metric: 'Active AI Model', Value: job.active_model || 'Dynamic Failover' },
    { Metric: 'Total Target Websites', Value: job.total_websites },
    { Metric: 'Completed Websites', Value: job.completed_websites },
    { Metric: 'Failed Websites', Value: job.failed_websites },
    { Metric: 'Total Contacts Extracted', Value: job.contacts_found },
    { Metric: 'Decision-Makers Identified', Value: decisionMakersCount },
    { Metric: 'Professional Personal Emails', Value: personalCount },
    { Metric: 'Generic Business Emails', Value: genericCount },
    { Metric: 'Personal Email Providers (Gmail/Yahoo etc)', Value: providerCount },
    { Metric: 'Unknown / Unverified Email Types', Value: unknownCount },
    { Metric: 'Total Pages Crawled', Value: job.pages_crawled },
    { Metric: 'Generated By', Value: 'Enterprise Lead Scraper & Verifier' },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & Metrics');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function generateCsv(contacts: Contact[], websites?: WebsiteResult[]): string {
  const escapeField = (val: string | number | undefined | boolean | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // If no contacts exist, but websites/businesses exist, export the businesses table
  if ((!contacts || contacts.length === 0) && websites && websites.length > 0) {
    const businessHeaders = [
      'Company Name',
      'Website',
      'Operating Status',
      'Lead Eligibility',
      'Confidence',
      'Industry',
      'Company Size / Employees',
      'Decision Maker Identified',
      'Decision Maker Name',
      'Decision Maker Role',
      'Decision Maker Email',
      'Decision Maker Classification',
      'ICP Filter Status',
      'ICP Filter Reasons',
      'Google Maps Found',
      'Google Maps Status',
      'Google Maps Match Confidence',
      'Google Maps URL',
      'Government Entity Found',
      'Legal Business Name',
      'Government Entity ID',
      'Government Entity Status',
      'Government Source',
      'Status Evidence',
    ];

    const rows = websites.map((w) => {
      const v = w.verification;
      return [
        escapeField(w.company_name || w.normalized_url),
        escapeField(w.url),
        escapeField(v?.final_business_status || 'UNCERTAIN'),
        escapeField(v?.lead_eligibility || (v?.final_business_status === 'OPEN' ? 'KEEP' : 'VERIFY')),
        escapeField(v?.status_confidence || 'LOW'),
        escapeField(w.firmographics?.industry || 'Unspecified'),
        escapeField(w.firmographics?.employee_tier || w.firmographics?.employee_count || 'Unknown'),
        escapeField(w.decision_maker ? 'YES' : 'NO'),
        escapeField(w.decision_maker?.full_name || 'N/A'),
        escapeField(w.decision_maker?.role || 'N/A'),
        escapeField(w.decision_maker?.email || 'N/A'),
        escapeField(w.decision_maker?.email_type || 'N/A'),
        escapeField(w.icp_filter_status || 'INCLUDED'),
        escapeField((w.icp_filter_reasons || []).join('; ')),
        escapeField(v?.google_maps_found ? 'YES' : 'NO'),
        escapeField(v?.google_maps_status || 'Unverified'),
        escapeField(v?.google_maps_match || 'N/A'),
        escapeField(v?.google_maps_url || ''),
        escapeField(v?.government_entity_found ? 'YES' : 'NO'),
        escapeField(v?.government_legal_name || v?.government_entity_name || ''),
        escapeField(v?.government_entity_id || ''),
        escapeField(v?.government_entity_status || 'NOT FOUND'),
        escapeField(v?.government_source || 'N/A'),
        escapeField(v?.status_evidence || ''),
      ].join(',');
    });

    return [businessHeaders.map(escapeField).join(','), ...rows].join('\n');
  }

  const contactHeaders = [
    'First Name',
    'Last Name',
    'Full Name',
    'Professional Email',
    'Generic Email',
    'Association Status',
    'Confidence Score',
    'Departmental Inboxes',
    'Job Title / Role',
    'Role Tier',
    'Email Address',
    'Email Classification',
    'Email Classification Reason',
    'Identity Verification Status',
    'Identity Verification Evidence',
    'Company Name',
    'Company Website',
    'Company Size / Employee Count',
    'Industry',
    'Phone Number',
    'LinkedIn Profile',
    'Page Source URL',
    'Decision-Maker Status',
    'Decision-Maker Tier',
    'Decision-Maker Score',
    'Decision-Maker Reasons',
    'ICP Filter Match Status',
    'Reason for Inclusion / Exclusion',
    'ICP Match Score',
    'ICP Tier',
    'AI Provider',
    'AI Model',
    'Google Maps Found',
    'Google Maps Status',
    'Government Entity Found',
    'Government Entity Status',
    'Final Business Status',
    'Lead Eligibility',
  ];

  const rows = contacts.map((c) => {
    const reasons = [
      ...(c.icp_inclusion_reasons || []),
      ...(c.icp_exclusion_reasons || []),
      ...(c.icp_match_reasons || []),
    ].join('; ');

    return [
      escapeField(c.first_name),
      escapeField(c.last_name),
      escapeField(c.full_name),
      escapeField(c.professional_email || (c.email_type !== 'Generic Business Email' && c.email_type !== 'Generic' ? c.email : '') || 'Not found'),
      escapeField((c.company_generic_emails && c.company_generic_emails.length > 0) ? c.company_generic_emails.join('; ') : (c.email_type === 'Generic Business Email' || c.email_type === 'Generic' ? c.email : 'Not found')),
      escapeField(c.association_status || (c.professional_email ? 'explicit' : 'none')),
      escapeField(c.confidence_score !== undefined ? `${c.confidence_score}%` : 'N/A'),
      escapeField((c.departmental_emails || []).join('; ')),
      escapeField(c.role),
      escapeField(c.role_tier || 'Other Staff'),
      escapeField(c.email),
      escapeField(c.email_type || 'Unknown'),
      escapeField(c.email_classification_reason || ''),
      escapeField(c.identity_verified ? 'VERIFIED' : 'UNVERIFIED'),
      escapeField(c.identity_verification_evidence || c.email_classification_reason || ''),
      escapeField(c.company_name),
      escapeField(c.website),
      escapeField(c.company_size || 'Unknown'),
      escapeField(c.industry || 'Unknown'),
      escapeField(c.phone),
      escapeField(c.linkedin_url || c.social_profiles?.linkedin || ''),
      escapeField(c.source_url),
      escapeField(c.is_decision_maker ? `YES (${c.decision_maker_tier || 'Executive'})` : 'NO'),
      escapeField(c.decision_maker_tier || 'None'),
      escapeField(c.decision_maker_score || 0),
      escapeField((c.decision_maker_reasons || []).join('; ')),
      escapeField(c.icp_filter_status || 'INCLUDED'),
      escapeField(reasons),
      escapeField(c.icp_score !== undefined ? `${c.icp_score}%` : ''),
      escapeField(c.icp_tier || ''),
      escapeField(c.provider),
      escapeField(c.model),
      escapeField(c.google_maps_found ? 'YES' : 'NO'),
      escapeField(c.google_maps_status || 'Unverified'),
      escapeField(c.government_entity_found ? 'YES' : 'NO'),
      escapeField(c.government_entity_status || 'NOT FOUND'),
      escapeField(c.final_business_status || 'UNCERTAIN'),
      escapeField(c.lead_eligibility || (c.final_business_status === 'OPEN' ? 'KEEP' : 'VERIFY')),
    ].join(',');
  });

  return [contactHeaders.map(escapeField).join(','), ...rows].join('\n');
}
