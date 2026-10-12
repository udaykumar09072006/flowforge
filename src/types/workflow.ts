export type NodeCategory = 'trigger' | 'logic' | 'action' | 'utility';

export type NodeType =
  // Triggers
  | 'trigger:manual'
  | 'trigger:webhook'
  | 'trigger:schedule'
  // Logic
  | 'logic:condition'
  | 'logic:switch'
  | 'logic:filter'
  | 'logic:merge'
  | 'logic:delay'
  // Actions
  | 'action:http_request'
  | 'action:send_email'
  | 'action:db_record'
  | 'action:log'
  // Utilities
  | 'utility:set_variable'
  | 'utility:transform'
  | 'utility:json_parse'
  | 'utility:string_util'
  | 'utility:date_util'
  | 'utility:generate_output';

export type ExecutionStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export type NodeExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export type UserRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface FlowNodeData {
  label: string;
  nodeType: NodeType;
  category: NodeCategory;
  description: string;
  config: Record<string, any>;
  status?: NodeExecutionStatus;
  executionDuration?: number;
  errorMessage?: string;
  [key: string]: any;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  publishedVersionId?: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
  lastRunStatus?: ExecutionStatus | null;
  lastRunAt?: string | null;
  runCount: number;
  webhookEndpointId?: string;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  versionNumber: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  publishedAt: string;
  publishedBy: string;
  notes?: string;
}

export interface NodeExecution {
  id: string;
  runId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeType;
  attempt: number;
  status: NodeExecutionStatus;
  inputSnapshot?: any;
  outputSnapshot?: any;
  errorDetails?: string | null;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface WorkflowRun {
  id: string;
  workspaceId: string;
  workflowId: string;
  workflowName: string;
  versionId: string;
  triggerType: string;
  triggerPayload: any;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorSummary?: string | null;
  output?: any;
  nodeExecutions: NodeExecution[];
  logs: { timestamp: string; level: 'info' | 'warn' | 'error' | 'debug'; message: string; nodeId?: string }[];
}

export interface WebhookEndpoint {
  id: string;
  workflowId: string;
  name: string;
  token: string;
  createdAt: string;
  lastTriggeredAt?: string | null;
  callCount: number;
}

export interface ScheduleTrigger {
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
}

export interface DatabaseRecord {
  id: string;
  collection: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchedEmail {
  id: string;
  runId?: string;
  workflowId?: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'delivered' | 'failed';
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface NodeDefinition {
  type: NodeType;
  category: NodeCategory;
  name: string;
  description: string;
  icon: string;
  defaultConfig: Record<string, any>;
  inputs: { name: string; type: string; required?: boolean }[];
  outputs: { name: string; label: string; handleId?: string }[];
}
