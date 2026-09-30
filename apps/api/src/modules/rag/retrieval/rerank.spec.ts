import { diversify, rerank } from './rerank';
import type { VectorCandidate } from './vector-search';
import type { RetrievedChunk } from './retrieval.types';

function candidate(overrides: Partial<VectorCandidate> = {}): VectorCandidate {
  return {
    id: 'c1',
    document_id: 'd1',
    content: 'ত্বরণ হলো বেগের পরিবর্তনের হার।',
    chunk_index: 0,
    page_number: 1,
    section: 'Motion',
    subject_id: 's1',
    chapter_id: 'ch1',
    class_level: 10,
    language: 'BN',
    similarity: 0.8,
    lexical: 0.2,
    ...overrides,
  };
}

describe('rerank', () => {
  it('orders by combined score, highest first', () => {
    const result = rerank(
      [
        candidate({ id: 'low', similarity: 0.5 }),
        candidate({ id: 'high', similarity: 0.95 }),
        candidate({ id: 'mid', similarity: 0.7 }),
      ],
      { queryLanguage: 'bn', topK: 3 },
    );

    expect(result.map((chunk) => chunk.id)).toEqual(['high', 'mid', 'low']);
  });

  it('lets strong lexical overlap promote a chunk the embedding ranked lower', () => {
    // The reason lexical overlap is in the score at all: a student asking
    // about "ত্বরণ" should find the chunk containing that exact word even
    // when the embedding put a paraphrase nearer.
    const result = rerank(
      [
        candidate({ id: 'paraphrase', similarity: 0.82, lexical: 0.0 }),
        candidate({ id: 'exact-term', similarity: 0.72, lexical: 0.95 }),
      ],
      { queryLanguage: 'bn', topK: 2 },
    );

    expect(result[0]!.id).toBe('exact-term');
  });

  it('prefers the language the student reads, all else equal', () => {
    const result = rerank(
      [candidate({ id: 'en', language: 'EN' }), candidate({ id: 'bn', language: 'BN' })],
      { queryLanguage: 'banglish', topK: 2 },
    );

    expect(result[0]!.id).toBe('bn');
  });

  it('still returns the other language rather than dropping it', () => {
    // An English chunk is worth retrieving for a Bangla question when it is
    // the only one there.
    const result = rerank([candidate({ id: 'en-only', language: 'EN' })], {
      queryLanguage: 'bn',
      topK: 3,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBeGreaterThan(0);
  });

  it('gives a small bonus to the chapter the student is studying', () => {
    const result = rerank(
      [
        candidate({ id: 'other-chapter', chapter_id: 'ch9' }),
        candidate({ id: 'this-chapter', chapter_id: 'ch1' }),
      ],
      { queryLanguage: 'bn', chapterId: 'ch1', topK: 2 },
    );

    expect(result[0]!.id).toBe('this-chapter');
  });

  it('does not let the chapter bonus outweigh a much better match', () => {
    // The bonus is a tiebreaker, not a filter. A far more relevant chunk
    // from another chapter must still win.
    const result = rerank(
      [
        candidate({ id: 'right-chapter-poor-match', chapter_id: 'ch1', similarity: 0.3 }),
        candidate({ id: 'other-chapter-great-match', chapter_id: 'ch9', similarity: 0.95 }),
      ],
      { queryLanguage: 'bn', chapterId: 'ch1', topK: 2 },
    );

    expect(result[0]!.id).toBe('other-chapter-great-match');
  });

  it('truncates to topK', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      candidate({ id: `c${i}`, page_number: i, similarity: 0.9 - i * 0.01 }),
    );

    expect(rerank(candidates, { queryLanguage: 'bn', topK: 5 })).toHaveLength(5);
  });

  it('exposes the component scores for the retrieval log', () => {
    const [chunk] = rerank([candidate({ similarity: 0.8, lexical: 0.4 })], {
      queryLanguage: 'bn',
      topK: 1,
    });

    expect(chunk!.vectorScore).toBe(0.8);
    expect(chunk!.lexicalScore).toBe(0.4);
    expect(chunk!.score).toBeGreaterThan(0);
  });

  it('survives a non-finite similarity without producing NaN', () => {
    const [chunk] = rerank([candidate({ similarity: Number.NaN })], {
      queryLanguage: 'bn',
      topK: 1,
    });

    expect(Number.isNaN(chunk!.score)).toBe(false);
  });

  it('returns nothing for no candidates', () => {
    expect(rerank([], { queryLanguage: 'bn', topK: 5 })).toEqual([]);
  });
});

describe('diversify', () => {
  function chunk(id: string, documentId: string, page: number | null): RetrievedChunk {
    return {
      id,
      documentId,
      content: 'x',
      chunkIndex: 0,
      pageNumber: page,
      section: null,
      subjectId: 's1',
      chapterId: 'ch1',
      classLevel: 10,
      language: 'BN',
      vectorScore: 0.8,
      lexicalScore: 0,
      score: 0.8,
    };
  }

  it('caps how many chunks come from one page', () => {
    // Adjacent chunks overlap, so they score almost identically and top-5
    // becomes five views of one paragraph — a narrow context that looks rich.
    const sameePage = Array.from({ length: 6 }, (_, i) => chunk(`c${i}`, 'd1', 1));
    const otherPages = [chunk('other1', 'd1', 2), chunk('other2', 'd1', 3)];

    const result = diversify([...sameePage, ...otherPages], 4);
    const fromPageOne = result.filter((c) => c.pageNumber === 1);

    expect(fromPageOne.length).toBeLessThanOrEqual(2);
    expect(result).toHaveLength(4);
  });

  it('treats the same page number in different documents as different pages', () => {
    const result = diversify([chunk('a', 'd1', 1), chunk('b', 'd2', 1), chunk('c', 'd3', 1)], 3);
    expect(result).toHaveLength(3);
  });

  it('backfills rather than returning fewer than asked for', () => {
    // A thin corpus may legitimately have one relevant page; returning two
    // chunks when five were requested would starve the tutor's context.
    const allOnePage = Array.from({ length: 5 }, (_, i) => chunk(`c${i}`, 'd1', 1));
    expect(diversify(allOnePage, 5)).toHaveLength(5);
  });

  it('keeps the highest-scoring chunks when capping', () => {
    const chunks = [
      { ...chunk('best', 'd1', 1), score: 0.95 },
      { ...chunk('second', 'd1', 1), score: 0.9 },
      { ...chunk('third', 'd1', 1), score: 0.85 },
    ];

    const result = diversify(chunks, 2);
    expect(result.map((c) => c.id)).toEqual(['best', 'second']);
  });

  it('groups chunks with no page number together', () => {
    const noPage = Array.from({ length: 4 }, (_, i) => chunk(`c${i}`, 'd1', null));
    const result = diversify(noPage, 4);
    expect(result).toHaveLength(4);
  });
});
