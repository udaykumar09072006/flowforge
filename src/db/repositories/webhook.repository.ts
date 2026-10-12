import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../client';
import { generateWebhookSecret, verifyWebhookSecret } from '../encryption';

export class WebhookRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  /**
   * Creates or rotates a secure WebhookEndpoint for a workflow
   */
  async createOrRotateWebhook(params: {
    workflowId: string;
    endpointPath: string;
    userId: string;
    rateLimitPerMinute?: number;
  }) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });
    if (!workflow) throw new Error('Workflow not found');

    const { rawToken, hashedSecret } = generateWebhookSecret();

    return this.prisma.$transaction(async (tx) => {
      const endpoint = await tx.webhookEndpoint.upsert({
        where: { workflowId: params.workflowId },
        create: {
          workflowId: params.workflowId,
          endpointPath: params.endpointPath,
          secretHash: hashedSecret,
          rateLimitPerMinute: params.rateLimitPerMinute || 60,
          status: 'ACTIVE',
        },
        update: {
          endpointPath: params.endpointPath,
          secretHash: hashedSecret,
          rateLimitPerMinute: params.rateLimitPerMinute || 60,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: workflow.workspaceId,
          actorUserId: params.userId,
          action: 'WEBHOOK_CONFIGURED',
          resourceType: 'WebhookEndpoint',
          resourceId: endpoint.id,
          safeMetadata: {
            endpointPath: params.endpointPath,
            rateLimit: endpoint.rateLimitPerMinute,
          },
        },
      });

      // Returns rawToken ONCE to the caller for initial setup
      return {
        id: endpoint.id,
        endpointPath: endpoint.endpointPath,
        rawSecretToken: rawToken, // displayed once to user
        rateLimitPerMinute: endpoint.rateLimitPerMinute,
        status: endpoint.status,
      };
    });
  }

  /**
   * Verifies an incoming webhook request and increments trigger counters
   */
  async verifyAndRecordWebhookTrigger(params: {
    endpointPath: string;
    secretToken?: string;
  }) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { endpointPath: params.endpointPath },
      include: { workflow: true },
    });

    if (!endpoint) throw new Error('Webhook endpoint not found');
    if (endpoint.status !== 'ACTIVE') throw new Error('Webhook endpoint is revoked or inactive');

    // If endpoint requires token authentication
    if (params.secretToken) {
      const isValid = verifyWebhookSecret(params.secretToken, endpoint.secretHash);
      if (!isValid) throw new Error('Invalid webhook authorization token');
    }

    // Increment call count atomically
    await this.prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: {
        callCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    return endpoint.workflow;
  }
}
