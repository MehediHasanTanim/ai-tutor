import type { RetrievalLogEntry } from '@/lib/knowledge';

/**
 * The retrieval trace: what the pipeline decided, before the chunks.
 *
 * Every field here answers a question that comes up while diagnosing a bad
 * answer. Detected language explains why Bangla chunks were preferred. The
 * filter explains why a chunk you expected was never a candidate. Candidate
 * count separates "the search found little" from "reranking dropped it".
 * Timings catch a slow embedding call being blamed on the model.
 */
export function RetrievalTrace({ entry }: { entry: RetrievalLogEntry }) {
  return (
    <div className="card">
      <div className="small muted" style={{ marginBottom: 12 }}>
        <span className="mono">{entry.requestId}</span> · {new Date(entry.at).toLocaleString()}
      </div>

      <p style={{ margin: '0 0 14px' }}>
        <strong>Query:</strong> <span className="bangla">{entry.query}</span>
      </p>

      <table>
        <tbody>
          <tr>
            <th style={{ width: 200 }}>Detected language</th>
            <td>
              {entry.detectedLanguage}
              <span className="muted small"> (confidence {entry.languageConfidence})</span>
              {entry.matchedMarkers.length > 0 && (
                <div className="muted small">
                  Banglish markers: {entry.matchedMarkers.join(', ')}
                </div>
              )}
            </td>
          </tr>
          <tr>
            <th>Scope filter</th>
            <td className="small">
              class {entry.filter.classLevel}
              {' · '}
              {Array.isArray(entry.filter.subjectIds)
                ? entry.filter.subjectIds.length === 0
                  ? 'no subjects (nothing searched)'
                  : `${entry.filter.subjectIds.length} subject(s)`
                : entry.filter.subjectIds}
              {entry.filter.chapterId && ' · chapter-scoped'}
              <div className="muted mono" style={{ marginTop: 4 }}>
                curriculum {entry.filter.curriculumId.slice(0, 8)}
                {Array.isArray(entry.filter.subjectIds) &&
                  entry.filter.subjectIds.length > 0 &&
                  ` · subjects ${entry.filter.subjectIds.map((id) => id.slice(0, 8)).join(', ')}`}
              </div>
            </td>
          </tr>
          <tr>
            <th>Candidates → returned</th>
            <td className="mono">
              {entry.candidateCount} → {entry.chunks.length}
              {entry.candidateCount > 0 && entry.chunks.length === 0 && (
                <span className="muted small"> (reranking returned none)</span>
              )}
            </td>
          </tr>
          <tr>
            <th>Timings</th>
            <td className="mono small">
              embed {entry.timings.embedMs}ms · search {entry.timings.searchMs}ms · rerank{' '}
              {entry.timings.rerankMs}ms · <strong>total {entry.timings.totalMs}ms</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
