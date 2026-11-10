import React, { useState, useEffect, useCallback } from 'react';
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowRun,
  NodeExecutionResult,
} from '../types/workflow';
import { workflowApi } from '../services/workflowApi';
import { PRESET_WORKFLOWS, NODE_DEFINITIONS } from '../services/workflowTemplates';
import { WorkflowCanvas } from '../components/workflow/WorkflowCanvas';
import { NodeConfigDrawer } from '../components/workflow/NodeConfigDrawer';
import { AddNodeModal } from '../components/workflow/AddNodeModal';
import { TemplatesModal } from '../components/workflow/TemplatesModal';
import { ExecutionRunsDrawer } from '../components/workflow/ExecutionRunsDrawer';
import {
  Play,
  Plus,
  Save,
  Layers,
  Sparkles,
  Download,
  Upload,
  Check,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  GitBranch,
  Bot,
  Activity,
} from 'lucide-react';

interface WorkflowsPageProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const WorkflowsPage: React.FC<WorkflowsPageProps> = ({ onShowToast }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow>(PRESET_WORKFLOWS[0]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Modals and Drawers
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isRunsOpen, setIsRunsOpen] = useState(false);

  // Executions & Runs
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [activeRun, setActiveRun] = useState<WorkflowRun | null>(null);
  const [nodeExecutions, setNodeExecutions] = useState<Record<string, NodeExecutionResult>>({});

  // Fetch initial workflows
  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await workflowApi.getWorkflows();
      if (list && list.length > 0) {
        setWorkflows(list);
        setCurrentWorkflow(list[0]);
        loadRuns(list[0].id);
      } else {
        // Fallback to presets
        setWorkflows(PRESET_WORKFLOWS);
        setCurrentWorkflow(PRESET_WORKFLOWS[0]);
      }
    } catch {
      setWorkflows(PRESET_WORKFLOWS);
      setCurrentWorkflow(PRESET_WORKFLOWS[0]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRuns = async (wfId: string) => {
    try {
      const history = await workflowApi.getRuns(wfId);
      setRuns(history);
      if (history.length > 0) {
        setActiveRun(history[0]);
        setNodeExecutions(history[0].nodeExecutions || {});
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Save current workflow
  const handleSaveWorkflow = async () => {
    try {
      setIsSaving(true);
      const saved = await workflowApi.updateWorkflow(currentWorkflow.id, currentWorkflow);
      setWorkflows((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
      setCurrentWorkflow(saved);
      onShowToast('Workflow saved successfully', 'success');
    } catch (e: any) {
      onShowToast(`Failed to save: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Run full workflow
  const handleExecuteWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setNodeExecutions({});

    // Optimistically set all nodes to 'running' or idle
    const initialStatuses: Record<string, NodeExecutionResult> = {};
    currentWorkflow.nodes.forEach((n) => {
      initialStatuses[n.id] = {
        nodeId: n.id,
        nodeName: n.name,
        nodeType: n.type,
        status: 'running',
        startedAt: new Date().toISOString(),
      };
    });
    setNodeExecutions(initialStatuses);

    try {
      onShowToast(`Executing workflow: ${currentWorkflow.name}...`, 'info');
      const runResult = await workflowApi.executeWorkflow(currentWorkflow.id);
      setActiveRun(runResult);
      setNodeExecutions(runResult.nodeExecutions || {});
      setRuns((prev) => [runResult, ...prev]);

      if (runResult.status === 'success') {
        onShowToast(`Workflow completed successfully in ${runResult.durationMs}ms`, 'success');
      } else {
        onShowToast(`Workflow completed with errors. Inspect node logs.`, 'warning');
      }
    } catch (e: any) {
      onShowToast(`Execution failed: ${e.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // Test single node
  const handleTestSingleNode = async (node: WorkflowNode, inputData: any) => {
    const res = await workflowApi.testSingleNode(node, inputData);
    setNodeExecutions((prev) => ({
      ...prev,
      [node.id]: {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status: 'success',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: res.durationMs,
        outputData: res.output,
        agentThoughts: res.agentThoughts,
        branchTaken: res.branchTaken as any,
      },
    }));
    return res;
  };

  // Add new node to canvas
  const handleAddNode = (type: WorkflowNodeType) => {
    const meta = NODE_DEFINITIONS[type];
    if (!meta) return;

    // Smart placement: place adjacent to rightmost node
    let maxX = 80;
    let maxY = 220;
    if (currentWorkflow.nodes.length > 0) {
      const last = currentWorkflow.nodes[currentWorkflow.nodes.length - 1];
      maxX = last.position.x + 320;
      maxY = last.position.y;
    }

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: meta.name,
      type,
      category: meta.category,
      position: { x: maxX, y: maxY },
      data: { ...meta.defaultData },
    };

    const updatedNodes = [...currentWorkflow.nodes, newNode];
    setCurrentWorkflow((prev) => ({ ...prev, nodes: updatedNodes }));
    setSelectedNodeId(newNode.id);
    onShowToast(`Added "${meta.name}" to canvas`, 'info');
  };

  // Add node at explicit dropped coordinates (manual drag & drop)
  const handleAddNodeAtPosition = (type: WorkflowNodeType, position: { x: number; y: number }) => {
    const meta = NODE_DEFINITIONS[type];
    if (!meta) return;

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: meta.name,
      type,
      category: meta.category,
      position,
      data: { ...meta.defaultData },
    };

    const updatedNodes = [...currentWorkflow.nodes, newNode];
    setCurrentWorkflow((prev) => ({ ...prev, nodes: updatedNodes }));
    setSelectedNodeId(newNode.id);
    onShowToast(`Placed "${meta.name}" onto canvas at (${position.x}, ${position.y})`, 'info');
  };

  // Create new blank workflow
  const handleCreateNewWorkflow = () => {
    const newWf: Workflow = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: 'Custom AI Automation Pipeline',
      description: 'Custom multi-step workflow with AI agents and integrations',
      category: 'custom',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRunStatus: 'idle',
      runsCount: 0,
      nodes: [
        {
          id: `node_start_${Date.now()}`,
          name: 'Manual Test Trigger',
          type: 'manual_trigger',
          category: 'trigger',
          position: { x: 80, y: 220 },
          data: { ...NODE_DEFINITIONS.manual_trigger?.defaultData },
        },
      ],
      edges: [],
    };
    setWorkflows((prev) => [newWf, ...prev]);
    setCurrentWorkflow(newWf);
    setSelectedNodeId(newWf.nodes[0].id);
    onShowToast('Created new workflow. Drag & drop nodes from the palette to build your pipeline!', 'success');
  };

  // Duplicate node
  const handleDuplicateNode = (nodeId: string) => {
    const original = currentWorkflow.nodes.find((n) => n.id === nodeId);
    if (!original) return;

    const dupNode: WorkflowNode = {
      ...original,
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${original.name} (Copy)`,
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      data: JSON.parse(JSON.stringify(original.data || {})),
    };

    setCurrentWorkflow((prev) => ({
      ...prev,
      nodes: [...prev.nodes, dupNode],
    }));
    setSelectedNodeId(dupNode.id);
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    setCurrentWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Select template
  const handleSelectTemplate = (template: Workflow) => {
    const cloned: Workflow = {
      ...template,
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrentWorkflow(cloned);
    setWorkflows((prev) => [cloned, ...prev]);
    onShowToast(`Loaded "${template.name}" template`, 'success');
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentWorkflow, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentWorkflow.name.toLowerCase().replace(/\s+/g, '_')}_workflow.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    onShowToast('Workflow JSON exported', 'success');
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.nodes && parsed.edges) {
          const imported: Workflow = {
            ...parsed,
            id: `wf_import_${Date.now()}`,
            name: parsed.name || 'Imported Workflow',
          };
          setCurrentWorkflow(imported);
          setWorkflows((prev) => [imported, ...prev]);
          onShowToast('Workflow imported successfully', 'success');
        } else {
          onShowToast('Invalid workflow JSON file format', 'error');
        }
      } catch {
        onShowToast('Could not parse JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const selectedNode = currentWorkflow.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-24px)] m-3 mr-3 p-3 space-y-3 overflow-hidden bg-slate-950/80 rounded-2xl border border-slate-800/80 shadow-2xl">
      {/* Top Controls Header Bar */}
      <div className="flex items-center justify-between p-2.5 px-4 bg-slate-900/90 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          {/* Workflow Picker Dropdown */}
          <div className="relative">
            <select
              value={currentWorkflow.id}
              onChange={(e) => {
                const found = workflows.find((w) => w.id === e.target.value);
                if (found) {
                  setCurrentWorkflow(found);
                  loadRuns(found.id);
                  setSelectedNodeId(null);
                }
              }}
              className="appearance-none bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2 pr-9 text-xs font-semibold text-slate-100 outline-none cursor-pointer focus:border-indigo-500 transition-colors shadow-inner"
            >
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} ({wf.nodes?.length || 0} nodes)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Workflow Category Badge */}
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
            {currentWorkflow.category}
          </span>

          {/* Templates Library Button */}
          <button
            onClick={() => setIsTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-800 text-purple-300 hover:text-purple-200 border border-purple-900/60 rounded-xl text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Templates</span>
          </button>

          {/* New Workflow Button */}
          <button
            onClick={handleCreateNewWorkflow}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 rounded-xl text-xs font-medium transition-colors"
            title="Create fresh custom pipeline"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New Flow</span>
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Add Node Button */}
          <button
            onClick={() => setIsAddNodeOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Node Library</span>
          </button>

          {/* Execution Traces Drawer Toggle */}
          <button
            onClick={() => setIsRunsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Runs ({runs.length})</span>
          </button>

          {/* Export / Import */}
          <button
            onClick={handleExportJson}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            title="Export Workflow JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          <label
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Import Workflow JSON"
          >
            <Upload className="w-4 h-4" />
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          {/* Save Workflow Button */}
          <button
            onClick={handleSaveWorkflow}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Execute Full Workflow Primary Action */}
          <button
            onClick={handleExecuteWorkflow}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : 'fill-white'}`} />
            <span>{isRunning ? 'Executing Flow...' : 'Test Workflow'}</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="flex-1 relative overflow-hidden rounded-xl">
        <WorkflowCanvas
          workflow={currentWorkflow}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onUpdateNodes={(nodes) => setCurrentWorkflow((prev) => ({ ...prev, nodes }))}
          onUpdateEdges={(edges) => setCurrentWorkflow((prev) => ({ ...prev, edges }))}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onRunSingleNode={(node) => {
            setSelectedNodeId(node.id);
            handleTestSingleNode(node, {
              company: 'Vanguard Robotics',
              website: 'https://vanguardrobotics.example.com',
              contactName: 'Elena Rostova',
              email: 'elena@vanguardrobotics.example.com',
              score: 88,
            });
          }}
          onAddNodeAtPosition={handleAddNodeAtPosition}
          nodeExecutions={nodeExecutions}
          isRunning={isRunning}
        />
      </div>

      {/* Node Config Drawer (Slides out from right) */}
      <NodeConfigDrawer
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onUpdateNode={(updated) => {
          setCurrentWorkflow((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) => (n.id === updated.id ? updated : n)),
          }));
        }}
        onTestNode={handleTestSingleNode}
        lastExecution={selectedNode ? nodeExecutions[selectedNode.id] : undefined}
      />

      {/* Add Node Modal Palette */}
      <AddNodeModal
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
        onAddNode={handleAddNode}
      />

      {/* Pre-built Templates Library Modal */}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Execution Runs / Logs Drawer */}
      <ExecutionRunsDrawer
        isOpen={isRunsOpen}
        onClose={() => setIsRunsOpen(false)}
        runs={runs}
        activeRun={activeRun}
        onSelectRun={(run) => {
          setActiveRun(run);
          setNodeExecutions(run.nodeExecutions || {});
        }}
      />
    </div>
  );
};
