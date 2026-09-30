import type {
  KnowledgeBaseStatus,
  KnowledgeChunkDetail,
  KnowledgeDocumentSummary,
  SubjectSummary,
  UploadDocumentResponse,
} from '@ai-tutor/shared-types';
import { apiFetch } from './api';

/**
 * Knowledge-base reads and writes.
 *
 * A thin layer over `apiFetch` so pages read like what they display, and so
 * the query-string building lives in one place rather than in six components.
 */

export interface RetrievalLogEntry {
  requestId: string;
  at: string;
  query: string;
  detectedLanguage: string;
  languageConfidence: number;
  matchedMarkers: string[];
  filter: {
    classLevel: number;
    curriculumId: string;
    subjectIds: string[] | 'all-in-class';
    chapterId?: string;
  };
  candidateCount: number;
  timings: { embedMs: number; searchMs: number; rerankMs: number; totalMs: number };
  chunks: Array<{
    id: string;
    documentId: string;
    page: number | null;
    section: string | null;
    language: string;
    vectorScore: number;
    lexicalScore: number;
    score: number;
  }>;
}

export function listDocuments(params: { status?: string; subjectId?: string } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.subjectId) query.set('subject_id', params.subjectId);

  return apiFetch<KnowledgeDocumentSummary[]>(`/admin/documents?${query}`);
}

export function knowledgeBaseStatus() {
  return apiFetch<KnowledgeBaseStatus>('/admin/knowledge-base/status');
}

export function listChunks(params: { documentId?: string; search?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.documentId) query.set('document_id', params.documentId);
  if (params.search) query.set('search', params.search);
  query.set('limit', String(params.limit ?? 50));

  return apiFetch<KnowledgeChunkDetail[]>(`/admin/knowledge-base/chunks?${query}`);
}

export function retrievalLog(params: { requestId?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.requestId) query.set('request_id', params.requestId);
  if (params.limit) query.set('limit', String(params.limit));

  return apiFetch<RetrievalLogEntry[]>(`/admin/retrieval-log?${query}`);
}

export function reprocessDocument(id: string) {
  return apiFetch<KnowledgeDocumentSummary>(`/admin/documents/${id}/process`, { method: 'POST' });
}

export function uploadDocument(formData: FormData) {
  return apiFetch<UploadDocumentResponse>('/admin/documents', { method: 'POST', formData });
}

/** Subjects, for the upload form's scope selector. */
export function listSubjects() {
  return apiFetch<SubjectSummary[]>('/subjects');
}
