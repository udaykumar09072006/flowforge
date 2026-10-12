import {
  AuditLog,
  DatabaseRecord,
  DispatchedEmail,
  FlowNode,
  ScheduleTrigger,
  WebhookEndpoint,
  Workflow,
  WorkflowRun,
  WorkflowVersion,
} from '../types/workflow';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
}

/**
 * In-Memory & File Persistent Store for FlowForge
 */
export class DataStore {
  public users: Map<string, StoredUser> = new Map();
  public sessions: Map<string, StoredSession> = new Map();

  public workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
    members: Array<{ id: string; name: string; email: string; role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' }>;
  }> = [];

  public workflows: Map<string, Workflow> = new Map();
  public versions: Map<string, WorkflowVersion[]> = new Map(); // workflowId -> versions
  public runs: Map<string, WorkflowRun> = new Map();
  public webhooks: Map<string, WebhookEndpoint> = new Map();
  public schedules: Map<string, ScheduleTrigger> = new Map();
  public dbRecords: Map<string, DatabaseRecord[]> = new Map(); // collection -> records
  public emails: DispatchedEmail[] = [];
  public auditLogs: AuditLog[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 0. Seed Users with secure bcrypt password hash (Password123!)
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

    const alex: StoredUser = {
      id: 'usr_1',
      name: 'Alex Rivera',
      email: 'alex@flowforge.dev',
      passwordHash: defaultPasswordHash,
      emailVerified: true,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const sarah: StoredUser = {
      id: 'usr_2',
      name: 'Sarah Chen',
      email: 'sarah.c@flowforge.dev',
      passwordHash: defaultPasswordHash,
      emailVerified: true,
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const devon: StoredUser = {
      id: 'usr_3',
      name: 'Devon Patel',
      email: 'devon@flowforge.dev',
      passwordHash: defaultPasswordHash,
      emailVerified: true,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const maya: StoredUser = {
      id: 'usr_4',
      name: 'Maya Lin',
      email: 'maya@flowforge.dev',
      passwordHash: defaultPasswordHash,
      emailVerified: true,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(alex.id, alex);
    this.users.set(sarah.id, sarah);
    this.users.set(devon.id, devon);
    this.users.set(maya.id, maya);

    // Initial session for Alex Rivera so dev experience is instantly ready
    const initialSessionToken = 'session_dev_alex_rivera_token_secure_flowforge';
    this.sessions.set(initialSessionToken, {
      id: 'sess_1',
      userId: alex.id,
      sessionToken: initialSessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: 'FlowForge-App/1.0',
      createdAt: new Date().toISOString(),
    });

    // 1. Workspace
    this.workspaces.push({
      id: 'ws_default',
      name: 'FlowForge Core Workspace',
      slug: 'flowforge-core',
      plan: 'Enterprise Automation',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      members: [
        { id: 'usr_1', name: 'Alex Rivera (You)', email: 'alex@flowforge.dev', role: 'OWNER' },
        { id: 'usr_2', name: 'Sarah Chen', email: 'sarah.c@flowforge.dev', role: 'ADMIN' },
        { id: 'usr_3', name: 'Devon Patel', email: 'devon@flowforge.dev', role: 'EDITOR' },
        { id: 'usr_4', name: 'Maya Lin', email: 'maya@flowforge.dev', role: 'VIEWER' },
      ],
    });

    // 2. Sample Workflow 1: E-Commerce High-Value Order Processing (From prompt specs)
    const wf1Id = 'wf_order_pipeline';
    const wf1WebhookId = 'wh_orders_live';

    const wf1Nodes: FlowNode[] = [
      {
        id: 'node_trigger',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          label: 'Order Webhook',
          nodeType: 'trigger:webhook',
          category: 'trigger',
          description: 'Receives new incoming customer orders via HTTP POST',
          config: {
            authRequired: false,
            expectedContentType: 'application/json',
          },
        },
      },
      {
        id: 'node_validate',
        type: 'custom',
        position: { x: 420, y: 200 },
        data: {
          label: 'Validate & Parse Order',
          nodeType: 'utility:transform',
          category: 'utility',
          description: 'Extracts customer details, items count, and order sum',
          config: {
            mapping: JSON.stringify(
              {
                orderId: '{{trigger.orderId}}',
                customerName: '{{trigger.customerName}}',
                customerEmail: '{{trigger.customerEmail}}',
                amount: '{{trigger.amount}}',
                itemCount: '{{trigger.items.length}}',
              },
              null,
              2
            ),
          },
        },
      },
      {
        id: 'node_check_value',
        type: 'custom',
        position: { x: 740, y: 200 },
        data: {
          label: 'Check Amount > ₹5,000',
          nodeType: 'logic:condition',
          category: 'logic',
          description: 'Branch based on whether the order amount exceeds ₹5,000 threshold',
          config: {
            field: '{{trigger.amount}}',
            operator: 'gt',
            value: '5000',
          },
        },
      },
      {
        id: 'node_high_value_alert',
        type: 'custom',
        position: { x: 1100, y: 80 },
        data: {
          label: 'Send VIP Order Alert',
          nodeType: 'action:send_email',
          category: 'action',
          description: 'Notify sales manager of a priority high-value purchase',
          config: {
            to: 'vip-sales@company.com',
            subject: '🚨 HIGH-VALUE ORDER ALERT: ₹{{trigger.amount}} from {{trigger.customerName}}',
            body: 'Priority alert: A high-value order #{{trigger.orderId}} of ₹{{trigger.amount}} has been placed by {{trigger.customerName}} ({{trigger.customerEmail}}). Immediate fulfillment review advised.',
          },
        },
      },
      {
        id: 'node_save_order',
        type: 'custom',
        position: { x: 1100, y: 320 },
        data: {
          label: 'Persist Order Record',
          nodeType: 'action:db_record',
          category: 'action',
          description: 'Save order payload into internal database "orders" collection',
          config: {
            collection: 'orders',
            operation: 'insert',
            payload: JSON.stringify(
              {
                orderId: '{{trigger.orderId}}',
                customer: '{{trigger.customerName}}',
                email: '{{trigger.customerEmail}}',
                amount: '{{trigger.amount}}',
                status: 'CONFIRMED',
                processedAt: '{{run.startedAt}}',
              },
              null,
              2
            ),
          },
        },
      },
      {
        id: 'node_merge_paths',
        type: 'custom',
        position: { x: 1440, y: 200 },
        data: {
          label: 'Merge & Log Audit',
          nodeType: 'action:log',
          category: 'action',
          description: 'Records structured completion message for telemetry',
          config: {
            level: 'info',
            message: 'Order #{{trigger.orderId}} processed successfully. Amount: ₹{{trigger.amount}}',
          },
        },
      },
    ];

    const wf1Edges = [
      { id: 'e1', source: 'node_trigger', target: 'node_validate', animated: true },
      { id: 'e2', source: 'node_validate', target: 'node_check_value', animated: true },
      { id: 'e3_true', source: 'node_check_value', target: 'node_high_value_alert', sourceHandle: 'true', label: 'True (> ₹5k)' },
      { id: 'e3_false', source: 'node_check_value', target: 'node_save_order', sourceHandle: 'false', label: 'False (≤ ₹5k)' },
      { id: 'e4', source: 'node_high_value_alert', target: 'node_save_order', animated: true },
      { id: 'e5', source: 'node_save_order', target: 'node_merge_paths', animated: true },
    ];

    const wf1: Workflow = {
      id: wf1Id,
      workspaceId: 'ws_default',
      name: 'High-Value E-Commerce Order Router',
      description: 'Ingests order webhooks, checks if amount exceeds ₹5,000 threshold, dispatches priority alerts, and records order in PostgreSQL.',
      status: 'published',
      version: 1,
      publishedVersionId: 'v1_wf_order_pipeline',
      nodes: wf1Nodes,
      edges: wf1Edges,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      lastRunStatus: 'SUCCEEDED',
      lastRunAt: new Date(Date.now() - 3600000).toISOString(),
      runCount: 14,
      webhookEndpointId: wf1WebhookId,
    };
    this.workflows.set(wf1Id, wf1);

    // Version record for wf1
    this.versions.set(wf1Id, [
      {
        id: 'v1_wf_order_pipeline',
        workflowId: wf1Id,
        versionNumber: 1,
        nodes: JSON.parse(JSON.stringify(wf1Nodes)),
        edges: JSON.parse(JSON.stringify(wf1Edges)),
        publishedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        publishedBy: 'Alex Rivera',
        notes: 'Initial production publication with threshold ₹5,000 VIP routing.',
      },
    ]);

    // Webhook record for wf1
    this.webhooks.set(wf1WebhookId, {
      id: wf1WebhookId,
      workflowId: wf1Id,
      name: 'Order Ingestion Endpoint',
      token: 'sec_wh_ord_9f82d1c7a',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      lastTriggeredAt: new Date(Date.now() - 3600000).toISOString(),
      callCount: 14,
    });

    // Sample Workflow 2: API Uptime & Health Monitor with Notification
    const wf2Id = 'wf_uptime_monitor';
    const wf2Nodes: FlowNode[] = [
      {
        id: 'n_sched',
        type: 'custom',
        position: { x: 100, y: 180 },
        data: {
          label: 'Every 5 Minutes',
          nodeType: 'trigger:schedule',
          category: 'trigger',
          description: 'Triggers recurring health probes every 5 minutes',
          config: { cronExpression: '*/5 * * * *', timezone: 'UTC' },
        },
      },
      {
        id: 'n_probe',
        type: 'custom',
        position: { x: 420, y: 180 },
        data: {
          label: 'Ping API Health Check',
          nodeType: 'action:http_request',
          category: 'action',
          description: 'Sends GET ping to service status endpoint',
          config: {
            method: 'GET',
            url: 'https://httpbin.org/status/200',
            timeoutSeconds: 5,
          },
        },
      },
      {
        id: 'n_check_status',
        type: 'custom',
        position: { x: 740, y: 180 },
        data: {
          label: 'Status == 200?',
          nodeType: 'logic:condition',
          category: 'logic',
          description: 'Verifies HTTP 200 OK return code',
          config: {
            field: '{{nodes.n_probe.output.status}}',
            operator: 'eq',
            value: '200',
          },
        },
      },
      {
        id: 'n_log_healthy',
        type: 'custom',
        position: { x: 1060, y: 90 },
        data: {
          label: 'Log Healthy Heartbeat',
          nodeType: 'action:log',
          category: 'action',
          description: 'Emits healthy status beacon',
          config: {
            level: 'info',
            message: 'Service is healthy: Response 200 in {{nodes.n_probe.output.durationMs}}ms',
          },
        },
      },
      {
        id: 'n_alert_down',
        type: 'custom',
        position: { x: 1060, y: 280 },
        data: {
          label: 'Notify Incident Team',
          nodeType: 'action:send_email',
          category: 'action',
          description: 'Escalates service disruption alert',
          config: {
            to: 'oncall-devops@company.com',
            subject: '⚠️ Production Health Check Failed: Status {{nodes.n_probe.output.status}}',
            body: 'Service ping failed with status {{nodes.n_probe.output.status}}. Immediate intervention required.',
          },
        },
      },
    ];

    const wf2Edges = [
      { id: 'w2_e1', source: 'n_sched', target: 'n_probe', animated: true },
      { id: 'w2_e2', source: 'n_probe', target: 'n_check_status', animated: true },
      { id: 'w2_e3_t', source: 'n_check_status', target: 'n_log_healthy', sourceHandle: 'true', label: 'Healthy (200)' },
      { id: 'w2_e3_f', source: 'n_check_status', target: 'n_alert_down', sourceHandle: 'false', label: 'Degraded / Error' },
    ];

    const wf2: Workflow = {
      id: wf2Id,
      workspaceId: 'ws_default',
      name: 'API Health Probe & Failover Notifier',
      description: 'Scheduled monitor polling service endpoints every 5 minutes and firing instant alerts on degradation.',
      status: 'published',
      version: 1,
      publishedVersionId: 'v1_wf_uptime_monitor',
      nodes: wf2Nodes,
      edges: wf2Edges,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      lastRunStatus: 'SUCCEEDED',
      lastRunAt: new Date(Date.now() - 300000).toISOString(),
      runCount: 88,
    };
    this.workflows.set(wf2Id, wf2);

    this.versions.set(wf2Id, [
      {
        id: 'v1_wf_uptime_monitor',
        workflowId: wf2Id,
        versionNumber: 1,
        nodes: JSON.parse(JSON.stringify(wf2Nodes)),
        edges: JSON.parse(JSON.stringify(wf2Edges)),
        publishedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
        publishedBy: 'Sarah Chen',
        notes: 'Initial publication for production uptime monitor',
      },
    ]);

    // Sample Workflow 3: Lead Ingestion & Qualification Pipeline (Draft)
    const wf3Id = 'wf_lead_qualifier';
    const wf3Nodes: FlowNode[] = [
      {
        id: 'n_lead_wh',
        type: 'custom',
        position: { x: 100, y: 150 },
        data: {
          label: 'Website Lead Form',
          nodeType: 'trigger:manual',
          category: 'trigger',
          description: 'Triggered when a lead submits the signup form',
          config: {
            defaultPayload: JSON.stringify(
              {
                leadName: 'Rohan Sharma',
                company: 'TechCorp India',
                email: 'rohan@techcorp.in',
                employees: 250,
                interest: 'Enterprise Plan',
              },
              null,
              2
            ),
          },
        },
      },
      {
        id: 'n_lead_var',
        type: 'custom',
        position: { x: 420, y: 150 },
        data: {
          label: 'Set Tier Variable',
          nodeType: 'utility:set_variable',
          category: 'utility',
          description: 'Calculates lead tier rating',
          config: {
            variableName: 'leadRating',
            variableValue: 'Tier-1 Enterprise',
          },
        },
      },
      {
        id: 'n_lead_save',
        type: 'custom',
        position: { x: 740, y: 150 },
        data: {
          label: 'Store in Leads DB',
          nodeType: 'action:db_record',
          category: 'action',
          description: 'Records lead in customer database table',
          config: {
            collection: 'leads',
            operation: 'insert',
            payload: JSON.stringify(
              {
                name: '{{trigger.leadName}}',
                company: '{{trigger.company}}',
                email: '{{trigger.email}}',
                size: '{{trigger.employees}}',
                rating: '{{variables.leadRating}}',
              },
              null,
              2
            ),
          },
        },
      },
    ];

    const wf3Edges = [
      { id: 'w3_e1', source: 'n_lead_wh', target: 'n_lead_var', animated: true },
      { id: 'w3_e2', source: 'n_lead_var', target: 'n_lead_save', animated: true },
    ];

    const wf3: Workflow = {
      id: wf3Id,
      workspaceId: 'ws_default',
      name: 'Lead Qualification & CRM Ingestion',
      description: 'Parses incoming business leads, assigns tier classifications, and registers them in the company repository.',
      status: 'draft',
      version: 1,
      nodes: wf3Nodes,
      edges: wf3Edges,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      lastRunStatus: null,
      lastRunAt: null,
      runCount: 0,
    };
    this.workflows.set(wf3Id, wf3);

    // Pre-populate Database collection "orders"
    this.dbRecords.set('orders', [
      {
        id: 'ord_1001',
        collection: 'orders',
        data: {
          orderId: 'ORD-9842',
          customer: 'Priya Sundaram',
          email: 'priya.s@example.com',
          amount: 7450,
          status: 'CONFIRMED',
          tier: 'VIP',
        },
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'ord_1002',
        collection: 'orders',
        data: {
          orderId: 'ORD-9843',
          customer: 'Aarav Mehta',
          email: 'aarav@example.com',
          amount: 2300,
          status: 'CONFIRMED',
          tier: 'Standard',
        },
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 'ord_1003',
        collection: 'orders',
        data: {
          orderId: 'ORD-9844',
          customer: 'Kavita Rao',
          email: 'kavita@techsol.co',
          amount: 14999,
          status: 'CONFIRMED',
          tier: 'VIP',
        },
        createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
    ]);

    // Pre-populate Leads collection
    this.dbRecords.set('leads', [
      {
        id: 'lead_1',
        collection: 'leads',
        data: {
          name: 'Vikram Joshi',
          company: 'Acme Cloud Inc',
          email: 'vikram@acmecloud.in',
          size: 500,
          rating: 'Tier-1 Enterprise',
        },
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ]);

    // Pre-populate Outbox emails
    this.emails.push({
      id: 'eml_1',
      workflowId: wf1Id,
      to: 'vip-sales@company.com',
      subject: '🚨 HIGH-VALUE ORDER ALERT: ₹14999 from Kavita Rao',
      body: 'Priority alert: A high-value order #ORD-9844 of ₹14999 has been placed by Kavita Rao (kavita@techsol.co). Immediate fulfillment review advised.',
      sentAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      status: 'delivered',
    });

    // Pre-populate Initial Execution Runs
    const pastRun1: WorkflowRun = {
      id: 'run_order_prior_vip',
      workspaceId: 'ws_default',
      workflowId: wf1Id,
      workflowName: 'High-Value E-Commerce Order Router',
      versionId: 'v1_wf_order_pipeline',
      triggerType: 'webhook',
      triggerPayload: {
        orderId: 'ORD-9844',
        customerName: 'Kavita Rao',
        customerEmail: 'kavita@techsol.co',
        amount: 14999,
        items: [{ id: 'prod_1', name: 'Enterprise License', price: 14999 }],
      },
      status: 'SUCCEEDED',
      startedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      completedAt: new Date(Date.now() - 3 * 3600000 + 420).toISOString(),
      durationMs: 420,
      nodeExecutions: [
        {
          id: 'ne_1',
          runId: 'run_order_prior_vip',
          nodeId: 'node_trigger',
          nodeLabel: 'Order Webhook',
          nodeType: 'trigger:webhook',
          attempt: 1,
          status: 'SUCCEEDED',
          durationMs: 12,
          outputSnapshot: { orderId: 'ORD-9844', amount: 14999 },
        },
        {
          id: 'ne_2',
          runId: 'run_order_prior_vip',
          nodeId: 'node_validate',
          nodeLabel: 'Validate & Parse Order',
          nodeType: 'utility:transform',
          attempt: 1,
          status: 'SUCCEEDED',
          durationMs: 24,
          outputSnapshot: { orderId: 'ORD-9844', amount: 14999, customerName: 'Kavita Rao' },
        },
        {
          id: 'ne_3',
          runId: 'run_order_prior_vip',
          nodeId: 'node_check_value',
          nodeLabel: 'Check Amount > ₹5,000',
          nodeType: 'logic:condition',
          attempt: 1,
          status: 'SUCCEEDED',
          durationMs: 8,
          outputSnapshot: { fieldValue: 14999, comparisonValue: 5000, passed: true, branch: 'true' },
        },
        {
          id: 'ne_4',
          runId: 'run_order_prior_vip',
          nodeId: 'node_high_value_alert',
          nodeLabel: 'Send VIP Order Alert',
          nodeType: 'action:send_email',
          attempt: 1,
          status: 'SUCCEEDED',
          durationMs: 145,
          outputSnapshot: { deliveredAt: new Date().toISOString(), recipient: 'vip-sales@company.com' },
        },
        {
          id: 'ne_5',
          runId: 'run_order_prior_vip',
          nodeId: 'node_save_order',
          nodeLabel: 'Persist Order Record',
          nodeType: 'action:db_record',
          attempt: 1,
          status: 'SUCCEEDED',
          durationMs: 110,
          outputSnapshot: { collection: 'orders', operation: 'insert' },
        },
        {
          id: 'ne_6',
          runId: 'run_order_prior_vip',
          nodeId: 'node_merge_paths',
          nodeLabel: 'Merge & Log Audit',
          nodeType: 'action:log',
          attempt: 1,
          status: 'SUCCEEDED',
          durationMs: 15,
          outputSnapshot: { loggedAt: new Date().toISOString() },
        },
      ],
      logs: [
        { timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), level: 'info', message: 'Workflow run started.' },
        { timestamp: new Date(Date.now() - 3 * 3600000 + 40).toISOString(), level: 'info', message: 'Order Webhook received payload for ORD-9844.' },
        { timestamp: new Date(Date.now() - 3 * 3600000 + 80).toISOString(), level: 'info', message: 'Evaluated condition: 14999 > 5000 -> True. Routing to VIP alert.' },
        { timestamp: new Date(Date.now() - 3 * 3600000 + 225).toISOString(), level: 'info', message: 'Dispatched VIP email notification to vip-sales@company.com.' },
        { timestamp: new Date(Date.now() - 3 * 3600000 + 335).toISOString(), level: 'info', message: 'Order ORD-9844 inserted into database collection "orders".' },
        { timestamp: new Date(Date.now() - 3 * 3600000 + 420).toISOString(), level: 'info', message: 'Workflow completed successfully.' },
      ],
    };
    this.runs.set(pastRun1.id, pastRun1);

    // Audit logs
    this.auditLogs.push(
      {
        id: 'aud_1',
        workspaceId: 'ws_default',
        actor: 'Alex Rivera',
        action: 'WORKFLOW_PUBLISHED',
        resourceType: 'workflow',
        resourceId: wf1Id,
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
        metadata: { version: 1, name: wf1.name },
      },
      {
        id: 'aud_2',
        workspaceId: 'ws_default',
        actor: 'Sarah Chen',
        action: 'WORKFLOW_PUBLISHED',
        resourceType: 'workflow',
        resourceId: wf2Id,
        timestamp: new Date(Date.now() - 14 * 86400000).toISOString(),
        metadata: { version: 1, name: wf2.name },
      }
    );
  }

  // --- DB Operations for action:db_record ---
  public async executeDbOperation(collection: string, operation: string, payload: any): Promise<any> {
    if (!this.dbRecords.has(collection)) {
      this.dbRecords.set(collection, []);
    }
    const list = this.dbRecords.get(collection)!;

    switch (operation) {
      case 'insert': {
        const record: DatabaseRecord = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          collection,
          data: payload || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        list.unshift(record);
        return record;
      }
      case 'findMany': {
        return list.slice(0, 50);
      }
      case 'findOne': {
        if (payload?.id) {
          return list.find((r) => r.id === payload.id) || null;
        }
        return list[0] || null;
      }
      case 'delete': {
        if (payload?.id) {
          const idx = list.findIndex((r) => r.id === payload.id);
          if (idx >= 0) {
            return list.splice(idx, 1)[0];
          }
        }
        return { deleted: false };
      }
      case 'update': {
        if (payload?.id) {
          const rec = list.find((r) => r.id === payload.id);
          if (rec) {
            rec.data = { ...rec.data, ...payload.data };
            rec.updatedAt = new Date().toISOString();
            return rec;
          }
        }
        return null;
      }
      default:
        return { status: 'unsupported_operation', operation };
    }
  }

  // --- Email Service for action:send_email ---
  public async sendEmail(to: string, subject: string, body: string, runId?: string, workflowId?: string) {
    const emailRecord: DispatchedEmail = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      runId,
      workflowId,
      to,
      subject,
      body,
      sentAt: new Date().toISOString(),
      status: 'delivered',
    };
    this.emails.unshift(emailRecord);
    return emailRecord;
  }

  // --- Auth & Session Methods ---
  public findUserByEmail(email: string): StoredUser | null {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  public findUserById(id: string): StoredUser | null {
    return this.users.get(id) || null;
  }

  public createUser(params: {
    name: string;
    email: string;
    passwordHash: string;
    emailVerified?: boolean;
    emailVerificationToken?: string | null;
    emailVerificationExpires?: Date | null;
  }): StoredUser {
    const normalized = params.email.trim().toLowerCase();
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newUser: StoredUser = {
      id,
      name: params.name.trim(),
      email: normalized,
      passwordHash: params.passwordHash,
      emailVerified: params.emailVerified ?? false,
      emailVerificationToken: params.emailVerificationToken,
      emailVerificationExpires: params.emailVerificationExpires,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, newUser);

    // Auto-assign to default workspace as EDITOR
    const ws = this.workspaces[0];
    if (ws) {
      ws.members.push({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: 'EDITOR',
      });
    }

    return newUser;
  }

  public updateUser(id: string, updates: Partial<StoredUser>): StoredUser | null {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
    this.users.set(id, updated);
    return updated;
  }

  public createSession(userId: string, userAgent?: string, ipAddress?: string): StoredSession {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session: StoredSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      sessionToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent,
      ipAddress,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(sessionToken, session);
    return session;
  }

  public findSessionByToken(token: string): { session: StoredSession; user: StoredUser } | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiresAt) <= new Date()) {
      this.sessions.delete(token); // expired
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user) return null;
    return { session, user };
  }

  public revokeSession(token: string): boolean {
    return this.sessions.delete(token);
  }

  public revokeAllUserSessions(userId: string): number {
    let count = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  public setPasswordResetToken(userId: string, token: string, expiresAt: Date): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.passwordResetToken = token;
    user.passwordResetExpires = expiresAt;
    user.updatedAt = new Date().toISOString();
    return true;
  }

  public findByPasswordResetToken(token: string): StoredUser | null {
    if (!token) return null;
    for (const user of this.users.values()) {
      if (user.passwordResetToken === token) {
        if (user.passwordResetExpires && new Date(user.passwordResetExpires) > new Date()) {
          return user;
        }
      }
    }
    return null;
  }

  public resetPassword(userId: string, newPasswordHash: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.passwordHash = newPasswordHash;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.updatedAt = new Date().toISOString();
    // Revoke all existing sessions on password reset
    this.revokeAllUserSessions(userId);
    return true;
  }

  public findByEmailVerificationToken(token: string): StoredUser | null {
    if (!token) return null;
    for (const user of this.users.values()) {
      if (user.emailVerificationToken === token) {
        if (!user.emailVerificationExpires || new Date(user.emailVerificationExpires) > new Date()) {
          return user;
        }
      }
    }
    return null;
  }

  public verifyEmail(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    user.updatedAt = new Date().toISOString();
    return true;
  }

  public getWorkspaceMembership(workspaceId: string, userId: string): { role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' } | null {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return null;
    const member = ws.members.find((m) => m.id === userId);
    return member ? { role: member.role } : null;
  }
}
