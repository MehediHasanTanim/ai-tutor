/**
 * Reranking — the stage between vector search and top-k.
 *
 * Deliberately not a cross-encoder. A reranker model is another provider
 * decision, another cost per query, and another 200ms on a latency budget
 * that doc 07 §5.4 already caps at 2.5s to first token. What this does
 * instead is combine signals the search already produced, plus two the
 * embedding cannot know: whether the chunk is in the language the student
 * reads, and whether the answer is spread across one page or several.
 *
 * Swappable: `rerank` is a pure function over candidates, so dropping a
 * cross-encoder in later means replacing this file and nothing else.
 */

import type { VectorCandidate } from './vector-search';
import type { QueryLanguage, RetrievedChunk } from './retrieval.types';
import { preferredChunkLanguages } from './query-language';

export interface RerankOptions {
  queryLanguage: QueryLanguage;
  /** Chapter the student is studying, when there is one. */
  chapterId?: string;
  topK: number;
}

/**
 * Weights.
 *
 * Vector similarity dominates because it is the only signal that understands
 * meaning. Lexical overlap earns its place by catching what embeddings miss:
 * a student asking about "ত্বরণ" should find the chunk containing that exact
 * word even if the embedding put a paraphrase nearer.
 */
const WEIGHTS = {
  vector: 0.7,
  lexical: 0.2,
  language: 0.06,
  chapter: 0.04,
} as const;

export function rerank(candidates: VectorCandidate[], options: RerankOptions): RetrievedChunk[] {
  const preferred = preferredChunkLanguages(options.queryLanguage);

  const scored = candidates.map((candidate) => {
    // Rank within the preference list, so a first-choice language scores 1
    // and a second-choice scores less rather than zero — an English chunk is
    // worth retrieving for a Bangla question when it is the only one there.
    const languageRank = preferred.indexOf(candidate.language);
    const languageScore = languageRank === -1 ? 0 : 1 - languageRank / preferred.length;

    const chapterScore =
      options.chapterId !== undefined && candidate.chapter_id === options.chapterId ? 1 : 0;

    const score =
      WEIGHTS.vector * clamp(candidate.similarity) +
      WEIGHTS.lexical * clamp(candidate.lexical) +
      WEIGHTS.language * languageScore +
      WEIGHTS.chapter * chapterScore;

    return toRetrievedChunk(candidate, score);
  });

  scored.sort((a, b) => b.score - a.score);

  return diversify(scored, options.topK);
}

/**
 * Takes top-k while limiting how many chunks come from one document page.
 *
 * Without this, overlapping chunks from the same page crowd out the rest:
 * adjacent chunks share text, so they score almost identically, and top-5
 * becomes five views of one paragraph. The tutor then has a narrow context
 * that looks rich. Two per page is enough to keep a split derivation whole
 * without letting one page own the whole result.
 */
export function diversify(chunks: RetrievedChunk[], topK: number): RetrievedChunk[] {
  const MAX_PER_PAGE = 2;

  const perPage = new Map<string, number>();
  const selected: RetrievedChunk[] = [];
  const deferred: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    if (selected.length >= topK) break;

    const key = `${chunk.documentId}:${chunk.pageNumber ?? 'none'}`;
    const seen = perPage.get(key) ?? 0;

    if (seen >= MAX_PER_PAGE) {
      deferred.push(chunk);
      continue;
    }

    perPage.set(key, seen + 1);
    selected.push(chunk);
  }

  // Backfill from what the page cap pushed aside rather than returning fewer
  // than asked for — a thin corpus may legitimately have one relevant page.
  for (const chunk of deferred) {
    if (selected.length >= topK) break;
    selected.push(chunk);
  }

  return selected;
}

function toRetrievedChunk(candidate: VectorCandidate, score: number): RetrievedChunk {
  return {
    id: candidate.id,
    documentId: candidate.document_id,
    content: candidate.content,
    chunkIndex: candidate.chunk_index,
    pageNumber: candidate.page_number,
    section: candidate.section,
    subjectId: candidate.subject_id,
    chapterId: candidate.chapter_id,
    classLevel: candidate.class_level,
    language: candidate.language,
    vectorScore: candidate.similarity,
    lexicalScore: candidate.lexical,
    score,
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
