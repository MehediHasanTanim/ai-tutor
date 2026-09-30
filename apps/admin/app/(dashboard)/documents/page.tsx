import Link from 'next/link';
import { listDocuments } from '@/lib/knowledge';
import { reprocessAction } from '@/lib/actions';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const documents = await listDocuments();

  return (
    <>
      <header>
        <h2>Documents</h2>
        <p>Everything uploaded to the knowledge base, and where it got to.</p>
      </header>

      {documents.length === 0 ? (
        <div className="card empty">
          <p>No documents yet.</p>
          <Link href="/upload">Upload one</Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Scope</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Chunks</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{document.title}</div>
                    <div className="muted small">
                      {document.document_type.replace('_', ' ').toLowerCase()}
                      {document.source ? ` · ${document.source}` : ''}
                      {` · ${formatBytes(document.size_bytes)}`}
                      {document.page_count !== null ? ` · ${document.page_count}p` : ''}
                    </div>
                    {document.status_detail && (
                      <div
                        className={`alert ${document.status === 'FAILED' ? 'alert-error' : 'alert-warn'} small`}
                        style={{ marginTop: 8, marginBottom: 0 }}
                      >
                        {document.status_detail}
                      </div>
                    )}
                  </td>
                  <td className="small">
                    {document.subject ? (
                      `${document.subject.name} · Class ${document.subject.class_level}`
                    ) : (
                      <span className="muted">unscoped</span>
                    )}
                    {document.chapter && (
                      <div className="muted">Ch. {document.chapter.chapter_number}</div>
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={document.status}
                      hasNotes={document.status_detail !== null}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {document.chunk_count}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {document.chunk_count > 0 && (
                      <Link
                        href={`/inspector?document_id=${document.id}`}
                        className="small"
                        style={{ marginRight: 12 }}
                      >
                        Inspect
                      </Link>
                    )}
                    <form action={reprocessAction} style={{ display: 'inline' }}>
                      <input type="hidden" name="document_id" value={document.id} />
                      <button
                        type="submit"
                        className="secondary"
                        style={{ padding: '5px 11px', fontSize: 13 }}
                      >
                        Reprocess
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small">
        Reprocessing replaces a document&rsquo;s chunks rather than adding to them, so it is safe to
        run after changing the extractor or the chunking rules.
      </p>
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
