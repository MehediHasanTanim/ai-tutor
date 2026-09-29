/**
 * Retrieval quality — the measurement that decides D-11.
 *
 * Doc 07 D-11: "Must handle Bangla. Changing this later means re-embedding
 * the entire corpus — decide once, deliberately."
 *
 * The test is not "does it produce vectors" but "does a Bangla question rank
 * the right Bangla chunk above a topically adjacent wrong one". Hard negatives
 * are the whole point: any model separates physics from poetry, and the one
 * that matters is Class 10 physics from Class 9 physics.
 */

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export interface RankedChunk {
  chunkId: string;
  score: number;
}

/** Ranks candidate chunks against a query vector, best first. */
export function rank(
  queryVector: number[],
  chunks: Array<{ id: string; vector: number[] }>,
): RankedChunk[] {
  return chunks
    .map((chunk) => ({ chunkId: chunk.id, score: cosineSimilarity(queryVector, chunk.vector) }))
    .sort((a, b) => b.score - a.score);
}

export interface RetrievalMetrics {
  /** Share of queries whose correct chunk appeared in the top k. */
  recallAtK: Record<number, number>;
  /** Mean reciprocal rank — rewards ranking the answer first, not just present. */
  mrr: number;
  /**
   * Share of queries where a hard negative outranked the correct chunk.
   *
   * The number to actually look at. High recall@5 with a high confusion rate
   * means the model retrieves the right chapter and the wrong class alongside
   * it, and the tutor will cite whichever the reranker happens to prefer.
   */
  hardNegativeConfusionRate: number;
  queryCount: number;
}

export function scoreRetrieval(
  results: Array<{
    ranked: RankedChunk[];
    relevantChunkId: string;
    hardNegativeChunkIds: string[];
  }>,
  kValues: number[] = [1, 3, 5, 10],
): RetrievalMetrics {
  if (results.length === 0) {
    return { recallAtK: {}, mrr: 0, hardNegativeConfusionRate: 0, queryCount: 0 };
  }

  const recallAtK: Record<number, number> = {};
  for (const k of kValues) {
    const hits = results.filter((result) =>
      result.ranked.slice(0, k).some((entry) => entry.chunkId === result.relevantChunkId),
    ).length;
    recallAtK[k] = hits / results.length;
  }

  const reciprocalRanks = results.map((result) => {
    const index = result.ranked.findIndex((entry) => entry.chunkId === result.relevantChunkId);
    return index === -1 ? 0 : 1 / (index + 1);
  });

  const confusions = results.filter((result) => {
    const correctIndex = result.ranked.findIndex(
      (entry) => entry.chunkId === result.relevantChunkId,
    );
    const bestNegativeIndex = result.ranked.findIndex((entry) =>
      result.hardNegativeChunkIds.includes(entry.chunkId),
    );

    if (bestNegativeIndex === -1) return false;
    if (correctIndex === -1) return true;
    return bestNegativeIndex < correctIndex;
  }).length;

  return {
    recallAtK,
    mrr: reciprocalRanks.reduce((sum, value) => sum + value, 0) / results.length,
    hardNegativeConfusionRate: confusions / results.length,
    queryCount: results.length,
  };
}

/**
 * Character-level accuracy for OCR — the D-10 measurement.
 *
 * Levenshtein-based rather than exact match, because doc 07 §6 asks for
 * "character-level accuracy on Bangla text": a single mangled conjunct should
 * not score the same as an unreadable line.
 */
export function characterAccuracy(expected: string, actual: string): number {
  const a = expected.normalize('NFC');
  const b = actual.normalize('NFC');

  if (a.length === 0) return b.length === 0 ? 1 : 0;

  const distance = levenshtein(a, b);
  return Math.max(0, 1 - distance / a.length);
}

function levenshtein(a: string, b: string): number {
  // Two rows rather than a full matrix — these strings are short, but the
  // vision set runs every image against every candidate.
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length]!;
}
