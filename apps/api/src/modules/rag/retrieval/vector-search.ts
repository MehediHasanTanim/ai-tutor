import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { EMBEDDING_DIMENSIONS } from '../embedding.constants';
import type { RetrievalScope } from './retrieval.types';

export interface VectorCandidate {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  page_number: number | null;
  section: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  class_level: number;
  language: 'BN' | 'EN';
  similarity: number;
  /** Trigram similarity against the query, computed in the same pass. */
  lexical: number;
}

/**
 * Hybrid search over `knowledge_chunks`.
 *
 * Two things here are not incidental.
 *
 * **The metadata filter is a WHERE clause, not a post-filter.** Doc 07:
 * "Hard metadata filtering before vector search. A Class 10 student asking a
 * Physics question must never retrieve Class 9 Chemistry content." Filtering
 * after taking top-k would be both unsafe and useless — unsafe because a bug
 * in the post-filter leaks content, useless because when the nearest k are
 * all wrong-class you are left with nothing rather than the right answers
 * that sat at rank 40.
 *
 * **Iterative index scan is enabled.** This is the pgvector filtered-search
 * trap: an HNSW scan visits `ef_search` candidates and *then* applies the
 * WHERE clause, so a selective filter can return far fewer than `limit` rows
 * even when thousands match. pgvector 0.8 fixes it by re-scanning until the
 * limit is satisfied. Without this, retrieval quietly degrades exactly as the
 * corpus grows — the failure mode that looks like "the tutor got worse".
 */
@Injectable()
export class VectorSearch {
  private readonly logger = new Logger(VectorSearch.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    embedding: number[];
    query: string;
    scope: RetrievalScope;
    /** How many candidates to hand the reranker. Larger than final top-k. */
    limit: number;
  }): Promise<VectorCandidate[]> {
    if (params.embedding.length !== EMBEDDING_DIMENSIONS) {
      // Caught here rather than letting Postgres reject the cast with an
      // error that names a column and not the cause.
      throw new Error(
        `Query embedding has ${params.embedding.length} dimensions but the corpus is ` +
          `vector(${EMBEDDING_DIMENSIONS}). The embedding model does not match the ` +
          'one the corpus was built with (D-11).',
      );
    }

    const filter = this.buildFilter(params.scope);
    const vector = `[${params.embedding.join(',')}]`;

    // A transaction so the SET LOCAL applies to this query only and does not
    // leak onto whatever else borrows this pooled connection next.
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`);
      // Over-fetch inside the index so the filter has candidates to keep.
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${Math.max(100, params.limit * 4)}`);

      return tx.$queryRaw<VectorCandidate[]>`
        SELECT
          c.id,
          c.document_id,
          c.content,
          c.chunk_index,
          c.page_number,
          c.section,
          c.subject_id,
          c.chapter_id,
          c.class_level,
          c.language::text AS language,
          1 - (c.embedding <=> ${vector}::vector) AS similarity,
          COALESCE(similarity(c.content, ${params.query}), 0) AS lexical
        FROM knowledge_chunks c
        INNER JOIN knowledge_documents d ON d.id = c.document_id
        WHERE c.embedding IS NOT NULL
          AND d.status = 'READY'
          AND ${filter}
        ORDER BY c.embedding <=> ${vector}::vector
        LIMIT ${params.limit}
      `;
    });

    return rows.map((row) => ({
      ...row,
      // Postgres returns numerics as strings through some drivers; normalise
      // so downstream arithmetic cannot silently concatenate.
      similarity: Number(row.similarity),
      lexical: Number(row.lexical),
    }));
  }

  /**
   * The hard filter.
   *
   * Class and curriculum are always applied. Subject is narrowed to the one
   * asked about, or to the student's selected subjects — never left open,
   * because "every subject in Class 10" would let a chemistry question
   * retrieve biology and the tutor would cite it without noticing.
   */
  private buildFilter(scope: RetrievalScope): Prisma.Sql {
    const clauses: Prisma.Sql[] = [
      Prisma.sql`c.class_level = ${scope.classLevel}`,
      // Joined through subjects rather than denormalised onto the chunk: the
      // chunk's subject_id already implies a curriculum, and duplicating it
      // would create a second place for the two to disagree.
      Prisma.sql`EXISTS (
        SELECT 1 FROM subjects s
        WHERE s.id = c.subject_id AND s.curriculum_id = ${scope.curriculumId}::uuid
      )`,
    ];

    if (scope.chapterId) {
      clauses.push(Prisma.sql`c.chapter_id = ${scope.chapterId}::uuid`);
    }

    if (scope.subjectId) {
      clauses.push(Prisma.sql`c.subject_id = ${scope.subjectId}::uuid`);
    } else if (scope.studentSubjectIds && scope.studentSubjectIds.length > 0) {
      clauses.push(Prisma.sql`c.subject_id = ANY(${scope.studentSubjectIds}::uuid[])`);
    } else {
      // No subject and no selection. Rather than search the whole class,
      // match nothing: an unscoped search is the bug this filter prevents,
      // and a caller that reaches here has forgotten to pass the student's
      // subjects. Empty results make that visible immediately.
      this.logger.warn(
        'Retrieval called with neither subjectId nor studentSubjectIds; refusing to ' +
          'search the whole class level.',
      );
      clauses.push(Prisma.sql`FALSE`);
    }

    return Prisma.join(clauses, ' AND ');
  }

  /** Corpus size for the scope, so an empty result can say why. */
  async countInScope(scope: RetrievalScope): Promise<number> {
    const filter = this.buildFilter(scope);
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM knowledge_chunks c
      INNER JOIN knowledge_documents d ON d.id = c.document_id
      WHERE c.embedding IS NOT NULL AND d.status = 'READY' AND ${filter}
    `;
    return Number(rows[0]?.count ?? 0n);
  }
}
