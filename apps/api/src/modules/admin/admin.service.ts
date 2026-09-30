import { Injectable, Logger } from '@nestjs/common';
import { DocumentStatus, Prisma } from '@prisma/client';
import { ErrorCode } from '@ai-tutor/shared-types';
import type {
  KnowledgeBaseStatus,
  KnowledgeChunkDetail,
  KnowledgeDocumentSummary,
  UploadDocumentResponse,
} from '@ai-tutor/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { DOCUMENT_LIMITS, validateUpload, type UploadCandidate } from '../files/file-validation';
import { IngestionQueue } from '../rag/ingestion.queue';
import { EMBEDDING_DIMENSIONS } from '../rag/embedding.constants';
import type { UploadDocumentDto } from './dto/upload-document.dto';

const DOCUMENT_INCLUDE = {
  subject: { select: { id: true, name: true, classLevel: true } },
  chapter: { select: { id: true, title: true, chapterNumber: true } },
} satisfies Prisma.KnowledgeDocumentInclude;

type DocumentRow = Prisma.KnowledgeDocumentGetPayload<{ include: typeof DOCUMENT_INCLUDE }>;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: IngestionQueue,
  ) {}

  /**
   * Uploads a document and queues it for processing.
   *
   * Deduplicates on content hash. Doc 07 requires that re-processing a
   * document twice produce no duplicate chunks; catching it here means the
   * second upload of the same PDF returns the first document rather than
   * creating a parallel corpus nobody notices until retrieval gets strange.
   */
  async uploadDocument(
    file: UploadCandidate | undefined,
    dto: UploadDocumentDto,
  ): Promise<UploadDocumentResponse> {
    validateUpload(file, DOCUMENT_LIMITS);
    const upload = file!;

    await this.assertTargetsExist(dto.subject_id, dto.chapter_id);

    const stored = await this.storage.upload({
      buffer: upload.buffer,
      mimeType: upload.mimetype,
      originalName: upload.originalname,
      prefix: 'knowledge',
    });

    const existing = await this.prisma.knowledgeDocument.findFirst({
      where: { checksum: stored.checksum },
      include: DOCUMENT_INCLUDE,
      orderBy: { version: 'desc' },
    });

    if (existing) {
      // The bytes are already in the corpus. Drop the redundant object rather
      // than paying storage for a second copy of the same textbook.
      await this.storage.delete(stored.key).catch(() => undefined);
      this.logger.log(`Duplicate upload ignored; returning document ${existing.id}`);

      return { document: toDocumentSummary(existing), deduplicated: true };
    }

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        title: dto.title,
        documentType: dto.document_type,
        subjectId: dto.subject_id ?? null,
        chapterId: dto.chapter_id ?? null,
        source: dto.source ?? null,
        storageKey: stored.key,
        mimeType: upload.mimetype,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        status: DocumentStatus.QUEUED,
      },
      include: DOCUMENT_INCLUDE,
    });

    await this.queue.enqueue({ documentId: document.id, reprocess: false });

    return { document: toDocumentSummary(document), deduplicated: false };
  }

  async listDocuments(filters: {
    status?: DocumentStatus;
    subjectId?: string;
  }): Promise<KnowledgeDocumentSummary[]> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      },
      include: DOCUMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return documents.map(toDocumentSummary);
  }

  /** Re-runs ingestion. Existing chunks are replaced, not appended to. */
  async reprocessDocument(id: string): Promise<KnowledgeDocumentSummary> {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: DOCUMENT_INCLUDE,
    });

    if (!document) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: 'Document not found' });
    }

    // BullMQ keys the job by document id, so a completed or failed job must
    // be forgotten before the same id can be queued again.
    await this.queue.forget(id);

    const updated = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: { status: DocumentStatus.QUEUED, statusDetail: null },
      include: DOCUMENT_INCLUDE,
    });

    await this.queue.enqueue({ documentId: id, reprocess: true });

    return toDocumentSummary(updated);
  }

  /**
   * `GET /api/v1/admin/knowledge-base/status`.
   *
   * Reports the gap between chunked and searchable as its own number:
   * chunks exist but have no vector when embedding failed partway, and a
   * total-only view would show a healthy corpus that retrieves nothing.
   */
  async knowledgeBaseStatus(): Promise<KnowledgeBaseStatus> {
    const [byStatus, totalDocuments, totalChunks, withoutEmbedding, queue] = await Promise.all([
      this.prisma.knowledgeDocument.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.knowledgeDocument.count(),
      this.prisma.knowledgeChunk.count(),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM knowledge_chunks WHERE embedding IS NULL
      `,
      this.queue.counts(),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(DocumentStatus).map((status) => [status, 0]),
    ) as KnowledgeBaseStatus['documents']['by_status'];

    for (const row of byStatus) {
      statusCounts[row.status as keyof typeof statusCounts] = row._count._all;
    }

    return {
      documents: { total: totalDocuments, by_status: statusCounts },
      chunks: {
        total: totalChunks,
        without_embedding: Number(withoutEmbedding[0]?.count ?? 0n),
      },
      queue,
      embedding_dimensions: EMBEDDING_DIMENSIONS,
    };
  }

  /**
   * The chunk inspector — doc 07 Weeks 3–4.
   *
   * "The chunk inspector matters more than it sounds — it is how anyone
   * diagnoses bad answers." Given a wrong tutor reply, you paste a phrase
   * from it here and find which chunk it came from, or discover it came from
   * none of them.
   */
  async inspectChunks(params: {
    documentId?: string;
    search?: string;
    limit: number;
  }): Promise<KnowledgeChunkDetail[]> {
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        ...(params.documentId ? { documentId: params.documentId } : {}),
        ...(params.search ? { content: { contains: params.search, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
      take: params.limit,
    });

    // `embedding` is an unsupported column, so Prisma cannot select it.
    // Fetched separately as a presence flag, which is what the inspector
    // needs — the vector itself is 1024 floats nobody reads.
    const ids = chunks.map((chunk) => chunk.id);
    const embedded = ids.length
      ? await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM knowledge_chunks
          WHERE id = ANY(${ids}::uuid[]) AND embedding IS NOT NULL
        `
      : [];
    const hasEmbedding = new Set(embedded.map((row) => row.id));

    return chunks.map((chunk) => ({
      id: chunk.id,
      document_id: chunk.documentId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      page_number: chunk.pageNumber,
      section: chunk.section,
      token_count: chunk.tokenCount,
      class_level: chunk.classLevel,
      subject_id: chunk.subjectId,
      chapter_id: chunk.chapterId,
      language: chunk.language,
      has_embedding: hasEmbedding.has(chunk.id),
    }));
  }

  private async assertTargetsExist(subjectId?: string, chapterId?: string): Promise<void> {
    if (subjectId) {
      const count = await this.prisma.subject.count({ where: { id: subjectId } });
      if (count === 0) {
        throw new AppException(ErrorCode.VALIDATION_ERROR, {
          message: 'Unknown subject',
          details: { subject_id: ['No such subject'] },
        });
      }
    }

    if (chapterId) {
      const count = await this.prisma.chapter.count({ where: { id: chapterId } });
      if (count === 0) {
        throw new AppException(ErrorCode.VALIDATION_ERROR, {
          message: 'Unknown chapter',
          details: { chapter_id: ['No such chapter'] },
        });
      }
    }
  }
}

function toDocumentSummary(document: DocumentRow): KnowledgeDocumentSummary {
  return {
    id: document.id,
    title: document.title,
    document_type: document.documentType,
    source: document.source,
    version: document.version,
    status: document.status,
    status_detail: document.statusDetail,
    subject: document.subject
      ? {
          id: document.subject.id,
          name: document.subject.name,
          class_level: document.subject.classLevel,
        }
      : null,
    chapter: document.chapter
      ? {
          id: document.chapter.id,
          title: document.chapter.title,
          chapter_number: document.chapter.chapterNumber,
        }
      : null,
    size_bytes: document.sizeBytes,
    page_count: document.pageCount,
    chunk_count: document.chunkCount,
    processed_at: document.processedAt?.toISOString() ?? null,
    created_at: document.createdAt.toISOString(),
  };
}
