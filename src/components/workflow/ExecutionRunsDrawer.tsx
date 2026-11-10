import React, { useState } from 'react';
import { WorkflowRun, NodeExecutionResult } from '../../types/workflow';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Bot,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ExecutionRunsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  runs: WorkflowRun[];
  activeRun: WorkflowRun | null;
  onSelectRun: (run: WorkflowRun) => void;
}

export const ExecutionRunsDrawer: React.FC<ExecutionRunsDrawerProps> = ({
  isOpen,
  onClose,
  runs,
  activeRun,
  onSelectRun,
}) => {
  if (!isOpen) return null;

  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const displayRun = activeRun || runs[0] || null;

  return (
    <div className="fixed inset-y-0 right-0 w-[540px] max-w-full bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Execution Traces & Runs Inspector</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Step-by-step visual execution logs, node outputs, and agent reasoning
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Past Runs Selector Pills */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/30 overflow-x-auto flex items-center gap-2">
          {runs.map((r) => {
            const isSelected = displayRun?.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => onSelectRun(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.status === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                ) : r.status === 'failed' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                )}
                <span>{new Date(r.startedAt).toLocaleTimeString()}</span>
                <span className="text-[10px] opacity-80">({r.durationMs || 0}ms)</span>
              </button>
            );
          })}
          {runs.length === 0 && (
            <span className="text-xs text-slate-500 py-1">No execution history recorded yet.</span>
          )}
        </div>

        {displayRun ? (
          <div className="p-4 space-y-4">
            {/* Run Overview Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-mono">Run ID: {displayRun.id}</div>
                <div className="text-xs text-slate-300 font-medium mt-0.5">
                  Trigger: {displayRun.trigger}
                </div>
              </div>
              <div className="text-right font-mono">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    displayRun.status === 'success'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                      : displayRun.status === 'failed'
                      ? 'bg-rose-950 text-rose-400 border border-rose-700/60'
                      : 'bg-amber-950 text-amber-400 border border-amber-700/60'
                  }`}
                >
                  {displayRun.status}
                </span>
                <div className="text-[11px] text-slate-400 mt-1">
                  Total: {displayRun.durationMs || 0}ms
                </div>
              </div>
            </div>

            {/* Per-Node Execution Step Tree */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-300">Node Executions Timeline</h4>

              {Object.values(displayRun.nodeExecutions).map((step: NodeExecutionResult) => {
                const isExpanded = expandedNodeId === step.nodeId;
                const isSkipped = step.status === 'skipped';
                const isFailed = step.status === 'failed';
                const hasThoughts = step.agentThoughts && step.agentThoughts.length > 0;

                return (
                  <div
                    key={step.nodeId}
                    className={`rounded-xl border transition-all ${
                      isFailed
                        ? 'border-rose-900/60 bg-rose-950/20'
                        : isSkipped
                        ? 'border-slate-800/40 bg-slate-950/30 opacity-60'
                        : 'border-slate-800 bg-slate-950/50'
                    }`}
                  >
                    <div
                      onClick={() => setExpandedNodeId(isExpanded ? null : step.nodeId)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {step.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : step.status === 'failed' ? (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-dashed border-slate-500 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {step.nodeName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {step.nodeType}
                            {step.branchTaken && ` · Branch: ${step.branchTaken.toUpperCase()}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {step.durationMs !== undefined && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {step.durationMs}ms
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 space-y-3 rounded-b-xl text-xs">
                        {/* Agent thoughts if available */}
                        {hasThoughts && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 font-semibold text-purple-400 text-xs">
                              <Bot className="w-3.5 h-3.5" />
                              <span>Autonomous Agent Thoughts Trace</span>
                            </div>
                            {step.agentThoughts!.map((th, tIdx) => (
                              <div
                                key={tIdx}
                                className="p-2.5 bg-slate-900 rounded-lg border border-purple-900/40 text-[11px] space-y-1"
                              >
                                <div className="flex items-center justify-between text-purple-300 font-bold">
                                  <span>Step {th.step}</span>
                                  {th.toolCalled && (
                                    <span className="font-mono text-[10px] text-purple-400">
                                      Tool: {th.toolCalled}
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-300">{th.thought}</div>
                                {th.toolResult && (
                                  <pre className="p-1.5 bg-slate-950 rounded text-emerald-400 font-mono text-[10px] overflow-x-auto">
                                    {JSON.stringify(th.toolResult, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Error if failed */}
                        {step.error && (
                          <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs">
                            Error: {step.error}
                          </div>
                        )}

                        {/* Output JSON payload */}
                        {step.outputData && (
                          <div>
                            <div className="font-mono text-[10px] text-slate-400 mb-1">
                              Output Data Payload:
                            </div>
                            <pre className="p-2.5 bg-slate-900 rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-48">
                              {JSON.stringify(step.outputData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs">
            Run a workflow to view execution traces and step-by-step logs.
          </div>
        )}
      </div>
    </div>
  );
};
