import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { IngestionQueue } from './ingestion.queue';
import { IngestionWorker } from './ingestion.worker';

/**
 * RAG module — architecture §5, doc 07 Weeks 3–4.
 *
 * Owns the ingestion pipeline. Retrieval (`RagService`) lands alongside it
 * once there is a corpus to retrieve from; the queue and worker come first
 * because nothing can be retrieved until something is ingested.
 */
@Module({
  imports: [AiModule],
  providers: [IngestionQueue, IngestionWorker],
  exports: [IngestionQueue],
})
export class RagModule {}
