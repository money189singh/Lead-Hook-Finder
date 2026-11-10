import React, { useState } from 'react';
import { Workflow } from '../../types/workflow';
import { PRESET_WORKFLOWS } from '../../services/workflowTemplates';
import { X, Sparkles, ArrowRight, Layers, Search } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Workflow) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'prospecting', label: 'Prospecting' },
    { id: 'enrichment', label: 'Enrichment' },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'verification', label: 'Verification' },
    { id: 'custom', label: 'Custom' },
  ];

  const filteredTemplates = PRESET_WORKFLOWS.filter((tpl) => {
    const matchesCat = selectedCategory === 'all' || tpl.category === selectedCategory;
    const q = search.toLowerCase().trim();
    if (!q) return matchesCat;
    const matchesQuery =
      tpl.name.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.nodes.some((n) => n.name.toLowerCase().includes(q) || n.type.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Production AI Automation Templates</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              8 pre-built enterprise-grade pipelines with autonomous AI agents, CRM sync, and smart routing
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search templates by keyword, node, or CRM (HubSpot, Slack, Clearbit)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-slate-950 rounded-xl border border-slate-800">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates List */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 divide-y divide-slate-800/40">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No workflow templates found matching &ldquo;{search}&rdquo;. Try another keyword.
            </div>
          ) : (
            filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="pt-3.5 first:pt-0 p-4 rounded-xl bg-slate-950/50 hover:bg-slate-950/80 border border-slate-800/80 hover:border-purple-800/60 transition-all flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-purple-300 transition-colors">
                        {tpl.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                        <span className="uppercase text-purple-400 font-medium">{tpl.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{tpl.nodes.length} Nodes</span>
                        <span aria-hidden="true">·</span>
                        <span>{tpl.edges.length} Connections</span>
                        <span aria-hidden="true">·</span>
                        <span>{tpl.runsCount || 0} Runs Recorded</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onSelectTemplate(tpl);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Use Template</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {tpl.description}
                  </p>

                  {/* Flow Steps Preview */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2.5 border-t border-slate-800/60">
                    {tpl.nodes.map((node, i) => (
                      <React.Fragment key={node.id}>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          <span>{node.name}</span>
                        </span>
                        {i < tpl.nodes.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
