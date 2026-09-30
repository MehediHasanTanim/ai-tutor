'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface DocumentOption {
  id: string;
  title: string;
  chunkCount: number;
}

/**
 * Two ways in, kept visually separate because they answer different questions.
 *
 * The request-id field is first: it is the one you reach for when a specific
 * answer was wrong, which is the case the inspector exists for.
 */
export function InspectorFilters({
  documents,
  defaults,
}: {
  documents: DocumentOption[];
  defaults: { documentId?: string; search?: string; requestId?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [requestId, setRequestId] = useState(defaults.requestId ?? '');
  const [search, setSearch] = useState(defaults.search ?? '');
  const [documentId, setDocumentId] = useState(defaults.documentId ?? '');

  function go(next: Record<string, string>): void {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value.trim()) query.set(key, value.trim());
    }
    router.push(`/inspector?${query}`);
  }

  const hasFilters = params.toString().length > 0;

  return (
    <div className="card">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go({ request_id: requestId });
        }}
        style={{ marginBottom: 18 }}
      >
        <label htmlFor="request_id">Trace a request</label>
        <div className="row">
          <input
            id="request_id"
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            placeholder="req_1f04f1c2-4c4c-422b-9cd2-a8cd5a5d560f"
            className="mono"
          />
          <button type="submit" style={{ flex: '0 0 auto' }}>
            Trace
          </button>
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          From the <code className="mono">request_id</code> in an error envelope or a
          student&rsquo;s report. Shows exactly which chunks that request used and how they scored.
        </p>
      </form>

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '0 0 18px' }} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          go({ search, document_id: documentId });
        }}
      >
        <label htmlFor="search">Or search the corpus</label>
        <div className="row">
          <input
            id="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="a phrase from the answer, e.g. ত্বরণ"
            className="bangla"
          />
          <select
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            aria-label="Restrict to a document"
          >
            <option value="">All documents</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title} ({document.chunkCount})
              </option>
            ))}
          </select>
          <button type="submit" style={{ flex: '0 0 auto' }}>
            Search
          </button>
        </div>
      </form>

      {hasFilters && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setRequestId('');
            setSearch('');
            setDocumentId('');
            router.push('/inspector');
          }}
          style={{ marginTop: 14, padding: '6px 12px', fontSize: 13 }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
