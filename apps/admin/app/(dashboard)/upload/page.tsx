import { listSubjects } from '@/lib/knowledge';
import { UploadForm } from '@/components/upload-form';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  // Best-effort: an upload can still be scoped by nothing if this fails.
  const subjects = await listSubjects().catch(() => []);

  return (
    <>
      <header>
        <h2>Upload a document</h2>
        <p>Stored, then queued for extraction, chunking and embedding.</p>
      </header>

      <UploadForm subjects={subjects} />

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Before you upload</h3>
        <ul className="small muted" style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li>
            <strong>Scope it to a subject.</strong> Retrieval filters on class and subject before
            the vector search, so an unscoped document is never retrieved for anyone.
          </li>
          <li>
            <strong>Check a PDF first.</strong>{' '}
            <code className="mono">pnpm --filter @ai-tutor/api probe:extraction file.pdf</code>{' '}
            reports whether Bangla conjuncts survived. A scanned PDF has no text layer and will fail
            until OCR is configured.
          </li>
          <li>
            <strong>Re-uploading the same file is free.</strong> Documents are deduplicated on
            content hash, so identical bytes return the existing document instead of a second copy.
          </li>
        </ul>
      </div>
    </>
  );
}
