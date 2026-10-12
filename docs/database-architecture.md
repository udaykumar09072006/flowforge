# FlowForge Database Architecture & Relational Engineering

FlowForge uses PostgreSQL as its primary authoritative relational data store with Prisma ORM for type-safe schema modeling, migrations, and queries.

---

## 1. Entity-Relationship Overview

```
 [User] 1 ───────────< [WorkspaceMember] >─────────── 1 [Workspace]
   │                           │                             │
   │ (creates)                 │                             │ (owns)
   ▼                           ▼                             ▼
 [Workflow] 1 ───────────────────────────────────────< [Workspace]
   │
   ├─────── 1 ───< [WorkflowVersion] (Immutable when published)
   │                      │
   │                      │ 1 (pinned version)
   │                      ▼
   ├─────── 1 ───< [WorkflowRun] 1 ─────< [NodeExecution] (Attempt history)
   │                      │
   ├─────── 1 ─── 1 [WebhookEndpoint]
   │
   └─────── 1 ───< [Schedule]

 [Workspace] 1 ───< [IntegrationCredential] (AES-256-GCM Encrypted)
 [Workspace] 1 ───< [AuditLog] (Scrubbed Security Audit Trail)

 [IdempotencyRecord] (Durable Scope & Key Locking)
 [OutboxEvent]       (Transactional Outbox for Asynchronous Queues)
```

---

## 2. Core Models and Constraints

### User & Workspace Isolation
- **`users`**: UUID primary key, unique email, hashed password. Never stores plaintext secrets.
- **`workspaces`**: Logical tenant boundary. Every workflow, execution, credential, and audit log belongs to an explicit `workspaceId`.
- **`workspace_members`**: Join model between `workspaces` and `users` enforcing role-based access control (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`). Unique constraint `[workspaceId, userId]` prevents duplicate memberships.

### Workflow & Version Immutability
- **`workflows`**: Represents the automation entity. Holds workspace ownership, name, description, status (`DRAFT`, `PUBLISHED`, `ARCHIVED`), and pointer references:
  - `currentDraftVersionId`: Points to the active editable draft.
  - `latestPublishedVersionId`: Points to the latest active published release.
- **`workflow_versions`**:
  - Contains the validated JSON graph definition (`nodes`, `edges`, configurations).
  - Unique constraint: `@@unique([workflowId, versionNumber])`.
  - **Immutability Contract**: When `isPublished: true`, the record is locked against modifications. Edits never mutate a published version; instead, they operate on a draft version with an incremented version number.
  - **Resolution of Circular FKs**: `workflow_versions.workflowId` holds a standard `ON DELETE CASCADE` foreign key referencing `workflows.id`. The reverse pointers on `workflows` (`currentDraftVersionId`, `latestPublishedVersionId`) avoid hard circular constraints by storing UUID references managed atomically inside repository transactions.

### Execution Engine & History
- **`workflow_runs`**:
  - Every run is strictly pinned to a specific immutable `workflowVersionId`.
  - Status transitions: `QUEUED` -> `RUNNING` -> `SUCCEEDED` / `FAILED` / `CANCELLED` / `TIMED_OUT`.
  - Holds `triggerPayload` with sensitive fields redacted before storage.
  - Indexed by `[workflowId, createdAt(desc)]` for fast history timeline pagination.
- **`node_executions`**:
  - Preserves per-attempt execution history: `@@unique([workflowRunId, nodeId, attemptNumber])`.
  - Stores input and output snapshots, duration, error codes, and failure diagnostics.
  - Enables query of latest attempt as well as inspection of retry sequences.

### Triggers: Webhooks & Schedules
- **`webhook_endpoints`**:
  - Generates secure random endpoint paths.
  - Stores `secretHash` (SHA-256 / HMAC) rather than plaintext secrets.
  - Verifies signatures with timing-safe comparison to prevent timing attacks.
  - Tracks `callCount` and `lastTriggeredAt`.
- **`schedules`**:
  - Stores cron expression, timezone, and computed `nextRunAt`.
  - Coordinated via database transactions to prevent duplicate dispatches upon worker restarts.

---

## 3. Reliability & Distributed System Models

### Durable Idempotency (`idempotency_records`)
- Enforces at-most-once processing for external webhook and manual run dispatches.
- Unique constraint: `@@unique([scope, idempotencyKey])`.
- Computes SHA-256 request payload hash. Concurrent identical requests encounter database constraint locks and are prevented from starting duplicate runs.
- Includes `expiresAt` with index for automated TTL cleanup.

### Transactional Outbox (`outbox_events`)
- Solves the dual-write problem between PostgreSQL and Redis / BullMQ.
- In the same database transaction that creates a `WorkflowRun` or publishes a `WorkflowVersion`, an `OutboxEvent` record is inserted atomically.
- An asynchronous dispatcher (`OutboxDispatcher`) polls unprocessed events and dispatches them to BullMQ with exponential backoff retry on transient failures.

---

## 4. Encryption & Redaction Architecture

### AES-256-GCM Credential Encryption
- Credentials stored in `integration_credentials.encryptedSecret` are encrypted using **AES-256-GCM** authenticated cipher.
- Derived encryption key is generated via **PBKDF2** (100,000 iterations, SHA-256) with a unique 64-byte random salt per credential.
- Ciphertext format includes base64-encoded initialization vector (IV), salt, and GCM authentication tag.
- Decryption validates tag authenticity to prevent ciphertext tampering.

### Field Redaction
- `redactSensitiveData()` recursively sanitizes payloads before writing to `workflow_runs.triggerPayload`, `node_executions.inputData`, `node_executions.outputData`, and `audit_logs.safeMetadata`.
- Scrub patterns match passwords, API keys, tokens, authorization headers, and certificates.
- Credentials listed in API responses use strict DTO projections omitting `encryptedSecret`.

---

## 5. PostgreSQL Indexing Strategy

| Table | Index Columns | Purpose |
|---|---|---|
| `users` | `email` (UNIQUE) | Fast authentication lookup |
| `workspaces` | `slug` (UNIQUE) | Workspace URL resolution |
| `workspace_members` | `[workspaceId, userId]` (UNIQUE) | Fast RBAC access checks |
| `workflows` | `[workspaceId]`, `[status]` | Workspace workflow listings |
| `workflow_versions` | `[workflowId, versionNumber]` (UNIQUE) | Strict version sequencing |
| `workflow_runs` | `[workflowId, createdAt DESC]` | Chronological runs timeline & cursor pagination |
| `workflow_runs` | `[status]`, `[idempotencyKey]` | Queue status polling & duplicate checks |
| `node_executions` | `[workflowRunId, nodeId, attemptNumber]` (UNIQUE) | Attempt uniqueness |
| `idempotency_records` | `[scope, idempotencyKey]` (UNIQUE) | Atomic idempotency lock |
| `outbox_events` | `[processedAt, createdAt]` | Fast pending outbox polling |
