import { FlowEdge, FlowNode, WorkflowRun } from '../../types/workflow';
import { WorkflowRunCallbacks, WorkflowRunner } from './runner';

export interface QueueJob {
  id: string;
  runId: string;
  workflowId: string;
  versionId: string;
  workflowName: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  triggerPayload: any;
  triggerType: string;
  workspaceId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  runner?: WorkflowRunner;
  abortController?: AbortController;
}

export interface QueueMetrics {
  activeCount: number;
  waitingCount: number;
  completedCount: number;
  failedCount: number;
  totalProcessed: number;
}

export class ExecutionQueue {
  private waitingQueue: QueueJob[] = [];
  private activeJobs: Map<string, QueueJob> = new Map();
  private completedCount = 0;
  private failedCount = 0;
  private totalProcessed = 0;
  private concurrencyLimit = 5;
  private isProcessing = false;

  private dbStore: {
    executeOperation: (collection: string, operation: string, payload: any) => Promise<any>;
  };
  private emailService: {
    send: (to: string, subject: string, body: string) => Promise<{ id: string; status: 'delivered' | 'failed' }>;
  };
  private getCallbacks: (runId: string) => WorkflowRunCallbacks;

  constructor(options: {
    concurrency?: number;
    dbStore: {
      executeOperation: (collection: string, operation: string, payload: any) => Promise<any>;
    };
    emailService: {
      send: (to: string, subject: string, body: string) => Promise<{ id: string; status: 'delivered' | 'failed' }>;
    };
    getCallbacks: (runId: string) => WorkflowRunCallbacks;
  }) {
    this.concurrencyLimit = options.concurrency || 5;
    this.dbStore = options.dbStore;
    this.emailService = options.emailService;
    this.getCallbacks = options.getCallbacks;
  }

  public enqueue(job: Omit<QueueJob, 'id' | 'createdAt' | 'status'>): QueueJob {
    const fullJob: QueueJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'queued',
      abortController: new AbortController(),
    };

    this.waitingQueue.push(fullJob);
    this.processNext();
    return fullJob;
  }

  public cancel(runId: string): boolean {
    // Check if in active jobs
    const active = this.activeJobs.get(runId);
    if (active) {
      active.status = 'cancelled';
      active.runner?.cancel();
      active.abortController?.abort();
      return true;
    }

    // Check if in waiting queue
    const waitingIdx = this.waitingQueue.findIndex((j) => j.runId === runId);
    if (waitingIdx >= 0) {
      const job = this.waitingQueue.splice(waitingIdx, 1)[0];
      job.status = 'cancelled';
      return true;
    }

    return false;
  }

  public getMetrics(): QueueMetrics {
    return {
      activeCount: this.activeJobs.size,
      waitingCount: this.waitingQueue.length,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      totalProcessed: this.totalProcessed,
    };
  }

  private async processNext() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.activeJobs.size < this.concurrencyLimit && this.waitingQueue.length > 0) {
        const job = this.waitingQueue.shift()!;
        job.status = 'processing';
        job.startedAt = new Date().toISOString();
        this.activeJobs.set(job.runId, job);

        // Fire execution asynchronously without blocking the loop
        this.executeJob(job).catch((err) => {
          console.error(`[Queue Error] Job ${job.id} failed uncaught:`, err);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: QueueJob) {
    const run: WorkflowRun = {
      id: job.runId,
      workspaceId: job.workspaceId,
      workflowId: job.workflowId,
      workflowName: job.workflowName,
      versionId: job.versionId,
      triggerType: job.triggerType,
      triggerPayload: job.triggerPayload,
      status: 'QUEUED',
      startedAt: new Date().toISOString(),
      nodeExecutions: [],
      logs: [],
    };

    const callbacks = this.getCallbacks(job.runId);

    const runner = new WorkflowRunner({
      run,
      nodes: job.nodes,
      edges: job.edges,
      callbacks,
      abortController: job.abortController,
      dbStore: this.dbStore,
      emailService: this.emailService,
    });

    job.runner = runner;

    try {
      const finalRun = await runner.execute();
      this.totalProcessed++;
      if (finalRun.status === 'SUCCEEDED') {
        this.completedCount++;
        job.status = 'completed';
      } else if (finalRun.status === 'CANCELLED') {
        job.status = 'cancelled';
      } else {
        this.failedCount++;
        job.status = 'failed';
      }
      job.completedAt = new Date().toISOString();
    } catch (err: any) {
      this.failedCount++;
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      console.error(`[Queue] Job execution threw:`, err);
    } finally {
      this.activeJobs.delete(job.runId);
      // Trigger next job in queue if waiting
      this.processNext();
    }
  }
}
