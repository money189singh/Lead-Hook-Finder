import React, { useState } from 'react';
import {
  X,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Mail,
  Filter,
  Building,
} from 'lucide-react';

interface TestResultItem {
  id: string;
  category: 'email_classification' | 'strict_icp_filters' | 'custom_rules' | 'decision_maker' | 'govfiles';
  name: string;
  description: string;
  passed: boolean;
  actual: any;
  expected: any;
  details?: string;
  durationMs: number;
}

interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  executionTimeMs: number;
  results: TestResultItem[];
}

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<TestSuiteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'icp' | 'govfiles'>('all');

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/test-suite/run', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Test suite execution failed');
      }
      const data: TestSuiteSummary = await res.json();
      setSummary(data);
    } catch (e: any) {
      setError(e.message || 'Error running test suite');
    } finally {
      setIsRunning(false);
    }
  };

  const filteredResults = (summary?.results || []).filter((r) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'email') return r.category === 'email_classification';
    if (activeTab === 'icp') return r.category === 'strict_icp_filters' || r.category === 'decision_maker';
    if (activeTab === 'govfiles') return r.category === 'govfiles';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in-50">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">System Verification & Test Suite</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Status Bar */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Tests ({summary?.total || 0})
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'email'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Email Classification
            </button>
            <button
              onClick={() => setActiveTab('icp')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'icp'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Strict ICP & Owners
            </button>
            <button
              onClick={() => setActiveTab('govfiles')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'govfiles'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              GovFiles Scenarios
            </button>
          </div>

          <div className="flex items-center gap-2">
            {summary && (
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                  summary.allPassed
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {summary.allPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>
                  {summary.passed} / {summary.total} Passed ({summary.executionTimeMs}ms)
                </span>
              </span>
            )}

            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2 cursor-pointer transition-all"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Suite...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>RUN TEST SUITE</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!summary && !isRunning && !error && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
              <div className="text-sm font-medium text-slate-400">Automated Testing Ready</div>
            </div>
          )}

          {summary && (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              {filteredResults.map((item, idx) => (
                <div key={`test-suite-res-${item.id || idx}`} className="p-3.5 space-y-1.5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="font-semibold text-white text-xs">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">{item.durationMs}ms</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          item.passed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {item.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 pl-6">{item.description}</p>

                  {item.details && (
                    <div className="pl-6 text-[10px] text-slate-500 font-mono bg-slate-950/40 p-2 rounded border border-slate-800/60 mt-1">
                      {item.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
