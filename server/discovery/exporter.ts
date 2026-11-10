import * as XLSX from 'xlsx';
import { DiscoveredProspect } from './types';

export function generateDiscoveryXlsx(prospects: DiscoveredProspect[]): Buffer {
  const wb = XLSX.utils.book_new();

  const rows = prospects.map((p) => ({
    'Company Name': p.companyName || '',
    'Domain': p.domain || '',
    'Official Website': p.website || '',
    'Decision Maker Name': p.personName || '',
    'Decision Maker Role / Title': p.jobTitle || '',
    'Decision Maker Seniority': p.seniority || '',
    'Decision Maker Email (Direct)': p.decisionMakerEmail || (p.emailType !== 'Generic Business Email' ? p.email : '') || '',
    'Generic Company Email': p.genericEmail || (p.emailType === 'Generic Business Email' ? p.email : '') || '',
    'Primary Contact Email': p.email || '',
    'Email Classification': p.emailType || '',
    'City': p.city || '',
    'State / Region': p.state || '',
    'Country': p.country || '',
    'Full Location': p.location || [p.city, p.state, p.country].filter(Boolean).join(', ') || '',
    'Founded Year': p.foundedYear || '',
    'Number of Employees': p.employeeCount || '',
    'Industry': p.industry || '',
    'Phone Number': p.phone || '',
    'LinkedIn URL': p.linkedinUrl || '',
    'Company Description': p.description || '',
    'Annual Revenue': p.revenue || '',
    'Verification Status': p.verificationStatus || 'Needs review',
    'Match Fit Score': p.fitScore || 85,
    'Discovered At': p.discoveredAt || '',
    'Source URL': p.sourceUrl || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Discovered Prospects');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function generateDiscoveryCsv(prospects: DiscoveredProspect[]): string {
  const headers = [
    'Company Name',
    'Domain',
    'Official Website',
    'Decision Maker Name',
    'Decision Maker Role / Title',
    'Decision Maker Seniority',
    'Decision Maker Email (Direct)',
    'Generic Company Email',
    'Primary Contact Email',
    'Email Classification',
    'City',
    'State / Region',
    'Country',
    'Full Location',
    'Founded Year',
    'Number of Employees',
    'Industry',
    'Phone Number',
    'LinkedIn URL',
    'Company Description',
    'Annual Revenue',
    'Verification Status',
    'Match Fit Score',
    'Discovered At',
    'Source URL',
  ];

  const escapeCsv = (val: any) => {
    if (val === undefined || val === null) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines = [headers.join(',')];

  for (const p of prospects) {
    const row = [
      escapeCsv(p.companyName),
      escapeCsv(p.domain),
      escapeCsv(p.website),
      escapeCsv(p.personName),
      escapeCsv(p.jobTitle),
      escapeCsv(p.seniority),
      escapeCsv(p.decisionMakerEmail || (p.emailType !== 'Generic Business Email' ? p.email : '')),
      escapeCsv(p.genericEmail || (p.emailType === 'Generic Business Email' ? p.email : '')),
      escapeCsv(p.email),
      escapeCsv(p.emailType),
      escapeCsv(p.city),
      escapeCsv(p.state),
      escapeCsv(p.country),
      escapeCsv(p.location || [p.city, p.state, p.country].filter(Boolean).join(', ')),
      escapeCsv(p.foundedYear),
      escapeCsv(p.employeeCount),
      escapeCsv(p.industry),
      escapeCsv(p.phone),
      escapeCsv(p.linkedinUrl),
      escapeCsv(p.description),
      escapeCsv(p.revenue),
      escapeCsv(p.verificationStatus),
      escapeCsv(p.fitScore || 85),
      escapeCsv(p.discoveredAt),
      escapeCsv(p.sourceUrl),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
