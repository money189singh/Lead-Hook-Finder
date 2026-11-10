import React, { useState } from 'react';
import { CreditUsageRecord } from '../../types';
import { Coins, PlusCircle, History, ArrowDownRight, Calendar, AlertCircle } from 'lucide-react';

interface CreditHistoryModalProps {
  records: CreditUsageRecord[];
  availableCredits: number;
  totalCreditsUsed: number;
  onClose: () => void;
  onAddCredits: (amount: number) => Promise<void>;
}

export const CreditHistoryModal: React.FC<CreditHistoryModalProps> = ({
  records,
  availableCredits,
  totalCreditsUsed,
  onClose,
  onAddCredits,
}) => {
  const [addingAmount, setAddingAmount] = useState(500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAdd = async (amount: number) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    try {
      await onAddCredits(amount);
      setSuccessMessage(`Successfully topped up ${amount.toLocaleString()} credits!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#131122] border border-purple-100 dark:border-purple-900/40 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-100/80 dark:border-purple-900/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Verification Credits & History</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Internal credit usage tracking and balance top-ups</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Balance & Top-up Card */}
        <div className="p-6 border-b border-purple-100/80 dark:border-purple-900/30 bg-purple-50/50 dark:bg-[#181628]/60 shrink-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Balance</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
                <span>{availableCredits.toLocaleString()}</span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">credits</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Total Lifetime Used: <span className="text-slate-700 dark:text-slate-300 font-semibold">{totalCreditsUsed.toLocaleString()}</span>
              </div>
            </div>

            {/* Quick Top-up buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {[100, 500, 1000, 5000].map((amt) => (
                <button
                  key={amt}
                  disabled={isSubmitting}
                  onClick={() => handleAdd(amt)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 dark:text-purple-300 dark:border-purple-800/40 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {successMessage && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-lg">
              {successMessage}
            </div>
          )}
        </div>

        {/* History Log Table */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <span>Usage Log</span>
            <span>{records.length} records</span>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <History className="w-8 h-8 mx-auto text-purple-300 dark:text-purple-700 mb-2 opacity-60" />
              No verification credit usage logged yet.
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-white dark:bg-[#181628]/40 border border-purple-100/70 dark:border-purple-900/30 flex items-center justify-between gap-3 text-xs shadow-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/40">
                        {rec.verification_level}
                      </span>
                      <span>{rec.businesses_processed} businesses</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{rec.notes || 'Verification run'}</div>
                    <div className="text-[10px] text-slate-400">{new Date(rec.date).toLocaleString()}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      -{rec.credits_used}
                    </div>
                    <div className="text-[10px] text-slate-400">credits deducted</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-purple-100/80 dark:border-purple-900/30 bg-purple-50/20 dark:bg-[#151325]/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
