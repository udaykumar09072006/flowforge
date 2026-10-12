import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  BackgroundVariant,
} from '@xyflow/react';
import { CustomWorkflowNode } from './CustomWorkflowNode';
import { FlowEdge, FlowNode, NodeType } from '../../types/workflow';
import { NODE_DEFINITIONS } from '../../shared/nodeRegistry';
import { useFlowForgeRbac } from '../../hooks/useFlowForgeRbac';
import { Lock, Eye } from 'lucide-react';

const nodeTypes = {
  custom: CustomWorkflowNode,
};

interface WorkflowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  onSelectNode: (node: FlowNode | null) => void;
  selectedNodeId?: string | null;
  isDarkMode: boolean;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onSelectNode,
  selectedNodeId,
  isDarkMode,
}) => {
  // Convert domain nodes to React Flow Node objects
  const rfNodes = useMemo(() => {
    return (nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    })) as unknown) as Node[];
  }, [nodes, selectedNodeId]);

  const rfEdges = useMemo(() => {
    return edges as Edge[];
  }, [edges]);

  // Handle Node Changes (drag, select, delete)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = (applyNodeChanges(changes, rfNodes) as unknown) as FlowNode[];
      onNodesChange(updated);
    },
    [rfNodes, onNodesChange]
  );

  // Handle Edge Changes
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updated = applyEdgeChanges(changes, rfEdges) as FlowEdge[];
      onEdgesChange(updated);
    },
    [rfEdges, onEdgesChange]
  );

  // Connect two nodes
  const handleConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) return; // Prevent self-loop

      const newEdge: FlowEdge = {
        id: `e_${params.source}_${params.sourceHandle || 'def'}_${params.target}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || null,
        targetHandle: params.targetHandle || null,
        animated: true,
        label: params.sourceHandle === 'true' ? 'True' : params.sourceHandle === 'false' ? 'False' : undefined,
      };

      onEdgesChange(addEdge(newEdge as Edge, rfEdges) as FlowEdge[]);
    },
    [rfEdges, onEdgesChange]
  );

  // Drop handler from Left Palette
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeTypeData = event.dataTransfer.getData('application/flowforge-nodetype');
      if (!nodeTypeData) return;

      const def = NODE_DEFINITIONS[nodeTypeData as NodeType];
      if (!def) return;

      // Calculate canvas drop position
      const bounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 120,
        y: event.clientY - bounds.top - 40,
      };

      const newNodeId = `node_${Date.now()}`;
      const newNode: FlowNode = {
        id: newNodeId,
        type: 'custom',
        position,
        data: {
          label: def.name,
          nodeType: def.type,
          category: def.category,
          description: def.description,
          config: JSON.parse(JSON.stringify(def.defaultConfig)),
        },
      };

      onNodesChange([...nodes, newNode]);
      onSelectNode(newNode);
    },
    [nodes, onNodesChange, onSelectNode]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const domainNode = nodes.find((n) => n.id === node.id) || null;
      onSelectNode(domainNode);
    },
    [nodes, onSelectNode]
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  const { role, can, cannot, setIsAuthModalOpen } = useFlowForgeRbac();

  return (
    <div
      className="w-full h-full relative"
      onDrop={can('edit', 'workflow') ? handleDrop : (e) => e.preventDefault()}
      onDragOver={handleDragOver}
    >
      {/* Floating Read-Only Warning Banner for Viewers */}
      {cannot('edit', 'workflow') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 backdrop-blur-md text-xs font-semibold flex items-center gap-2 shadow-lg animate-in fade-in">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>Viewer Mode ({role}): Canvas is read-only</span>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="underline hover:text-amber-700 dark:hover:text-amber-300 ml-1 cursor-pointer"
          >
            Switch Role
          </button>
        </div>
      )}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={can('edit', 'workflow') ? handleNodesChange : undefined}
        onEdgesChange={can('edit', 'workflow') ? handleEdgesChange : undefined}
        onConnect={can('edit', 'workflow') ? handleConnect : undefined}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={2.0}
        colorMode={isDarkMode ? 'dark' : 'light'}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.5}
          color={isDarkMode ? '#334155' : '#cbd5e1'}
        />
        <Controls
          showInteractive={false}
          className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !shadow-sm !rounded-lg"
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node: any) => {
            const cat = node.data?.category;
            if (cat === 'trigger') return '#f59e0b';
            if (cat === 'logic') return '#6366f1';
            if (cat === 'action') return '#3b82f6';
            if (cat === 'utility') return '#10b981';
            return '#64748b';
          }}
          className="!bg-white/80 dark:!bg-slate-900/80 !border-slate-200 dark:!border-slate-800"
        />
      </ReactFlow>
    </div>
  );
};
