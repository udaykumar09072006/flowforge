-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT');
CREATE TYPE "NodeExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable sessions
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable workspaces
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable workspace_members
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable workflows
CREATE TABLE "workflows" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "currentDraftVersionId" UUID,
    "latestPublishedVersionId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable workflow_versions
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflowId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "graphDefinition" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable workflow_runs
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflowId" UUID NOT NULL,
    "workflowVersionId" UUID NOT NULL,
    "triggeredById" UUID,
    "triggerType" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT,
    "triggerPayload" JSONB,
    "errorSummary" TEXT,
    "retryOfRunId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable node_executions
CREATE TABLE "node_executions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflowRunId" UUID NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "NodeExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "inputData" JSONB,
    "outputData" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable webhook_endpoints
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflowId" UUID NOT NULL,
    "endpointPath" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allowedMethods" TEXT NOT NULL DEFAULT 'POST',
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable schedules
CREATE TABLE "schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflowId" UUID NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable integration_credentials
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspaceId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspaceId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "safeMetadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable idempotency_records
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "responseData" JSONB,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable outbox_events
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

CREATE INDEX "workflows_workspaceId_idx" ON "workflows"("workspaceId");
CREATE INDEX "workflows_createdById_idx" ON "workflows"("createdById");
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

CREATE UNIQUE INDEX "workflow_versions_workflowId_versionNumber_key" ON "workflow_versions"("workflowId", "versionNumber");
CREATE INDEX "workflow_versions_workflowId_idx" ON "workflow_versions"("workflowId");
CREATE INDEX "workflow_versions_workflowId_isPublished_idx" ON "workflow_versions"("workflowId", "isPublished");

CREATE INDEX "workflow_runs_workflowId_createdAt_idx" ON "workflow_runs"("workflowId", "createdAt" DESC);
CREATE INDEX "workflow_runs_workflowVersionId_idx" ON "workflow_runs"("workflowVersionId");
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");
CREATE INDEX "workflow_runs_idempotencyKey_idx" ON "workflow_runs"("idempotencyKey");

CREATE UNIQUE INDEX "node_executions_workflowRunId_nodeId_attemptNumber_key" ON "node_executions"("workflowRunId", "nodeId", "attemptNumber");
CREATE INDEX "node_executions_workflowRunId_nodeId_idx" ON "node_executions"("workflowRunId", "nodeId");
CREATE INDEX "node_executions_status_idx" ON "node_executions"("status");

CREATE UNIQUE INDEX "webhook_endpoints_workflowId_key" ON "webhook_endpoints"("workflowId");
CREATE UNIQUE INDEX "webhook_endpoints_endpointPath_key" ON "webhook_endpoints"("endpointPath");
CREATE INDEX "webhook_endpoints_endpointPath_idx" ON "webhook_endpoints"("endpointPath");

CREATE INDEX "schedules_workflowId_idx" ON "schedules"("workflowId");
CREATE INDEX "schedules_status_nextRunAt_idx" ON "schedules"("status", "nextRunAt");

CREATE INDEX "integration_credentials_workspaceId_idx" ON "integration_credentials"("workspaceId");

CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt" DESC);
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_sessionToken_idx" ON "sessions"("sessionToken");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

CREATE UNIQUE INDEX "idempotency_records_scope_idempotencyKey_key" ON "idempotency_records"("scope", "idempotencyKey");
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

CREATE INDEX "outbox_events_processedAt_createdAt_idx" ON "outbox_events"("processedAt", "createdAt");

-- Foreign Keys
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "node_executions" ADD CONSTRAINT "node_executions_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedules" ADD CONSTRAINT "schedules_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
