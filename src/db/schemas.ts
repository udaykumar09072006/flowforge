import { z } from 'zod';

// -------------------------------------------------------------
// WORKFLOW GRAPH DEFINITION SCHEMAS
// -------------------------------------------------------------

export const FlowNodeDataSchema = z.object({
  label: z.string().min(1, 'Node label is required').max(100),
  nodeType: z.string().min(1, 'Node type is required'),
  category: z.enum(['trigger', 'logic', 'action', 'utility']),
  description: z.string().optional().default(''),
  config: z.record(z.string(), z.any()).default({}),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED']).optional(),
  executionDuration: z.number().nonnegative().optional(),
  errorMessage: z.string().optional(),
}).passthrough();

export const FlowNodeSchema = z.object({
  id: z.string().min(1, 'Node id is required'),
  type: z.string().default('custom'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: FlowNodeDataSchema,
});

export const FlowEdgeSchema = z.object({
  id: z.string().min(1, 'Edge id is required'),
  source: z.string().min(1, 'Source node id is required'),
  target: z.string().min(1, 'Target node id is required'),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
});

export const GraphDefinitionSchema = z.object({
  schemaVersion: z.number().int().positive().default(1),
  nodes: z.array(FlowNodeSchema).min(1, 'Graph must contain at least one node'),
  edges: z.array(FlowEdgeSchema).default([]),
  viewport: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    zoom: z.number().default(1),
  }).optional(),
});

export type GraphDefinition = z.infer<typeof GraphDefinitionSchema>;

// -------------------------------------------------------------
// WORKFLOW CRUD & PUBLISHING SCHEMAS
// -------------------------------------------------------------

export const CreateWorkflowSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace UUID'),
  name: z.string().trim().min(1, 'Workflow name is required').max(120),
  description: z.string().trim().max(1000).optional(),
});

export const UpdateWorkflowDraftSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  graphDefinition: GraphDefinitionSchema.optional(),
});

export const PublishWorkflowSchema = z.object({
  notes: z.string().trim().max(500).optional().default('Production release'),
  graphDefinition: GraphDefinitionSchema.optional(), // if publishing directly with latest edits
});

// -------------------------------------------------------------
// EXECUTION & RUN SCHEMAS
// -------------------------------------------------------------

export const TriggerWorkflowRunSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow UUID'),
  payload: z.record(z.string(), z.any()).default({}),
  triggerType: z.enum(['manual', 'webhook', 'schedule', 'api']).default('manual'),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export const RecordNodeAttemptSchema = z.object({
  nodeId: z.string().min(1),
  nodeType: z.string().min(1),
  attemptNumber: z.number().int().positive().default(1),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED']),
  inputData: z.any().optional(),
  outputData: z.any().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

// -------------------------------------------------------------
// INTEGRATION CREDENTIALS & WEBHOOK SCHEMAS
// -------------------------------------------------------------

export const CreateCredentialSchema = z.object({
  workspaceId: z.string().uuid(),
  provider: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  secretData: z.record(z.string(), z.any()), // Raw secret object to be encrypted
});

export const CreateWebhookEndpointSchema = z.object({
  workflowId: z.string().uuid(),
  endpointPath: z.string().min(3).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'Must be alphanumeric with hyphens or underscores'),
  allowedMethods: z.string().default('POST'),
  rateLimitPerMinute: z.number().int().positive().max(1000).default(60),
});

// -------------------------------------------------------------
// IDEMPOTENCY & OUTBOX SCHEMAS
// -------------------------------------------------------------

export const IdempotencyCheckSchema = z.object({
  scope: z.string().min(1),
  idempotencyKey: z.string().min(1),
  requestPayload: z.any(),
  ttlSeconds: z.number().int().positive().default(86400), // 24 hours
});

export const OutboxEventSchema = z.object({
  eventType: z.string().min(1),
  aggregateType: z.string().min(1),
  aggregateId: z.string().min(1),
  payload: z.record(z.string(), z.any()),
});

// -------------------------------------------------------------
// AUTHENTICATION SCHEMAS
// -------------------------------------------------------------

export const SignUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(/[A-Za-z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(/[A-Za-z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

