import type { KnowledgeChunkDetail } from '@ai-tutor/shared-types';

/**
 * One chunk, rendered as text first.
 *
 * `white-space: pre-wrap` and the Bangla font stack are the point: this panel
 * exists so someone can judge whether extracted Bangla is correct, and a
 * renderer that collapses whitespace or falls back to a Latin font would hide
 * the corruption it is supposed to reveal.
 */
export function ChunkCard({
  chunk,
  highlight,
}: {
  chunk: KnowledgeChunkDetail;
  highlight?: string;
}) {
  return (
    <article className="chunk">
      <div className="chunk-head">
        <span className="mono">#{chunk.chunk_index}</span>
        {chunk.page_number !== null && <span>page {chunk.page_number}</span>}
        {chunk.section && <span>&ldquo;{chunk.section}&rdquo;</span>}
        <span>class {chunk.class_level}</span>
        <span>{chunk.language}</span>
        {chunk.token_count !== null && <span>{chunk.token_count} tok</span>}
        {!chunk.has_embedding && (
          <span className="badge badge-warn">no embedding — not retrievable</span>
        )}
        <span className="mono" style={{ marginLeft: 'auto', opacity: 0.6 }}>
          {chunk.id.slice(0, 8)}
        </span>
      </div>
      <p className="chunk-text">
        {highlight ? highlighted(chunk.content, highlight) : chunk.content}
      </p>
    </article>
  );
}

/**
 * Marks the search term without using `dangerouslySetInnerHTML`.
 *
 * Chunk text came out of an uploaded PDF, and the search term came from a URL.
 * Neither is trusted enough to inject as HTML into an admin page that holds a
 * session cookie.
 */
function highlighted(content: string, term: string): React.ReactNode {
  if (term.trim().length === 0) return content;

  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (;;) {
    const index = lowerContent.indexOf(lowerTerm, cursor);
    if (index === -1) break;

    if (index > cursor) parts.push(content.slice(cursor, index));
    parts.push(
      <mark key={index} style={{ background: 'var(--primary-soft)', color: 'inherit' }}>
        {content.slice(index, index + term.length)}
      </mark>,
    );
    cursor = index + term.length;
  }

  if (cursor === 0) return content;
  if (cursor < content.length) parts.push(content.slice(cursor));
  return parts;
}
