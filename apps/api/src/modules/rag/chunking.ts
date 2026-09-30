/**
 * Chunking — doc 07 Weeks 3–4.
 *
 * "Semantic, respecting chapter/section boundaries, ~400–600 tokens with
 * overlap. Never split a worked example or a formula derivation across
 * chunks."
 *
 * That last rule is the one that matters for this product. A derivation cut
 * in half retrieves as two chunks that each look plausible and neither of
 * which contains the answer, and the tutor then confidently explains half a
 * method. Splitting on paragraph boundaries and refusing to break inside a
 * detected example is cheap insurance against that.
 */

export interface ChunkingOptions {
  targetTokens: number;
  maxTokens: number;
  /** Tokens repeated from the previous chunk, so a boundary is never a cliff. */
  overlapTokens: number;
}

export const DEFAULT_CHUNKING: ChunkingOptions = {
  targetTokens: 500,
  maxTokens: 700,
  overlapTokens: 60,
};

export interface TextBlock {
  text: string;
  pageNumber?: number;
  section?: string;
}

export interface Chunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  section?: string;
  tokenCount: number;
}

/**
 * Estimates tokens without calling a tokenizer.
 *
 * Bangla is materially denser per character than English under every
 * tokenizer in common use, so a single chars/4 heuristic would under-count
 * Bangla chunks by roughly half and produce chunks that blow the context
 * budget. This weights the two scripts separately.
 *
 * It is an estimate. Replace it with the chosen provider's `count_tokens`
 * once D-09/D-11 are closed — until then it is calibrated to be conservative.
 */
export function estimateTokens(text: string): number {
  const bengali = (text.match(/[ঀ-৿]/gu) ?? []).length;
  const other = text.length - bengali;

  // ~1 token per 2 Bengali characters, ~1 per 4 otherwise.
  return Math.ceil(bengali / 2 + other / 4);
}

/**
 * Text that must not be split.
 *
 * Worked examples and derivations are recognised by their opening marker in
 * either language; the guard runs to the end of the block.
 */
const ATOMIC_MARKERS = [
  /^\s*(?:example|worked example|solution|derivation|proof)\b/iu,
  /^\s*(?:উদাহরণ|সমাধান|প্রমাণ|অনুশীলনী)/u,
];

function isAtomic(text: string): boolean {
  return ATOMIC_MARKERS.some((marker) => marker.test(text));
}

/**
 * Splits extracted blocks into chunks.
 *
 * Blocks come from extraction already separated by paragraph or layout
 * boundary, so this packs them rather than cutting arbitrary text.
 */
export function chunkBlocks(blocks: TextBlock[], options = DEFAULT_CHUNKING): Chunk[] {
  const chunks: Chunk[] = [];

  let buffer: TextBlock[] = [];
  let bufferTokens = 0;

  const flush = (): void => {
    if (buffer.length === 0) return;

    const content = buffer
      .map((block) => block.text.trim())
      .filter(Boolean)
      .join('\n\n');

    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex: chunks.length,
        pageNumber: buffer[0]?.pageNumber,
        section: buffer[0]?.section,
        tokenCount: estimateTokens(content),
      });
    }

    // Carry the tail of this chunk into the next, so a question whose answer
    // straddles the boundary still retrieves something useful.
    const overlap = takeOverlap(buffer, options.overlapTokens);
    buffer = overlap;
    bufferTokens = overlap.reduce((sum, block) => sum + estimateTokens(block.text), 0);
  };

  for (const block of blocks) {
    const blockTokens = estimateTokens(block.text);

    // An atomic block that would overflow gets its own chunk rather than
    // being split — an over-long chunk beats a severed derivation.
    if (isAtomic(block.text) && blockTokens > options.targetTokens) {
      flush();
      chunks.push({
        content: block.text.trim(),
        chunkIndex: chunks.length,
        pageNumber: block.pageNumber,
        section: block.section,
        tokenCount: blockTokens,
      });
      buffer = [];
      bufferTokens = 0;
      continue;
    }

    // A section change is a real semantic boundary; do not pack across it.
    const sectionChanged =
      buffer.length > 0 && block.section !== undefined && block.section !== buffer[0]?.section;

    if (sectionChanged || bufferTokens + blockTokens > options.maxTokens) {
      flush();
    }

    buffer.push(block);
    bufferTokens += blockTokens;

    if (bufferTokens >= options.targetTokens) flush();
  }

  // Final flush, without carrying overlap forward into nothing.
  if (buffer.length > 0) {
    const content = buffer
      .map((block) => block.text.trim())
      .filter(Boolean)
      .join('\n\n');

    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex: chunks.length,
        pageNumber: buffer[0]?.pageNumber,
        section: buffer[0]?.section,
        tokenCount: estimateTokens(content),
      });
    }
  }

  return dedupe(chunks);
}

function takeOverlap(buffer: TextBlock[], overlapTokens: number): TextBlock[] {
  const overlap: TextBlock[] = [];
  let tokens = 0;

  for (let i = buffer.length - 1; i >= 0; i -= 1) {
    const block = buffer[i]!;
    const blockTokens = estimateTokens(block.text);
    if (tokens + blockTokens > overlapTokens) break;

    overlap.unshift(block);
    tokens += blockTokens;
  }

  return overlap;
}

/**
 * Drops chunks whose content is identical to an earlier one.
 *
 * Overlap plus a repeated page header produces these, and a duplicate chunk
 * wastes an embedding call and skews retrieval toward whatever it repeats.
 */
function dedupe(chunks: Chunk[]): Chunk[] {
  const seen = new Set<string>();
  const result: Chunk[] = [];

  for (const chunk of chunks) {
    const key = chunk.content.normalize('NFC').replace(/\s+/gu, ' ').trim();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ ...chunk, chunkIndex: result.length });
  }

  return result;
}

/**
 * Normalization — doc 07 Weeks 3–4.
 *
 * "Unicode normalization for Bangla; strip headers/footers/page numbers;
 * repair broken conjuncts if extraction mangles them."
 */
/**
 * Invisible characters that are pure extraction artefacts.
 *
 * Only ZERO WIDTH SPACE and BYTE ORDER MARK. Deliberately **not** ZWJ
 * (U+200D) or ZWNJ (U+200C): in Bangla those are orthographic, not noise.
 * ZWNJ suppresses a conjunct and ZWJ forces a particular conjunct form, so
 * stripping them silently changes how a word renders — the corruption this
 * function exists to prevent, caused by the function itself.
 *
 * Built from a string rather than a regex literal because Prettier rewrites
 * `\u200B` inside a literal into the actual character, which would put
 * invisible characters into this source file.
 */
const EXTRACTION_ARTEFACTS = new RegExp('[\\u200B\\uFEFF]', 'gu');

export function normalizeExtractedText(text: string): string {
  return (
    text
      // NFC first: Bangla conjuncts arrive decomposed from some extractors,
      // and every downstream comparison assumes one canonical form.
      .normalize('NFC')
      .replace(EXTRACTION_ARTEFACTS, '')
      // A bare page number on its own line is a header/footer artefact.
      .replace(/^\s*[\d০-৯]{1,4}\s*$/gmu, '')
      .replace(/[ \t]+/gu, ' ')
      .replace(/\n{3,}/gu, '\n\n')
      .trim()
  );
}

/** Splits normalized text into paragraph blocks. */
export function toBlocks(text: string, pageNumber?: number, section?: string): TextBlock[] {
  return text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({ text: paragraph, pageNumber, section }));
}
