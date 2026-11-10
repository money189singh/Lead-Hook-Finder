import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  X,
  Check,
  AlertCircle,
  Building2,
  Globe,
  MapPin,
  FileUp,
  Sparkles,
} from 'lucide-react';

interface ParsedBusiness {
  url: string;
  company_name?: string;
  address?: string;
  phone?: string;
}

interface VerifierImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const VerifierImportModal: React.FC<VerifierImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedBusinesses, setParsedBusinesses] = useState<ParsedBusiness[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process uploaded file (CSV, XLSX, XLS, TXT)
  const handleFile = async (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'txt') {
        const text = await file.text();
        parseRawText(text);
      } else {
        // Use XLSX parser for .xlsx, .xls, and .csv
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          showToast('Uploaded spreadsheet is empty.', 'warning');
          setIsProcessing(false);
          return;
        }

        // Identify header row
        const firstRow = (jsonData[0] || []).map((c: any) => String(c || '').toLowerCase().trim());
        let urlIdx = firstRow.findIndex(
          (h: string) => h.includes('url') || h.includes('website') || h.includes('domain') || h.includes('site') || h.includes('web')
        );
        let nameIdx = firstRow.findIndex(
          (h: string) => h.includes('company') || h.includes('business') || h.includes('name') || h.includes('title')
        );
        let addrIdx = firstRow.findIndex(
          (h: string) => h.includes('address') || h.includes('location') || h.includes('headquarter') || h.includes('city')
        );
        let phoneIdx = firstRow.findIndex(
          (h: string) => h.includes('phone') || h.includes('tel') || h.includes('contact')
        );

        const startIndex = urlIdx !== -1 || nameIdx !== -1 ? 1 : 0;
        const results: ParsedBusiness[] = [];
        const seenUrls = new Set<string>();

        for (let r = startIndex; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          let rawUrl = '';
          let compName = '';
          let addr = '';
          let phone = '';

          if (urlIdx !== -1 && row[urlIdx]) {
            rawUrl = String(row[urlIdx]).trim();
          } else {
            // Find first column containing domain or http
            const found = row.find((cell: any) => {
              const s = String(cell || '').trim();
              return s.includes('.') && (s.startsWith('http') || s.startsWith('www') || !s.includes(' '));
            });
            if (found) rawUrl = String(found).trim();
          }

          if (nameIdx !== -1 && row[nameIdx]) {
            compName = String(row[nameIdx]).trim();
          }
          if (addrIdx !== -1 && row[addrIdx]) {
            addr = String(row[addrIdx]).trim();
          }
          if (phoneIdx !== -1 && row[phoneIdx]) {
            phone = String(row[phoneIdx]).trim();
          }

          // If no URL but company name exists, construct candidate
          if (!rawUrl && compName) {
            rawUrl = compName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
          }

          if (rawUrl) {
            const cleanKey = rawUrl.toLowerCase();
            if (!seenUrls.has(cleanKey)) {
              seenUrls.add(cleanKey);
              results.push({
                url: rawUrl,
                company_name: compName || undefined,
                address: addr || undefined,
                phone: phone || undefined,
              });
            }
          }
        }

        setParsedBusinesses(results);
        if (results.length === 0) {
          showToast('Could not find valid business URLs in file. Check columns.', 'warning');
        } else {
          showToast(`Extracted ${results.length} business(es) from ${file.name}`, 'info');
        }
      }
    } catch (err: any) {
      showToast(`Error reading file: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const parseRawText = (text: string) => {
    const lines = text.split(/\r?\n/);
    const results: ParsedBusiness[] = [];
    const seenUrls = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check if comma or tab separated
      const parts = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
      if (parts.length > 1) {
        // e.g. Company Name, Website, Address
        let rawUrl = '';
        let compName = '';
        let addr = '';

        for (const part of parts) {
          const p = part.trim().replace(/['"]/g, '');
          if (!rawUrl && (p.includes('.') && (p.startsWith('http') || p.startsWith('www') || !p.includes(' ')))) {
            rawUrl = p;
          } else if (!compName && !p.includes('.')) {
            compName = p;
          } else if (!addr) {
            addr = p;
          }
        }

        if (rawUrl) {
          const cleanKey = rawUrl.toLowerCase();
          if (!seenUrls.has(cleanKey)) {
            seenUrls.add(cleanKey);
            results.push({
              url: rawUrl,
              company_name: compName || undefined,
              address: addr || undefined,
            });
          }
        }
      } else {
        // Plain URL per line
        const rawUrl = trimmed.replace(/['"]/g, '');
        const cleanKey = rawUrl.toLowerCase();
        if (!seenUrls.has(cleanKey)) {
          seenUrls.add(cleanKey);
          results.push({ url: rawUrl });
        }
      }
    }

    setParsedBusinesses(results);
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    parseRawText(text);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmitImport = async () => {
    if (parsedBusinesses.length === 0) {
      showToast('No businesses detected to import.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/verifier/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses: parsedBusinesses }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Failed to import businesses', 'error');
        return;
      }

      showToast(`Successfully imported ${parsedBusinesses.length} business(es) into Verification workspace!`, 'success');
      onImportSuccess();
      onClose();
    } catch (err: any) {
      showToast(`Network error importing businesses: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Import Businesses for Verification
              </h2>
              <p className="text-xs text-slate-400">
                Upload a spreadsheet (Excel/CSV) or paste URLs to load businesses directly into the Verifier.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-4 border-b border-slate-800 flex gap-4 bg-slate-900">
          <button
            onClick={() => setActiveTab('file')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'file'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upload File (.xlsx, .csv, .txt)</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'paste'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste URLs / Text</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'file' ? (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-950/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-white">
                  {fileName ? fileName : 'Click to select or drag and drop file here'}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Supports Excel (.xlsx, .xls), CSV (.csv), or Text (.txt) files.
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                  Auto-detects columns: Website/URL, Company Name, Address/Headquarters, Phone.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Enter or paste website URLs (one per line):</span>
                <span className="text-[11px] text-slate-500">Supports: URL or &quot;Company, URL, Address&quot;</span>
              </label>
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={`https://example.com\nhttps://apple.com\nTesla, tesla.com, Austin TX\nStripe, stripe.com, South San Francisco`}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
              />
            </div>
          )}

          {/* Parsed Preview Section */}
          {parsedBusinesses.length > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Detected {parsedBusinesses.length} business(es) ready to import:
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">
                  {parsedBusinesses.filter((b) => b.company_name).length} named
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {parsedBusinesses.slice(0, 50).map((b, i) => (
                  <div key={i} className="pt-1.5 flex items-center justify-between text-[11px] text-slate-300">
                    <div className="flex items-center gap-2 truncate max-w-[70%]">
                      <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="font-mono text-cyan-300 truncate">{b.url}</span>
                      {b.company_name && (
                        <span className="text-slate-400 truncate">({b.company_name})</span>
                      )}
                    </div>
                    {b.address && (
                      <span className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {b.address}
                      </span>
                    )}
                  </div>
                ))}
                {parsedBusinesses.length > 50 && (
                  <div className="text-[10px] text-slate-500 text-center pt-2">
                    ...and {parsedBusinesses.length - 50} more businesses
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {parsedBusinesses.length > 0 ? (
              <span>
                Ready to import <strong className="text-white">{parsedBusinesses.length}</strong> businesses
              </span>
            ) : (
              <span>Select a file or paste URLs above</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitImport}
              disabled={isProcessing || parsedBusinesses.length === 0}
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileUp className="w-4 h-4" />
              <span>{isProcessing ? 'Importing...' : `Import ${parsedBusinesses.length > 0 ? `${parsedBusinesses.length} Businesses` : 'Businesses'}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
