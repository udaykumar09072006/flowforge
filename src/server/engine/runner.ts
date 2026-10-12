import { FlowEdge, FlowNode, NodeExecution, WorkflowRun } from '../../types/workflow';
import { ExpressionContext } from './expression';
import { validateGraph } from './graph-validator';
import { NODE_HANDLERS } from './handlers';

export interface WorkflowRunCallbacks {
  onRunStatusChange: (run: WorkflowRun) => void;
  onNodeExecutionChange: (nodeExec: NodeExecution) => void;
  onLog: (log: { timestamp: string; level: 'info' | 'warn' | 'error' | 'debug'; message: string; nodeId?: string }) => void;
}

export interface RunnerOptions {
  run: WorkflowRun;
  nodes: FlowNode[];
  edges: FlowEdge[];
  callbacks: WorkflowRunCallbacks;
  abortController?: AbortController;
  dbStore: {
    executeOperation: (collection: string, operation: string, payload: any) => Promise<any>;
  };
  emailService: {
    send: (to: string, subject: string, body: string) => Promise<{ id: string; status: 'delivered' | 'failed' }>;
  };
}

/**
 * FlowForge Workflow Execution Engine
 */
export class WorkflowRunner {
  private run: WorkflowRun;
  private nodes: FlowNode[];
  private edges: FlowEdge[];
  private callbacks: WorkflowRunCallbacks;
  private abortController: AbortController;
  private dbStore: RunnerOptions['dbStore'];
  private emailService: RunnerOptions['emailService'];
  private expressionContext: ExpressionContext;
  private nodeOutputs: Record<string, any> = {};
  private activeBranchesByNode: Map<string, string> = new Map(); // nodeId -> selectedBranch

  constructor(options: RunnerOptions) {
    this.run = options.run;
    this.nodes = options.nodes;
    this.edges = options.edges;
    this.callbacks = options.callbacks;
    this.abortController = options.abortController || new AbortController();
    this.dbStore = options.dbStore;
    this.emailService = options.emailService;

    this.expressionContext = {
      trigger: this.run.triggerPayload || {},
      nodes: {},
      variables: {},
      run: {
        id: this.run.id,
        workflowId: this.run.workflowId,
        startedAt: this.run.startedAt,
      },
    };
  }

  private log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', nodeId?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      nodeId,
    };
    this.run.logs.push(entry);
    this.callbacks.onLog(entry);
  }

  public cancel() {
    this.log('Cancellation requested by user or system.', 'warn');
    this.abortController.abort();
    this.run.status = 'CANCELLED';
    this.run.completedAt = new Date().toISOString();
    this.run.durationMs = Date.now() - new Date(this.run.startedAt).getTime();
    this.callbacks.onRunStatusChange(this.run);
  }

  public async execute(): Promise<WorkflowRun> {
    const startTime = Date.now();
    this.run.status = 'RUNNING';
    this.callbacks.onRunStatusChange(this.run);
    this.log(`Started execution of workflow "${this.run.workflowName}" (Run ID: ${this.run.id})`);

    // 1. Validate graph topology and cycles
    const validation = validateGraph(this.nodes, this.edges);
    if (!validation.isValid) {
      this.run.status = 'FAILED';
      this.run.errorSummary = `Graph validation failed: ${validation.errors.map((e) => e.message).join('; ')}`;
      this.run.completedAt = new Date().toISOString();
      this.run.durationMs = Date.now() - startTime;
      this.log(this.run.errorSummary, 'error');
      this.callbacks.onRunStatusChange(this.run);
      return this.run;
    }

    // 2. Initialize NodeExecutions map
    const nodeMap = new Map<string, FlowNode>();
    for (const node of this.nodes) {
      nodeMap.set(node.id, node);
      const existing = this.run.nodeExecutions.find((ne) => ne.nodeId === node.id);
      if (!existing) {
        this.run.nodeExecutions.push({
          id: `ne_${this.run.id}_${node.id}`,
          runId: this.run.id,
          nodeId: node.id,
          nodeLabel: node.data.label || node.id,
          nodeType: node.data.nodeType,
          attempt: 0,
          status: 'PENDING',
        });
      }
    }

    // 3. Track in-degree and branch routing
    // Outgoing edges map: sourceNodeId -> FlowEdge[]
    const outgoing = new Map<string, FlowEdge[]>();
    // Incoming edges map: targetNodeId -> FlowEdge[]
    const incoming = new Map<string, FlowEdge[]>();

    for (const node of this.nodes) {
      outgoing.set(node.id, []);
      incoming.set(node.id, []);
    }

    for (const edge of this.edges) {
      outgoing.get(edge.source)?.push(edge);
      incoming.get(edge.target)?.push(edge);
    }

    // Identify Trigger entry nodes
    const readyQueue: string[] = this.nodes
      .filter((n) => n.data.nodeType?.startsWith('trigger:'))
      .map((n) => n.id);

    // If no explicit trigger, start from in-degree 0 nodes
    if (readyQueue.length === 0) {
      this.nodes.forEach((n) => {
        if ((incoming.get(n.id)?.length || 0) === 0) {
          readyQueue.push(n.id);
        }
      });
    }

    const executedNodes = new Set<string>();
    const skippedNodes = new Set<string>();

    // 4. Execution Loop
    while (readyQueue.length > 0) {
      // Cooperative cancellation check
      if (this.abortController.signal.aborted) {
        this.log('Execution cancelled before node execution.', 'warn');
        this.run.status = 'CANCELLED';
        break;
      }

      const nodeId = readyQueue.shift()!;
      if (executedNodes.has(nodeId) || skippedNodes.has(nodeId)) {
        continue;
      }

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const nodeExec = this.run.nodeExecutions.find((ne) => ne.nodeId === nodeId)!;

      // Check incoming edge conditions
      const incomingEdges = incoming.get(nodeId) || [];
      let shouldExecute = true;

      if (incomingEdges.length > 0) {
        // A node can execute if at least one incoming active edge delivered control to it
        // and all upstream dependencies on active paths have completed.
        let hasActiveIncoming = false;
        let waitingForDependency = false;

        for (const edge of incomingEdges) {
          if (!executedNodes.has(edge.source) && !skippedNodes.has(edge.source)) {
            // Upstream not yet finished
            waitingForDependency = true;
            break;
          }

          if (executedNodes.has(edge.source)) {
            const selectedBranch = this.activeBranchesByNode.get(edge.source);
            // If the source was a branching node (Condition/Switch), check if this edge matched the branch
            if (selectedBranch !== undefined) {
              if (edge.sourceHandle === selectedBranch || (!edge.sourceHandle && selectedBranch === 'default')) {
                hasActiveIncoming = true;
              }
            } else {
              // Regular non-branching source node that succeeded
              hasActiveIncoming = true;
            }
          }
        }

        if (waitingForDependency) {
          // Re-queue for later
          readyQueue.push(nodeId);
          continue;
        }

        if (!hasActiveIncoming) {
          shouldExecute = false;
        }
      }

      // If all incoming paths are disabled/unselected, mark node SKIPPED
      if (!shouldExecute) {
        skippedNodes.add(nodeId);
        nodeExec.status = 'SKIPPED';
        this.callbacks.onNodeExecutionChange(nodeExec);
        this.log(`Node "${node.data.label}" was bypassed (unselected branch path)`, 'debug', nodeId);

        // Propagate skip to all downstream nodes
        const nextEdges = outgoing.get(nodeId) || [];
        for (const edge of nextEdges) {
          if (!readyQueue.includes(edge.target)) {
            readyQueue.push(edge.target);
          }
        }
        continue;
      }

      // Execute node with retry support
      nodeExec.status = 'RUNNING';
      nodeExec.startedAt = new Date().toISOString();
      const nodeStart = Date.now();
      nodeExec.attempt += 1;
      this.callbacks.onNodeExecutionChange(nodeExec);
      this.log(`Executing node "${node.data.label}" (${node.data.nodeType}) [Attempt ${nodeExec.attempt}]`, 'info', nodeId);

      const handler = NODE_HANDLERS[node.data.nodeType];
      if (!handler) {
        nodeExec.status = 'FAILED';
        nodeExec.errorDetails = `Missing handler implementation for node type ${node.data.nodeType}`;
        nodeExec.completedAt = new Date().toISOString();
        nodeExec.durationMs = Date.now() - nodeStart;
        this.callbacks.onNodeExecutionChange(nodeExec);
        this.run.status = 'FAILED';
        this.run.errorSummary = nodeExec.errorDetails;
        this.log(nodeExec.errorDetails, 'error', nodeId);
        break;
      }

      // Collect inputs from upstream nodes
      const incomingInputs: Record<string, any> = {};
      for (const edge of incomingEdges) {
        if (this.nodeOutputs[edge.source]) {
          incomingInputs[edge.source] = this.nodeOutputs[edge.source];
        }
      }
      nodeExec.inputSnapshot = incomingInputs;

      let success = false;
      let result: any = null;
      let lastError: any = null;
      const maxRetries = node.data.nodeType === 'action:http_request' ? 2 : 1;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        nodeExec.attempt = attempt;
        try {
          result = await handler({
            nodeId,
            config: node.data.config || {},
            expressionContext: this.expressionContext,
            incomingInputs,
            logger: (msg, lvl = 'info') => this.log(msg, lvl, nodeId),
            signal: this.abortController.signal,
            dbStore: this.dbStore,
            emailService: this.emailService,
          });
          success = true;
          break;
        } catch (err: any) {
          lastError = err;
          this.log(`Node "${node.data.label}" attempt ${attempt} failed: ${err.message}`, 'warn', nodeId);
          if (attempt < maxRetries && !this.abortController.signal.aborted) {
            // Exponential backoff
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
          }
        }
      }

      const nodeEnd = Date.now();
      nodeExec.durationMs = nodeEnd - nodeStart;
      nodeExec.completedAt = new Date().toISOString();

      if (success) {
        executedNodes.add(nodeId);
        nodeExec.status = 'SUCCEEDED';
        nodeExec.outputSnapshot = result.output;
        this.nodeOutputs[nodeId] = result.output;

        // Store into expression context
        if (!this.expressionContext.nodes) this.expressionContext.nodes = {};
        this.expressionContext.nodes[nodeId] = {
          output: result.output,
          status: 'SUCCEEDED',
        };

        if (result.branch) {
          this.activeBranchesByNode.set(nodeId, result.branch);
        }

        this.callbacks.onNodeExecutionChange(nodeExec);
        this.log(`Node "${node.data.label}" completed successfully in ${nodeExec.durationMs}ms`, 'info', nodeId);

        // If this is a final Generate Output node, copy to run.output
        if (node.data.nodeType === 'utility:generate_output') {
          this.run.output = result.output;
        }

        // Enqueue downstream children
        const nextEdges = outgoing.get(nodeId) || [];
        for (const edge of nextEdges) {
          if (!readyQueue.includes(edge.target)) {
            readyQueue.push(edge.target);
          }
        }
      } else {
        nodeExec.status = 'FAILED';
        nodeExec.errorDetails = lastError?.message || 'Execution failed';
        this.callbacks.onNodeExecutionChange(nodeExec);
        this.run.status = 'FAILED';
        this.run.errorSummary = `Execution stopped due to failure at node "${node.data.label}": ${nodeExec.errorDetails}`;
        this.log(this.run.errorSummary, 'error', nodeId);
        break;
      }
    }

    // 5. Wrap up Workflow Run status
    this.run.completedAt = new Date().toISOString();
    this.run.durationMs = Date.now() - startTime;

    if (this.run.status === 'RUNNING') {
      this.run.status = 'SUCCEEDED';
      this.log(`Workflow run completed successfully in ${this.run.durationMs}ms.`, 'info');
    }

    this.callbacks.onRunStatusChange(this.run);
    return this.run;
  }
}
