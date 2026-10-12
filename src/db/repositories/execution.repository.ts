import { ExecutionStatus, NodeExecutionStatus, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../client';
import { computeRequestHash, redactSensitiveData } from '../encryption';

export class ExecutionRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Starts a new workflow execution run with optional idempotency enforcement
   */
  async createRun(params: {
    workflowId: string;
    versionId?: string; // If not provided, uses latest published version
    triggeredById?: string;
    triggerType: string;
    payload?: any;
    idempotencyKey?: string;
  }) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: params.workflowId },
      include: {
        versions: {
          where: params.versionId ? { id: params.versionId } : { isPublished: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!workflow) throw new Error('Workflow not found');

    const targetVersion = workflow.versions[0];
    if (!targetVersion) {
      throw new Error('No executable version found for workflow. Publish the workflow first.');
    }

    const sanitizedPayload = redactSensitiveData(params.payload || {});

    // Idempotency check if key provided
    if (params.idempotencyKey) {
      const scope = `workflow_run:${workflow.id}`;
      const requestHash = computeRequestHash(params.payload);

      return this.prisma.$transaction(async (tx) => {
        const existingRecord = await tx.idempotencyRecord.findUnique({
          where: {
            scope_idempotencyKey: { scope, idempotencyKey: params.idempotencyKey! },
          },
        });

        if (existingRecord) {
          if (existingRecord.status === 'COMPLETED' && existingRecord.resourceId) {
            // Return existing completed run
            const existingRun = await tx.workflowRun.findUnique({
              where: { id: existingRecord.resourceId },
              include: { nodeExecutions: true },
            });
            return { run: existingRun, isIdempotentReplay: true };
          }
          if (existingRecord.status === 'PENDING') {
            throw new Error('Concurrent request with identical idempotency key is currently processing.');
          }
        }

        // Create new Run
        const run = await tx.workflowRun.create({
          data: {
            workflowId: workflow.id,
            workflowVersionId: targetVersion.id,
            triggeredById: params.triggeredById,
            triggerType: params.triggerType,
            status: ExecutionStatus.QUEUED,
            idempotencyKey: params.idempotencyKey,
            triggerPayload: sanitizedPayload as any,
          },
        });

        // Record Idempotency Record
        await tx.idempotencyRecord.create({
          data: {
            scope,
            idempotencyKey: params.idempotencyKey!,
            requestHash,
            status: 'PENDING',
            resourceId: run.id,
            expiresAt: new Date(Date.now() + 86400000), // 24h expiration
          },
        });

        // Emit outbox event
        await tx.outboxEvent.create({
          data: {
            eventType: 'WORKFLOW_RUN_QUEUED',
            aggregateType: 'WorkflowRun',
            aggregateId: run.id,
            payload: {
              runId: run.id,
              workflowId: workflow.id,
              versionId: targetVersion.id,
              triggerType: params.triggerType,
            },
          },
        });

        return { run, isIdempotentReplay: false };
      });
    }

    // Standard run creation without idempotency key
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.workflowRun.create({
        data: {
          workflowId: workflow.id,
          workflowVersionId: targetVersion.id,
          triggeredById: params.triggeredById,
          triggerType: params.triggerType,
          status: ExecutionStatus.QUEUED,
          triggerPayload: sanitizedPayload as any,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'WORKFLOW_RUN_QUEUED',
          aggregateType: 'WorkflowRun',
          aggregateId: run.id,
          payload: {
            runId: run.id,
            workflowId: workflow.id,
            versionId: targetVersion.id,
            triggerType: params.triggerType,
          },
        },
      });

      return { run, isIdempotentReplay: false };
    });
  }

  /**
   * Records or updates a node execution attempt
   */
  async recordNodeExecution(params: {
    runId: string;
    nodeId: string;
    nodeType: string;
    attemptNumber?: number;
    status: NodeExecutionStatus;
    inputData?: any;
    outputData?: any;
    errorCode?: string;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
  }) {
    const attempt = params.attemptNumber || 1;
    const sanitizedInputs = redactSensitiveData(params.inputData);
    const sanitizedOutputs = redactSensitiveData(params.outputData);

    return this.prisma.nodeExecution.upsert({
      where: {
        workflowRunId_nodeId_attemptNumber: {
          workflowRunId: params.runId,
          nodeId: params.nodeId,
          attemptNumber: attempt,
        },
      },
      create: {
        workflowRunId: params.runId,
        nodeId: params.nodeId,
        nodeType: params.nodeType,
        attemptNumber: attempt,
        status: params.status,
        inputData: sanitizedInputs as any,
        outputData: sanitizedOutputs as any,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        startedAt: params.startedAt || new Date(),
        completedAt: params.completedAt,
        durationMs: params.durationMs,
      },
      update: {
        status: params.status,
        outputData: sanitizedOutputs as any,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        completedAt: params.completedAt || new Date(),
        durationMs: params.durationMs,
      },
    });
  }

  /**
   * Finalizes workflow run status and completes associated idempotency record
   */
  async finalizeRun(params: {
    runId: string;
    status: ExecutionStatus;
    errorSummary?: string;
    completedAt?: Date;
    durationMs?: number;
  }) {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: params.runId },
    });
    if (!run) throw new Error('Run not found');

    return this.prisma.$transaction(async (tx) => {
      const updatedRun = await tx.workflowRun.update({
        where: { id: params.runId },
        data: {
          status: params.status,
          errorSummary: params.errorSummary,
          completedAt: params.completedAt || new Date(),
          durationMs: params.durationMs,
        },
      });

      // If run had an idempotency key, mark idempotency record COMPLETED
      if (run.idempotencyKey) {
        const scope = `workflow_run:${run.workflowId}`;
        await tx.idempotencyRecord.updateMany({
          where: { scope, idempotencyKey: run.idempotencyKey },
          data: {
            status: params.status === 'SUCCEEDED' ? 'COMPLETED' : 'FAILED',
            responseData: { status: params.status, errorSummary: params.errorSummary } as any,
          },
        });
      }

      return updatedRun;
    });
  }

  /**
   * Queries paginated runs for a workflow or workspace
   */
  async getRuns(params: {
    workflowId?: string;
    status?: ExecutionStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.workflowId) where.workflowId = params.workflowId;
    if (params.status) where.status = params.status;

    const [total, runs] = await Promise.all([
      this.prisma.workflowRun.count({ where }),
      this.prisma.workflowRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          workflowId: true,
          workflowVersionId: true,
          triggerType: true,
          status: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          errorSummary: true,
          createdAt: true,
          workflow: { select: { name: true } },
          _count: { select: { nodeExecutions: true } },
        },
      }),
    ]);

    return {
      runs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
