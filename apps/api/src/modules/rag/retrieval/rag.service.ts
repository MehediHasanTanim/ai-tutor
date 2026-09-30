import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_PROVIDER, type AIProvider } from '../../ai/ai-provider.interface';
import { detectQueryLanguage } from './query-language';
import { rerank } from './rerank';
import { VectorSearch } from './vector-search';
import { RetrievalLog } from './retrieval.log';
import type { RetrievalRequest, RetrievalResult } from './retrieval.types';

/**
 * RagService — architecture §6.
 *
 *   query → language detect → metadata filter → embed → vector search
 *         → rerank → top-k
 *
 * The pipeline is in that order for a reason. Language detection is first
 * because it shapes reranking. The filter is decided before the embedding
 * call so an out-of-scope request costs nothing. The vector search applies
 * the filter *inside* the query rather than after, and reranking runs over a
 * wider candidate set than the caller asked for.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  /**
   * Candidates fetched per final result.
   *
   * Reranking can only reorder what the search returned, so the multiplier is
   * what gives it room to promote a chunk the embedding ranked 15th. Four is
   * enough to matter without making the SQL scan expensive.
   */
  private static readonly CANDIDATE_MULTIPLIER = 4;
  private static readonly DEFAULT_TOP_K = 5;

  constructor(
    private readonly vectorSearch: VectorSearch,
    private readonly retrievalLog: RetrievalLog,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const startedAt = Date.now();
    const topK = request.topK ?? RagService.DEFAULT_TOP_K;

    // 1. Language detection.
    const detection = detectQueryLanguage(request.query);

    // 2. The filter, resolved before spending anything on an embedding.
    const appliedFilter = {
      classLevel: request.scope.classLevel,
      curriculumId: request.scope.curriculumId,
      subjectIds: request.scope.subjectId
        ? [request.scope.subjectId]
        : (request.scope.studentSubjectIds ?? []),
      ...(request.scope.chapterId ? { chapterId: request.scope.chapterId } : {}),
    };

    if (!this.ai.capabilities.embedding) {
      // No embedding provider means no retrieval. Returning empty rather
      // than throwing, because the tutor's correct behaviour on an empty
      // retrieval is already defined: say the curriculum does not cover it
      // (doc 07 Weeks 5–6 exit criteria). A throw would turn a degraded
      // answer into a broken screen.
      this.logger.warn('Retrieval skipped: no embedding provider configured (D-11).');
      return this.emptyResult(detection.language, appliedFilter, startedAt);
    }

    // 3. Embed.
    const embedStartedAt = Date.now();
    const embedded = await this.ai.embed({ texts: [request.query], inputType: 'query' });
    const embedMs = Date.now() - embedStartedAt;

    const vector = embedded.data.vectors[0];
    if (!vector) {
      this.logger.error('Embedding provider returned no vector for the query');
      return this.emptyResult(detection.language, appliedFilter, startedAt);
    }

    // 4. Vector search, with the filter applied in the query.
    const searchStartedAt = Date.now();
    const candidates = await this.vectorSearch.search({
      embedding: vector,
      query: request.query,
      scope: request.scope,
      limit: topK * RagService.CANDIDATE_MULTIPLIER,
    });
    const searchMs = Date.now() - searchStartedAt;

    // 5. Rerank and take top-k.
    const rerankStartedAt = Date.now();
    const chunks = rerank(candidates, {
      queryLanguage: detection.language,
      chapterId: request.scope.chapterId,
      topK,
    });
    const rerankMs = Date.now() - rerankStartedAt;

    const result: RetrievalResult = {
      chunks,
      detectedLanguage: detection.language,
      appliedFilter: {
        ...appliedFilter,
        subjectIds: request.scope.subjectId
          ? [request.scope.subjectId]
          : (request.scope.studentSubjectIds ?? []),
      },
      candidateCount: candidates.length,
      timings: { embedMs, searchMs, rerankMs, totalMs: Date.now() - startedAt },
      empty: chunks.length === 0,
    };

    // 6. Log chunk ids and scores. Doc 07 Weeks 3–4 and §12 both require it:
    // "Log retrieved chunk IDs and scores against every request for
    // debuggability." It is how a wrong answer gets traced to its sources.
    this.retrievalLog.record({
      requestId: request.requestId,
      query: request.query,
      detection,
      result,
    });

    if (result.empty) {
      // An empty result is ambiguous — bad query, or no corpus for this
      // scope at all. Distinguishing them turns "the tutor is broken" into
      // "that chapter has not been ingested yet".
      const inScope = await this.vectorSearch.countInScope(request.scope);
      this.logger.warn(
        inScope === 0
          ? `No chunks exist for class ${request.scope.classLevel} / ` +
              `subjects ${appliedFilter.subjectIds.join(', ') || '(none selected)'} — ` +
              'nothing has been ingested for this scope yet.'
          : `Retrieved nothing from ${inScope} chunks in scope; the query may be ` +
              'outside the ingested material.',
      );
    }

    return result;
  }

  private emptyResult(
    detectedLanguage: RetrievalResult['detectedLanguage'],
    appliedFilter: {
      classLevel: number;
      curriculumId: string;
      subjectIds: string[];
      chapterId?: string;
    },
    startedAt: number,
  ): RetrievalResult {
    return {
      chunks: [],
      detectedLanguage,
      appliedFilter,
      candidateCount: 0,
      timings: { embedMs: 0, searchMs: 0, rerankMs: 0, totalMs: Date.now() - startedAt },
      empty: true,
    };
  }
}
