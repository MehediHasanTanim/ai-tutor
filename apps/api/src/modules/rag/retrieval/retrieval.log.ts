import { Injectable, Logger } from '@nestjs/common';
import type { LanguageDetection } from './query-language';
import type { RetrievalResult } from './retrieval.types';

/**
 * Per-request retrieval log — doc 07 Weeks 3–4 and §12.
 *
 * "Log retrieved chunk IDs and scores against every request for
 * debuggability." §12 adds: "Retrieved chunk IDs and similarity scores per
 * request — essential for diagnosing bad answers."
 *
 * This is the thing that makes a bad answer investigable. A student reports
 * that the tutor said something wrong; you have the request id from the error
 * envelope; this gives you the exact chunks that produced it and their
 * scores. Without it the only available diagnosis is re-running the question
 * and hoping it reproduces.
 *
 * Structured output rather than prose, because these lines are meant to be
 * queried by request id once they reach a log aggregator.
 */
@Injectable()
export class RetrievalLog {
  private readonly logger = new Logger('Retrieval');

  /** In-memory ring for the admin panel. Not a substitute for real logs. */
  private readonly recent: RetrievalLogEntry[] = [];
  private static readonly RECENT_LIMIT = 200;

  record(params: {
    requestId?: string;
    query: string;
    detection: LanguageDetection;
    result: RetrievalResult;
  }): void {
    const { requestId, query, detection, result } = params;

    const entry: RetrievalLogEntry = {
      requestId: requestId ?? 'unknown',
      at: new Date().toISOString(),
      // Truncated: a query is student input, and a log is not the place for
      // an unbounded copy of it.
      query: query.slice(0, 300),
      detectedLanguage: detection.language,
      languageConfidence: Number(detection.confidence.toFixed(2)),
      matchedMarkers: detection.matchedMarkers,
      filter: result.appliedFilter,
      candidateCount: result.candidateCount,
      timings: result.timings,
      chunks: result.chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        page: chunk.pageNumber,
        section: chunk.section,
        language: chunk.language,
        vectorScore: round(chunk.vectorScore),
        lexicalScore: round(chunk.lexicalScore),
        score: round(chunk.score),
      })),
    };

    this.recent.push(entry);
    if (this.recent.length > RetrievalLog.RECENT_LIMIT) this.recent.shift();

    // One structured line per request. The chunk ids are the payload; the
    // scores are what tell you whether a wrong answer came from a bad chunk
    // ranked high or a good chunk ranked low.
    this.logger.log(JSON.stringify(entry));
  }

  /** Recent entries, newest first. Feeds the admin panel's diagnosis view. */
  list(limit = 50): RetrievalLogEntry[] {
    return [...this.recent].reverse().slice(0, limit);
  }

  findByRequestId(requestId: string): RetrievalLogEntry | undefined {
    return [...this.recent].reverse().find((entry) => entry.requestId === requestId);
  }
}

export interface RetrievalLogEntry {
  requestId: string;
  at: string;
  query: string;
  detectedLanguage: string;
  languageConfidence: number;
  matchedMarkers: string[];
  filter: RetrievalResult['appliedFilter'];
  candidateCount: number;
  timings: RetrievalResult['timings'];
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

function round(value: number): number {
  return Number(value.toFixed(4));
}
