/**
 * Knowledge base contract — doc 04 "Admin" section, doc 07 Weeks 3–4.
 *
 * Admin-only. Backs the Next.js panel: document list, upload, processing
 * status, and the chunk inspector that doc 07 singles out — "it is how anyone
 * diagnoses bad answers".
 */

export const DocumentType = {
  TEXTBOOK: 'TEXTBOOK',
  QUESTION_PAPER: 'QUESTION_PAPER',
  NOTE: 'NOTE',
  SOLUTION_GUIDE: 'SOLUTION_GUIDE',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  UPLOADED: 'UPLOADED',
  QUEUED: 'QUEUED',
  EXTRACTING: 'EXTRACTING',
  CHUNKING: 'CHUNKING',
  EMBEDDING: 'EMBEDDING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const ContentLanguage = { BN: 'BN', EN: 'EN' } as const;
export type ContentLanguage = (typeof ContentLanguage)[keyof typeof ContentLanguage];

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  document_type: DocumentType;
  source: string | null;
  version: number;
  status: DocumentStatus;
  /** Why it failed, when it did. Shown in the admin list, not swallowed. */
  status_detail: string | null;
  subject: { id: string; name: string; class_level: number } | null;
  chapter: { id: string; title: string; chapter_number: number } | null;
  size_bytes: number;
  page_count: number | null;
  chunk_count: number;
  processed_at: string | null;
  created_at: string;
}

export interface UploadDocumentRequest {
  title: string;
  document_type: DocumentType;
  subject_id?: string;
  chapter_id?: string;
  source?: string;
}

export interface UploadDocumentResponse {
  document: KnowledgeDocumentSummary;
  /**
   * True when an identical file was already ingested. Doc 07 requires
   * re-processing be idempotent; the caller gets the existing document back
   * rather than a duplicate corpus.
   */
  deduplicated: boolean;
}

/** One chunk, as the inspector shows it. */
export interface KnowledgeChunkDetail {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section: string | null;
  token_count: number | null;
  class_level: number;
  subject_id: string | null;
  chapter_id: string | null;
  language: ContentLanguage;
  /** False when embedding has not run or failed for this chunk. */
  has_embedding: boolean;
}

/** `GET /api/v1/admin/knowledge-base/status`. */
export interface KnowledgeBaseStatus {
  documents: {
    total: number;
    by_status: Record<DocumentStatus, number>;
  };
  chunks: {
    total: number;
    /** Chunks still missing a vector — the gap between chunked and searchable. */
    without_embedding: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    /** False when Redis is unreachable; the counts above are then stale. */
    reachable: boolean;
  };
  /**
   * The pgvector dimension the corpus is committed to.
   *
   * Surfaced because doc 07 D-11 makes this a one-way decision: a mismatch
   * between this and the configured embedding model means every chunk
   * silently fails to insert.
   */
  embedding_dimensions: number;
}
