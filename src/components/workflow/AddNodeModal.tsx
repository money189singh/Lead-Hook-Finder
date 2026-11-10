import React, { useState } from 'react';
import { WorkflowNodeType, NodeCategory } from '../../types/workflow';
import { NODE_DEFINITIONS } from '../../services/workflowTemplates';
import {
  X,
  Search,
  Sparkles,
  Bot,
  GitBranch,
  Globe,
  ShieldCheck,
  Send,
  Code2,
  Bell,
  Database,
  Clock,
  PlayCircle,
  Webhook,
  Split,
  Repeat,
  Timer,
  FileJson,
  Wand2,
  Target,
  Building2,
  MessageSquare,
  Mail,
  FileSpreadsheet,
  Compass,
  Activity,
  FileText,
  Cpu,
  GripVertical,
} from 'lucide-react';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (type: WorkflowNodeType) => void;
}

const CATEGORY_TABS: Array<{ id: NodeCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Nodes' },
  { id: 'trigger', label: '⚡ Triggers' },
  { id: 'ai', label: '🤖 AI & Agents' },
  { id: 'integration', label: '🔌 Integrations & CRM' },
  { id: 'tool', label: '🌐 Scraping & Tools' },
  { id: 'logic', label: '🔀 Logic & Flow' },
  { id: 'action', label: '🎯 Actions' },
];

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  PlayCircle,
  Webhook,
  Clock,
  Sparkles,
  Globe,
  Search,
  ShieldCheck,
  Send,
  Code2,
  Bell,
  Database,
  Timer,
  GitBranch,
  Split,
  Repeat,
  Bot,
  Wand2,
  Target,
  FileJson,
  Building2,
  MessageSquare,
  Mail,
  FileSpreadsheet,
  Compass,
  Activity,
  FileText,
  Cpu,
};

export const AddNodeModal: React.FC<AddNodeModalProps> = ({ isOpen, onClose, onAddNode }) => {
  if (!isOpen) return null;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | 'all'>('all');

  const filteredNodes = Object.values(NODE_DEFINITIONS).filter((node) => {
    const matchesCategory =
      selectedCategory === 'all' || node.category === selectedCategory;
    const matchesSearch =
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.description.toLowerCase().includes(search.toLowerCase()) ||
      node.type.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Node &amp; Integration Library</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any node to insert onto the canvas, or drag directly from the palette
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Category Filter Tabs */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools, triggers, AI agents, CRM integrations (HubSpot, Slack, Clearbit)..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  selectedCategory === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Node Cards Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
          {filteredNodes.map((meta) => {
            const IconComp = ICON_MAP[meta.iconName] || Sparkles;
            return (
              <div
                key={meta.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/workflow-node-type', meta.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  onAddNode(meta.type);
                  onClose();
                }}
                className="flex items-start gap-3 p-3 text-left rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-600/60 transition-all group cursor-pointer active:scale-[0.99]"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: `${meta.color}25`, color: meta.color }}
                >
                  <IconComp className="w-5 h-5" />
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                      {meta.name}
                    </h4>
                    <span className="text-[10px] text-slate-500 uppercase font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                      {meta.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                    {meta.description}
                  </p>
                </div>
                <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 self-center" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
