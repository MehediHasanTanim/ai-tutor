import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import configuration from '../../config/configuration';

export const INGESTION_QUEUE = 'document-ingestion';

export interface IngestionJob {
  documentId: string;
  /** True when re-processing an already-ingested document. */
  reprocess: boolean;
}

export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  reachable: boolean;
}

/**
 * The document-processing queue — doc 07 Weeks 3–4.
 *
 * Ingestion is slow (PDF extraction, then one embedding call per chunk) and
 * must survive a restart, which rules out doing it inline in the upload
 * request. BullMQ on the Redis that already backs refresh tokens and quotas.
 */
@Injectable()
export class IngestionQueue implements OnModuleDestroy {
  private readonly logger = new Logger(IngestionQueue.name);
  private readonly connection: IORedis;
  private readonly queue: Queue<IngestionJob>;
  private readonly events: QueueEvents;

  constructor(
    @Inject(configuration.KEY)
    config: ConfigType<typeof configuration>,
  ) {
    // BullMQ requires maxRetriesPerRequest: null on its connection; the
    // shared RedisService sets a finite value for the request path, so the
    // queue gets its own.
    this.connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });

    this.queue = new Queue<IngestionJob>(INGESTION_QUEUE, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        // Keep recent history for the admin panel, discard the long tail.
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });

    this.events = new QueueEvents(INGESTION_QUEUE, { connection: this.connection.duplicate() });
    this.events.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`Ingestion job ${jobId} failed: ${failedReason}`);
    });
  }

  /**
   * Enqueues a document.
   *
   * The job id is the document id, so enqueueing twice is a no-op rather than
   * two workers racing to chunk the same file — the idempotency doc 07 asks
   * for, enforced at the queue rather than left to the worker.
   */
  async enqueue(job: IngestionJob): Promise<void> {
    await this.queue.add(INGESTION_QUEUE, job, { jobId: job.documentId });
    this.logger.log(`Queued document ${job.documentId}`);
  }

  /** Removes a completed or failed job so the same document can be requeued. */
  async forget(documentId: string): Promise<void> {
    const existing = await this.queue.getJob(documentId);
    await existing?.remove();
  }

  async counts(): Promise<QueueCounts> {
    try {
      const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed');
      return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        reachable: true,
      };
    } catch (error) {
      // A dead Redis must not fail the status endpoint — the endpoint's job
      // is to report that, and zeros with `reachable: false` say it plainly.
      this.logger.warn(`Queue counts unavailable: ${String(error)}`);
      return { waiting: 0, active: 0, completed: 0, failed: 0, reachable: false };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.events.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
