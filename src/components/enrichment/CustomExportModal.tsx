import React, { useState } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  Check,
  Sliders,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Contact, WebsiteResult } from '../../types';

export interface ExportColumnDef {
  id: string;
  label: string;
  enabled: boolean;
  getValue: (c: Contact, site?: WebsiteResult) => string | number;
}

interface CustomExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  websites: WebsiteResult[];
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

const BASE_COLUMNS: ExportColumnDef[] = [
  {
    id: 'first_name',
    label: 'First Name',
    enabled: true,
    getValue: (c) => c.first_name || (c.full_name ? c.full_name.split(' ')[0] : ''),
  },
  {
    id: 'last_name',
    label: 'Last Name',
    enabled: true,
    getValue: (c) => c.last_name || (c.full_name ? c.full_name.split(' ').slice(1).join(' ') : ''),
  },
  {
    id: 'full_name',
    label: 'Full Name',
    enabled: true,
    getValue: (c) => c.full_name || '',
  },
  {
    id: 'email',
    label: 'Email',
    enabled: true,
    getValue: (c) => c.professional_email || c.email || c.company_generic_emails?.[0] || '',
  },
  {
    id: 'professional_email',
    label: 'Professional Email',
    enabled: true,
    getValue: (c) => c.professional_email || '',
  },
  {
    id: 'generic_emails',
    label: 'Generic Inboxes',
    enabled: true,
    getValue: (c) => (c.company_generic_emails || []).join('; '),
  },
  {
    id: 'company_name',
    label: 'Company Name',
    enabled: true,
    getValue: (c) => c.company_name || '',
  },
  {
    id: 'website',
    label: 'Website',
    enabled: true,
    getValue: (c) => c.website || '',
  },
  {
    id: 'role',
    label: 'Job Title',
    enabled: true,
    getValue: (c) => c.role || '',
  },
  {
    id: 'role_tier',
    label: 'Role Tier',
    enabled: true,
    getValue: (c) => c.role_tier || '',
  },
  {
    id: 'phone',
    label: 'Phone',
    enabled: true,
    getValue: (c) => c.phone || '',
  },
  {
    id: 'linkedin_url',
    label: 'LinkedIn URL',
    enabled: true,
    getValue: (c) => c.linkedin_url || c.social_profiles?.linkedin || '',
  },
  {
    id: 'icp_score',
    label: 'ICP Score',
    enabled: true,
    getValue: (c) => (c.icp_score !== undefined ? c.icp_score : ''),
  },
  {
    id: 'employees',
    label: 'Employees',
    enabled: true,
    getValue: (c, site) =>
      site?.firmographics?.employee_count ||
      site?.firmographics?.employee_range ||
      site?.firmographics?.employee_tier ||
      c.company_size ||
      '',
  },
  {
    id: 'founded_year',
    label: 'Founded Year',
    enabled: true,
    getValue: (_c, site) => site?.firmographics?.founded_year || '',
  },
  {
    id: 'location',
    label: 'Location',
    enabled: true,
    getValue: (_c, site) =>
      site?.firmographics?.location || site?.firmographics?.headquarters || '',
  },
  {
    id: 'pipeline_stage',
    label: 'Pipeline Stage',
    enabled: true,
    getValue: (c) => c.pipeline_stage || 'New',
  },
  {
    id: 'tags',
    label: 'Tags',
    enabled: true,
    getValue: (c) => (c.tags || []).join(', '),
  },
  {
    id: 'notes',
    label: 'Notes',
    enabled: true,
    getValue: (c) => c.notes || '',
  },
  {
    id: 'source_url',
    label: 'Source URL',
    enabled: true,
    getValue: (c) => c.source_url || '',
  },
];

type PresetId = 'all' | 'instantly' | 'smartlead' | 'apollo' | 'hubspot';

const PRESETS: Record<PresetId, { name: string; columns: { id: string; label: string }[] }> = {
  all: {
    name: 'All Columns',
    columns: BASE_COLUMNS.map((c) => ({ id: c.id, label: c.label })),
  },
  instantly: {
    name: 'Instantly.ai',
    columns: [
      { id: 'email', label: 'email' },
      { id: 'first_name', label: 'first_name' },
      { id: 'last_name', label: 'last_name' },
      { id: 'company_name', label: 'company_name' },
      { id: 'website', label: 'website' },
      { id: 'role', label: 'job_title' },
      { id: 'phone', label: 'phone' },
      { id: 'linkedin_url', label: 'linkedin' },
    ],
  },
  smartlead: {
    name: 'Smartlead',
    columns: [
      { id: 'email', label: 'email' },
      { id: 'first_name', label: 'first_name' },
      { id: 'last_name', label: 'last_name' },
      { id: 'company_name', label: 'company_name' },
      { id: 'website', label: 'company_url' },
      { id: 'role', label: 'title' },
      { id: 'phone', label: 'phone_number' },
      { id: 'location', label: 'location' },
    ],
  },
  apollo: {
    name: 'Apollo',
    columns: [
      { id: 'first_name', label: 'First Name' },
      { id: 'last_name', label: 'Last Name' },
      { id: 'role', label: 'Title' },
      { id: 'company_name', label: 'Company' },
      { id: 'email', label: 'Email' },
      { id: 'phone', label: 'Work Direct Phone' },
      { id: 'employees', label: '# Employees' },
      { id: 'website', label: 'Website' },
      { id: 'linkedin_url', label: 'Person Linkedin Url' },
    ],
  },
  hubspot: {
    name: 'HubSpot',
    columns: [
      { id: 'email', label: 'Email' },
      { id: 'first_name', label: 'First Name' },
      { id: 'last_name', label: 'Last Name' },
      { id: 'role', label: 'Job Title' },
      { id: 'company_name', label: 'Company Name' },
      { id: 'phone', label: 'Phone Number' },
      { id: 'website', label: 'Website URL' },
      { id: 'pipeline_stage', label: 'Lead Status' },
      { id: 'notes', label: 'Notes' },
    ],
  },
};

export const CustomExportModal: React.FC<CustomExportModalProps> = ({
  isOpen,
  onClose,
  contacts,
  websites,
  onShowToast,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('all');
  const [columns, setColumns] = useState<ExportColumnDef[]>(BASE_COLUMNS);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);

  if (!isOpen) return null;

  const applyPreset = (presetId: PresetId) => {
    setSelectedPreset(presetId);
    const preset = PRESETS[presetId];
    const presetMap = new Map(preset.columns.map((c, idx) => [c.id, { label: c.label, order: idx }]));

    const ordered: ExportColumnDef[] = [];
    for (const pc of preset.columns) {
      const base = BASE_COLUMNS.find((b) => b.id === pc.id);
      if (base) {
        ordered.push({ ...base, label: pc.label, enabled: true });
      }
    }
    for (const base of BASE_COLUMNS) {
      if (!presetMap.has(base.id)) {
        ordered.push({ ...base, enabled: false });
      }
    }
    setColumns(ordered);
  };

  const toggleColumn = (id: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, enabled: !col.enabled } : col))
    );
  };

  const updateLabel = (id: string, newLabel: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, label: newLabel } : col))
    );
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const copy = [...columns];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setColumns(copy);
  };

  const buildRows = () => {
    const activeCols = columns.filter((c) => c.enabled);
    const filteredList = onlyWithEmail
      ? contacts.filter(
          (c) =>
            Boolean(c.professional_email) ||
            Boolean(c.email) ||
            Boolean(c.company_generic_emails && c.company_generic_emails.length > 0)
        )
      : contacts;

    return filteredList.map((c) => {
      const site = websites.find(
        (w) =>
          w.url === c.website ||
          w.normalized_url === c.website ||
          (c.website && w.url.includes(c.website))
      );
      const rowObj: Record<string, string | number> = {};
      for (const col of activeCols) {
        rowObj[col.label || col.id] = col.getValue(c, site);
      }
      return rowObj;
    });
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const activeCols = columns.filter((c) => c.enabled);
    if (activeCols.length === 0) {
      onShowToast('Select at least one column to export.', 'warning');
      return;
    }
    const rows = buildRows();
    if (rows.length === 0) {
      onShowToast('No contacts match the export filter.', 'warning');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const filename = `leadhook_${selectedPreset}_${new Date().toISOString().slice(0, 10)}.${format}`;
    XLSX.writeFile(wb, filename, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
    onShowToast(`Exported ${rows.length} leads (${filename})`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#0f1424] border border-blue-100 dark:border-blue-900/40 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Custom Export Builder
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Presets */}
          <div className="space-y-2">
            <div className="font-semibold text-slate-700 dark:text-slate-300">Export Format Presets</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as PresetId[]).map((presetKey) => (
                <button
                  key={`export-preset-${presetKey}`}
                  type="button"
                  onClick={() => applyPreset(presetKey)}
                  className={`px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedPreset === presetKey
                      ? 'bg-[#155eef] text-white border-[#155eef] shadow-xs'
                      : 'bg-blue-50/50 dark:bg-[#101730] text-slate-700 dark:text-slate-300 border-blue-200/70 dark:border-blue-800/40 hover:border-[#155eef]'
                  }`}
                >
                  {selectedPreset === presetKey && <Check className="w-3.5 h-3.5" />}
                  <span>{PRESETS[presetKey].name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Option */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/40 dark:bg-[#101730]/50 border border-blue-100 dark:border-blue-900/30">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Only export leads with verified or extracted email addresses
            </span>
            <input
              type="checkbox"
              checked={onlyWithEmail}
              onChange={(e) => setOnlyWithEmail(e.target.checked)}
              className="w-4 h-4 rounded border-blue-300 text-[#155eef] cursor-pointer"
            />
          </div>

          {/* Columns List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Columns ({columns.filter((c) => c.enabled).length} selected)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setColumns((prev) => prev.map((c) => ({ ...c, enabled: true })))}
                  className="text-[#155eef] dark:text-blue-400 hover:underline font-medium cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setColumns((prev) => prev.map((c) => ({ ...c, enabled: false })))}
                  className="text-slate-500 hover:underline font-medium cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {columns.map((col, idx) => (
                <div
                  key={`custom-col-${col.id}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-2 bg-white dark:bg-[#0f1424] hover:bg-blue-50/30 dark:hover:bg-blue-950/20"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer min-w-[160px]">
                    <input
                      type="checkbox"
                      checked={col.enabled}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-blue-300 text-[#155eef] cursor-pointer"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {BASE_COLUMNS.find((b) => b.id === col.id)?.label || col.id}
                    </span>
                  </label>

                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateLabel(col.id, e.target.value)}
                    placeholder="Header Name"
                    className="flex-1 max-w-[220px] px-2.5 py-1 glass-input rounded-lg text-xs font-mono"
                  />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveColumn(idx, -1)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 text-slate-500 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === columns.length - 1}
                      onClick={() => moveColumn(idx, 1)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 text-slate-500 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-blue-100 dark:border-blue-900/30 bg-slate-50/60 dark:bg-[#0c101d]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#101730] hover:bg-blue-50 text-[#155eef] dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export XLSX</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
