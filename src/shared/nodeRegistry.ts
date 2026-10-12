import { NodeDefinition, NodeType } from '../types/workflow';

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  // --- TRIGGERS ---
  'trigger:manual': {
    type: 'trigger:manual',
    category: 'trigger',
    name: 'Manual Trigger',
    description: 'Start execution manually from the UI or via API with custom payload',
    icon: 'PlayCircle',
    defaultConfig: {
      defaultPayload: '{\n  "source": "manual_trigger",\n  "testMode": true\n}',
    },
    inputs: [],
    outputs: [{ name: 'output', label: 'Payload' }],
  },
  'trigger:webhook': {
    type: 'trigger:webhook',
    category: 'trigger',
    name: 'Webhook Trigger',
    description: 'Trigger workflow when an HTTP POST request is received on a unique URL',
    icon: 'Webhook',
    defaultConfig: {
      authRequired: false,
      secretToken: '',
      expectedContentType: 'application/json',
    },
    inputs: [],
    outputs: [{ name: 'output', label: 'Webhook Data' }],
  },
  'trigger:schedule': {
    type: 'trigger:schedule',
    category: 'trigger',
    name: 'Schedule Trigger',
    description: 'Trigger recurring workflow runs using cron expressions',
    icon: 'Clock',
    defaultConfig: {
      cronExpression: '0 9 * * 1-5', // Mon-Fri at 9 AM
      timezone: 'UTC',
    },
    inputs: [],
    outputs: [{ name: 'output', label: 'Schedule Context' }],
  },

  // --- LOGIC ---
  'logic:condition': {
    type: 'logic:condition',
    category: 'logic',
    name: 'If / Else Condition',
    description: 'Branch execution based on boolean comparisons',
    icon: 'GitFork',
    defaultConfig: {
      field: '{{trigger.amount}}',
      operator: 'gt', // eq, neq, gt, gte, lt, lte, contains, exists, boolean
      value: '5000',
    },
    inputs: [{ name: 'input', type: 'any', required: true }],
    outputs: [
      { name: 'true', label: 'True', handleId: 'true' },
      { name: 'false', label: 'False', handleId: 'false' },
    ],
  },
  'logic:switch': {
    type: 'logic:switch',
    category: 'logic',
    name: 'Switch',
    description: 'Route execution to one of multiple cases based on matching value',
    icon: 'Split',
    defaultConfig: {
      field: '{{trigger.status}}',
      cases: ['pending', 'approved', 'rejected'],
    },
    inputs: [{ name: 'input', type: 'any', required: true }],
    outputs: [
      { name: 'pending', label: 'pending', handleId: 'pending' },
      { name: 'approved', label: 'approved', handleId: 'approved' },
      { name: 'rejected', label: 'rejected', handleId: 'rejected' },
      { name: 'default', label: 'Default', handleId: 'default' },
    ],
  },
  'logic:filter': {
    type: 'logic:filter',
    category: 'logic',
    name: 'Filter',
    description: 'Halt workflow branch if conditions are not satisfied',
    icon: 'Filter',
    defaultConfig: {
      field: '{{trigger.isValid}}',
      operator: 'eq',
      value: 'true',
    },
    inputs: [{ name: 'input', type: 'any', required: true }],
    outputs: [{ name: 'output', label: 'Passed' }],
  },
  'logic:merge': {
    type: 'logic:merge',
    category: 'logic',
    name: 'Merge',
    description: 'Combine upstream branch data into a unified dictionary',
    icon: 'GitMerge',
    defaultConfig: {
      strategy: 'combine', // combine, prefer_first
    },
    inputs: [{ name: 'input', type: 'any', required: true }],
    outputs: [{ name: 'output', label: 'Merged Data' }],
  },
  'logic:delay': {
    type: 'logic:delay',
    category: 'logic',
    name: 'Delay',
    description: 'Pause workflow execution for a configured number of seconds',
    icon: 'Hourglass',
    defaultConfig: {
      seconds: 2,
    },
    inputs: [{ name: 'input', type: 'any', required: true }],
    outputs: [{ name: 'output', label: 'Resumed' }],
  },

  // --- ACTIONS ---
  'action:http_request': {
    type: 'action:http_request',
    category: 'action',
    name: 'HTTP Request',
    description: 'Make a secured HTTP request to an external API (SSRF-protected)',
    icon: 'Globe',
    defaultConfig: {
      method: 'POST',
      url: 'https://httpbin.org/post',
      headers: '{\n  "Content-Type": "application/json"\n}',
      body: '{\n  "orderId": "{{trigger.id}}",\n  "amount": "{{trigger.amount}}"\n}',
      timeoutSeconds: 10,
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'HTTP Response' }],
  },
  'action:send_email': {
    type: 'action:send_email',
    category: 'action',
    name: 'Send Email',
    description: 'Send transactional email via SMTP or FlowForge internal outbox',
    icon: 'Mail',
    defaultConfig: {
      to: '{{trigger.customerEmail}}',
      subject: 'Order Confirmation #{{trigger.orderNumber}}',
      body: 'Hello {{trigger.customerName}},\n\nYour order has been processed successfully. Amount: ₹{{trigger.amount}}.\n\nThank you for choosing us!',
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'Sent Confirmation' }],
  },
  'action:db_record': {
    type: 'action:db_record',
    category: 'action',
    name: 'Database Record',
    description: 'Insert, query, update, or delete records in FlowForge internal data tables',
    icon: 'Database',
    defaultConfig: {
      collection: 'orders',
      operation: 'insert', // insert, findOne, findMany, update, delete
      payload: '{\n  "orderId": "{{trigger.id}}",\n  "amount": "{{trigger.amount}}",\n  "status": "PROCESSED"\n}',
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'Record Result' }],
  },
  'action:log': {
    type: 'action:log',
    category: 'action',
    name: 'Log Message',
    description: 'Write a structured log entry into the execution timeline and telemetry',
    icon: 'FileText',
    defaultConfig: {
      level: 'info', // info, warn, error, debug
      message: 'Processing completed for item {{trigger.id}} with amount ₹{{trigger.amount}}',
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'Log Output' }],
  },

  // --- UTILITIES ---
  'utility:set_variable': {
    type: 'utility:set_variable',
    category: 'utility',
    name: 'Set Variable',
    description: 'Store key-value variables into workflow execution context',
    icon: 'Variable',
    defaultConfig: {
      variableName: 'discountedTotal',
      variableValue: '{{trigger.amount * 0.9}}',
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'Variables' }],
  },
  'utility:transform': {
    type: 'utility:transform',
    category: 'utility',
    name: 'Transform Data',
    description: 'Reshape and map fields from prior node outputs into custom JSON',
    icon: 'Shuffle',
    defaultConfig: {
      mapping: '{\n  "id": "{{trigger.id}}",\n  "summary": "{{trigger.title}}",\n  "processedAt": "{{nodes.date_util.output.timestamp}}"\n}',
    },
    inputs: [{ name: 'input', type: 'any', required: true }],
    outputs: [{ name: 'output', label: 'Transformed' }],
  },
  'utility:json_parse': {
    type: 'utility:json_parse',
    category: 'utility',
    name: 'JSON Parse & Validate',
    description: 'Parse raw text into structured JSON object and validate properties',
    icon: 'Code',
    defaultConfig: {
      sourceField: '{{trigger.rawPayload}}',
    },
    inputs: [{ name: 'input', type: 'any', required: true }],
    outputs: [{ name: 'output', label: 'Parsed JSON' }],
  },
  'utility:string_util': {
    type: 'utility:string_util',
    category: 'utility',
    name: 'String Utilities',
    description: 'Transform strings: uppercase, lowercase, trim, slugify, or replace',
    icon: 'Type',
    defaultConfig: {
      inputString: '{{trigger.customerName}}',
      operation: 'uppercase', // uppercase, lowercase, trim, slugify
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'Result' }],
  },
  'utility:date_util': {
    type: 'utility:date_util',
    category: 'utility',
    name: 'Date Utilities',
    description: 'Generate timestamps, format dates, and calculate day differences',
    icon: 'Calendar',
    defaultConfig: {
      operation: 'now', // now, format, addDays
      format: 'ISO',
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'Date Result' }],
  },
  'utility:generate_output': {
    type: 'utility:generate_output',
    category: 'utility',
    name: 'Generate Output',
    description: 'Declare the final workflow return value returned to caller or webhook',
    icon: 'CheckCircle',
    defaultConfig: {
      outputPayload: '{\n  "success": true,\n  "orderProcessed": true,\n  "runId": "{{run.id}}"\n}',
    },
    inputs: [{ name: 'input', type: 'any', required: false }],
    outputs: [{ name: 'output', label: 'Final Output' }],
  },
};

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  trigger: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/40 dark:border-amber-500/50',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  logic: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    border: 'border-indigo-500/40 dark:border-indigo-500/50',
    text: 'text-indigo-700 dark:text-indigo-400',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  action: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'border-blue-500/40 dark:border-blue-500/50',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  utility: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/40 dark:border-emerald-500/50',
    text: 'text-emerald-700 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};
