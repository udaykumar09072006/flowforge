import { PrismaClient, WorkflowStatus, WorkspaceRole, ExecutionStatus, NodeExecutionStatus } from '@prisma/client';
import crypto from 'crypto';
import { encryptSecret } from '../src/db/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding FlowForge production database...');

  // 1. Create Users
  const user1 = await prisma.user.upsert({
    where: { email: 'alex@flowforge.dev' },
    update: {},
    create: {
      name: 'Alex Rivera',
      email: 'alex@flowforge.dev',
      passwordHash: crypto.createHash('sha256').update('SuperSecret123!').digest('hex'),
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'sarah.c@flowforge.dev' },
    update: {},
    create: {
      name: 'Sarah Chen',
      email: 'sarah.c@flowforge.dev',
      passwordHash: crypto.createHash('sha256').update('SuperSecret123!').digest('hex'),
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'devon@flowforge.dev' },
    update: {},
    create: {
      name: 'Devon Patel',
      email: 'devon@flowforge.dev',
      passwordHash: crypto.createHash('sha256').update('SuperSecret123!').digest('hex'),
    },
  });

  const user4 = await prisma.user.upsert({
    where: { email: 'maya@flowforge.dev' },
    update: {},
    create: {
      name: 'Maya Lin',
      email: 'maya@flowforge.dev',
      passwordHash: crypto.createHash('sha256').update('SuperSecret123!').digest('hex'),
    },
  });

  console.log('Created Users:', [user1.name, user2.name, user3.name, user4.name]);

  // 2. Create Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'flowforge-core' },
    update: {},
    create: {
      name: 'FlowForge Core Workspace',
      slug: 'flowforge-core',
      ownerId: user1.id,
    },
  });

  // 3. Create Workspace Members
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user1.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user1.id, role: WorkspaceRole.OWNER },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user2.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user2.id, role: WorkspaceRole.ADMIN },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user3.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user3.id, role: WorkspaceRole.EDITOR },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user4.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user4.id, role: WorkspaceRole.VIEWER },
  });

  console.log('Created Workspace and RBAC memberships.');

  // 4. Create Workflow 1: High-Value E-Commerce Order Router
  const wf1 = await prisma.workflow.create({
    data: {
      workspaceId: workspace.id,
      name: 'High-Value E-Commerce Order Router',
      description: 'Ingests order webhooks, checks if amount exceeds ₹5,000 threshold, dispatches priority VIP alerts, and stores order details.',
      status: WorkflowStatus.PUBLISHED,
      createdById: user1.id,
    },
  });

  const wf1Graph = {
    schemaVersion: 1,
    nodes: [
      {
        id: 'node_trigger',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: {
          label: 'Order Webhook',
          nodeType: 'trigger:webhook',
          category: 'trigger',
          description: 'Receives new incoming customer orders via HTTP POST',
          config: { authRequired: false },
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
            mapping: JSON.stringify({ orderId: '{{trigger.orderId}}', amount: '{{trigger.amount}}' }),
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
          config: { field: '{{trigger.amount}}', operator: 'gt', value: '5000' },
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
          config: { to: 'vip-sales@company.com', subject: '🚨 VIP Order Alert', body: 'High value order.' },
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
          description: 'Save order payload into database',
          config: { collection: 'orders', operation: 'insert' },
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'node_trigger', target: 'node_validate' },
      { id: 'e2', source: 'node_validate', target: 'node_check_value' },
      { id: 'e3_t', source: 'node_check_value', target: 'node_high_value_alert', sourceHandle: 'true' },
      { id: 'e3_f', source: 'node_check_value', target: 'node_save_order', sourceHandle: 'false' },
    ],
  };

  const wf1Version = await prisma.workflowVersion.create({
    data: {
      workflowId: wf1.id,
      versionNumber: 1,
      graphDefinition: wf1Graph as any,
      schemaVersion: 1,
      isPublished: true,
      publishedAt: new Date(),
      createdById: user1.id,
    },
  });

  await prisma.workflow.update({
    where: { id: wf1.id },
    data: { latestPublishedVersionId: wf1Version.id },
  });

  // Webhook for Workflow 1
  const secretHash = crypto.createHash('sha256').update('wh_secret_ord_demo_token').digest('hex');
  await prisma.webhookEndpoint.create({
    data: {
      workflowId: wf1.id,
      endpointPath: 'orders-live',
      secretHash,
      allowedMethods: 'POST',
      rateLimitPerMinute: 60,
    },
  });

  // 5. Create a Historical Workflow Run
  const run1 = await prisma.workflowRun.create({
    data: {
      workflowId: wf1.id,
      workflowVersionId: wf1Version.id,
      triggeredById: user1.id,
      triggerType: 'webhook',
      status: ExecutionStatus.SUCCEEDED,
      triggerPayload: { orderId: 'ORD-9844', amount: 14999, customerName: 'Kavita Rao' },
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 3600000 + 380),
      durationMs: 380,
    },
  });

  // Node Executions for Run 1
  await prisma.nodeExecution.createMany({
    data: [
      {
        workflowRunId: run1.id,
        nodeId: 'node_trigger',
        nodeType: 'trigger:webhook',
        status: NodeExecutionStatus.SUCCEEDED,
        attemptNumber: 1,
        durationMs: 10,
        outputData: { orderId: 'ORD-9844', amount: 14999 },
      },
      {
        workflowRunId: run1.id,
        nodeId: 'node_validate',
        nodeType: 'utility:transform',
        status: NodeExecutionStatus.SUCCEEDED,
        attemptNumber: 1,
        durationMs: 15,
        outputData: { orderId: 'ORD-9844', amount: 14999 },
      },
      {
        workflowRunId: run1.id,
        nodeId: 'node_check_value',
        nodeType: 'logic:condition',
        status: NodeExecutionStatus.SUCCEEDED,
        attemptNumber: 1,
        durationMs: 5,
        outputData: { passed: true, branch: 'true' },
      },
      {
        workflowRunId: run1.id,
        nodeId: 'node_high_value_alert',
        nodeType: 'action:send_email',
        status: NodeExecutionStatus.SUCCEEDED,
        attemptNumber: 1,
        durationMs: 120,
        outputData: { status: 'delivered', recipient: 'vip-sales@company.com' },
      },
      {
        workflowRunId: run1.id,
        nodeId: 'node_save_order',
        nodeType: 'action:db_record',
        status: NodeExecutionStatus.SUCCEEDED,
        attemptNumber: 1,
        durationMs: 80,
        outputData: { recordId: 'rec_orders_9844' },
      },
    ],
  });

  // 6. Create Integration Credential with AES-256-GCM encryption
  const encryptedSmtp = encryptSecret({
    host: 'smtp.mailgun.org',
    port: 587,
    username: 'postmaster@mg.flowforge.dev',
    password: 'SuperSecretApiKey123!',
  });

  await prisma.integrationCredential.create({
    data: {
      workspaceId: workspace.id,
      provider: 'smtp',
      displayName: 'Production Mailgun Relay',
      encryptedSecret: encryptedSmtp,
      keyVersion: 1,
      status: 'ACTIVE',
      createdById: user1.id,
    },
  });

  // 7. Audit Log
  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorUserId: user1.id,
      action: 'WORKFLOW_PUBLISHED',
      resourceType: 'Workflow',
      resourceId: wf1.id,
      safeMetadata: { name: wf1.name, version: 1 },
    },
  });

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
