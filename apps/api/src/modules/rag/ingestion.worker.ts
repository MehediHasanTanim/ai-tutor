import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ContentLanguage, DocumentStatus } from '@prisma/client';
import configuration from '../../config/configuration';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { AI_PROVIDER, type AIProvider } from '../ai/ai-provider.interface';
import { chunkBlocks, type Chunk, type TextBlock } from './chunking';
import { ExtractionService } from './extraction/extraction.service';
import { INGESTION_QUEUE, type IngestionJob } from './ingestion.queue';
import { EMBEDDING_DIMENSIONS } from './embedding.constants';

/**
 * Document ingestion worker — doc 07 Weeks 3–4.
 *
 *   upload → text extraction → normalization → chunking → embedding → pgvector
 *
 * Runs in-process for now. Doc 07 reserves port 4002 for a standalone worker;
 * splitting it out is a deployment change, not a code change, because
 * everything here is driven by the queue rather than by a request.
 *
 * **Idempotent and re-runnable**: re-processing deletes this document's
 * chunks inside the same transaction that writes the new ones, so a document
 * processed twice has one set of chunks, not two.
 */
@Injectable()
export class IngestionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionWorker.name);
  private readonly connection: IORedis;
  private worker?: Worker<IngestionJob>;

  constructor(
    @Inject(configuration.KEY)
    private readonly config: ConfigType<typeof configuration>,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly extraction: ExtractionService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {
    this.connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });
  }

  onModuleInit(): void {
    this.worker = new Worker<IngestionJob>(INGESTION_QUEUE, async (job) => this.process(job.data), {
      connection: this.connection,
      // Low: each job makes many embedding calls, and the provider rate
      // limit is the real constraint, not local CPU.
      concurrency: 2,
    });

    this.worker.on('failed', (job, error) => {
      void this.markFailed(job?.data.documentId, error.message);
    });

    this.logger.log('Ingestion worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection.quit();
  }

  async process(job: IngestionJob): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id: job.documentId },
      include: { subject: true },
    });

    if (!document) {
      this.logger.warn(`Document ${job.documentId} vanished before processing`);
      return;
    }

    this.logger.log(`Processing "${document.title}" (${document.id})`);

    try {
      await this.setStatus(document.id, DocumentStatus.EXTRACTING);
      const file = await this.storage.download(document.storageKey);
      const extracted = await this.extraction.extract(file, document.mimeType);

      if (extracted.pages.every((page) => page.text.trim().length === 0)) {
        // The R-02 case. Failing loudly is the point: a silently empty
        // document would sit at READY and retrieve nothing, and nobody
        // would know why the tutor had stopped citing that chapter.
        throw new Error(
          extracted.unreadablePages.length > 0
            ? `Every page lacks a text layer (${extracted.unreadablePages.length} pages). ` +
                'This is a scanned PDF and needs OCR before ingestion (doc 07 R-02).'
            : 'Extraction produced no text.',
        );
      }

      // Conjunct corruption makes text that renders as something and means
      // nothing. Refusing it here is cheaper than a student reading it.
      if (!extracted.quality.usable) {
        throw new Error(
          'Extracted Bangla failed the quality check — ' +
            `${extracted.quality.orphanedMarks} orphaned marks, ` +
            `${extracted.quality.danglingViramas} dangling viramas, ` +
            `${extracted.quality.replacementChars} replacement characters. ` +
            'The extractor mangled the conjuncts (doc 07 R-02); do not ingest this.',
        );
      }

      // Ingests, but records why a native reader should look. Doc 07's
      // Weeks 3–4 exit criteria require that spot-check; this makes the
      // documents that most need it findable in the admin panel.
      if (extracted.quality.suspicious) {
        this.logger.warn(
          `"${document.title}" extracted with warnings: ${extracted.quality.warnings.join(' ')}`,
        );
      }

      await this.setStatus(document.id, DocumentStatus.CHUNKING);

      // Pages carry their number and section forward, so a chunk can be
      // traced to a physical page in the admin inspector.
      const blocks: TextBlock[] = extracted.pages.flatMap((page) =>
        page.text
          .split(/\n{2,}/u)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph) => ({
            text: paragraph,
            pageNumber: page.pageNumber,
            section: page.section,
          })),
      );

      const chunks = chunkBlocks(blocks);

      if (chunks.length === 0) {
        throw new Error('Chunking produced no chunks from non-empty text');
      }

      await this.setStatus(document.id, DocumentStatus.EMBEDDING);
      const vectors = await this.embedChunks(chunks);

      await this.writeChunks(document, chunks, vectors);

      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.READY,
          statusDetail: buildStatusDetail(extracted),
          chunkCount: chunks.length,
          pageCount: extracted.pageCount,
          processedAt: new Date(),
        },
      });

      this.logger.log(`Ingested ${chunks.length} chunks from "${document.title}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markFailed(document.id, message);
      throw error;
    }
  }

  private async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    if (!this.ai.capabilities.embedding) {
      throw new Error(
        'No embedding provider is configured. D-11 is open — decide it with ' +
          '`pnpm --filter @ai-tutor/eval eval:embedding`, then set EMBEDDING_PROVIDER.',
      );
    }

    const vectors: number[][] = [];
    // Batched to keep request sizes sane and to avoid losing a whole
    // document's work to one rate-limit rejection.
    const batchSize = 32;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const result = await this.ai.embed({
        texts: batch.map((chunk) => chunk.content),
        inputType: 'document',
      });

      if (result.data.dimensions !== EMBEDDING_DIMENSIONS) {
        // Caught here rather than at insert, where pgvector's error names a
        // column and not the cause.
        throw new Error(
          `Embedding model returned ${result.data.dimensions} dimensions but the ` +
            `knowledge_chunks column is vector(${EMBEDDING_DIMENSIONS}). Changing ` +
            'the model means a migration and re-embedding the whole corpus (D-11).',
        );
      }

      vectors.push(...result.data.vectors);
    }

    return vectors;
  }

  /**
   * Writes chunks and their vectors.
   *
   * Prisma cannot express the pgvector type, so vectors go in through
   * `$executeRaw`. Wrapped in a transaction with the delete so re-processing
   * never leaves a document with both old and new chunks.
   */
  private async writeChunks(
    document: {
      id: string;
      subjectId: string | null;
      chapterId: string | null;
      subject: { classLevel: number } | null;
    },
    chunks: Chunk[],
    vectors: number[][],
  ): Promise<void> {
    const classLevel = document.subject?.classLevel ?? 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { documentId: document.id } });

      for (const [index, chunk] of chunks.entries()) {
        const vector = vectors[index];
        if (!vector) throw new Error(`Missing embedding for chunk ${index}`);

        await tx.$executeRaw`
          INSERT INTO knowledge_chunks (
            id, document_id, content, chunk_index, page_number, section,
            token_count, class_level, subject_id, chapter_id, language,
            embedding, created_at
          ) VALUES (
            gen_random_uuid(),
            ${document.id}::uuid,
            ${chunk.content},
            ${chunk.chunkIndex},
            ${chunk.pageNumber ?? null},
            ${chunk.section ?? null},
            ${chunk.tokenCount},
            ${classLevel},
            ${document.subjectId}::uuid,
            ${document.chapterId}::uuid,
            ${detectLanguage(chunk.content)}::"ContentLanguage",
            ${`[${vector.join(',')}]`}::vector,
            NOW()
          )
        `;
      }
    });
  }

  private async setStatus(documentId: string, status: DocumentStatus): Promise<void> {
    await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status } });
  }

  private async markFailed(documentId: string | undefined, detail: string): Promise<void> {
    if (!documentId) return;

    await this.prisma.knowledgeDocument
      .update({
        where: { id: documentId },
        data: { status: DocumentStatus.FAILED, statusDetail: detail.slice(0, 2000) },
      })
      .catch((error: unknown) => {
        this.logger.error(`Could not mark ${documentId} failed: ${String(error)}`);
      });
  }
}

/** Majority script wins. Mixed Bangla/English pages are normal in NCTB texts. */
export function detectLanguage(text: string): ContentLanguage {
  const bengali = (text.match(/[ঀ-৿]/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/gu) ?? []).length;
  return bengali >= latin ? ContentLanguage.BN : ContentLanguage.EN;
}

/**
 * Everything an admin should know about a document that ingested anyway.
 *
 * Kept as a note on a READY document rather than a failure, because both
 * conditions produce a usable corpus — just one that needs a human to
 * confirm it says what the page says.
 */
function buildStatusDetail(extracted: {
  unreadablePages: number[];
  quality: { suspicious: boolean; warnings: string[] };
}): string | null {
  const notes: string[] = [];

  if (extracted.unreadablePages.length > 0) {
    notes.push(
      `${extracted.unreadablePages.length} page(s) had no text layer and were skipped: ` +
        extracted.unreadablePages.slice(0, 20).join(', '),
    );
  }

  if (extracted.quality.suspicious) {
    notes.push(
      `Extraction warnings — needs a native reader: ${extracted.quality.warnings.join(' ')}`,
    );
  }

  return notes.length > 0 ? notes.join(' | ') : null;
}
