import { describe, it, expect } from 'vitest';
import { resolveExpression, getNestedProperty } from '../src/server/engine/expression';
import { validateGraph } from '../src/server/engine/graph-validator';
import { validateUrlForSSRF } from '../src/server/engine/ssrf-guard';
import { WorkflowRunner } from '../src/server/engine/runner';
import { FlowEdge, FlowNode, WorkflowRun } from '../src/types/workflow';

describe('Expression Resolver', () => {
  it('safely extracts nested object properties', () => {
    const obj = { order: { customer: { name: 'Aarav' }, items: [{ price: 450 }] } };
    expect(getNestedProperty(obj, 'order.customer.name')).toBe('Aarav');
    expect(getNestedProperty(obj, 'order.items[0].price')).toBe(450);
    expect(getNestedProperty(obj, 'order.missing.property')).toBeUndefined();
  });

  it('blocks prototype pollution attempts', () => {
    const obj = { regular: 'value' };
    expect(getNestedProperty(obj, '__proto__.polluted')).toBeUndefined();
    expect(getNestedProperty(obj, 'constructor.prototype')).toBeUndefined();
  });

  it('interpolates multiple expressions within string template', () => {
    const context = {
      trigger: { orderId: 'ORD-123', amount: 5400, customerName: 'Priya' },
      variables: { tier: 'VIP' },
    };
    const template = 'Order #{{trigger.orderId}} of ₹{{trigger.amount}} for {{trigger.customerName}} ({{variables.tier}})';
    const result = resolveExpression(template, context);
    expect(result).toBe('Order #ORD-123 of ₹5400 for Priya (VIP)');
  });

  it('preserves native types when template is a single token', () => {
    const context = { trigger: { amount: 5000, isActive: true } };
    expect(resolveExpression('{{trigger.amount}}', context)).toBe(5000);
    expect(resolveExpression('{{trigger.isActive}}', context)).toBe(true);
  });
});

describe('Graph Validator & Cycle Detection', () => {
  it('flags workflows with no triggers', () => {
    const nodes: FlowNode[] = [
      {
        id: 'n1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Log', nodeType: 'action:log', category: 'action', description: '', config: {} },
      },
    ];
    const report = validateGraph(nodes, []);
    expect(report.isValid).toBe(false);
    expect(report.errors[0].message).toContain('at least one trigger');
  });

  it('detects cycles using Kahn algorithm', () => {
    const nodes: FlowNode[] = [
      {
        id: 't1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Trigger', nodeType: 'trigger:manual', category: 'trigger', description: '', config: {} },
      },
      {
        id: 'a',
        type: 'custom',
        position: { x: 100, y: 0 },
        data: { label: 'Node A', nodeType: 'utility:string_util', category: 'utility', description: '', config: {} },
      },
      {
        id: 'b',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { label: 'Node B', nodeType: 'utility:string_util', category: 'utility', description: '', config: {} },
      },
    ];
    // Create cycle: Trigger -> A -> B -> A
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'a' },
      { id: 'e2', source: 'a', target: 'b' },
      { id: 'e3', source: 'b', target: 'a' }, // circular loop!
    ];
    const report = validateGraph(nodes, edges);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.message.includes('Cycle detected'))).toBe(true);
  });

  it('validates a clean DAG and produces topological order', () => {
    const nodes: FlowNode[] = [
      {
        id: 't1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Trigger', nodeType: 'trigger:manual', category: 'trigger', description: '', config: {} },
      },
      {
        id: 'c1',
        type: 'custom',
        position: { x: 100, y: 0 },
        data: { label: 'Condition', nodeType: 'logic:condition', category: 'logic', description: '', config: { field: '{{trigger.x}}' } },
      },
      {
        id: 'l1',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { label: 'Log', nodeType: 'action:log', category: 'action', description: '', config: {} },
      },
    ];
    const edges: FlowEdge[] = [
      { id: 'e1', source: 't1', target: 'c1' },
      { id: 'e2', source: 'c1', target: 'l1' },
    ];
    const report = validateGraph(nodes, edges);
    expect(report.isValid).toBe(true);
    expect(report.executionOrder).toEqual(['t1', 'c1', 'l1']);
  });
});

describe('SSRF Protection Guard', () => {
  it('blocks loopback hostnames and IPs', () => {
    expect(validateUrlForSSRF('http://localhost:8080/admin').isAllowed).toBe(false);
    expect(validateUrlForSSRF('http://127.0.0.1/secrets').isAllowed).toBe(false);
    expect(validateUrlForSSRF('http://[::1]/debug').isAllowed).toBe(false);
  });

  it('blocks private IPv4 networks (RFC 1918)', () => {
    expect(validateUrlForSSRF('http://10.0.1.5/api').isAllowed).toBe(false);
    expect(validateUrlForSSRF('http://172.16.50.2/api').isAllowed).toBe(false);
    expect(validateUrlForSSRF('http://192.168.1.1/router').isAllowed).toBe(false);
  });

  it('blocks Cloud metadata service endpoints', () => {
    expect(validateUrlForSSRF('http://169.254.169.254/latest/meta-data').isAllowed).toBe(false);
    expect(validateUrlForSSRF('http://metadata.google.internal/computeMetadata/v1').isAllowed).toBe(false);
  });

  it('permits valid public URLs', () => {
    expect(validateUrlForSSRF('https://httpbin.org/get').isAllowed).toBe(true);
    expect(validateUrlForSSRF('https://api.github.com/users').isAllowed).toBe(true);
  });
});

describe('Workflow Runner Execution Engine', () => {
  it('executes condition branch and marks false branch as SKIPPED', async () => {
    const nodes: FlowNode[] = [
      {
        id: 'n_trig',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Trigger', nodeType: 'trigger:manual', category: 'trigger', description: '', config: {} },
      },
      {
        id: 'n_cond',
        type: 'custom',
        position: { x: 100, y: 0 },
        data: {
          label: 'Condition',
          nodeType: 'logic:condition',
          category: 'logic',
          description: '',
          config: { field: '{{trigger.amount}}', operator: 'gt', value: '5000' },
        },
      },
      {
        id: 'n_true_action',
        type: 'custom',
        position: { x: 200, y: -50 },
        data: { label: 'True Branch Log', nodeType: 'action:log', category: 'action', description: '', config: { message: 'High value' } },
      },
      {
        id: 'n_false_action',
        type: 'custom',
        position: { x: 200, y: 50 },
        data: { label: 'False Branch Log', nodeType: 'action:log', category: 'action', description: '', config: { message: 'Standard value' } },
      },
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', source: 'n_trig', target: 'n_cond' },
      { id: 'e2_t', source: 'n_cond', target: 'n_true_action', sourceHandle: 'true' },
      { id: 'e2_f', source: 'n_cond', target: 'n_false_action', sourceHandle: 'false' },
    ];

    const run: WorkflowRun = {
      id: 'test_run_1',
      workspaceId: 'ws_test',
      workflowId: 'wf_test',
      workflowName: 'Test Branching Flow',
      versionId: 'v1',
      triggerType: 'manual',
      triggerPayload: { amount: 8000 }, // 8000 > 5000 is TRUE
      status: 'QUEUED',
      startedAt: new Date().toISOString(),
      nodeExecutions: [],
      logs: [],
    };

    const runner = new WorkflowRunner({
      run,
      nodes,
      edges,
      callbacks: {
        onRunStatusChange: () => {},
        onNodeExecutionChange: () => {},
        onLog: () => {},
      },
      dbStore: { executeOperation: async () => ({}) },
      emailService: { send: async () => ({ id: '1', status: 'delivered' }) },
    });

    const finalRun = await runner.execute();

    expect(finalRun.status).toBe('SUCCEEDED');
    const trueNode = finalRun.nodeExecutions.find((ne) => ne.nodeId === 'n_true_action');
    const falseNode = finalRun.nodeExecutions.find((ne) => ne.nodeId === 'n_false_action');

    expect(trueNode?.status).toBe('SUCCEEDED');
    expect(falseNode?.status).toBe('SKIPPED');
  });
});
