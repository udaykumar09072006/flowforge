import React, { useState } from 'react';
import {
  FolderKanban,
  Sparkles,
  ArrowRight,
  GitFork,
  CheckCircle2,
  Copy,
  Layers,
  Clock,
  Mail,
  Database,
  Globe,
  Loader2,
} from 'lucide-react';
import { FlowNode } from '../../types/workflow';

interface TemplateItem {
  id: string;
  title: string;
  category: string;
  description: string;
  nodeCount: number;
  tags: string[];
  nodes: FlowNode[];
  edges: any[];
}

interface TemplatesPageProps {
  onCloneTemplate: (template: TemplateItem) => Promise<void>;
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({ onCloneTemplate }) => {
  const [cloningId, setCloningId] = useState<string | null>(null);

  const templates: TemplateItem[] = [
    {
      id: 'tmpl_ecommerce_high_value',
      title: 'E-Commerce High-Value Order Router & VIP Alert',
      category: 'E-Commerce & Sales',
      description:
        'Receives order webhooks, inspects order amount, branches if amount exceeds ₹5,000 threshold to dispatch priority VIP email alerts, and stores order details in PostgreSQL.',
      nodeCount: 6,
      tags: ['Webhook', 'Condition Branching', 'Email Alert', 'Database Record'],
      nodes: [
        {
          id: 't_node_1',
          type: 'custom',
          position: { x: 100, y: 200 },
          data: {
            label: 'Order Webhook',
            nodeType: 'trigger:webhook',
            category: 'trigger',
            description: 'Receives order payload',
            config: { authRequired: false },
          },
        },
        {
          id: 't_node_2',
          type: 'custom',
          position: { x: 420, y: 200 },
          data: {
            label: 'Parse Order Data',
            nodeType: 'utility:transform',
            category: 'utility',
            description: 'Transforms items',
            config: { mapping: '{\n  "orderId": "{{trigger.orderId}}",\n  "amount": "{{trigger.amount}}"\n}' },
          },
        },
        {
          id: 't_node_3',
          type: 'custom',
          position: { x: 740, y: 200 },
          data: {
            label: 'Amount > ₹5,000?',
            nodeType: 'logic:condition',
            category: 'logic',
            description: 'Threshold check',
            config: { field: '{{trigger.amount}}', operator: 'gt', value: '5000' },
          },
        },
        {
          id: 't_node_4',
          type: 'custom',
          position: { x: 1060, y: 90 },
          data: {
            label: 'Send VIP Alert',
            nodeType: 'action:send_email',
            category: 'action',
            description: 'Sales team alert',
            config: {
              to: 'vip-sales@company.com',
              subject: '🚨 VIP Order: ₹{{trigger.amount}}',
              body: 'High value order received.',
            },
          },
        },
        {
          id: 't_node_5',
          type: 'custom',
          position: { x: 1060, y: 310 },
          data: {
            label: 'Store in Orders DB',
            nodeType: 'action:db_record',
            category: 'action',
            description: 'Save order record',
            config: { collection: 'orders', operation: 'insert', payload: '{\n  "orderId": "{{trigger.orderId}}"\n}' },
          },
        },
        {
          id: 't_node_6',
          type: 'custom',
          position: { x: 1380, y: 200 },
          data: {
            label: 'Log Completion',
            nodeType: 'action:log',
            category: 'action',
            description: 'Emits audit trail',
            config: { level: 'info', message: 'Order processed successfully.' },
          },
        },
      ],
      edges: [
        { id: 'te_1', source: 't_node_1', target: 't_node_2', animated: true },
        { id: 'te_2', source: 't_node_2', target: 't_node_3', animated: true },
        { id: 'te_3_t', source: 't_node_3', target: 't_node_4', sourceHandle: 'true', label: 'True (> ₹5k)' },
        { id: 'te_3_f', source: 't_node_3', target: 't_node_5', sourceHandle: 'false', label: 'False (Standard)' },
        { id: 'te_4', source: 't_node_4', target: 't_node_5', animated: true },
        { id: 'te_5', source: 't_node_5', target: 't_node_6', animated: true },
      ],
    },
    {
      id: 'tmpl_api_uptime_monitor',
      title: 'Scheduled API Health Probe & On-Call Alert',
      category: 'DevOps & Reliability',
      description:
        'Runs every 5 minutes using cron, executes an HTTP GET health ping with timeout guards, checks for HTTP 200 OK, and alerts on-call engineers if degraded.',
      nodeCount: 5,
      tags: ['Schedule Cron', 'HTTP Request', 'Condition Check', 'Email Notification'],
      nodes: [
        {
          id: 'u_1',
          type: 'custom',
          position: { x: 100, y: 180 },
          data: {
            label: '5-Minute Cron',
            nodeType: 'trigger:schedule',
            category: 'trigger',
            description: 'Every 5m tick',
            config: { cronExpression: '*/5 * * * *', timezone: 'UTC' },
          },
        },
        {
          id: 'u_2',
          type: 'custom',
          position: { x: 420, y: 180 },
          data: {
            label: 'Ping Health Endpoint',
            nodeType: 'action:http_request',
            category: 'action',
            description: 'SSRF safe GET probe',
            config: { method: 'GET', url: 'https://httpbin.org/status/200' },
          },
        },
        {
          id: 'u_3',
          type: 'custom',
          position: { x: 740, y: 180 },
          data: {
            label: 'Status == 200?',
            nodeType: 'logic:condition',
            category: 'logic',
            description: 'Status verify',
            config: { field: '{{nodes.u_2.output.status}}', operator: 'eq', value: '200' },
          },
        },
        {
          id: 'u_4',
          type: 'custom',
          position: { x: 1060, y: 90 },
          data: {
            label: 'Log Healthy Heartbeat',
            nodeType: 'action:log',
            category: 'action',
            description: 'Record beacon',
            config: { level: 'info', message: 'API Healthy in {{nodes.u_2.output.durationMs}}ms' },
          },
        },
        {
          id: 'u_5',
          type: 'custom',
          position: { x: 1060, y: 280 },
          data: {
            label: 'Alert Incident Team',
            nodeType: 'action:send_email',
            category: 'action',
            description: 'Disruption alert',
            config: { to: 'oncall@company.com', subject: '🚨 Service Degraded', body: 'Health probe failed.' },
          },
        },
      ],
      edges: [
        { id: 'ue_1', source: 'u_1', target: 'u_2', animated: true },
        { id: 'ue_2', source: 'u_2', target: 'u_3', animated: true },
        { id: 'ue_3_t', source: 'u_3', target: 'u_4', sourceHandle: 'true', label: 'Healthy (200)' },
        { id: 'ue_3_f', source: 'u_3', target: 'u_5', sourceHandle: 'false', label: 'Failed' },
      ],
    },
    {
      id: 'tmpl_customer_onboarding',
      title: 'Customer Onboarding Sequence with Async Delay',
      category: 'Customer Engagement',
      description:
        'Welcomes new signups immediately, delays execution safely, and delivers automated setup advice.',
      nodeCount: 5,
      tags: ['Manual/Webhook', 'Async Delay', 'Email Drip', 'Variables'],
      nodes: [
        {
          id: 'c_1',
          type: 'custom',
          position: { x: 100, y: 200 },
          data: {
            label: 'User Signup Webhook',
            nodeType: 'trigger:webhook',
            category: 'trigger',
            description: 'New account registered',
            config: { authRequired: false },
          },
        },
        {
          id: 'c_2',
          type: 'custom',
          position: { x: 420, y: 200 },
          data: {
            label: 'Send Welcome Email',
            nodeType: 'action:send_email',
            category: 'action',
            description: 'Immediate greeting',
            config: { to: '{{trigger.email}}', subject: 'Welcome to FlowForge!', body: 'Glad to have you aboard.' },
          },
        },
        {
          id: 'c_3',
          type: 'custom',
          position: { x: 740, y: 200 },
          data: {
            label: 'Wait 3 Seconds',
            nodeType: 'logic:delay',
            category: 'logic',
            description: 'Paced delay',
            config: { seconds: 3 },
          },
        },
        {
          id: 'c_4',
          type: 'custom',
          position: { x: 1060, y: 200 },
          data: {
            label: 'Send Getting Started Tips',
            nodeType: 'action:send_email',
            category: 'action',
            description: 'Tutorial pointers',
            config: { to: '{{trigger.email}}', subject: '3 Pro Automation Tips', body: 'Explore our canvas.' },
          },
        },
        {
          id: 'c_5',
          type: 'custom',
          position: { x: 1380, y: 200 },
          data: {
            label: 'Record In Customers DB',
            nodeType: 'action:db_record',
            category: 'action',
            description: 'Save onboarded flag',
            config: { collection: 'customers', operation: 'insert', payload: '{\n  "onboarded": true\n}' },
          },
        },
      ],
      edges: [
        { id: 'ce_1', source: 'c_1', target: 'c_2', animated: true },
        { id: 'ce_2', source: 'c_2', target: 'c_3', animated: true },
        { id: 'ce_3', source: 'c_3', target: 'c_4', animated: true },
        { id: 'ce_4', source: 'c_4', target: 'c_5', animated: true },
      ],
    },
    {
      id: 'tmpl_lead_routing',
      title: 'Enterprise Lead Ingestion & Qualification Router',
      category: 'Sales & CRM',
      description:
        'Ingests leads from form, assigns rating tier, formats contact string, and persists record into leads table.',
      nodeCount: 4,
      tags: ['Lead Ingestion', 'String Util', 'Database Record', 'Set Variable'],
      nodes: [
        {
          id: 'l_1',
          type: 'custom',
          position: { x: 100, y: 200 },
          data: {
            label: 'Lead Form Submission',
            nodeType: 'trigger:manual',
            category: 'trigger',
            description: 'Incoming prospect',
            config: { defaultPayload: '{\n  "name": "Sarah Connor",\n  "company": "Cyberdyne Systems"\n}' },
          },
        },
        {
          id: 'l_2',
          type: 'custom',
          position: { x: 420, y: 200 },
          data: {
            label: 'Uppercase Company Name',
            nodeType: 'utility:string_util',
            category: 'utility',
            description: 'Clean formatting',
            config: { inputString: '{{trigger.company}}', operation: 'uppercase' },
          },
        },
        {
          id: 'l_3',
          type: 'custom',
          position: { x: 740, y: 200 },
          data: {
            label: 'Set Enterprise Tier',
            nodeType: 'utility:set_variable',
            category: 'utility',
            description: 'Assign priority',
            config: { variableName: 'tier', variableValue: 'Enterprise Priority' },
          },
        },
        {
          id: 'l_4',
          type: 'custom',
          position: { x: 1060, y: 200 },
          data: {
            label: 'Persist In Leads DB',
            nodeType: 'action:db_record',
            category: 'action',
            description: 'Store in collection',
            config: { collection: 'leads', operation: 'insert', payload: '{\n  "lead": "{{trigger.name}}"\n}' },
          },
        },
      ],
      edges: [
        { id: 'le_1', source: 'l_1', target: 'l_2', animated: true },
        { id: 'le_2', source: 'l_2', target: 'l_3', animated: true },
        { id: 'le_3', source: 'l_3', target: 'l_4', animated: true },
      ],
    },
  ];

  const handleClone = async (t: TemplateItem) => {
    setCloningId(t.id);
    try {
      await onCloneTemplate(t);
    } finally {
      setCloningId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full select-none">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Workflow Templates Gallery
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Deploy production-ready automation architectures with pre-configured branching, schemas, and actions.
        </p>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    {tmpl.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {tmpl.title}
                  </h3>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                  {tmpl.nodeCount} nodes
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {tmpl.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tmpl.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                1-click clone into workspace
              </span>
              <button
                onClick={() => handleClone(tmpl)}
                disabled={cloningId === tmpl.id}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {cloningId === tmpl.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Use Template</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
