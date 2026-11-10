import React, { useState } from 'react';
import {
  WorkflowNode,
  ConditionRule,
  NodeExecutionResult,
  AgentThoughtStep,
} from '../../types/workflow';
import { NODE_DEFINITIONS } from '../../services/workflowTemplates';
import {
  X,
  Play,
  Check,
  Plus,
  Trash2,
  Bot,
  Sparkles,
  Code2,
  GitBranch,
  ShieldCheck,
  Send,
  Database,
  Globe,
  Search,
  Clock,
  Layers,
  Terminal,
  ChevronDown,
  Info,
} from 'lucide-react';

interface NodeConfigDrawerProps {
  node: WorkflowNode | null;
  onClose: () => void;
  onUpdateNode: (updatedNode: WorkflowNode) => void;
  onTestNode: (node: WorkflowNode, inputData: any) => Promise<any>;
  lastExecution?: NodeExecutionResult;
}

export const NodeConfigDrawer: React.FC<NodeConfigDrawerProps> = ({
  node,
  onClose,
  onUpdateNode,
  onTestNode,
  lastExecution,
}) => {
  if (!node) return null;

  const [activeTab, setActiveTab] = useState<'params' | 'test' | 'thoughts'>('params');
  const [isTesting, setIsTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<any>(lastExecution?.outputData || null);
  const [testThoughts, setTestThoughts] = useState<AgentThoughtStep[] | undefined>(
    lastExecution?.agentThoughts
  );
  const [testDuration, setTestDuration] = useState<number | null>(
    lastExecution?.durationMs || null
  );

  const meta = NODE_DEFINITIONS[node.type] || {
    name: node.name,
    category: node.category,
    color: '#3b82f6',
    description: '',
  };

  const updateData = (key: string, value: any) => {
    onUpdateNode({
      ...node,
      data: {
        ...(node.data || {}),
        [key]: value,
      },
    });
  };

  const handleTestStep = async () => {
    setIsTesting(true);
    try {
      const input = lastExecution?.inputData || {
        company: 'Vanguard Robotics',
        website: 'https://vanguardrobotics.example.com',
        contactName: 'Elena Rostova',
        email: 'elena@vanguardrobotics.example.com',
        role: 'VP Engineering',
        score: 85,
        industry: 'Warehouse Automation',
      };
      const res = await onTestNode(node, input);
      setTestOutput(res.output);
      setTestThoughts(res.agentThoughts);
      setTestDuration(res.durationMs);
      setActiveTab(node.type === 'ai_agent' && res.agentThoughts ? 'thoughts' : 'test');
    } catch (e: any) {
      setTestOutput({ error: e.message });
      setActiveTab('test');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] max-w-full bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${meta.color}25`, color: meta.color }}
          >
            {node.type === 'ai_agent' ? (
              <Bot className="w-4 h-4" />
            ) : node.type === 'condition_if' ? (
              <GitBranch className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
          <div className="truncate">
            <input
              type="text"
              value={node.name}
              onChange={(e) => onUpdateNode({ ...node, name: e.target.value })}
              className="bg-transparent font-semibold text-slate-100 text-sm hover:bg-slate-800/60 focus:bg-slate-800 px-1 py-0.5 rounded outline-none border border-transparent focus:border-indigo-500 w-full"
            />
            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 px-1">
              <span>{meta.name}</span>
              <span>·</span>
              <span className="uppercase">{node.category}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/30 px-3">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'params'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Parameters
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'test'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Output & Data
        </button>
        {node.type === 'ai_agent' && (
          <button
            onClick={() => setActiveTab('thoughts')}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'thoughts'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Agent Thoughts</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'params' && (
          <div className="space-y-4 text-xs">
            {/* Description note */}
            <p className="text-slate-400 text-xs leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
              {meta.description}
            </p>

            {/* IF / ELSE CONDITION BUILDER */}
            {node.type === 'condition_if' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">Condition Rules</label>
                  <div className="flex items-center gap-1 bg-slate-800/90 p-0.5 rounded-md border border-slate-700">
                    <button
                      onClick={() => updateData('combine', 'AND')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        (node.data?.combine || 'AND') === 'AND'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      AND
                    </button>
                    <button
                      onClick={() => updateData('combine', 'OR')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        node.data?.combine === 'OR'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      OR
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {(node.data?.rules || []).map((rule: ConditionRule, idx: number) => (
                    <div
                      key={rule.id || idx}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          Rule #{idx + 1}
                        </span>
                        <button
                          onClick={() => {
                            const updated = (node.data?.rules || []).filter(
                              (_: any, i: number) => i !== idx
                            );
                            updateData('rules', updated);
                          }}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">
                          Field Path (e.g. json.score, json.email)
                        </label>
                        <input
                          type="text"
                          value={rule.field}
                          onChange={(e) => {
                            const updated = [...(node.data?.rules || [])];
                            updated[idx] = { ...rule, field: e.target.value };
                            updateData('rules', updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-indigo-500 outline-none"
                          placeholder="json.score"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Operator</label>
                          <select
                            value={rule.operator}
                            onChange={(e) => {
                              const updated = [...(node.data?.rules || [])];
                              updated[idx] = { ...rule, operator: e.target.value as any };
                              updateData('rules', updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:border-indigo-500 outline-none"
                          >
                            <option value="greater_than">&gt; Greater Than</option>
                            <option value="less_than">&lt; Less Than</option>
                            <option value="equals">= Equals</option>
                            <option value="not_equals">≠ Not Equals</option>
                            <option value="contains">Contains String</option>
                            <option value="not_contains">Does Not Contain</option>
                            <option value="is_valid_email">Is Valid Email</option>
                            <option value="is_not_empty">Is Not Empty</option>
                            <option value="is_empty">Is Empty</option>
                            <option value="regex_match">Matches Regex</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Target Value</label>
                          <input
                            type="text"
                            value={rule.value}
                            onChange={(e) => {
                              const updated = [...(node.data?.rules || [])];
                              updated[idx] = { ...rule, value: e.target.value };
                              updateData('rules', updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-indigo-500 outline-none"
                            placeholder="70"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const newRule: ConditionRule = {
                        id: `r_${Date.now()}`,
                        field: 'json.score',
                        operator: 'greater_than',
                        value: '70',
                      };
                      updateData('rules', [...(node.data?.rules || []), newRule]);
                    }}
                    className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Condition Rule</span>
                  </button>
                </div>
              </div>
            )}

            {/* AUTONOMOUS AI AGENT */}
            {node.type === 'ai_agent' && (
              <div className="space-y-3.5">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={node.data?.agentName || ''}
                    onChange={(e) => updateData('agentName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:border-purple-500 outline-none"
                    placeholder="Outreach & Value Strategist Agent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Agent Role & Persona</label>
                  <input
                    type="text"
                    value={node.data?.role || ''}
                    onChange={(e) => updateData('role', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:border-purple-500 outline-none"
                    placeholder="Senior B2B Deal Strategist"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Agent Objective & Goal</label>
                  <textarea
                    rows={3}
                    value={node.data?.objective || ''}
                    onChange={(e) => updateData('objective', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:border-purple-500 outline-none resize-none"
                    placeholder="Analyze company profile, detect buying signals, and draft high-converting attack plan..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-200 block mb-1">LLM Model</label>
                    <select
                      value={node.data?.model || 'gemini-2.5-flash'}
                      onChange={(e) => updateData('model', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-purple-500 outline-none"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast & Resilient)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-200 block mb-1">
                      Max Reasoning Steps: {node.data?.maxSteps || 3}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={node.data?.maxSteps || 3}
                      onChange={(e) => updateData('maxSteps', parseInt(e.target.value, 10))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">
                    In-Built Autonomous Tools
                  </label>
                  <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                    {[
                      { id: 'web_search', label: 'Web Search Engine', desc: 'Queries live search for fresh intel' },
                      { id: 'scrape_website', label: 'Web Scraper & Crawler', desc: 'Inspects website headings & pages' },
                      { id: 'verify_email', label: 'Email Verifier Tool', desc: 'Validates contact email deliverability' },
                      { id: 'calculate_metrics', label: 'Metrics & ROI Calculator', desc: 'Computes ROI numbers' },
                    ].map((tool) => {
                      const enabled = (node.data?.enabledTools || []).includes(tool.id);
                      return (
                        <label
                          key={tool.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-medium text-slate-200 text-xs">{tool.label}</div>
                            <div className="text-[10px] text-slate-500">{tool.desc}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => {
                              const curr = node.data?.enabledTools || [];
                              const updated = e.target.checked
                                ? [...curr, tool.id]
                                : curr.filter((t: string) => t !== tool.id);
                              updateData('enabledTools', updated);
                            }}
                            className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 accent-purple-600 w-4 h-4 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* WEB SCRAPER */}
            {node.type === 'web_scraper' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">
                    Target URL (Variables supported)
                  </label>
                  <input
                    type="text"
                    value={node.data?.url || ''}
                    onChange={(e) => updateData('url', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:border-blue-500 outline-none"
                    placeholder="{{$json.website}}"
                  />
                </div>
                <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={node.data?.extractEmails ?? true}
                      onChange={(e) => updateData('extractEmails', e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span className="text-slate-300">Extract Corporate & Generic Emails</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={node.data?.extractPhones ?? true}
                      onChange={(e) => updateData('extractPhones', e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span className="text-slate-300">Extract Phone Numbers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={node.data?.extractSocials ?? true}
                      onChange={(e) => updateData('extractSocials', e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span className="text-slate-300">Extract LinkedIn & Twitter Links</span>
                  </label>
                </div>
              </div>
            )}

            {/* EMAIL VERIFIER */}
            {node.type === 'email_verifier' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Email Field</label>
                  <input
                    type="text"
                    value={node.data?.emailField || ''}
                    onChange={(e) => updateData('emailField', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:border-emerald-500 outline-none"
                    placeholder="{{$json.email}}"
                  />
                </div>
                <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={node.data?.checkMx ?? true}
                      onChange={(e) => updateData('checkMx', e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span className="text-slate-300">Validate MX Records</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={node.data?.checkDisposable ?? true}
                      onChange={(e) => updateData('checkDisposable', e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span className="text-slate-300">Filter Disposable Domains</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={node.data?.checkSmtp ?? true}
                      onChange={(e) => updateData('checkSmtp', e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span className="text-slate-300">Simulate SMTP Handshake</span>
                  </label>
                </div>
              </div>
            )}

            {/* SEARCH DISCOVERY */}
            {node.type === 'search_discovery' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Search Query</label>
                  <input
                    type="text"
                    value={node.data?.query || ''}
                    onChange={(e) => updateData('query', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:border-sky-500 outline-none"
                    placeholder="site:linkedin.com/in {{$json.company}}"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-200 block mb-1">Search Engine</label>
                    <select
                      value={node.data?.engine || 'duckduckgo'}
                      onChange={(e) => updateData('engine', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                    >
                      <option value="duckduckgo">DuckDuckGo</option>
                      <option value="bing">Bing</option>
                      <option value="google">Google</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-200 block mb-1">Max Results</label>
                    <input
                      type="number"
                      value={node.data?.maxResults || 5}
                      onChange={(e) => updateData('maxResults', parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CODE TRANSFORM */}
            {node.type === 'code_transform' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">JavaScript Transformation</label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        updateData(
                          'code',
                          `return {\n  ...$input,\n  timestamp: new Date().toISOString(),\n  qualified: ($input.score || 0) >= 70\n};`
                        )
                      }
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Reset Snippet
                    </button>
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={node.data?.code || ''}
                  onChange={(e) => updateData('code', e.target.value)}
                  className="w-full bg-slate-950 font-mono text-[11px] border border-slate-700 rounded-lg p-2.5 text-emerald-400 focus:border-indigo-500 outline-none resize-none leading-relaxed"
                />
                <span className="text-[10px] text-slate-500">
                  Tip: Use <code className="text-indigo-400">$input</code> or{' '}
                  <code className="text-indigo-400">$json</code> to access incoming data.
                </span>
              </div>
            )}

            {/* AI GENERATE TEXT */}
            {node.type === 'ai_generate_text' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Prompt Template</label>
                  <textarea
                    rows={5}
                    value={node.data?.prompt || ''}
                    onChange={(e) => updateData('prompt', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:border-purple-500 outline-none resize-none"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-500">Insert:</span>
                    {['{{$json.company}}', '{{$json.contactName}}', '{{$json.role}}'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => updateData('prompt', (node.data?.prompt || '') + ' ' + tag)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-mono text-purple-300"
                      >
                        + {tag.replace('{{$json.', '').replace('}}', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI LEAD QUALIFIER */}
            {node.type === 'ai_lead_qualifier' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Target ICP Definition</label>
                  <input
                    type="text"
                    value={node.data?.targetIcp || ''}
                    onChange={(e) => updateData('targetIcp', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:border-pink-500 outline-none"
                    placeholder="B2B Software, AI Robotics companies with 10-500 employees"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Scoring Rubric</label>
                  <textarea
                    rows={3}
                    value={node.data?.scoringRubric || ''}
                    onChange={(e) => updateData('scoringRubric', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:border-pink-500 outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* HTTP REQUEST */}
            {node.type === 'http_request' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1">
                    <label className="font-semibold text-slate-200 block mb-1">Method</label>
                    <select
                      value={node.data?.method || 'POST'}
                      onChange={(e) => updateData('method', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs outline-none"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="font-semibold text-slate-200 block mb-1">URL</label>
                    <input
                      type="text"
                      value={node.data?.url || ''}
                      onChange={(e) => updateData('url', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">JSON Body</label>
                  <textarea
                    rows={4}
                    value={typeof node.data?.body === 'string' ? node.data?.body : JSON.stringify(node.data?.body || {}, null, 2)}
                    onChange={(e) => updateData('body', e.target.value)}
                    className="w-full bg-slate-950 font-mono text-xs border border-slate-700 rounded-lg p-2 text-slate-200 outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* SEND NOTIFICATION */}
            {node.type === 'send_notification' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Webhook URL</label>
                  <input
                    type="text"
                    value={node.data?.webhookUrl || ''}
                    onChange={(e) => updateData('webhookUrl', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:border-pink-500 outline-none"
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Message Template</label>
                  <textarea
                    rows={3}
                    value={node.data?.messageTemplate || ''}
                    onChange={(e) => updateData('messageTemplate', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:border-pink-500 outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* MANUAL TRIGGER PAYLOAD */}
            {node.type === 'manual_trigger' && (
              <div className="space-y-3">
                <label className="font-semibold text-slate-200 block">Initial Test JSON Payload</label>
                <textarea
                  rows={8}
                  value={node.data?.payload || ''}
                  onChange={(e) => updateData('payload', e.target.value)}
                  className="w-full bg-slate-950 font-mono text-xs border border-slate-700 rounded-lg p-2.5 text-indigo-300 outline-none resize-none"
                />
              </div>
            )}

            {/* AI SENTIMENT ANALYZER */}
            {node.type === 'ai_sentiment_analyzer' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Text Field to Analyze</label>
                  <input
                    type="text"
                    value={node.data?.textField || 'json.feedback'}
                    onChange={(e) => updateData('textField', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                    placeholder="json.feedback or json.text"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Urgency Escalation Threshold (0-100)</label>
                  <input
                    type="number"
                    value={node.data?.minUrgencyScore || 65}
                    onChange={(e) => updateData('minUrgencyScore', parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {/* AI RESEARCH DOSSIER */}
            {node.type === 'ai_research_dossier' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Target Account Company</label>
                  <input
                    type="text"
                    value={node.data?.company || '{{$json.company}}'}
                    onChange={(e) => updateData('company', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                  />
                </div>
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={node.data?.includeCompetitors ?? true}
                      onChange={(e) => updateData('includeCompetitors', e.target.checked)}
                      className="accent-purple-500"
                    />
                    <span>Include Competitor Battlecards</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={node.data?.includeIcebreakers ?? true}
                      onChange={(e) => updateData('includeIcebreakers', e.target.checked)}
                      className="accent-purple-500"
                    />
                    <span>Generate Tailored Executive Icebreakers</span>
                  </label>
                </div>
              </div>
            )}

            {/* AI TECH STACK DETECTOR */}
            {node.type === 'ai_tech_stack_detector' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Domain or Website</label>
                  <input
                    type="text"
                    value={node.data?.domain || '{{$json.website}}'}
                    onChange={(e) => updateData('domain', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {/* HUBSPOT CRM */}
            {node.type === 'hubspot_crm' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Lifecycle Stage</label>
                  <select
                    value={node.data?.lifecycleStage || 'lead'}
                    onChange={(e) => updateData('lifecycleStage', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                  >
                    <option value="subscriber">Subscriber</option>
                    <option value="lead">Lead</option>
                    <option value="marketingqualifiedlead">Marketing Qualified Lead (MQL)</option>
                    <option value="salesqualifiedlead">Sales Qualified Lead (SQL)</option>
                    <option value="opportunity">Opportunity</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Deal Pipeline Stage</label>
                  <input
                    type="text"
                    value={node.data?.dealStage || 'Qualified Opportunity'}
                    onChange={(e) => updateData('dealStage', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Owner Assignment Email</label>
                  <input
                    type="text"
                    value={node.data?.ownerEmail || 'sales-lead@company.com'}
                    onChange={(e) => updateData('ownerEmail', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {/* SALESFORCE CRM */}
            {node.type === 'salesforce_crm' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Lead Status</label>
                  <select
                    value={node.data?.leadStatus || 'Working - Contacted'}
                    onChange={(e) => updateData('leadStatus', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                  >
                    <option value="Open - Not Contacted">Open - Not Contacted</option>
                    <option value="Working - Contacted">Working - Contacted</option>
                    <option value="Closed - Converted">Closed - Converted</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Rating</label>
                  <select
                    value={node.data?.rating || 'Hot'}
                    onChange={(e) => updateData('rating', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                  >
                    <option value="Hot">Hot</option>
                    <option value="Warm">Warm</option>
                    <option value="Cold">Cold</option>
                  </select>
                </div>
              </div>
            )}

            {/* SLACK NOTIFICATION */}
            {node.type === 'slack_notification' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Target Slack Channel</label>
                  <input
                    type="text"
                    value={node.data?.channel || '#sales-hot-leads'}
                    onChange={(e) => updateData('channel', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                    placeholder="#sales-leads"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Incoming Webhook URL</label>
                  <input
                    type="text"
                    value={node.data?.webhookUrl || ''}
                    onChange={(e) => updateData('webhookUrl', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Formatted Message</label>
                  <textarea
                    rows={4}
                    value={node.data?.message || ''}
                    onChange={(e) => updateData('message', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs font-mono outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* DISCORD WEBHOOK */}
            {node.type === 'discord_webhook' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Channel Label</label>
                  <input
                    type="text"
                    value={node.data?.channelName || 'prospects-alerts'}
                    onChange={(e) => updateData('channelName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Discord Webhook URL</label>
                  <input
                    type="text"
                    value={node.data?.webhookUrl || ''}
                    onChange={(e) => updateData('webhookUrl', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Embed Title</label>
                  <input
                    type="text"
                    value={node.data?.title || '🎯 Lead Qualified: {{$json.company}}'}
                    onChange={(e) => updateData('title', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {/* TELEGRAM ALERT */}
            {node.type === 'telegram_alert' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Chat ID or Channel</label>
                  <input
                    type="text"
                    value={node.data?.chatId || '@LeadHookAlerts'}
                    onChange={(e) => updateData('chatId', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Message Content</label>
                  <textarea
                    rows={3}
                    value={node.data?.message || ''}
                    onChange={(e) => updateData('message', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs font-mono outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* EMAIL DISPATCH */}
            {node.type === 'email_dispatch' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-200 block mb-1">Provider</label>
                    <select
                      value={node.data?.provider || 'Resend API'}
                      onChange={(e) => updateData('provider', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                    >
                      <option value="Resend API">Resend API</option>
                      <option value="SendGrid">SendGrid</option>
                      <option value="Custom SMTP">Custom SMTP</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-200 block mb-1">Recipient Field</label>
                    <input
                      type="text"
                      value={node.data?.to || '{{$json.email}}'}
                      onChange={(e) => updateData('to', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={node.data?.subject || 'Question regarding {{$json.company}}'}
                    onChange={(e) => updateData('subject', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Body Template</label>
                  <textarea
                    rows={4}
                    value={node.data?.body || ''}
                    onChange={(e) => updateData('body', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs font-mono outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* GOOGLE SHEETS */}
            {node.type === 'google_sheets' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Spreadsheet Name</label>
                  <input
                    type="text"
                    value={node.data?.spreadsheetName || 'LeadHook_Outreach_Master_2026'}
                    onChange={(e) => updateData('spreadsheetName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Worksheet Tab</label>
                  <input
                    type="text"
                    value={node.data?.sheetName || 'Q1 Prospects'}
                    onChange={(e) => updateData('sheetName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {/* AIRTABLE SYNC */}
            {node.type === 'airtable_sync' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Airtable Base</label>
                  <input
                    type="text"
                    value={node.data?.baseName || 'Sales CRM Pipeline'}
                    onChange={(e) => updateData('baseName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Table Name</label>
                  <input
                    type="text"
                    value={node.data?.tableName || 'Target Accounts'}
                    onChange={(e) => updateData('tableName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {/* CLEARBIT ENRICHMENT */}
            {node.type === 'clearbit_enrichment' && (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1">Domain Field</label>
                  <input
                    type="text"
                    value={node.data?.domain || '{{$json.website}}'}
                    onChange={(e) => updateData('domain', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* OUTPUT & TEST RESULTS TAB */}
        {activeTab === 'test' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Execution Output</span>
              {testDuration !== null && (
                <span className="text-[11px] font-mono text-emerald-400">
                  Completed in {testDuration}ms
                </span>
              )}
            </div>
            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[420px] whitespace-pre-wrap">
              {testOutput ? JSON.stringify(testOutput, null, 2) : 'No execution data yet. Click "Test This Step" below.'}
            </pre>
          </div>
        )}

        {/* AGENT REASONING THOUGHTS TAB */}
        {activeTab === 'thoughts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-purple-400" />
                <span>Multi-Step Autonomous Reasoning Trace</span>
              </span>
              <span className="text-[11px] text-purple-400 font-mono">
                {(testThoughts || []).length} Steps
              </span>
            </div>

            {(!testThoughts || testThoughts.length === 0) ? (
              <div className="text-xs text-slate-500 p-4 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                Run the agent step to see its live tool-use reasoning loop.
              </div>
            ) : (
              <div className="space-y-3">
                {testThoughts.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-950/70 rounded-xl border border-purple-900/40 space-y-2 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-purple-900/80 border border-purple-500 text-purple-200 flex items-center justify-center text-[10px]">
                          {step.step}
                        </span>
                        Step {step.step}: Agent Reasoning
                      </span>
                      {step.toolCalled && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-700/60">
                          tool: {step.toolCalled}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed pl-6 border-l-2 border-purple-500/40">
                      {step.thought}
                    </p>

                    {step.toolResult && (
                      <div className="pl-6 pt-1">
                        <div className="text-[10px] font-mono text-slate-400 mb-1">Tool Observation:</div>
                        <pre className="p-2 bg-slate-900 rounded-lg text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-36">
                          {JSON.stringify(step.toolResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Quick Action */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <button
          onClick={handleTestStep}
          disabled={isTesting}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isTesting ? 'Testing Step...' : 'Test This Step'}</span>
        </button>

        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
