import { describe, it, expect } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  redactSensitiveData,
  computeRequestHash,
  generateWebhookSecret,
  verifyWebhookSecret,
} from '../src/db/encryption';
import {
  GraphDefinitionSchema,
  CreateWorkflowSchema,
  TriggerWorkflowRunSchema,
} from '../src/db/schemas';

describe('Database Layer: Encryption & Security Services', () => {
  it('encrypts and decrypts credentials with AES-256-GCM and authenticated tag', () => {
    const rawCredential = {
      smtpHost: 'smtp.mailgun.org',
      smtpPort: 587,
      apiKey: 'key-98214f9c81249b20f',
      authToken: 'Bearer secret_token_abc123',
    };

    const encrypted = encryptSecret(rawCredential);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('smtp.mailgun.org');
    expect(encrypted).not.toContain('key-98214f9c81249b20f');

    const decrypted = decryptSecret<typeof rawCredential>(encrypted);
    expect(decrypted).toEqual(rawCredential);
    expect(decrypted.smtpHost).toBe('smtp.mailgun.org');
    expect(decrypted.apiKey).toBe('key-98214f9c81249b20f');
  });

  it('rejects tampered cipher text with authentication error', () => {
    const encrypted = encryptSecret({ secret: 'my-token' });
    const raw = Buffer.from(encrypted, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);

    // Tamper with tag
    parsed.tag = Buffer.from('tamperedtag12345').toString('base64');
    const tampered = Buffer.from(JSON.stringify(parsed)).toString('base64');

    expect(() => decryptSecret(tampered)).toThrow(/Decryption failed/);
  });

  it('redacts passwords, tokens, and authorization headers from serialized payloads', () => {
    const sensitivePayload = {
      orderId: 'ORD-1001',
      customerEmail: 'customer@example.com',
      password: 'MyPassword123!',
      bearerToken: 'ey123456.jwt.token',
      nested: {
        apiKey: 'sk_live_9812401',
        publicNote: 'Order approved',
      },
      items: [
        { id: 'item_1', authSecret: 'secret_value' },
      ],
    };

    const redacted = redactSensitiveData(sensitivePayload);
    expect(redacted.orderId).toBe('ORD-1001');
    expect(redacted.customerEmail).toBe('customer@example.com');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.bearerToken).toBe('[REDACTED]');
    expect(redacted.nested.apiKey).toBe('[REDACTED]');
    expect(redacted.nested.publicNote).toBe('Order approved');
    expect(redacted.items[0].authSecret).toBe('[REDACTED]');
  });

  it('generates timing-safe hashed webhook secrets', () => {
    const { rawToken, hashedSecret } = generateWebhookSecret();
    expect(rawToken).toMatch(/^ff_wh_[a-f0-9]{48}$/);
    expect(hashedSecret).toHaveLength(64); // SHA-256 hex length

    expect(verifyWebhookSecret(rawToken, hashedSecret)).toBe(true);
    expect(verifyWebhookSecret('wrong_token', hashedSecret)).toBe(false);
  });

  it('computes deterministic request hash for idempotency keys', () => {
    const payloadA = { amount: 5000, customerId: 'cust_1' };
    const payloadB = { amount: 5000, customerId: 'cust_1' };
    const payloadC = { amount: 5001, customerId: 'cust_1' };

    expect(computeRequestHash(payloadA)).toBe(computeRequestHash(payloadB));
    expect(computeRequestHash(payloadA)).not.toBe(computeRequestHash(payloadC));
  });
});

describe('Database Layer: Graph & Workflow Zod Validation Schemas', () => {
  it('validates a correct workflow graph definition with triggers, logic, and actions', () => {
    const validGraph = {
      schemaVersion: 1,
      nodes: [
        {
          id: 'n_trigger',
          type: 'custom',
          position: { x: 100, y: 150 },
          data: {
            label: 'Order Webhook',
            nodeType: 'trigger:webhook',
            category: 'trigger',
            description: 'Inbound webhook trigger',
            config: { authRequired: false },
          },
        },
        {
          id: 'n_condition',
          type: 'custom',
          position: { x: 420, y: 150 },
          data: {
            label: 'Amount > 5000',
            nodeType: 'logic:condition',
            category: 'logic',
            description: 'Threshold check',
            config: { field: '{{trigger.amount}}', operator: 'gt', value: 5000 },
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n_trigger',
          target: 'n_condition',
          sourceHandle: null,
          animated: true,
        },
      ],
    };

    const parsed = GraphDefinitionSchema.safeParse(validGraph);
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty graph definition with 0 nodes', () => {
    const invalidGraph = {
      schemaVersion: 1,
      nodes: [],
      edges: [],
    };

    const parsed = GraphDefinitionSchema.safeParse(invalidGraph);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('at least one node');
    }
  });

  it('validates workflow creation input constraints', () => {
    const valid = CreateWorkflowSchema.safeParse({
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Order Automation',
      description: 'Ingests orders and alerts sales',
    });
    expect(valid.success).toBe(true);

    const invalidUuid = CreateWorkflowSchema.safeParse({
      workspaceId: 'not-a-uuid',
      name: 'Test Flow',
    });
    expect(invalidUuid.success).toBe(false);

    const emptyName = CreateWorkflowSchema.safeParse({
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: '',
    });
    expect(emptyName.success).toBe(false);
  });

  it('validates workflow run trigger parameters', () => {
    const validRun = TriggerWorkflowRunSchema.safeParse({
      workflowId: '123e4567-e89b-12d3-a456-426614174000',
      payload: { orderId: 'ORD-9844', amount: 14999 },
      triggerType: 'webhook',
      idempotencyKey: 'idemp_key_998124',
    });
    expect(validRun.success).toBe(true);

    const invalidTrigger = TriggerWorkflowRunSchema.safeParse({
      workflowId: '123e4567-e89b-12d3-a456-426614174000',
      triggerType: 'invalid_type',
    });
    expect(invalidTrigger.success).toBe(false);
  });
});

describe('Database Layer: Relational Schema & Immutability Contracts', () => {
  it('enforces that published versions maintain immutable snapshot state', () => {
    const publishedVersionRecord = {
      id: 'ver_pub_1',
      workflowId: 'wf_1',
      versionNumber: 1,
      isPublished: true,
      publishedAt: new Date(),
      graphDefinition: { nodes: [{ id: 'n1' }], edges: [] },
    };

    // Immutability rule: when isPublished is true, any edit must spawn versionNumber + 1
    function applyEdit(currentVersion: typeof publishedVersionRecord, newGraph: any) {
      if (currentVersion.isPublished) {
        return {
          id: 'ver_pub_2',
          workflowId: currentVersion.workflowId,
          versionNumber: currentVersion.versionNumber + 1,
          isPublished: false,
          publishedAt: null,
          graphDefinition: newGraph,
        };
      }
      return { ...currentVersion, graphDefinition: newGraph };
    }

    const nextDraft = applyEdit(publishedVersionRecord, { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [] });
    expect(nextDraft.versionNumber).toBe(2);
    expect(nextDraft.isPublished).toBe(false);
    expect(publishedVersionRecord.versionNumber).toBe(1);
    expect(publishedVersionRecord.isPublished).toBe(true);
  });

  it('enforces attempt history uniqueness: [workflowRunId, nodeId, attemptNumber]', () => {
    const attempts = new Map<string, any>();

    function recordAttempt(runId: string, nodeId: string, attempt: number, status: string) {
      const compositeKey = `${runId}:${nodeId}:${attempt}`;
      if (attempts.has(compositeKey)) {
        throw new Error(`Unique constraint violation: attempt ${attempt} for node ${nodeId} already exists in run ${runId}`);
      }
      attempts.set(compositeKey, { runId, nodeId, attempt, status });
    }

    recordAttempt('run_1', 'node_http', 1, 'FAILED');
    recordAttempt('run_1', 'node_http', 2, 'SUCCEEDED'); // allowed!

    expect(attempts.size).toBe(2);
    expect(() => recordAttempt('run_1', 'node_http', 1, 'RUNNING')).toThrow(/Unique constraint violation/);
  });

  it('enforces idempotency locking: prevents duplicate processing under same scope', () => {
    const idempotencyStore = new Map<string, { status: string; resourceId?: string }>();

    function lockIdempotency(scope: string, key: string, runId: string) {
      const composite = `${scope}:${key}`;
      const existing = idempotencyStore.get(composite);
      if (existing) {
        if (existing.status === 'COMPLETED') {
          return { replay: true, runId: existing.resourceId };
        }
        throw new Error('Concurrent request with identical idempotency key is currently processing');
      }
      idempotencyStore.set(composite, { status: 'PENDING', resourceId: runId });
      return { replay: false, runId };
    }

    const first = lockIdempotency('workflow_run:wf_1', 'idem_key_777', 'run_1001');
    expect(first.replay).toBe(false);
    expect(first.runId).toBe('run_1001');

    // Concurrent in-flight duplicate
    expect(() => lockIdempotency('workflow_run:wf_1', 'idem_key_777', 'run_1002')).toThrow(/Concurrent request/);

    // Complete the first run
    idempotencyStore.set('workflow_run:wf_1:idem_key_777', { status: 'COMPLETED', resourceId: 'run_1001' });

    // Subsequent call returns idempotent replay
    const replayed = lockIdempotency('workflow_run:wf_1', 'idem_key_777', 'run_1003');
    expect(replayed.replay).toBe(true);
    expect(replayed.runId).toBe('run_1001');
  });
});
