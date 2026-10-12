import { FlowEdge, FlowNode } from '../../types/workflow';
import { NODE_DEFINITIONS } from '../../shared/nodeRegistry';

export interface ValidationError {
  type: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  executionOrder: string[];
}

/**
 * Validates a workflow graph:
 * - Ensures at least one trigger node exists
 * - Detects cyclic dependencies (cycles)
 * - Identifies missing configurations
 * - Detects orphan/unreachable nodes
 * - Computes topological execution order
 */
export function validateGraph(nodes: FlowNode[], edges: FlowEdge[]): ValidationReport {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!nodes || nodes.length === 0) {
    return {
      isValid: false,
      errors: [{ type: 'error', message: 'Workflow contains no nodes. Add at least one trigger node.' }],
      warnings: [],
      executionOrder: [],
    };
  }

  // 1. Identify Trigger Nodes
  const triggerNodes = nodes.filter((n) => n.data.nodeType?.startsWith('trigger:'));
  if (triggerNodes.length === 0) {
    errors.push({
      type: 'error',
      message: 'Workflow must have at least one trigger node (Manual, Webhook, or Schedule).',
    });
  }

  // 2. Validate individual node configuration
  const nodeMap = new Map<string, FlowNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    const def = NODE_DEFINITIONS[node.data.nodeType];
    if (!def) {
      errors.push({
        type: 'error',
        nodeId: node.id,
        message: `Unknown node type '${node.data.nodeType}' on node '${node.data.label || node.id}'.`,
      });
      continue;
    }

    // Node-specific required checks
    const cfg = node.data.config || {};
    if (node.data.nodeType === 'action:http_request') {
      if (!cfg.url || typeof cfg.url !== 'string' || cfg.url.trim() === '') {
        errors.push({
          type: 'error',
          nodeId: node.id,
          message: `HTTP Request node '${node.data.label}' is missing a destination URL.`,
        });
      }
    } else if (node.data.nodeType === 'logic:condition') {
      if (!cfg.field || cfg.field.trim() === '') {
        warnings.push({
          type: 'warning',
          nodeId: node.id,
          message: `Condition node '${node.data.label}' has an empty test field expression.`,
        });
      }
    } else if (node.data.nodeType === 'action:send_email') {
      if (!cfg.to || cfg.to.trim() === '') {
        warnings.push({
          type: 'warning',
          nodeId: node.id,
          message: `Send Email node '${node.data.label}' has an empty recipient ('to') field.`,
        });
      }
    }
  }

  // 3. Build Adjacency Graph and in-degree map for Kahn's cycle detection
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    // Check if edge source and target exist
    if (!nodeMap.has(edge.source)) {
      errors.push({
        type: 'error',
        message: `Edge references non-existent source node '${edge.source}'.`,
      });
      continue;
    }
    if (!nodeMap.has(edge.target)) {
      errors.push({
        type: 'error',
        message: `Edge references non-existent target node '${edge.target}'.`,
      });
      continue;
    }

    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // 4. Kahn's Algorithm for Topological Sort & Cycle Detection
  const queue: string[] = [];
  inDegree.forEach((deg, nodeId) => {
    if (deg === 0) {
      queue.push(nodeId);
    }
  });

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    executionOrder.push(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      const updatedDeg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, updatedDeg);
      if (updatedDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If sorted node count is less than total nodes, a cycle exists
  if (executionOrder.length < nodes.length) {
    const cycleNodes = nodes.filter((n) => !executionOrder.includes(n.id)).map((n) => n.data.label || n.id);
    errors.push({
      type: 'error',
      message: `Cycle detected in graph! Circular dependencies are prohibited: [${cycleNodes.join(', ')}].`,
    });
  }

  // 5. Unreachable non-trigger nodes warnings
  for (const node of nodes) {
    if (!node.data.nodeType?.startsWith('trigger:') && inDegree.get(node.id) === 0 && edges.length > 0) {
      warnings.push({
        type: 'warning',
        nodeId: node.id,
        message: `Node '${node.data.label || node.id}' has no incoming connections and will not be triggered.`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    executionOrder,
  };
}
