import type { DocumentStatus } from '@ai-tutor/shared-types';

/**
 * Document status.
 *
 * FAILED is red and READY-with-notes is amber, because "ingested but the
 * extraction looked wrong" is the state that most needs someone to look and
 * is the easiest to scroll past when it renders as success.
 */
const STYLES: Record<DocumentStatus, { className: string; label: string }> = {
  UPLOADED: { className: 'badge-idle', label: 'Uploaded' },
  QUEUED: { className: 'badge-idle', label: 'Queued' },
  EXTRACTING: { className: 'badge-warn', label: 'Extracting' },
  CHUNKING: { className: 'badge-warn', label: 'Chunking' },
  EMBEDDING: { className: 'badge-warn', label: 'Embedding' },
  READY: { className: 'badge-ok', label: 'Ready' },
  FAILED: { className: 'badge-err', label: 'Failed' },
};

export function StatusBadge({
  status,
  hasNotes = false,
}: {
  status: DocumentStatus;
  hasNotes?: boolean;
}) {
  const style = STYLES[status];
  const warnOnReady = status === 'READY' && hasNotes;

  return (
    <span className={`badge ${warnOnReady ? 'badge-warn' : style.className}`}>
      {warnOnReady ? 'Ready — check' : style.label}
    </span>
  );
}
