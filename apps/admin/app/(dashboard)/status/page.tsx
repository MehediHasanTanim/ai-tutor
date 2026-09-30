import { knowledgeBaseStatus } from '@/lib/knowledge';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const status = await knowledgeBaseStatus();

  const inFlight =
    status.documents.by_status.QUEUED +
    status.documents.by_status.EXTRACTING +
    status.documents.by_status.CHUNKING +
    status.documents.by_status.EMBEDDING;

  return (
    <>
      <header>
        <h2>Knowledge base status</h2>
        <p>Corpus size, ingestion queue, and the gap between chunked and searchable.</p>
      </header>

      {!status.queue.reachable && (
        <div className="alert alert-error">
          Redis is unreachable, so the queue counts below are not live. Ingestion is stalled until
          it comes back.
        </div>
      )}

      {status.chunks.without_embedding > 0 && (
        <div className="alert alert-warn">
          <strong>{status.chunks.without_embedding} chunk(s) have no embedding.</strong> They exist
          but cannot be retrieved — embedding failed partway through a document. Reprocess it from
          the Documents page.
        </div>
      )}

      <div className="stats" style={{ marginBottom: 20 }}>
        <Stat label="Documents" value={status.documents.total} />
        <Stat label="Ready" value={status.documents.by_status.READY} tone="ok" />
        <Stat label="In flight" value={inFlight} tone={inFlight > 0 ? 'warn' : undefined} />
        <Stat
          label="Failed"
          value={status.documents.by_status.FAILED}
          tone={status.documents.by_status.FAILED > 0 ? 'err' : undefined}
        />
        <Stat
          label="Searchable chunks"
          value={status.chunks.total - status.chunks.without_embedding}
        />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Documents by status</h3>
        <table>
          <tbody>
            {Object.entries(status.documents.by_status).map(([key, count]) => (
              <tr key={key}>
                <td style={{ textTransform: 'capitalize' }}>{key.toLowerCase()}</td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Ingestion queue</h3>
        <table>
          <tbody>
            <tr>
              <td>Waiting</td>
              <td className="mono" style={{ textAlign: 'right' }}>
                {status.queue.waiting}
              </td>
            </tr>
            <tr>
              <td>Active</td>
              <td className="mono" style={{ textAlign: 'right' }}>
                {status.queue.active}
              </td>
            </tr>
            <tr>
              <td>Completed</td>
              <td className="mono" style={{ textAlign: 'right' }}>
                {status.queue.completed}
              </td>
            </tr>
            <tr>
              <td>Failed</td>
              <td className="mono" style={{ textAlign: 'right' }}>
                {status.queue.failed}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Embedding dimensions</h3>
        <p className="mono" style={{ fontSize: 18, margin: '0 0 8px' }}>
          {status.embedding_dimensions}
        </p>
        <p className="muted small" style={{ margin: 0 }}>
          The corpus is committed to this width. Changing the embedding model means a migration{' '}
          <em>and</em> re-embedding every chunk — there is no in-place conversion, so this is
          effectively a one-way decision (D-11).
        </p>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'err';
}) {
  const color =
    tone === 'ok'
      ? 'var(--ok)'
      : tone === 'warn'
        ? 'var(--warn)'
        : tone === 'err'
          ? 'var(--danger)'
          : undefined;

  return (
    <div className="stat">
      <div className="n" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="k">{label}</div>
    </div>
  );
}
