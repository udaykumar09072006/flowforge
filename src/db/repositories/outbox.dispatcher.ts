import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../client';

export type OutboxHandler = (event: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: any;
}) => Promise<void>;

export class OutboxDispatcher {
  private isPolling = false;
  private pollIntervalTimer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private handler?: OutboxHandler
  ) {}

  /**
   * Processes a single batch of pending outbox events
   */
  async processBatch(batchSize = 20): Promise<{ processed: number; failed: number }> {
    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: { processedAt: null, attemptCount: { lt: 5 } },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    let processed = 0;
    let failed = 0;

    for (const event of pendingEvents) {
      try {
        if (this.handler) {
          await this.handler({
            id: event.id,
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payload: event.payload,
          });
        }

        // Mark processed
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            processedAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });
        processed++;
      } catch (err: any) {
        failed++;
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            attemptCount: { increment: 1 },
            lastError: err.message,
          },
        });
      }
    }

    return { processed, failed };
  }

  /**
   * Starts background polling timer
   */
  startPolling(intervalMs = 5000) {
    if (this.isPolling) return;
    this.isPolling = true;

    this.pollIntervalTimer = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (err) {
        console.error('[Outbox Dispatcher] Polling cycle error:', err);
      }
    }, intervalMs);
  }

  /**
   * Stops polling timer
   */
  stopPolling() {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    this.isPolling = false;
  }
}
