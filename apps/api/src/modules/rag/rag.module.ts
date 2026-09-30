import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ExtractionService } from './extraction/extraction.service';
import { PdfExtractor } from './extraction/pdf.extractor';
import { PlainTextExtractor } from './extraction/text.extractor';
import { IngestionQueue } from './ingestion.queue';
import { IngestionWorker } from './ingestion.worker';
import { RagService } from './retrieval/rag.service';
import { RetrievalLog } from './retrieval/retrieval.log';
import { VectorSearch } from './retrieval/vector-search';

/**
 * RAG module — architecture §5, doc 07 Weeks 3–4.
 *
 * Owns the ingestion pipeline:
 *
 *   upload → extraction → normalization → chunking → embedding → pgvector
 *
 * and retrieval:
 *
 *   query → language detect → metadata filter → embed → vector search
 *         → rerank → top-k
 *
 * No OcrProvider is registered: D-10 is open. `ExtractionService` takes it
 * as an optional dependency, so adding one is a provider registration here
 * and nothing else.
 */
@Module({
  imports: [AiModule],
  providers: [
    // Ingestion
    PdfExtractor,
    PlainTextExtractor,
    ExtractionService,
    IngestionQueue,
    IngestionWorker,
    // Retrieval
    VectorSearch,
    RetrievalLog,
    RagService,
  ],
  // VectorSearch is deliberately not exported: callers go through RagService,
  // which is where the pipeline order and the retrieval log are enforced.
  // Reaching past it to the raw search would skip both.
  exports: [IngestionQueue, ExtractionService, RagService, RetrievalLog],
})
export class RagModule {}
