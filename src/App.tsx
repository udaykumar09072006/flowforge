import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveTab } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { CommandPalette } from './components/layout/CommandPalette';
import { WorkflowCanvas } from './components/canvas/WorkflowCanvas';
import { NodePalette } from './components/editor/NodePalette';
import { NodeConfigPanel } from './components/editor/NodeConfigPanel';
import { EditorToolbar } from './components/editor/EditorToolbar';
import { RunModal } from './components/editor/RunModal';
import { PublishModal } from './components/editor/PublishModal';
import { VersionHistoryModal } from './components/editor/VersionHistoryModal';
import { AiWorkflowModal } from './components/editor/AiWorkflowModal';
import { DashboardPage } from './components/pages/DashboardPage';
import { WorkflowsListPage } from './components/pages/WorkflowsListPage';
import { ExecutionsPage } from './components/pages/ExecutionsPage';
import { TemplatesPage } from './components/pages/TemplatesPage';
import { IntegrationsPage } from './components/pages/IntegrationsPage';
import { AnalyticsPage } from './components/pages/AnalyticsPage';
import { WorkspacePage } from './components/pages/WorkspacePage';
import { FlowEdge, FlowNode, NodeType, UserRole, Workflow, WorkflowRun } from './types/workflow';
import { NODE_DEFINITIONS } from './shared/nodeRegistry';
import { ClerkRbacProvider, useClerkRbac } from './context/ClerkRbacContext';
import { ClerkAuthModal } from './components/auth/ClerkAuthModal';

function FlowForgeAppContent() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Navigation & Clerk Role State
  const { role: currentUserRole, setRole: setCurrentUserRole } = useClerkRbac();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Workflows & Active Editor State
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    errorCount: number;
    warningCount: number;
  } | null>(null);

  // Autosave State & Activity Tracking
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('flowforge_autosave');
    return saved !== null ? saved === 'true' : true;
  });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autosaveCountdown, setAutosaveCountdown] = useState<number | null>(null);
  const [lastActivityTimestamp, setLastActivityTimestamp] = useState<number>(Date.now());
  const activeWorkflowRef = useRef<Workflow | null>(activeWorkflow);

  useEffect(() => {
    activeWorkflowRef.current = activeWorkflow;
  }, [activeWorkflow]);

  const handleToggleAutosave = (enabled: boolean) => {
    setIsAutosaveEnabled(enabled);
    localStorage.setItem('flowforge_autosave', String(enabled));
  };

  const markCanvasActivity = useCallback(() => {
    setHasUnsavedChanges(true);
    setLastActivityTimestamp(Date.now());
  }, []);

  // Modals & Navigation Shell state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Load Workflows from Backend
  const loadWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/workflows');
      const data = await res.json();
      const list = data.workflows || [];
      setWorkflows(list);

      // Default active workflow to first one if not set
      if (!activeWorkflow && list.length > 0) {
        setActiveWorkflow(list[0]);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  }, [activeWorkflow]);

  useEffect(() => {
    loadWorkflows();
  }, []);

  // Listen to Server-Sent Events (SSE) for Real-Time Execution Halos on Canvas!
  useEffect(() => {
    const eventSource = new EventSource('/api/v1/events');

    eventSource.addEventListener('run:updated', (e) => {
      const run: WorkflowRun = JSON.parse(e.data);
      if (activeWorkflow && run.workflowId === activeWorkflow.id) {
        if (run.status === 'RUNNING') {
          setIsRunning(true);
        } else {
          setIsRunning(false);
        }
      }
    });

    eventSource.addEventListener('node:updated', (e) => {
      const { runId, nodeExec } = JSON.parse(e.data);
      // Update canvas nodes with status and duration halos
      setActiveWorkflow((prevWf) => {
        if (!prevWf) return prevWf;
        const updatedNodes = prevWf.nodes.map((node) => {
          if (node.id === nodeExec.nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                status: nodeExec.status,
                executionDuration: nodeExec.durationMs,
                errorMessage: nodeExec.errorDetails || undefined,
              },
            };
          }
          return node;
        });
        return { ...prevWf, nodes: updatedNodes };
      });
    });

    return () => {
      eventSource.close();
    };
  }, [activeWorkflow?.id]);

  // Open a specific workflow in Canvas Editor
  const handleOpenWorkflowInEditor = async (workflowId?: string) => {
    if (!workflowId) {
      // Create a brand new workflow
      try {
        const res = await fetch('/api/v1/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Automation Flow', description: 'Visual pipeline' }),
        });
        const data = await res.json();
        const created = data.workflow;
        setWorkflows((prev) => [created, ...prev]);
        setActiveWorkflow(created);
        setSelectedNode(created.nodes[0] || null);
        setHasUnsavedChanges(false);
        setActiveTab('editor');
      } catch (err) {
        console.error('Failed to create workflow:', err);
      }
      return;
    }

    try {
      const res = await fetch(`/api/v1/workflows/${workflowId}`);
      const data = await res.json();
      if (data.workflow) {
        setActiveWorkflow(data.workflow);
        setSelectedNode(null);
        setHasUnsavedChanges(false);
        setActiveTab('editor');
      }
    } catch (err) {
      console.error('Failed to open workflow:', err);
    }
  };

  // Node Canvas Changes
  const handleNodesChange = (updatedNodes: FlowNode[]) => {
    if (!activeWorkflow) return;
    setActiveWorkflow({
      ...activeWorkflow,
      nodes: updatedNodes,
    });
    markCanvasActivity();

    // Update selected node reference if modified
    if (selectedNode) {
      const match = updatedNodes.find((n) => n.id === selectedNode.id);
      setSelectedNode(match || null);
    }
  };

  const handleEdgesChange = (updatedEdges: FlowEdge[]) => {
    if (!activeWorkflow) return;
    setActiveWorkflow({
      ...activeWorkflow,
      edges: updatedEdges,
    });
    markCanvasActivity();
  };

  // Add node from Palette click
  const handleAddNodeFromPalette = (type: NodeType) => {
    if (!activeWorkflow) return;
    const def = NODE_DEFINITIONS[type];
    if (!def) return;

    const newNodeId = `node_${Date.now()}`;
    const newNode: FlowNode = {
      id: newNodeId,
      type: 'custom',
      position: {
        x: 200 + (activeWorkflow.nodes.length % 4) * 280,
        y: 180 + Math.floor(activeWorkflow.nodes.length / 4) * 140,
      },
      data: {
        label: def.name,
        nodeType: def.type,
        category: def.category,
        description: def.description,
        config: JSON.parse(JSON.stringify(def.defaultConfig)),
      },
    };

    const newNodes = [...activeWorkflow.nodes, newNode];
    setActiveWorkflow({ ...activeWorkflow, nodes: newNodes });
    setSelectedNode(newNode);
    markCanvasActivity();
  };

  // Update selected node config from Right Inspector
  const handleUpdateNode = (updatedNode: FlowNode) => {
    if (!activeWorkflow) return;
    const updatedNodes = activeWorkflow.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));
    setActiveWorkflow({ ...activeWorkflow, nodes: updatedNodes });
    setSelectedNode(updatedNode);
    markCanvasActivity();
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    if (!activeWorkflow) return;
    const updatedNodes = activeWorkflow.nodes.filter((n) => n.id !== nodeId);
    const updatedEdges = activeWorkflow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    setActiveWorkflow({ ...activeWorkflow, nodes: updatedNodes, edges: updatedEdges });
    setSelectedNode(null);
    markCanvasActivity();
  };

  // Duplicate node
  const handleDuplicateNode = (nodeId: string) => {
    if (!activeWorkflow) return;
    const target = activeWorkflow.nodes.find((n) => n.id === nodeId);
    if (!target) return;

    const dupId = `node_${Date.now()}`;
    const duplicated: FlowNode = {
      ...JSON.parse(JSON.stringify(target)),
      id: dupId,
      position: { x: target.position.x + 40, y: target.position.y + 40 },
      data: {
        ...target.data,
        label: `${target.data.label} (Copy)`,
      },
    };

    const newNodes = [...activeWorkflow.nodes, duplicated];
    setActiveWorkflow({ ...activeWorkflow, nodes: newNodes });
    setSelectedNode(duplicated);
    markCanvasActivity();
  };

  // Save Draft to Backend
  const handleSaveDraft = useCallback(async () => {
    const current = activeWorkflowRef.current;
    if (!current) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/workflows/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: current.name,
          description: current.description,
          nodes: current.nodes,
          edges: current.edges,
        }),
      });
      const data = await res.json();
      if (data.workflow) {
        setActiveWorkflow(data.workflow);
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date());
        setAutosaveCountdown(null);
      }
    } catch (err) {
      console.error('Failed to save draft:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Autosave: triggers handleSaveDraft automatically after 5 seconds of canvas inactivity
  useEffect(() => {
    if (!isAutosaveEnabled || !hasUnsavedChanges || isSaving || !activeWorkflow) {
      setAutosaveCountdown(null);
      return;
    }

    setAutosaveCountdown(5);

    const countdownInterval = setInterval(() => {
      setAutosaveCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);

    const timer = setTimeout(() => {
      setAutosaveCountdown(null);
      handleSaveDraft();
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [
    isAutosaveEnabled,
    hasUnsavedChanges,
    lastActivityTimestamp,
    isSaving,
    activeWorkflow?.id,
    handleSaveDraft,
  ]);

  // Validate Graph
  const handleValidateGraph = async () => {
    if (!activeWorkflow) return;
    try {
      const res = await fetch(`/api/v1/workflows/${activeWorkflow.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: activeWorkflow.nodes,
          edges: activeWorkflow.edges,
        }),
      });
      const data = await res.json();
      const report = data.report;
      setValidationStatus({
        isValid: report.isValid,
        errorCount: report.errors?.length || 0,
        warningCount: report.warnings?.length || 0,
      });

      if (!report.isValid) {
        alert(`Validation Errors:\n${report.errors.map((e: any) => `• ${e.message}`).join('\n')}`);
      } else if (report.warnings?.length > 0) {
        alert(`Valid with Warnings:\n${report.warnings.map((w: any) => `• ${w.message}`).join('\n')}`);
      }
    } catch (err) {
      console.error('Validation check failed:', err);
    }
  };

  // Execute Workflow Run
  const handleExecuteRun = async (payload: any) => {
    if (!activeWorkflow) return;
    setIsRunning(true);
    // Reset node halos to pending
    const resetNodes = activeWorkflow.nodes.map((n) => ({
      ...n,
      data: { ...n.data, status: undefined, executionDuration: undefined, errorMessage: undefined },
    }));
    setActiveWorkflow({ ...activeWorkflow, nodes: resetNodes });

    try {
      const res = await fetch(`/api/v1/workflows/${activeWorkflow.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: activeWorkflow.nodes,
          edges: activeWorkflow.edges,
          payload,
          triggerType: 'manual',
        }),
      });
      const data = await res.json();
      setActiveRunId(data.runId);
    } catch (err) {
      console.error('Failed to trigger execution:', err);
      setIsRunning(false);
    }
  };

  // Publish Version
  const handlePublishVersion = async (notes: string) => {
    if (!activeWorkflow) return;
    try {
      const res = await fetch(`/api/v1/workflows/${activeWorkflow.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: activeWorkflow.nodes,
          edges: activeWorkflow.edges,
          notes,
        }),
      });
      const data = await res.json();
      if (data.workflow) {
        setActiveWorkflow(data.workflow);
        setHasUnsavedChanges(false);
        loadWorkflows();
      }
    } catch (err) {
      console.error('Publish failed:', err);
    }
  };

  // Restore past version into active canvas
  const handleRestoreVersion = async (versionId: string) => {
    if (!activeWorkflow) return;
    try {
      const res = await fetch(`/api/v1/workflows/${activeWorkflow.id}/versions/${versionId}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.workflow) {
        setActiveWorkflow(data.workflow);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
  };

  // Duplicate Workflow from list
  const handleDuplicateWorkflow = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/v1/workflows/${workflowId}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.workflow) {
        setWorkflows((prev) => [data.workflow, ...prev]);
      }
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  // Delete Workflow
  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow? This action is permanent.')) return;
    try {
      await fetch(`/api/v1/workflows/${workflowId}`, { method: 'DELETE' });
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
      if (activeWorkflow?.id === workflowId) {
        setActiveWorkflow(workflows.find((w) => w.id !== workflowId) || null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Clone Template into Workspace
  const handleCloneTemplate = async (template: any) => {
    try {
      const res = await fetch('/api/v1/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.title,
          description: template.description,
        }),
      });
      const data = await res.json();
      const newWf: Workflow = {
        ...data.workflow,
        nodes: template.nodes,
        edges: template.edges,
      };

      // Save nodes & edges to newly created workflow
      await fetch(`/api/v1/workflows/${newWf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: template.nodes,
          edges: template.edges,
        }),
      });

      setWorkflows((prev) => [newWf, ...prev]);
      setActiveWorkflow(newWf);
      setActiveTab('editor');
    } catch (err) {
      console.error('Failed to clone template:', err);
    }
  };

  // Apply AI Generated Graph to Canvas
  const handleApplyAiGraph = (graphData: {
    name: string;
    description: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
  }) => {
    if (activeWorkflow) {
      setActiveWorkflow({
        ...activeWorkflow,
        name: graphData.name,
        description: graphData.description,
        nodes: graphData.nodes,
        edges: graphData.edges,
      });
      setHasUnsavedChanges(true);
      setActiveTab('editor');
    } else {
      handleOpenWorkflowInEditor().then(() => {
        setActiveWorkflow((prev) => (prev ? { ...prev, ...graphData } : null));
        setHasUnsavedChanges(true);
      });
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#070a12] text-slate-900 dark:text-slate-100 font-sans antialiased">
      {/* Desktop Collapsible Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsMobileSidebarOpen(false);
          }}
          activeWorkflowName={activeWorkflow?.name}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onOpenAiModal={() => setIsAiModalOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          currentUserRole={currentUserRole}
          setCurrentUserRole={setCurrentUserRole}
          workflowsCount={workflows.length}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden flex"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div
            className="w-64 h-full bg-white dark:bg-[#0b0f19] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                setActiveTab(tab);
                setIsMobileSidebarOpen(false);
              }}
              activeWorkflowName={activeWorkflow?.name}
              isCollapsed={false}
              setIsCollapsed={() => {}}
              onOpenAiModal={() => {
                setIsAiModalOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onOpenCommandPalette={() => {
                setIsCommandPaletteOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              currentUserRole={currentUserRole}
              setCurrentUserRole={setCurrentUserRole}
              workflowsCount={workflows.length}
            />
          </div>
        </div>
      )}

      {/* Right Content Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Navbar */}
        <TopNavbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeWorkflowName={activeWorkflow?.name}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onOpenAiModal={() => setIsAiModalOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          currentUserRole={currentUserRole}
          setCurrentUserRole={setCurrentUserRole}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Main View Area */}
        <main className="flex-1 flex overflow-hidden relative">
        {/* VIEW 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <DashboardPage
            onNavigateToEditor={handleOpenWorkflowInEditor}
            onNavigateToExecutions={(runId) => {
              setActiveRunId(runId || null);
              setActiveTab('executions');
            }}
            onNavigateToTemplates={() => setActiveTab('templates')}
            onNavigateToIntegrations={() => setActiveTab('integrations')}
            onOpenAiModal={() => setIsAiModalOpen(true)}
            onRunWorkflowNow={(wf) => {
              setActiveWorkflow(wf);
              setIsRunModalOpen(true);
            }}
          />
        )}

        {/* VIEW 2: WORKFLOWS LIST */}
        {activeTab === 'workflows' && (
          <WorkflowsListPage
            workflows={workflows}
            onOpenEditor={handleOpenWorkflowInEditor}
            onRunWorkflow={(wf) => {
              setActiveWorkflow(wf);
              setIsRunModalOpen(true);
            }}
            onDuplicateWorkflow={handleDuplicateWorkflow}
            onDeleteWorkflow={handleDeleteWorkflow}
            onOpenAiModal={() => setIsAiModalOpen(true)}
            onViewExecutions={(wfId) => {
              setActiveRunId(null);
              setActiveTab('executions');
            }}
          />
        )}

        {/* VIEW 3: 3-PANEL VISUAL WORKFLOW BUILDER */}
        {activeTab === 'editor' && activeWorkflow && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Editor Toolbar */}
            <EditorToolbar
              workflow={activeWorkflow}
              onUpdateName={(name) => {
                setActiveWorkflow({ ...activeWorkflow, name });
                markCanvasActivity();
              }}
              onSaveDraft={handleSaveDraft}
              onValidate={handleValidateGraph}
              onOpenRunModal={() => setIsRunModalOpen(true)}
              onCancelRun={() => {
                if (activeRunId) {
                  fetch(`/api/v1/runs/${activeRunId}/cancel`, { method: 'POST' });
                }
              }}
              onOpenPublishModal={() => setIsPublishModalOpen(true)}
              onOpenVersionModal={() => setIsVersionModalOpen(true)}
              onOpenAiModal={() => setIsAiModalOpen(true)}
              isSaving={isSaving}
              isRunning={isRunning}
              hasUnsavedChanges={hasUnsavedChanges}
              validationStatus={validationStatus}
              isAutosaveEnabled={isAutosaveEnabled}
              onToggleAutosave={handleToggleAutosave}
              autosaveCountdown={autosaveCountdown}
              lastSavedAt={lastSavedAt}
            />

            {/* 3-Panel Editor Layout */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Left Panel: Searchable Node Palette */}
              <NodePalette onAddNode={handleAddNodeFromPalette} />

              {/* Center Panel: Infinite React Flow Canvas */}
              <div className="flex-1 h-full relative">
                <WorkflowCanvas
                  nodes={activeWorkflow.nodes}
                  edges={activeWorkflow.edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onSelectNode={(node) => setSelectedNode(node)}
                  selectedNodeId={selectedNode?.id}
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* Right Panel: Selected Node Inspector Form */}
              {selectedNode && (
                <NodeConfigPanel
                  node={selectedNode}
                  onUpdateNode={handleUpdateNode}
                  onDeleteNode={handleDeleteNode}
                  onDuplicateNode={handleDuplicateNode}
                  onClose={() => setSelectedNode(null)}
                />
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: EXECUTIONS & DEBUGGER */}
        {activeTab === 'executions' && (
          <ExecutionsPage
            initialRunId={activeRunId}
            onNavigateToWorkflow={handleOpenWorkflowInEditor}
          />
        )}

        {/* VIEW 5: TEMPLATES GALLERY */}
        {activeTab === 'templates' && (
          <TemplatesPage onCloneTemplate={handleCloneTemplate} />
        )}

        {/* VIEW 6: INTEGRATIONS & DB */}
        {activeTab === 'integrations' && (
          <IntegrationsPage
            onNavigateToRun={(runId) => {
              setActiveRunId(runId);
              setActiveTab('executions');
            }}
          />
        )}

        {/* VIEW 7: ANALYTICS & OBSERVABILITY */}
        {activeTab === 'analytics' && <AnalyticsPage />}

        {/* VIEW 8: WORKSPACE & RBAC */}
        {activeTab === 'workspace' && (
          <WorkspacePage currentUserRole={currentUserRole} />
        )}
      </main>
      </div>

      {/* Global Modals */}
      {activeWorkflow && (
        <>
          <RunModal
            workflow={activeWorkflow}
            isOpen={isRunModalOpen}
            onClose={() => setIsRunModalOpen(false)}
            onExecute={handleExecuteRun}
          />
          <PublishModal
            workflow={activeWorkflow}
            isOpen={isPublishModalOpen}
            onClose={() => setIsPublishModalOpen(false)}
            onPublish={handlePublishVersion}
          />
          <VersionHistoryModal
            workflow={activeWorkflow}
            isOpen={isVersionModalOpen}
            onClose={() => setIsVersionModalOpen(false)}
            onRestoreVersion={handleRestoreVersion}
          />
        </>
      )}

      <AiWorkflowModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyGraph={handleApplyAiGraph}
      />

      {/* Quick Global Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={setActiveTab}
        workflows={workflows}
        onOpenWorkflow={handleOpenWorkflowInEditor}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      {/* Clerk Authentication & RBAC Modal */}
      <ClerkAuthModal />
    </div>
  );
}

export default function App() {
  return (
    <ClerkRbacProvider>
      <FlowForgeAppContent />
    </ClerkRbacProvider>
  );
}
