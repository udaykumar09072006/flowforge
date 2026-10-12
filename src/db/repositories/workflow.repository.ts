import { PrismaClient, WorkflowStatus, WorkspaceRole } from '@prisma/client';
import { prisma as defaultPrisma } from '../client';
import { GraphDefinition, GraphDefinitionSchema } from '../schemas';

export class WorkflowRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Verifies that the user has an authorized role within the workspace
   */
  async verifyWorkspaceAccess(
    workspaceId: string,
    userId: string,
    requiredRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
  ): Promise<boolean> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });

    if (!member) return false;
    return requiredRoles.includes(member.role);
  }

  /**
   * Creates a new workflow with initial draft version v1
   */
  async createWorkflow(params: {
    workspaceId: string;
    userId: string;
    name: string;
    description?: string;
    initialGraph?: GraphDefinition;
  }) {
    const hasAccess = await this.verifyWorkspaceAccess(params.workspaceId, params.userId, ['OWNER', 'ADMIN', 'EDITOR']);
    if (!hasAccess) {
      throw new Error('Unauthorized: insufficient workspace permissions to create workflows');
    }

    const defaultGraph: GraphDefinition = params.initialGraph || {
      schemaVersion: 1,
      nodes: [
        {
          id: 'node_trigger',
          type: 'custom',
          position: { x: 100, y: 200 },
          data: {
            label: 'Manual Trigger',
            nodeType: 'trigger:manual',
            category: 'trigger',
            description: 'Start execution manually or via API',
            config: { defaultPayload: '{\n  "test": true\n}' },
          },
        },
      ],
      edges: [],
    };

    // Validate graph schema
    GraphDefinitionSchema.parse(defaultGraph);

    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          workspaceId: params.workspaceId,
          name: params.name,
          description: params.description,
          status: WorkflowStatus.DRAFT,
          createdById: params.userId,
        },
      });

      const initialVersion = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: 1,
          graphDefinition: defaultGraph as any,
          schemaVersion: 1,
          isPublished: false,
          createdById: params.userId,
        },
      });

      const updatedWorkflow = await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          currentDraftVersionId: initialVersion.id,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: params.workspaceId,
          actorUserId: params.userId,
          action: 'WORKFLOW_CREATED',
          resourceType: 'Workflow',
          resourceId: workflow.id,
          safeMetadata: { name: params.name, version: 1 },
        },
      });

      return { workflow: updatedWorkflow, draftVersion: initialVersion };
    });
  }

  /**
   * Updates workflow draft definition
   */
  async updateDraft(params: {
    workflowId: string;
    userId: string;
    name?: string;
    description?: string;
    graphDefinition?: GraphDefinition;
  }) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });
    if (!workflow) throw new Error('Workflow not found');

    const hasAccess = await this.verifyWorkspaceAccess(workflow.workspaceId, params.userId, ['OWNER', 'ADMIN', 'EDITOR']);
    if (!hasAccess) throw new Error('Unauthorized: cannot modify workflow');

    if (params.graphDefinition) {
      GraphDefinitionSchema.parse(params.graphDefinition);
    }

    return this.prisma.$transaction(async (tx) => {
      // If currentDraftVersionId exists, update it; otherwise create a new draft version
      let draftVersionId = workflow.currentDraftVersionId;

      if (params.graphDefinition) {
        if (draftVersionId) {
          const existingDraft = await tx.workflowVersion.findUnique({
            where: { id: draftVersionId },
          });

          // Guard against mutating a published version
          if (existingDraft && existingDraft.isPublished) {
            draftVersionId = null; // force creating a new draft
          }
        }

        if (draftVersionId) {
          await tx.workflowVersion.update({
            where: { id: draftVersionId },
            data: {
              graphDefinition: params.graphDefinition as any,
            },
          });
        } else {
          // Get next version number
          const maxVer = await tx.workflowVersion.findFirst({
            where: { workflowId: workflow.id },
            orderBy: { versionNumber: 'desc' },
          });
          const nextVerNumber = (maxVer?.versionNumber || 0) + 1;

          const newDraft = await tx.workflowVersion.create({
            data: {
              workflowId: workflow.id,
              versionNumber: nextVerNumber,
              graphDefinition: params.graphDefinition as any,
              isPublished: false,
              createdById: params.userId,
            },
          });
          draftVersionId = newDraft.id;
        }
      }

      const updated = await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          name: params.name ?? workflow.name,
          description: params.description ?? workflow.description,
          currentDraftVersionId: draftVersionId,
        },
      });

      return updated;
    });
  }

  /**
   * Publishes an immutable workflow version
   */
  async publishWorkflow(params: {
    workflowId: string;
    userId: string;
    notes?: string;
    graphDefinition?: GraphDefinition;
  }) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: params.workflowId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!workflow) throw new Error('Workflow not found');

    const hasAccess = await this.verifyWorkspaceAccess(workflow.workspaceId, params.userId, ['OWNER', 'ADMIN']);
    if (!hasAccess) throw new Error('Unauthorized: only Owner or Admin can publish workflows');

    let graphToPublish: GraphDefinition;
    if (params.graphDefinition) {
      graphToPublish = GraphDefinitionSchema.parse(params.graphDefinition);
    } else {
      const latest = workflow.versions[0];
      if (!latest) throw new Error('No version found to publish');
      graphToPublish = latest.graphDefinition as unknown as GraphDefinition;
    }

    return this.prisma.$transaction(async (tx) => {
      const maxVer = await tx.workflowVersion.findFirst({
        where: { workflowId: workflow.id },
        orderBy: { versionNumber: 'desc' },
      });
      const nextVerNumber = (maxVer?.versionNumber || 0) + 1;

      // 1. Create immutable published version
      const publishedVersion = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: nextVerNumber,
          graphDefinition: graphToPublish as any,
          schemaVersion: 1,
          isPublished: true,
          publishedAt: new Date(),
          createdById: params.userId,
        },
      });

      // 2. Update workflow pointers
      const updatedWorkflow = await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          status: WorkflowStatus.PUBLISHED,
          latestPublishedVersionId: publishedVersion.id,
          currentDraftVersionId: null, // Draft completed and published
        },
      });

      // 3. Record AuditLog
      await tx.auditLog.create({
        data: {
          workspaceId: workflow.workspaceId,
          actorUserId: params.userId,
          action: 'WORKFLOW_PUBLISHED',
          resourceType: 'Workflow',
          resourceId: workflow.id,
          safeMetadata: {
            versionNumber: nextVerNumber,
            versionId: publishedVersion.id,
            notes: params.notes || 'Production release',
          },
        },
      });

      // 4. Transactional Outbox Event for background processing
      await tx.outboxEvent.create({
        data: {
          eventType: 'WORKFLOW_PUBLISHED',
          aggregateType: 'Workflow',
          aggregateId: workflow.id,
          payload: {
            workflowId: workflow.id,
            versionId: publishedVersion.id,
            versionNumber: nextVerNumber,
          },
        },
      });

      return { workflow: updatedWorkflow, publishedVersion };
    });
  }

  /**
   * Restores an older version by creating a new draft snapshot from it
   */
  async restoreVersion(params: {
    workflowId: string;
    versionId: string;
    userId: string;
  }) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });
    if (!workflow) throw new Error('Workflow not found');

    const hasAccess = await this.verifyWorkspaceAccess(workflow.workspaceId, params.userId, ['OWNER', 'ADMIN', 'EDITOR']);
    if (!hasAccess) throw new Error('Unauthorized');

    const targetVersion = await this.prisma.workflowVersion.findUnique({
      where: { id: params.versionId },
    });
    if (!targetVersion || targetVersion.workflowId !== workflow.id) {
      throw new Error('Version not found for this workflow');
    }

    return this.prisma.$transaction(async (tx) => {
      const maxVer = await tx.workflowVersion.findFirst({
        where: { workflowId: workflow.id },
        orderBy: { versionNumber: 'desc' },
      });
      const nextVerNumber = (maxVer?.versionNumber || 0) + 1;

      // Create new draft copy from target version (never mutate target version)
      const restoredDraft = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: nextVerNumber,
          graphDefinition: targetVersion.graphDefinition as any,
          schemaVersion: targetVersion.schemaVersion,
          isPublished: false,
          createdById: params.userId,
        },
      });

      const updatedWorkflow = await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          currentDraftVersionId: restoredDraft.id,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: workflow.workspaceId,
          actorUserId: params.userId,
          action: 'VERSION_RESTORED',
          resourceType: 'Workflow',
          resourceId: workflow.id,
          safeMetadata: {
            sourceVersionNumber: targetVersion.versionNumber,
            newDraftVersionNumber: nextVerNumber,
          },
        },
      });

      return { workflow: updatedWorkflow, draftVersion: restoredDraft };
    });
  }
}
