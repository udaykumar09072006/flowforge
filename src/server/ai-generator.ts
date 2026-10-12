import { GoogleGenAI } from '@google/genai';
import { FlowEdge, FlowNode } from '../types/workflow';
import { NODE_DEFINITIONS } from '../shared/nodeRegistry';

export interface GeneratedWorkflowResult {
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  isAiGenerated: boolean;
  explanation: string;
}

export async function generateWorkflowFromPrompt(userPrompt: string): Promise<GeneratedWorkflowResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const allowedTypes = Object.keys(NODE_DEFINITIONS).join(', ');

      const systemInstruction = `You are FlowForge AI, an expert visual workflow architect.
Convert natural language automation requests into valid, connected FlowForge workflow graphs.

Available Node Types:
${allowedTypes}

Constraints:
1. Every workflow must start with a trigger node (e.g., 'trigger:manual', 'trigger:webhook', or 'trigger:schedule').
2. Generate structured JSON conforming strictly to the requested schema.
3. Calculate clean x, y coordinates layout (e.g. 100, 200 -> 420, 200 -> 740, 200 -> 1060, 200). If condition branching occurs, offset True upwards (y: 80) and False downwards (y: 320).
4. For 'logic:condition', sourceHandle must be 'true' or 'false'.
5. Only use supported node types.
`;

      const prompt = `Create a complete workflow for this requirement:
"${userPrompt}"

Return ONLY valid JSON matching this structure:
{
  "name": "Concise Workflow Title",
  "description": "Brief description of the pipeline",
  "explanation": "Why this flow was structured this way",
  "nodes": [
    {
      "id": "node_1",
      "type": "custom",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Display Name",
        "nodeType": "trigger:webhook",
        "category": "trigger",
        "description": "Short explanation",
        "config": { ... }
      }
    }
  ],
  "edges": [
    {
      "id": "e_1_2",
      "source": "node_1",
      "target": "node_2",
      "sourceHandle": null,
      "label": "optional label",
      "animated": true
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const rawText = response.text?.trim() || '';
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          // Validate and sanitize nodes
          const sanitizedNodes: FlowNode[] = parsed.nodes.map((n: any, idx: number) => {
            const nodeType = n.data?.nodeType || 'action:log';
            const def = NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS] || NODE_DEFINITIONS['action:log'];
            return {
              id: n.id || `node_${idx + 1}`,
              type: 'custom',
              position: n.position || { x: 100 + idx * 300, y: 200 },
              data: {
                label: n.data?.label || def.name,
                nodeType: def.type,
                category: def.category,
                description: n.data?.description || def.description,
                config: { ...def.defaultConfig, ...(n.data?.config || {}) },
              },
            };
          });

          const sanitizedEdges: FlowEdge[] = (parsed.edges || []).map((e: any, idx: number) => ({
            id: e.id || `edge_${idx + 1}`,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || null,
            targetHandle: e.targetHandle || null,
            label: e.label,
            animated: true,
          }));

          return {
            name: parsed.name || 'AI Generated Automation',
            description: parsed.description || userPrompt,
            explanation: parsed.explanation || 'Constructed using Gemini 3.8 Flash intelligence.',
            nodes: sanitizedNodes,
            edges: sanitizedEdges,
            isAiGenerated: true,
          };
        }
      }
    } catch (err: any) {
      console.warn('[AI Generator] Model call failed or returned unparseable output; falling back to deterministic template:', err.message);
    }
  }

  // Deterministic fallback templates when API key is unavailable or upon fallback
  return getFallbackTemplate(userPrompt);
}

function getFallbackTemplate(prompt: string): GeneratedWorkflowResult {
  const lower = prompt.toLowerCase();

  // Pattern A: High-value order / threshold checking
  if (lower.includes('order') || lower.includes('amount') || lower.includes('5000') || lower.includes('price')) {
    return {
      name: 'Order Threshold Filter & Alert',
      description: 'Ingests orders, verifies value threshold, routes high-value purchases to VIP notifications, and records data.',
      explanation: 'Generated via FlowForge intelligent template engine matching "order" & "amount" criteria.',
      isAiGenerated: false,
      nodes: [
        {
          id: 'n_trig',
          type: 'custom',
          position: { x: 100, y: 200 },
          data: {
            label: 'Order Webhook Trigger',
            nodeType: 'trigger:webhook',
            category: 'trigger',
            description: 'Receives order payload with customer and amount fields',
            config: { authRequired: false },
          },
        },
        {
          id: 'n_cond',
          type: 'custom',
          position: { x: 440, y: 200 },
          data: {
            label: 'Amount > ₹5,000 Check',
            nodeType: 'logic:condition',
            category: 'logic',
            description: 'Checks if order value exceeds threshold',
            config: { field: '{{trigger.amount}}', operator: 'gt', value: '5000' },
          },
        },
        {
          id: 'n_alert',
          type: 'custom',
          position: { x: 780, y: 80 },
          data: {
            label: 'VIP Alert Email',
            nodeType: 'action:send_email',
            category: 'action',
            description: 'Notifies sales team of priority purchase',
            config: {
              to: 'sales-vip@company.com',
              subject: 'High-Value Order Alert: ₹{{trigger.amount}}',
              body: 'A priority order of ₹{{trigger.amount}} from {{trigger.customerName}} was placed.',
            },
          },
        },
        {
          id: 'n_db',
          type: 'custom',
          position: { x: 780, y: 320 },
          data: {
            label: 'Record in Orders DB',
            nodeType: 'action:db_record',
            category: 'action',
            description: 'Persists order data into internal storage',
            config: {
              collection: 'orders',
              operation: 'insert',
              payload: '{\n  "orderId": "{{trigger.orderId}}",\n  "amount": "{{trigger.amount}}",\n  "customer": "{{trigger.customerName}}"\n}',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n_trig', target: 'n_cond', animated: true },
        { id: 'e2_t', source: 'n_cond', target: 'n_alert', sourceHandle: 'true', label: 'True (> ₹5k)' },
        { id: 'e2_f', source: 'n_cond', target: 'n_db', sourceHandle: 'false', label: 'False (Standard)' },
      ],
    };
  }

  // Pattern B: Monitoring / Schedule / Ping
  if (lower.includes('monitor') || lower.includes('health') || lower.includes('ping') || lower.includes('schedule') || lower.includes('uptime')) {
    return {
      name: 'Service Health Monitor & Alert',
      description: 'Scheduled monitor polling API endpoint and sending notifications if response status is unhealthy.',
      explanation: 'Generated via FlowForge intelligent template engine matching monitoring criteria.',
      isAiGenerated: false,
      nodes: [
        {
          id: 'n_cron',
          type: 'custom',
          position: { x: 100, y: 200 },
          data: {
            label: 'Scheduled Trigger',
            nodeType: 'trigger:schedule',
            category: 'trigger',
            description: 'Runs periodically',
            config: { cronExpression: '*/15 * * * *', timezone: 'UTC' },
          },
        },
        {
          id: 'n_http',
          type: 'custom',
          position: { x: 440, y: 200 },
          data: {
            label: 'Ping API Status',
            nodeType: 'action:http_request',
            category: 'action',
            description: 'GET request to health check',
            config: { method: 'GET', url: 'https://httpbin.org/status/200' },
          },
        },
        {
          id: 'n_chk',
          type: 'custom',
          position: { x: 780, y: 200 },
          data: {
            label: 'Status == 200?',
            nodeType: 'logic:condition',
            category: 'logic',
            description: 'Check status code',
            config: { field: '{{nodes.n_http.output.status}}', operator: 'eq', value: '200' },
          },
        },
        {
          id: 'n_log',
          type: 'custom',
          position: { x: 1100, y: 200 },
          data: {
            label: 'Log Result',
            nodeType: 'action:log',
            category: 'action',
            description: 'Records check result',
            config: { level: 'info', message: 'Health probe status: {{nodes.n_http.output.status}}' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n_cron', target: 'n_http', animated: true },
        { id: 'e2', source: 'n_http', target: 'n_chk', animated: true },
        { id: 'e3', source: 'n_chk', target: 'n_log', sourceHandle: 'true', label: 'Healthy' },
      ],
    };
  }

  // Default General Automation Pipeline
  return {
    name: 'Smart Automation Flow',
    description: `Automated pipeline constructed for: "${prompt.slice(0, 80)}"`,
    explanation: 'Constructed standard 4-step pipeline: Manual Trigger -> Transform Data -> Action -> Log.',
    isAiGenerated: false,
    nodes: [
      {
        id: 'n_start',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          label: 'Manual Trigger',
          nodeType: 'trigger:manual',
          category: 'trigger',
          description: 'Start execution on demand',
          config: { defaultPayload: '{\n  "input": "test_data"\n}' },
        },
      },
      {
        id: 'n_transform',
        type: 'custom',
        position: { x: 440, y: 200 },
        data: {
          label: 'Data Transform',
          nodeType: 'utility:transform',
          category: 'utility',
          description: 'Structures input parameters',
          config: { mapping: '{\n  "processed": true,\n  "received": "{{trigger.input}}"\n}' },
        },
      },
      {
        id: 'n_action',
        type: 'custom',
        position: { x: 780, y: 200 },
        data: {
          label: 'Send Notification',
          nodeType: 'action:send_email',
          category: 'action',
          description: 'Notifies stakeholder',
          config: {
            to: 'admin@company.com',
            subject: 'Workflow Action Completed',
            body: 'Workflow executed successfully for: ' + prompt,
          },
        },
      },
      {
        id: 'n_finish',
        type: 'custom',
        position: { x: 1100, y: 200 },
        data: {
          label: 'Finalize & Log',
          nodeType: 'action:log',
          category: 'action',
          description: 'Completes audit trail',
          config: { level: 'info', message: 'Flow finished successfully.' },
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n_start', target: 'n_transform', animated: true },
      { id: 'e2', source: 'n_transform', target: 'n_action', animated: true },
      { id: 'e3', source: 'n_action', target: 'n_finish', animated: true },
    ],
  };
}
