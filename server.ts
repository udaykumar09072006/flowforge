import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { DataStore } from './src/server/store';
import { ExecutionQueue } from './src/server/engine/queue';
import { validateGraph } from './src/server/engine/graph-validator';
import { generateWorkflowFromPrompt } from './src/server/ai-generator';
import { Workflow, WorkflowRun } from './src/types/workflow';
import { sessionMiddleware, requireAuth, requireWorkspaceRole } from './src/server/auth';
import { createAuthRouter } from './src/server/routes/auth.routes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware stack
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Initialize persistent state and background queue
const store = new DataStore();

// Attach session middleware across all incoming requests
app.use(sessionMiddleware(store));

// Realtime SSE subscribers
const sseClients: Response[] = [];

function broadcastEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// Background queue with real-time SSE dispatching
const queue = new ExecutionQueue({
  concurrency: 5,
  dbStore: {
    executeOperation: (col, op, payload) => store.executeDbOperation(col, op, payload),
  },
  emailService: {
    send: (to, subj, body) => store.sendEmail(to, subj, body),
  },
  getCallbacks: (runId: string) => ({
    onRunStatusChange: (run: WorkflowRun) => {
      store.runs.set(run.id, run);
      // update workflow summary status
      const wf = store.workflows.get(run.workflowId);
      if (wf) {
        wf.lastRunStatus = run.status;
        wf.lastRunAt = run.completedAt || run.startedAt;
        if (run.status === 'SUCCEEDED' || run.status === 'FAILED') {
          wf.runCount = (wf.runCount || 0) + 1;
        }
      }
      broadcastEvent('run:updated', run);
    },
    onNodeExecutionChange: (nodeExec) => {
      broadcastEvent('node:updated', { runId, nodeExec });
    },
    onLog: (log) => {
      broadcastEvent('log:appended', { runId, log });
    },
  }),
});

// ============================================================================
// REST API ROUTES (/api/v1)
// ============================================================================

// 1. Authentication Endpoints
app.use('/api/v1/auth', createAuthRouter(store));

// 2. Health & Status (Public)
app.get('/api/v1/health', (_req, res) => {
  const metrics = queue.getMetrics();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    queue: metrics,
    workflowsCount: store.workflows.size,
    runsCount: store.runs.size,
    databaseCollections: Array.from(store.dbRecords.keys()),
  });
});

// 3. Real-time SSE Stream (Requires Authenticated Session via Cookie or Query Token)
app.get('/api/v1/events', (req: Request, res: Response) => {
  // Support authentication via session cookie or token query parameter
  const token = req.cookies?.flowforge_session || (req.query?.token as string);
  const sessionData = token ? store.findSessionByToken(token) : null;

  if (!sessionData && !req.user) {
    return res.status(401).json({ error: 'Authentication required for real-time events stream.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 4. Workspaces (Protected - Scoped to User's Authorized Memberships)
app.get('/api/v1/workspaces', requireAuth, (req, res) => {
  const user = req.user!;
  const userWorkspaces = store.workspaces.filter((w) =>
    w.members.some((m) => m.id === user.id)
  );
  res.json({ workspaces: userWorkspaces });
});

// 5. Workflows CRUD (Protected - Workspace Isolated, Prevents IDOR)
app.get('/api/v1/workflows', requireAuth, (req, res) => {
  const user = req.user!;
  const userWorkspaceIds = store.workspaces
    .filter((w) => w.members.some((m) => m.id === user.id))
    .map((w) => w.id);

  const targetWsId = req.query.workspaceId as string | undefined;

  let list = Array.from(store.workflows.values());
  if (targetWsId) {
    if (!userWorkspaceIds.includes(targetWsId)) {
      return res.status(403).json({
        error: 'Access denied: You are not a member of this workspace.',
        code: 'WORKSPACE_FORBIDDEN',
      });
    }
    list = list.filter((w) => w.workspaceId === targetWsId);
  } else {
    // Only return workflows from workspaces the user belongs to
    list = list.filter((w) => userWorkspaceIds.includes(w.workspaceId));
  }

  list.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  res.json({ workflows: list });
});

app.post('/api/v1/workflows', requireAuth, (req, res) => {
  const user = req.user!;
  const workspaceId = req.body.workspaceId || 'ws_default';

  // Enforce workspace membership and permission
  const membership = store.getWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return res.status(403).json({
      error: 'Access denied: You are not a member of this workspace.',
      code: 'WORKSPACE_FORBIDDEN',
    });
  }

  if (membership.role === 'VIEWER') {
    return res.status(403).json({
      error: 'Access denied: Viewers cannot create new workflows.',
      code: 'INSUFFICIENT_ROLE',
    });
  }

  const { name, description } = req.body;
  const newId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const defaultTriggerId = `node_trigger_${Date.now()}`;

  const newWorkflow: Workflow = {
    id: newId,
    workspaceId,
    name: name || 'Untitled Workflow',
    description: description || 'New visual automated process',
    status: 'draft',
    version: 1,
    nodes: [
      {
        id: defaultTriggerId,
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          label: 'Manual Trigger',
          nodeType: 'trigger:manual',
          category: 'trigger',
          description: 'Start execution manually or via API',
          config: {
            defaultPayload: '{\n  "test": true\n}',
          },
        },
      },
    ],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runCount: 0,
  };

  store.workflows.set(newId, newWorkflow);
  store.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    workspaceId,
    actor: user.name,
    action: 'WORKFLOW_CREATED',
    resourceType: 'workflow',
    resourceId: newId,
    timestamp: new Date().toISOString(),
    metadata: { name: newWorkflow.name },
  });

  res.status(201).json({ workflow: newWorkflow });
});

app.get('/api/v1/workflows/:id', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  // Enforce workspace access check
  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership) {
    return res.status(403).json({
      error: 'Access denied: You do not have access to this workflow.',
      code: 'WORKSPACE_FORBIDDEN',
    });
  }

  res.json({ workflow: wf });
});

app.patch('/api/v1/workflows/:id', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  // Enforce editor+ permissions
  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership || membership.role === 'VIEWER') {
    return res.status(403).json({
      error: 'Access denied: You do not have permission to modify this workflow.',
      code: 'INSUFFICIENT_ROLE',
    });
  }

  const { name, description, nodes, edges } = req.body;
  if (name !== undefined) wf.name = name;
  if (description !== undefined) wf.description = description;
  if (nodes !== undefined) wf.nodes = nodes;
  if (edges !== undefined) wf.edges = edges;
  wf.updatedAt = new Date().toISOString();

  res.json({ workflow: wf });
});

app.delete('/api/v1/workflows/:id', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  // Enforce admin/owner permissions for deletion
  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return res.status(403).json({
      error: 'Access denied: Only workspace Owners or Admins can delete workflows.',
      code: 'INSUFFICIENT_ROLE',
    });
  }

  store.workflows.delete(req.params.id);
  store.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    workspaceId: wf.workspaceId,
    actor: req.user!.name,
    action: 'WORKFLOW_DELETED',
    resourceType: 'workflow',
    resourceId: req.params.id,
    timestamp: new Date().toISOString(),
    metadata: { name: wf.name },
  });

  res.json({ success: true, deletedId: req.params.id });
});

app.post('/api/v1/workflows/:id/duplicate', requireAuth, (req, res) => {
  const source = store.workflows.get(req.params.id);
  if (!source) return res.status(404).json({ error: 'Workflow not found' });

  const membership = store.getWorkspaceMembership(source.workspaceId, req.user!.id);
  if (!membership || membership.role === 'VIEWER') {
    return res.status(403).json({
      error: 'Access denied: Insufficient permissions to duplicate workflows.',
      code: 'INSUFFICIENT_ROLE',
    });
  }

  const copyId = `wf_${Date.now()}_copy`;
  const duplicated: Workflow = {
    ...JSON.parse(JSON.stringify(source)),
    id: copyId,
    name: `${source.name} (Copy)`,
    status: 'draft',
    version: 1,
    publishedVersionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runCount: 0,
    lastRunStatus: null,
    lastRunAt: null,
  };

  store.workflows.set(copyId, duplicated);
  res.status(201).json({ workflow: duplicated });
});

// 6. Validation & Publishing (Protected)
app.post('/api/v1/workflows/:id/validate', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership) {
    return res.status(403).json({ error: 'Access denied: You do not have access to this workflow.' });
  }

  const nodes = req.body.nodes || wf.nodes;
  const edges = req.body.edges || wf.edges;
  const report = validateGraph(nodes, edges);

  res.json({ report });
});

app.post('/api/v1/workflows/:id/publish', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
    return res.status(403).json({ error: 'Access denied: Insufficient permissions to publish workflows.' });
  }

  const nodes = req.body.nodes || wf.nodes;
  const edges = req.body.edges || wf.edges;
  const notes = req.body.notes || 'Published release';

  const report = validateGraph(nodes, edges);
  if (!report.isValid) {
    return res.status(400).json({
      error: 'Cannot publish invalid workflow graph',
      errors: report.errors,
    });
  }

  const newVersionNumber = (wf.version || 1) + 1;
  const versionId = `v${newVersionNumber}_${wf.id}`;

  const versionRecord = {
    id: versionId,
    workflowId: wf.id,
    versionNumber: newVersionNumber,
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    publishedAt: new Date().toISOString(),
    publishedBy: req.user!.name,
    notes,
  };

  if (!store.versions.has(wf.id)) {
    store.versions.set(wf.id, []);
  }
  store.versions.get(wf.id)!.unshift(versionRecord);

  // Update workflow status
  wf.status = 'published';
  wf.version = newVersionNumber;
  wf.publishedVersionId = versionId;
  wf.nodes = nodes;
  wf.edges = edges;
  wf.updatedAt = new Date().toISOString();

  // Create Webhook endpoint if workflow contains a webhook trigger
  const hasWebhook = nodes.some((n: any) => n.data.nodeType === 'trigger:webhook');
  if (hasWebhook && !wf.webhookEndpointId) {
    const epId = `wh_${wf.id}`;
    store.webhooks.set(epId, {
      id: epId,
      workflowId: wf.id,
      name: `${wf.name} Webhook`,
      token: `sec_${Math.random().toString(36).substring(2, 12)}`,
      createdAt: new Date().toISOString(),
      callCount: 0,
    });
    wf.webhookEndpointId = epId;
  }

  store.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    workspaceId: wf.workspaceId,
    actor: req.user!.name,
    action: 'WORKFLOW_PUBLISHED',
    resourceType: 'workflow',
    resourceId: wf.id,
    timestamp: new Date().toISOString(),
    metadata: { version: newVersionNumber, notes },
  });

  res.json({ workflow: wf, version: versionRecord });
});

app.get('/api/v1/workflows/:id/versions', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership) {
    return res.status(403).json({ error: 'Access denied: You do not have access to this workflow.' });
  }

  const versions = store.versions.get(req.params.id) || [];
  res.json({ versions });
});

app.post('/api/v1/workflows/:id/versions/:versionId/restore', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
    return res.status(403).json({ error: 'Access denied: Insufficient permissions to restore versions.' });
  }

  const versions = store.versions.get(req.params.id) || [];
  const targetVersion = versions.find((v) => v.id === req.params.versionId);
  if (!targetVersion) return res.status(404).json({ error: 'Version not found' });

  // Restore snapshot into draft
  wf.nodes = JSON.parse(JSON.stringify(targetVersion.nodes));
  wf.edges = JSON.parse(JSON.stringify(targetVersion.edges));
  wf.updatedAt = new Date().toISOString();

  store.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    workspaceId: wf.workspaceId,
    actor: req.user!.name,
    action: 'VERSION_RESTORED',
    resourceType: 'workflow',
    resourceId: wf.id,
    timestamp: new Date().toISOString(),
    metadata: { restoredVersion: targetVersion.versionNumber },
  });

  res.json({ workflow: wf, restoredVersion: targetVersion });
});

// 7. Execution Runs (Protected - Workspace Authorization)
app.post('/api/v1/workflows/:id/runs', requireAuth, (req, res) => {
  const wf = store.workflows.get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  const membership = store.getWorkspaceMembership(wf.workspaceId, req.user!.id);
  if (!membership) {
    return res.status(403).json({ error: 'Access denied: You do not have access to this workflow.' });
  }

  // Can execute provided nodes (for test run from editor) or published version
  const nodes = req.body.nodes || wf.nodes;
  const edges = req.body.edges || wf.edges;
  const triggerPayload = req.body.payload || {};
  const triggerType = req.body.triggerType || 'manual';

  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Enqueue in background execution queue
  const job = queue.enqueue({
    runId,
    workflowId: wf.id,
    versionId: wf.publishedVersionId || `draft_v${wf.version}`,
    workflowName: wf.name,
    nodes,
    edges,
    triggerPayload,
    triggerType,
    workspaceId: wf.workspaceId,
  });

  // Pre-seed initial run record in store
  const initialRun: WorkflowRun = {
    id: runId,
    workspaceId: wf.workspaceId,
    workflowId: wf.id,
    workflowName: wf.name,
    versionId: wf.publishedVersionId || `draft_v${wf.version}`,
    triggerType,
    triggerPayload,
    status: 'QUEUED',
    startedAt: new Date().toISOString(),
    nodeExecutions: nodes.map((n: any) => ({
      id: `ne_${runId}_${n.id}`,
      runId,
      nodeId: n.id,
      nodeLabel: n.data.label || n.id,
      nodeType: n.data.nodeType,
      attempt: 0,
      status: 'PENDING',
    })),
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Workflow run triggered by ${req.user!.name} (${req.user!.email}).`,
      },
    ],
  };
  store.runs.set(runId, initialRun);

  res.status(202).json({
    runId,
    jobId: job.id,
    status: 'QUEUED',
    run: initialRun,
  });
});

app.get('/api/v1/runs', requireAuth, (req, res) => {
  const user = req.user!;
  const userWorkspaceIds = store.workspaces
    .filter((w) => w.members.some((m) => m.id === user.id))
    .map((w) => w.id);

  let runs = Array.from(store.runs.values()).filter((r) =>
    userWorkspaceIds.includes(r.workspaceId)
  );

  if (req.query.workflowId) {
    runs = runs.filter((r) => r.workflowId === req.query.workflowId);
  }
  if (req.query.status) {
    runs = runs.filter((r) => r.status === req.query.status);
  }

  runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  res.json({ runs });
});

app.get('/api/v1/runs/:id', requireAuth, (req, res) => {
  const run = store.runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Execution run not found' });

  // Enforce workspace membership
  const membership = store.getWorkspaceMembership(run.workspaceId, req.user!.id);
  if (!membership) {
    return res.status(403).json({ error: 'Access denied: You do not have access to this execution run.' });
  }

  res.json({ run });
});

app.post('/api/v1/runs/:id/cancel', requireAuth, (req, res) => {
  const run = store.runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const membership = store.getWorkspaceMembership(run.workspaceId, req.user!.id);
  if (!membership || membership.role === 'VIEWER') {
    return res.status(403).json({ error: 'Access denied: Insufficient permissions to cancel runs.' });
  }

  const cancelled = queue.cancel(req.params.id);
  if (cancelled) {
    run.status = 'CANCELLED';
    run.completedAt = new Date().toISOString();
    broadcastEvent('run:updated', run);
  }

  res.json({ success: true, run });
});

app.post('/api/v1/runs/:id/retry', requireAuth, (req, res) => {
  const priorRun = store.runs.get(req.params.id);
  if (!priorRun) return res.status(404).json({ error: 'Original run not found' });

  const membership = store.getWorkspaceMembership(priorRun.workspaceId, req.user!.id);
  if (!membership || membership.role === 'VIEWER') {
    return res.status(403).json({ error: 'Access denied: Insufficient permissions to retry runs.' });
  }

  const wf = store.workflows.get(priorRun.workflowId);
  if (!wf) return res.status(404).json({ error: 'Workflow no longer exists' });

  const newRunId = `run_${Date.now()}_retry`;
  queue.enqueue({
    runId: newRunId,
    workflowId: wf.id,
    versionId: priorRun.versionId,
    workflowName: wf.name,
    nodes: wf.nodes,
    edges: wf.edges,
    triggerPayload: priorRun.triggerPayload,
    triggerType: `${priorRun.triggerType}_retry`,
    workspaceId: wf.workspaceId,
  });

  res.status(202).json({ newRunId, status: 'QUEUED' });
});

// 8. Webhook Trigger Endpoint (Receives external webhooks securely)
app.post('/api/v1/webhooks/:endpointId', (req, res) => {
  const ep = store.webhooks.get(req.params.endpointId);
  if (!ep) {
    return res.status(404).json({ error: 'Webhook endpoint not found or inactive.' });
  }

  const wf = store.workflows.get(ep.workflowId);
  if (!wf) {
    return res.status(404).json({ error: 'Target workflow not found' });
  }

  ep.callCount = (ep.callCount || 0) + 1;
  ep.lastTriggeredAt = new Date().toISOString();

  const runId = `run_wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  queue.enqueue({
    runId,
    workflowId: wf.id,
    versionId: wf.publishedVersionId || `v${wf.version}`,
    workflowName: wf.name,
    nodes: wf.nodes,
    edges: wf.edges,
    triggerPayload: req.body || {},
    triggerType: 'webhook',
    workspaceId: wf.workspaceId,
  });

  res.status(202).json({
    message: 'Webhook accepted and workflow execution enqueued.',
    runId,
    workflow: wf.name,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/webhooks', requireAuth, (_req, res) => {
  res.json({ endpoints: Array.from(store.webhooks.values()) });
});

// 9. Analytics & Metrics (Protected)
app.get('/api/v1/analytics', requireAuth, (req, res) => {
  const user = req.user!;
  const userWorkspaceIds = store.workspaces
    .filter((w) => w.members.some((m) => m.id === user.id))
    .map((w) => w.id);

  const runs = Array.from(store.runs.values()).filter((r) =>
    userWorkspaceIds.includes(r.workspaceId)
  );
  const totalRuns = runs.length;
  const succeededRuns = runs.filter((r) => r.status === 'SUCCEEDED').length;
  const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
  const cancelledRuns = runs.filter((r) => r.status === 'CANCELLED').length;
  const successRate = totalRuns > 0 ? Math.round((succeededRuns / totalRuns) * 100) : 100;

  const completedWithDuration = runs.filter((r) => r.durationMs !== undefined && r.durationMs > 0);
  const avgDurationMs =
    completedWithDuration.length > 0
      ? Math.round(
          completedWithDuration.reduce((acc, curr) => acc + (curr.durationMs || 0), 0) /
            completedWithDuration.length
        )
      : 0;

  // Node failure frequency
  const failureCountsByNode: Record<string, { label: string; count: number; type: string }> = {};
  runs.forEach((r) => {
    r.nodeExecutions.forEach((ne) => {
      if (ne.status === 'FAILED') {
        if (!failureCountsByNode[ne.nodeType]) {
          failureCountsByNode[ne.nodeType] = { label: ne.nodeLabel, count: 0, type: ne.nodeType };
        }
        failureCountsByNode[ne.nodeType].count += 1;
      }
    });
  });

  const accessibleWorkflows = Array.from(store.workflows.values()).filter((w) =>
    userWorkspaceIds.includes(w.workspaceId)
  );

  res.json({
    totalRuns,
    succeededRuns,
    failedRuns,
    cancelledRuns,
    successRate,
    avgDurationMs,
    activeWorkflows: accessibleWorkflows.filter((w) => w.status === 'published').length,
    failingNodes: Object.values(failureCountsByNode).sort((a, b) => b.count - a.count),
    queueMetrics: queue.getMetrics(),
  });
});

// 10. Database Explorer & Outbox Inspector (Protected)
app.get('/api/v1/database/:collection', requireAuth, (req, res) => {
  const col = req.params.collection;
  const records = store.dbRecords.get(col) || [];
  res.json({ collection: col, records });
});

app.get('/api/v1/database-collections', requireAuth, (_req, res) => {
  const collections = Array.from(store.dbRecords.entries()).map(([name, recs]) => ({
    name,
    count: recs.length,
    sample: recs[0]?.data || null,
  }));
  res.json({ collections });
});

app.get('/api/v1/emails', requireAuth, (_req, res) => {
  res.json({ emails: store.emails });
});

app.get('/api/v1/audit-logs', requireAuth, (_req, res) => {
  res.json({ logs: store.auditLogs.slice(0, 50) });
});

// 11. AI Workflow Generation (Protected)
app.post('/api/v1/ai/generate', requireAuth, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt string is required.' });
  }

  try {
    const result = await generateWorkflowFromPrompt(prompt);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to generate workflow: ${err.message}` });
  }
});

// ============================================================================
// SERVER INITIALIZATION & FRONTEND MOUNTING
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    // Vite Dev Server middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FlowForge full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
