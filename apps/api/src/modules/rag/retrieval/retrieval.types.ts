/**
 * Retrieval contract — architecture §6, doc 07 Weeks 3–4.
 *
 *   query → language detect → metadata filter → embed → vector search
 *         → rerank → top-k
 */

import type { ContentLanguage } from '@prisma/client';

export type QueryLanguage = 'bn' | 'en' | 'banglish';

/**
 * Who is asking, and about what.
 *
 * `classLevel` and `curriculumId` are required, not optional. Doc 07 is
 * explicit: "A Class 10 student asking a Physics question must never retrieve
 * Class 9 Chemistry content." Making them optional would let a caller omit
 * them and silently get an unscoped search — the failure this whole type
 * exists to prevent.
 */
export interface RetrievalScope {
  classLevel: number;
  curriculumId: string;
  /** Narrow to one subject. Omit to search every subject the student takes. */
  subjectId?: string;
  /** Narrow further. Only meaningful with `subjectId`. */
  chapterId?: string;
  /**
   * The student's selected subjects. When `subjectId` is absent, retrieval is
   * restricted to these rather than to everything in the class.
   */
  studentSubjectIds?: string[];
}

export interface RetrievalRequest {
  query: string;
  scope: RetrievalScope;
  /** How many chunks to return after reranking. */
  topK?: number;
  /** Correlates the log line with the request. Doc 07 §12. */
  requestId?: string;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  section: string | null;
  subjectId: string | null;
  chapterId: string | null;
  classLevel: number;
  language: ContentLanguage;

  /** Cosine similarity, 0–1. Higher is closer. */
  vectorScore: number;
  /** Lexical overlap with the query, 0–1. */
  lexicalScore: number;
  /** Combined score after reranking. What `topK` is taken on. */
  score: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  detectedLanguage: QueryLanguage;
  /** The filter that was applied, echoed for the log and for debugging. */
  appliedFilter: {
    classLevel: number;
    curriculumId: string;
    subjectIds: string[] | 'all-in-class';
    chapterId?: string;
  };
  /** Candidates the vector search returned before reranking and truncation. */
  candidateCount: number;
  timings: { embedMs: number; searchMs: number; rerankMs: number; totalMs: number };
  /**
   * True when nothing was retrieved. The tutor must say so rather than
   * answer ungrounded — doc 07 R-05.
   */
  empty: boolean;
}
