import React from 'react';
import { History as HistoryIcon, Download, Trash2, Eye, Calendar, Globe, Users, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryPageProps {
  history: HistoryItem[];
  onSelectJob: (jobId: string) => Promise<void>;
  onExportHistoryXlsx: (jobId: string) => void;
  onDeleteHistory: (jobId: string) => Promise<void>;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  history,
  onSelectJob,
  onExportHistoryXlsx,
  onDeleteHistory,
}) => {
  return (
    <div id="history-page" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-2xl shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
            Previous Scraping Batches
          </h2>
        </div>

        <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 text-[#155eef] dark:text-blue-300 font-semibold">
          {history.length} saved session(s)
        </span>
      </div>

      {/* History Table */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="overflow-x-auto">
          <table id="history-jobs-table" className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-blue-50/50 dark:bg-[#0f1424]/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-blue-100 dark:border-blue-900/30 select-none">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Date & Time</th>
                <th className="py-3.5 px-4 text-center font-semibold">Total Sites</th>
                <th className="py-3.5 px-4 text-center font-semibold">Contacts</th>
                <th className="py-3.5 px-4 text-center font-semibold">Emails</th>
                <th className="py-3.5 px-4 text-center font-semibold">Completed</th>
                <th className="py-3.5 px-4 text-center font-semibold">Failed</th>
                <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100 dark:divide-blue-900/20">
              {history.length > 0 ? (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#155eef]" />
                      <span>{item.date}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {item.total_websites}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-[#155eef] dark:text-blue-400">
                      {item.contacts_found}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.emails_found}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {item.completed_websites}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      {item.failed_websites}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          id={`history-view-btn-${item.id}`}
                          onClick={() => onSelectJob(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Results</span>
                        </button>

                        <button
                          type="button"
                          id={`history-export-btn-${item.id}`}
                          onClick={() => onExportHistoryXlsx(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>XLSX</span>
                        </button>

                        <button
                          type="button"
                          id={`history-delete-btn-${item.id}`}
                          onClick={() => onDeleteHistory(item.id)}
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 dark:bg-[#101730] dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 border border-blue-100 dark:border-blue-900/30 hover:border-rose-200 dark:hover:border-rose-800/40 transition-colors cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500 italic">
                    No scraping history yet. Start a scraping job to record sessions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
