import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ExtractionService } from './extraction/extraction.service';
import { PdfExtractor } from './extraction/pdf.extractor';
import { PlainTextExtractor } from './extraction/text.extractor';
import { IngestionQueue } from './ingestion.queue';
import { IngestionWorker } from './ingestion.worker';

/**
 * RAG module — architecture §5, doc 07 Weeks 3–4.
 *
 * Owns the ingestion pipeline:
 *
 *   upload → extraction → normalization → chunking → embedding → pgvector
 *
 * Retrieval lands alongside it once there is a corpus to retrieve from.
 *
 * No OcrProvider is registered: D-10 is open. `ExtractionService` takes it
 * as an optional dependency, so adding one is a provider registration here
 * and nothing else.
 */
@Module({
  imports: [AiModule],
  providers: [PdfExtractor, PlainTextExtractor, ExtractionService, IngestionQueue, IngestionWorker],
  exports: [IngestionQueue, ExtractionService],
})
export class RagModule {}
