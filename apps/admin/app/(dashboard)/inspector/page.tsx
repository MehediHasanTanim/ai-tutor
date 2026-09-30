import Link from 'next/link';
import { listChunks, listDocuments, retrievalLog } from '@/lib/knowledge';
import { InspectorFilters } from '@/components/inspector-filters';
import { ChunkCard } from '@/components/chunk-card';
import { RetrievalTrace } from '@/components/retrieval-trace';

export const dynamic = 'force-dynamic';

interface SearchParams {
  document_id?: string;
  search?: string;
  request_id?: string;
}

/**
 * The chunk inspector.
 *
 * Doc 07 Weeks 3–4: "The chunk inspector matters more than it sounds — it is
 * how anyone diagnoses bad answers."
 *
 * Diagnosing a bad answer needs two things, and searching chunk text is only
 * one of them. The workflow the tool has to support is:
 *
 *   1. A student reports the tutor said something wrong.
 *   2. You have the `request_id` from the error envelope or the app's report.
 *   3. You need the exact chunks that request retrieved, with their scores.
 *   4. You need to read those chunks and see whether the answer came from a
 *      bad chunk ranked high, a good chunk ranked low, or nothing at all.
 *
 * So the page has two modes. Given a request id it shows the retrieval trace —
 * filter, timings, and every chunk with its vector, lexical and final score.
 * Otherwise it searches chunk text, which is how you answer the other
 * question: "is this fact in the corpus at all?"
 */
export default async function InspectorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const documents = await listDocuments().catch(() => []);

  const requestId = params.request_id?.trim();
  const search = params.search?.trim();
  const documentId = params.document_id?.trim();

  return (
    <>
      <header>
        <h2>Chunk inspector</h2>
        <p>
          Trace a bad answer back to the passages that produced it — or establish that none did.
        </p>
      </header>

      <InspectorFilters
        documents={documents.map((document) => ({
          id: document.id,
          title: document.title,
          chunkCount: document.chunk_count,
        }))}
        defaults={{ documentId, search, requestId }}
      />

      {requestId ? (
        <TraceMode requestId={requestId} />
      ) : (
        <SearchMode documentId={documentId} search={search} />
      )}
    </>
  );
}

/** Mode 1: what did this request actually retrieve? */
async function TraceMode({ requestId }: { requestId: string }) {
  // An admin tool that blanks the screen when one endpoint is unhappy is worse
  // than one that says which endpoint. The rest of the page still works.
  let entries: Awaited<ReturnType<typeof retrievalLog>>;
  try {
    entries = await retrievalLog({ requestId });
  } catch (error) {
    return (
      <div className="alert alert-error">
        Could not read the retrieval log: {error instanceof Error ? error.message : 'unknown error'}
      </div>
    );
  }

  const entry = entries[0];

  if (!entry) {
    return (
      <div className="card empty">
        <p>
          No retrieval recorded for <span className="mono">{requestId}</span>.
        </p>
        <p className="small">
          The log is in-memory and holds the most recent 200 retrievals, so an older request will
          have aged out. It is also empty if the request never reached retrieval — a quota rejection
          or a validation error, for instance.
        </p>
      </div>
    );
  }

  // Fetch the text for the chunks the trace names. The log stores ids and
  // scores; the text lives in the corpus, and reading it is the point.
  const chunkIds = new Set(entry.chunks.map((chunk) => chunk.id));
  const documentIds = [...new Set(entry.chunks.map((chunk) => chunk.documentId))];

  const fetched = await Promise.all(
    documentIds.map((documentId) => listChunks({ documentId, limit: 200 })),
  );
  const byId = new Map(
    fetched
      .flat()
      .filter((chunk) => chunkIds.has(chunk.id))
      .map((chunk) => [chunk.id, chunk]),
  );

  return (
    <>
      <RetrievalTrace entry={entry} />

      <h3 style={{ fontSize: 15, marginTop: 24 }}>Retrieved passages, in rank order</h3>

      {entry.chunks.length === 0 ? (
        <div className="alert alert-warn">
          This request retrieved <strong>nothing</strong>. Any answer the tutor gave was ungrounded
          — which is the case doc 07 R-05 calls critical. Check whether the scope had any corpus at
          all: the filter above shows class {entry.filter.classLevel} and{' '}
          {Array.isArray(entry.filter.subjectIds)
            ? `${entry.filter.subjectIds.length} subject(s)`
            : entry.filter.subjectIds}
          .
        </div>
      ) : (
        entry.chunks.map((scored, index) => {
          const chunk = byId.get(scored.id);

          return (
            <div key={scored.id}>
              <div
                className="small muted"
                style={{ display: 'flex', gap: 14, marginBottom: 4, flexWrap: 'wrap' }}
              >
                <strong>#{index + 1}</strong>
                <span>
                  final <span className="mono">{scored.score.toFixed(4)}</span>
                </span>
                <span>
                  vector <span className="mono">{scored.vectorScore.toFixed(4)}</span>
                </span>
                <span>
                  lexical <span className="mono">{scored.lexicalScore.toFixed(4)}</span>
                </span>
                <span
                  className="score-bar"
                  style={{ width: `${Math.max(2, scored.score * 120)}px` }}
                  aria-hidden
                />
              </div>

              {chunk ? (
                <ChunkCard chunk={chunk} />
              ) : (
                <div className="card small muted">
                  Chunk <span className="mono">{scored.id}</span> is no longer in the corpus — the
                  document was reprocessed or deleted after this retrieval.
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}

/** Mode 2: is this in the corpus at all? */
async function SearchMode({ documentId, search }: { documentId?: string; search?: string }) {
  if (!documentId && !search) {
    return (
      <div className="card empty">
        <p>Search chunk text, pick a document, or paste a request id above.</p>
        <p className="small">
          Paste a phrase from a wrong answer to find which passage produced it. No result means the
          tutor was not working from the corpus.
        </p>
      </div>
    );
  }

  const chunks = await listChunks({ documentId, search, limit: 50 });

  if (chunks.length === 0) {
    return (
      <div className="card empty">
        <p>No chunks match.</p>
        {search && (
          <p className="small">
            If that phrase came from a tutor answer, it was not quoted from the corpus — either the
            model paraphrased, or it answered without grounding.
          </p>
        )}
      </div>
    );
  }

  const missingEmbeddings = chunks.filter((chunk) => !chunk.has_embedding).length;

  return (
    <>
      <p className="small muted">
        {chunks.length} chunk{chunks.length === 1 ? '' : 's'}
        {chunks.length === 50 ? ' (showing the first 50)' : ''}
        {missingEmbeddings > 0 && (
          <>
            {' · '}
            <strong style={{ color: 'var(--warn)' }}>
              {missingEmbeddings} without an embedding, so not retrievable
            </strong>
          </>
        )}
      </p>

      {chunks.map((chunk) => (
        <ChunkCard key={chunk.id} chunk={chunk} highlight={search} />
      ))}

      <p className="muted small">
        Looking for why a specific answer was wrong?{' '}
        <Link href="/inspector">Paste its request id</Link> instead — that shows the exact chunks it
        used and how they ranked.
      </p>
    </>
  );
}
