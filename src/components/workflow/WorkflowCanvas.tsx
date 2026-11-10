import React, { useState, useRef, useCallback } from 'react';
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  NodeExecutionResult,
  NodeCategory,
} from '../../types/workflow';
import { NODE_DEFINITIONS } from '../../services/workflowTemplates';
import {
  Play,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Bot,
  GitBranch,
  Globe,
  Search,
  ShieldCheck,
  Send,
  Code2,
  Bell,
  Database,
  Split,
  Repeat,
  Timer,
  PlayCircle,
  Webhook,
  FileJson,
  Wand2,
  Target,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  MessageSquare,
  Mail,
  FileSpreadsheet,
  Compass,
  Activity,
  FileText,
  Cpu,
  PanelLeft,
  Grid,
  Map,
  Layers,
  GripVertical,
  Plus,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface WorkflowCanvasProps {
  workflow: Workflow;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodes: (nodes: WorkflowNode[]) => void;
  onUpdateEdges: (edges: WorkflowEdge[]) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onRunSingleNode: (node: WorkflowNode) => void;
  onAddNodeAtPosition?: (type: WorkflowNodeType, position: { x: number; y: number }) => void;
  nodeExecutions?: Record<string, NodeExecutionResult>;
  isRunning?: boolean;
}

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

const PALETTE_CATEGORIES: Array<{ id: NodeCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'trigger', label: 'Triggers' },
  { id: 'ai', label: 'AI & Agents' },
  { id: 'integration', label: 'Integrations' },
  { id: 'tool', label: 'Tools' },
  { id: 'logic', label: 'Logic' },
  { id: 'action', label: 'Actions' },
];

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  selectedNodeId,
  onSelectNode,
  onUpdateNodes,
  onUpdateEdges,
  onDeleteNode,
  onDuplicateNode,
  onRunSingleNode,
  onAddNodeAtPosition,
  nodeExecutions = {},
  isRunning = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Grid & Palette Controls
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [paletteFilter, setPaletteFilter] = useState('');
  const [paletteCategory, setPaletteCategory] = useState<NodeCategory | 'all'>('all');
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Edge Connecting
  const [connectingSource, setConnectingSource] = useState<{
    nodeId: string;
    handle: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Pan handlers
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    }

    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    } else if (draggingNodeId) {
      const updatedNodes = workflow.nodes.map((node) => {
        if (node.id === draggingNodeId) {
          let rawX = (e.clientX - (rect?.left || 0) - pan.x) / zoom - dragOffset.x;
          let rawY = (e.clientY - (rect?.top || 0) - pan.y) / zoom - dragOffset.y;
          if (snapToGrid) {
            rawX = Math.round(rawX / 20) * 20;
            rawY = Math.round(rawY / 20) * 20;
          }
          return {
            ...node,
            position: {
              x: Math.round(rawX),
              y: Math.round(rawY),
            },
          };
        }
        return node;
      });
      onUpdateNodes(updatedNodes);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setConnectingSource(null);
  };

  // Zoom handling with wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 2.2));
    }
  };

  // Node Drag Start on Canvas
  const handleNodeMouseDown = (e: React.MouseEvent, node: WorkflowNode) => {
    e.stopPropagation();
    onSelectNode(node.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const canvasMouseX = (e.clientX - rect.left - pan.x) / zoom;
      const canvasMouseY = (e.clientY - rect.top - pan.y) / zoom;
      setDragOffset({
        x: canvasMouseX - node.position.x,
        y: canvasMouseY - node.position.y,
      });
      setDraggingNodeId(node.id);
    }
  };

  // Output port drag connect
  const handleStartConnect = (e: React.MouseEvent, nodeId: string, handle: string) => {
    e.stopPropagation();
    setConnectingSource({ nodeId, handle });
  };

  // Input port drop connect
  const handleEndConnect = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    if (connectingSource && connectingSource.nodeId !== targetNodeId) {
      const edgeId = `e_${connectingSource.nodeId}_${targetNodeId}_${Date.now()}`;
      const newEdge: WorkflowEdge = {
        id: edgeId,
        source: connectingSource.nodeId,
        target: targetNodeId,
        sourceHandle: connectingSource.handle as any,
        targetHandle: 'input',
        label:
          connectingSource.handle === 'true'
            ? 'True'
            : connectingSource.handle === 'false'
            ? 'False'
            : undefined,
      };

      // Filter duplicate edges between same handles
      const exists = workflow.edges.some(
        (ed) =>
          ed.source === newEdge.source &&
          ed.target === newEdge.target &&
          ed.sourceHandle === newEdge.sourceHandle
      );
      if (!exists) {
        onUpdateEdges([...workflow.edges, newEdge]);
      }
    }
    setConnectingSource(null);
  };

  // Delete an edge
  const handleDeleteEdge = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateEdges(workflow.edges.filter((ed) => ed.id !== edgeId));
  };

  // Fit View
  const handleFitView = () => {
    if (workflow.nodes.length === 0) return;
    const minX = Math.min(...workflow.nodes.map((n) => n.position.x));
    const maxX = Math.max(...workflow.nodes.map((n) => n.position.x + 280));
    const minY = Math.min(...workflow.nodes.map((n) => n.position.y));
    const maxY = Math.max(...workflow.nodes.map((n) => n.position.y + 160));

    const width = maxX - minX + 240;
    const height = maxY - minY + 240;

    const containerWidth = containerRef.current?.clientWidth || 1000;
    const containerHeight = containerRef.current?.clientHeight || 600;

    const newZoom = Math.min(
      Math.max(Math.min(containerWidth / width, containerHeight / height), 0.45),
      1.1
    );
    setZoom(newZoom);
    setPan({
      x: containerWidth / 2 - ((minX + maxX) / 2) * newZoom,
      y: containerHeight / 2 - ((minY + maxY) / 2) * newZoom,
    });
  };

  // Auto Layout / Align DAG
  const handleAutoLayout = () => {
    if (workflow.nodes.length === 0) return;

    // Find incoming count for each node
    const inDegree: Record<string, number> = {};
    workflow.nodes.forEach((n) => (inDegree[n.id] = 0));
    workflow.edges.forEach((e) => {
      if (inDegree[e.target] !== undefined) {
        inDegree[e.target]++;
      }
    });

    // BFS Layer assignment
    const layer: Record<string, number> = {};
    const queue: string[] = [];

    workflow.nodes.forEach((n) => {
      if (inDegree[n.id] === 0) {
        layer[n.id] = 0;
        queue.push(n.id);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLayer = layer[current] || 0;
      const outgoing = workflow.edges.filter((e) => e.source === current);
      outgoing.forEach((e) => {
        const nextNode = e.target;
        layer[nextNode] = Math.max(layer[nextNode] || 0, currentLayer + 1);
        queue.push(nextNode);
      });
    }

    // Fallback for unvisited / circular nodes
    workflow.nodes.forEach((n, idx) => {
      if (layer[n.id] === undefined) {
        layer[n.id] = idx;
      }
    });

    // Group by layer
    const layerGroups: Record<number, WorkflowNode[]> = {};
    workflow.nodes.forEach((n) => {
      const l = layer[n.id] || 0;
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(n);
    });

    // Assign tidy grid positions
    const newNodes = workflow.nodes.map((n) => {
      const l = layer[n.id] || 0;
      const nodesInLayer = layerGroups[l] || [n];
      const indexInLayer = nodesInLayer.findIndex((item) => item.id === n.id);
      const x = 80 + l * 340;
      const y = 140 + indexInLayer * 220;
      return {
        ...n,
        position: { x, y },
      };
    });

    onUpdateNodes(newNodes);
    setTimeout(handleFitView, 50);
  };

  // HTML5 Drag and Drop handlers onto canvas
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOverCanvas) setIsDragOverCanvas(true);
  };

  const handleCanvasDragLeave = () => {
    setIsDragOverCanvas(false);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
    const nodeType = e.dataTransfer.getData('application/workflow-node-type') as WorkflowNodeType;
    if (!nodeType) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    let canvasX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    let canvasY = Math.round((e.clientY - rect.top - pan.y) / zoom);

    if (snapToGrid) {
      canvasX = Math.round(canvasX / 20) * 20;
      canvasY = Math.round(canvasY / 20) * 20;
    }

    if (onAddNodeAtPosition) {
      onAddNodeAtPosition(nodeType, { x: canvasX, y: canvasY });
    }
  };

  // Filtered components in palette
  const filteredPaletteNodes = Object.values(NODE_DEFINITIONS).filter((meta) => {
    const matchesCategory =
      paletteCategory === 'all' || meta.category === paletteCategory;
    const q = paletteFilter.toLowerCase().trim();
    if (!q) return matchesCategory;
    const matchesQuery =
      meta.name.toLowerCase().includes(q) ||
      meta.description.toLowerCase().includes(q) ||
      meta.type.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="relative w-full h-full min-h-[620px] flex overflow-hidden rounded-2xl border border-slate-800/80 shadow-2xl bg-slate-950">
      {/* ==================================================================== */}
      {/* LEFT DOCKED COMPONENT PALETTE (DRAG & DROP LIBRARY) */}
      {/* ==================================================================== */}
      <div
        className={`z-30 transition-all duration-200 border-r border-slate-800 bg-slate-950/95 backdrop-blur-xl flex flex-col shrink-0 ${
          isPaletteOpen ? 'w-72' : 'w-12'
        }`}
      >
        {/* Palette Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          {isPaletteOpen ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <Layers className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="truncate">
                <span className="text-xs font-semibold text-slate-200">Component Palette</span>
                <span className="block text-[10px] text-slate-500 font-mono">
                  Drag items onto canvas
                </span>
              </div>
            </div>
          ) : (
            <Layers className="w-4 h-4 text-purple-400 mx-auto" />
          )}

          <button
            onClick={() => setIsPaletteOpen(!isPaletteOpen)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={isPaletteOpen ? 'Collapse Palette' : 'Expand Palette'}
          >
            {isPaletteOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {isPaletteOpen && (
          <>
            {/* Search */}
            <div className="p-2.5 border-b border-slate-800/80">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter nodes, CRMs, tools..."
                  value={paletteFilter}
                  onChange={(e) => setPaletteFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Category Segmented Filter */}
              <div className="flex items-center gap-1 overflow-x-auto mt-2 pt-0.5 no-scrollbar">
                {PALETTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPaletteCategory(cat.id)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors whitespace-nowrap ${
                      paletteCategory === cat.id
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Draggable Component List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 select-none">
              {filteredPaletteNodes.map((meta) => {
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
                      if (onAddNodeAtPosition) {
                        onAddNodeAtPosition(meta.type, {
                          x: 200 + Math.random() * 80,
                          y: 200 + Math.random() * 80,
                        });
                      }
                    }}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/80 hover:border-purple-600/60 cursor-grab active:cursor-grabbing transition-all group"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>

                    <div className="overflow-hidden flex-1 leading-tight">
                      <div className="text-xs font-medium text-slate-200 group-hover:text-purple-300 truncate">
                        {meta.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono capitalize">
                        {meta.category}
                      </div>
                    </div>

                    <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MAIN CANVAS CONTAINER */}
      {/* ==================================================================== */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
        className="relative flex-1 h-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.12) 1px, transparent 1px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Drag Over Canvas Glowing Banner Feedback */}
        {isDragOverCanvas && (
          <div className="absolute inset-4 z-40 border-2 border-dashed border-purple-500/80 bg-purple-950/20 backdrop-blur-xs rounded-2xl flex items-center justify-center pointer-events-none animate-in fade-in duration-100">
            <div className="px-4 py-2 bg-purple-900/90 border border-purple-400 text-purple-100 rounded-xl font-medium text-xs shadow-2xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-300 animate-spin" />
              <span>Drop to place component at cursor location</span>
            </div>
          </div>
        )}

        {/* Viewport HUD Controls */}
        <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-xl text-slate-300">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2.2))}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium px-1.5 text-slate-400 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-1" />
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset Zoom & Pan (100%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitView}
            className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Fit All Nodes in View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-1" />
          <button
            onClick={handleAutoLayout}
            className="px-2 py-1 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
            title="Auto-arrange nodes neatly in DAG flow"
          >
            <Grid className="w-3.5 h-3.5 text-indigo-400" />
            <span>Auto Layout</span>
          </button>
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              snapToGrid ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle 20px Grid Snapping"
          >
            Snap Grid
          </button>
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`p-1.5 rounded-lg transition-colors ${
              showMiniMap ? 'text-indigo-400 bg-slate-800' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Birds-Eye Mini-Map"
          >
            <Map className="w-4 h-4" />
          </button>
        </div>

        {/* ================================================================== */}
        {/* SVG BEZIER EDGES LAYER */}
        {/* ================================================================== */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <defs>
            <linearGradient id="edge-gradient-default" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="edge-gradient-true" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="edge-gradient-false" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="1" />
            </linearGradient>
            <filter id="glow-edge" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Saved Edges */}
          {workflow.edges.map((edge) => {
            const sourceNode = workflow.nodes.find((n) => n.id === edge.source);
            const targetNode = workflow.nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const isCondition = sourceNode.type === 'condition_if';
            const isTrueHandle = edge.sourceHandle === 'true';
            const isFalseHandle = edge.sourceHandle === 'false';

            const sourceX = sourceNode.position.x + 280;
            let sourceY = sourceNode.position.y + 65;
            if (isCondition) {
              sourceY = isTrueHandle ? sourceNode.position.y + 45 : sourceNode.position.y + 85;
            }

            const targetX = targetNode.position.x;
            const targetY = targetNode.position.y + 65;

            const dx = Math.max(Math.abs(targetX - sourceX) * 0.5, 60);
            const pathData = `M ${sourceX} ${sourceY} C ${sourceX + dx} ${sourceY}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`;

            const edgeStroke = isTrueHandle
              ? 'url(#edge-gradient-true)'
              : isFalseHandle
              ? 'url(#edge-gradient-false)'
              : 'url(#edge-gradient-default)';

            const sourceExec = nodeExecutions[sourceNode.id];
            const isEdgeActive = isRunning && sourceExec?.status === 'running';

            const midX = (sourceX + targetX) / 2;
            const midY = (sourceY + targetY) / 2;

            return (
              <g key={edge.id} className="pointer-events-auto group">
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  className="cursor-pointer"
                />
                <path
                  d={pathData}
                  fill="none"
                  stroke={isTrueHandle ? '#10b981' : isFalseHandle ? '#f43f5e' : '#6366f1'}
                  strokeWidth={isEdgeActive ? 4 : 2}
                  strokeOpacity={isEdgeActive ? 0.7 : 0.25}
                  filter="url(#glow-edge)"
                />
                <path
                  d={pathData}
                  fill="none"
                  stroke={edgeStroke}
                  strokeWidth={isTrueHandle || isFalseHandle ? 2.5 : 2}
                  strokeDasharray={isEdgeActive ? '6 4' : undefined}
                  className={isEdgeActive ? 'animate-pulse' : ''}
                />

                {/* Edge Label & Delete Cross */}
                <g transform={`translate(${midX}, ${midY})`}>
                  {edge.label && (
                    <rect
                      x={-40}
                      y={-12}
                      width={80}
                      height={22}
                      rx={6}
                      fill="#0f172a"
                      stroke={isTrueHandle ? '#059669' : '#e11d48'}
                      strokeWidth={1}
                    />
                  )}
                  {edge.label && (
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fill={isTrueHandle ? '#34d399' : '#fb7185'}
                      fontSize={10}
                      fontWeight={600}
                      fontFamily="monospace"
                    >
                      {edge.label}
                    </text>
                  )}
                  <circle
                    cx={edge.label ? 38 : 0}
                    cy={edge.label ? -1 : 0}
                    r={8}
                    className="fill-slate-900 stroke-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:fill-rose-950"
                    onClick={(e) => handleDeleteEdge(edge.id, e)}
                  />
                  <text
                    cx={edge.label ? 38 : 0}
                    cy={edge.label ? 3 : 4}
                    x={edge.label ? 38 : 0}
                    y={edge.label ? 3 : 4}
                    textAnchor="middle"
                    fill="#f43f5e"
                    fontSize={10}
                    fontWeight={800}
                    className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  >
                    ×
                  </text>
                </g>
              </g>
            );
          })}

          {/* Active connecting wire while dragging from a port */}
          {connectingSource && (
            <path
              d={`M ${
                (workflow.nodes.find((n) => n.id === connectingSource.nodeId)?.position.x || 0) + 280
              } ${
                (workflow.nodes.find((n) => n.id === connectingSource.nodeId)?.position.y || 0) +
                (connectingSource.handle === 'true' ? 45 : connectingSource.handle === 'false' ? 85 : 65)
              } C ${
                (workflow.nodes.find((n) => n.id === connectingSource.nodeId)?.position.x || 0) + 280 + 80
              } ${
                (workflow.nodes.find((n) => n.id === connectingSource.nodeId)?.position.y || 0) + 65
              }, ${mousePos.x - 80} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
              fill="none"
              stroke="#a855f7"
              strokeWidth={2.5}
              strokeDasharray="5 5"
            />
          )}
        </svg>

        {/* ================================================================== */}
        {/* NODES LAYER */}
        {/* ================================================================== */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {workflow.nodes.map((node) => {
            const meta = NODE_DEFINITIONS[node.type] || {
              name: node.name,
              description: node.notes || 'Configured automation node',
              iconName: 'Play',
              color: '#3b82f6',
              category: node.category,
            };
            const IconComponent = ICON_MAP[meta.iconName] || PlayCircle;
            const isSelected = selectedNodeId === node.id;
            const execution = nodeExecutions[node.id];
            const isCondition = node.type === 'condition_if';
            const isAiAgent = node.type === 'ai_agent';

            let statusColor = 'text-slate-400 bg-slate-800/80 border-slate-700/60';
            let statusText = 'Idle';
            if (execution?.status === 'running') {
              statusColor = 'text-amber-300 bg-amber-950/80 border-amber-600 animate-pulse';
              statusText = 'Running...';
            } else if (execution?.status === 'success') {
              statusColor = 'text-emerald-400 bg-emerald-950/80 border-emerald-600/80';
              statusText = `${execution.durationMs !== undefined ? `${execution.durationMs}ms` : 'Done'}`;
            } else if (execution?.status === 'failed') {
              statusColor = 'text-rose-400 bg-rose-950/80 border-rose-600/80';
              statusText = 'Error';
            } else if (execution?.status === 'skipped') {
              statusColor = 'text-slate-500 bg-slate-900 border-slate-800 dashed';
              statusText = 'Skipped';
            }

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  width: '280px',
                }}
                className={`absolute pointer-events-auto rounded-xl bg-slate-900/95 backdrop-blur-md border transition-shadow group select-none ${
                  isSelected
                    ? 'border-indigo-500 shadow-2xl shadow-indigo-500/25 ring-2 ring-indigo-500/30'
                    : 'border-slate-800/90 hover:border-slate-700 shadow-xl'
                } ${execution?.status === 'running' ? 'ring-2 ring-amber-400/50' : ''}`}
              >
                {/* Input Port (Left Handle) */}
                {node.category !== 'trigger' && (
                  <div
                    onMouseUp={(e) => handleEndConnect(e, node.id)}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-950 border-2 border-indigo-400 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shadow-lg z-20 group/port"
                    title="Connect input data here"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-400 group-hover/port:bg-white transition-colors" />
                  </div>
                )}

                {/* Node Card Header */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-950/40 rounded-t-xl">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-inner"
                      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-slate-100 truncate leading-tight">
                        {node.name}
                      </h4>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                        {node.category}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono border flex items-center gap-1 shrink-0 ${statusColor}`}
                  >
                    {execution?.status === 'running' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    )}
                    {execution?.status === 'success' && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    )}
                    {execution?.status === 'failed' && (
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                    )}
                    <span>{statusText}</span>
                  </div>
                </div>

                {/* Node Card Body */}
                <div className="px-3.5 py-2.5 text-xs text-slate-400 space-y-1.5 bg-slate-900/60">
                  {isCondition ? (
                    <div className="font-mono text-[11px] text-amber-300/90 bg-amber-950/30 px-2 py-1 rounded border border-amber-800/40">
                      IF: {node.data?.rules?.[0]?.field || 'score'}{' '}
                      {node.data?.rules?.[0]?.operator || '>'}{' '}
                      {node.data?.rules?.[0]?.value || '70'}
                    </div>
                  ) : isAiAgent ? (
                    <div className="flex items-center gap-1.5 text-purple-300/90 text-[11px]">
                      <Bot className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                      <span className="truncate">{node.data?.agentName || 'Autonomous Agent'}</span>
                    </div>
                  ) : node.type === 'web_scraper' ? (
                    <div className="truncate text-slate-400 font-mono text-[11px]">
                      URL: {node.data?.url || '{{$json.website}}'}
                    </div>
                  ) : node.type === 'email_verifier' ? (
                    <div className="truncate text-emerald-300/90 font-mono text-[11px]">
                      Field: {node.data?.emailField || '{{$json.email}}'}
                    </div>
                  ) : node.type === 'hubspot_crm' ? (
                    <div className="truncate text-orange-300 font-mono text-[11px]">
                      HubSpot Deal: {node.data?.dealStage || 'Qualified'}
                    </div>
                  ) : node.type === 'slack_notification' ? (
                    <div className="truncate text-purple-300 font-mono text-[11px]">
                      Channel: {node.data?.channel || '#sales-hot-leads'}
                    </div>
                  ) : (
                    <div className="truncate text-slate-400 text-[11px]">
                      {((meta as any).description || 'Automation step').slice(0, 52)}...
                    </div>
                  )}

                  {isAiAgent && (
                    <div className="flex items-center gap-1.5 text-[10px] text-purple-400/80">
                      <span>Tools: {(node.data?.enabledTools || []).length}</span>
                      <span>·</span>
                      <span>Max steps: {node.data?.maxSteps || 3}</span>
                    </div>
                  )}
                </div>

                {/* Quick Action Floating Bar */}
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/60 rounded-b-xl text-slate-400 text-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunSingleNode(node);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 hover:text-white transition-colors"
                    title="Test step with live inputs"
                  >
                    <Play className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px]">Test</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateNode(node.id);
                      }}
                      className="p-1 rounded hover:bg-slate-800 hover:text-white transition-colors"
                      title="Duplicate Node"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                      className="p-1 rounded hover:bg-rose-950/60 hover:text-rose-400 transition-colors"
                      title="Delete Node"
                    >
                      <Trash2 className="w-3 h-3 text-slate-500 hover:text-rose-400" />
                    </button>
                  </div>
                </div>

                {/* Standard Output Port (Right Handle) */}
                {!isCondition && (
                  <div
                    onMouseDown={(e) => handleStartConnect(e, node.id, 'output')}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-950 border-2 border-indigo-400 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shadow-lg z-20 group/port"
                    title="Drag cable to connect next node"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-400 group-hover/port:bg-white transition-colors" />
                  </div>
                )}

                {/* Condition Node Dual Ports (TRUE vs FALSE) */}
                {isCondition && (
                  <>
                    <div
                      onMouseDown={(e) => handleStartConnect(e, node.id, 'true')}
                      style={{ top: '45px' }}
                      className="absolute -right-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950 border-2 border-emerald-500 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shadow-lg z-20 group/port"
                      title="TRUE Branch: Connect node for passing condition"
                    >
                      <span className="text-[8px] font-bold text-emerald-400 leading-none">T</span>
                    </div>

                    <div
                      onMouseDown={(e) => handleStartConnect(e, node.id, 'false')}
                      style={{ top: '85px' }}
                      className="absolute -right-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950 border-2 border-rose-500 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shadow-lg z-20 group/port"
                      title="FALSE Branch: Connect node for failing condition"
                    >
                      <span className="text-[8px] font-bold text-rose-400 leading-none">F</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ================================================================== */}
        {/* MINI-MAP BIRDS-EYE PREVIEW */}
        {/* ================================================================== */}
        {showMiniMap && workflow.nodes.length > 0 && (
          <div className="absolute top-4 right-4 z-20 w-44 h-28 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl p-2 shadow-2xl pointer-events-none">
            <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between">
              <span>Mini-Map</span>
              <span>{workflow.nodes.length} nodes</span>
            </div>
            <div className="relative w-full h-20 bg-slate-950/80 rounded-lg overflow-hidden border border-slate-800">
              {workflow.nodes.map((n) => {
                const normX = Math.min(Math.max((n.position.x / 2400) * 100, 5), 85);
                const normY = Math.min(Math.max((n.position.y / 1000) * 100, 5), 85);
                const isSel = selectedNodeId === n.id;
                return (
                  <div
                    key={n.id}
                    style={{ left: `${normX}%`, top: `${normY}%` }}
                    className={`absolute w-3 h-2 rounded-xs transform -translate-x-1/2 -translate-y-1/2 ${
                      isSel ? 'bg-indigo-400 ring-1 ring-white' : 'bg-slate-600'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
