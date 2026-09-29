import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { characterAccuracy, cosineSimilarity, rank, scoreRetrieval } from './retrieval.js';

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors and 0 for orthogonal ones', () => {
    assert.ok(Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  it('ignores magnitude', () => {
    assert.ok(Math.abs(cosineSimilarity([1, 1], [10, 10]) - 1) < 1e-9);
  });

  it('returns 0 rather than NaN for a zero vector', () => {
    assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
  });

  it('refuses mismatched dimensions instead of silently comparing', () => {
    assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), /length mismatch/);
  });
});

describe('rank', () => {
  it('orders chunks best-first', () => {
    const ranked = rank(
      [1, 0],
      [
        { id: 'far', vector: [0, 1] },
        { id: 'near', vector: [0.9, 0.1] },
        { id: 'exact', vector: [1, 0] },
      ],
    );

    assert.deepEqual(
      ranked.map((entry) => entry.chunkId),
      ['exact', 'near', 'far'],
    );
  });
});

describe('scoreRetrieval', () => {
  it('computes recall@k and MRR', () => {
    const results = [
      {
        ranked: [
          { chunkId: 'right', score: 0.9 },
          { chunkId: 'wrong', score: 0.5 },
        ],
        relevantChunkId: 'right',
        hardNegativeChunkIds: ['wrong'],
      },
      {
        ranked: [
          { chunkId: 'wrong', score: 0.9 },
          { chunkId: 'right', score: 0.8 },
        ],
        relevantChunkId: 'right',
        hardNegativeChunkIds: ['wrong'],
      },
    ];

    const metrics = scoreRetrieval(results, [1, 3]);

    assert.equal(metrics.recallAtK[1], 0.5);
    assert.equal(metrics.recallAtK[3], 1);
    assert.ok(Math.abs(metrics.mrr - (1 + 0.5) / 2) < 1e-9);
  });

  it('reports hard-negative confusion separately from recall', () => {
    // The number that actually matters for D-11: a model can retrieve the
    // right chapter inside top-5 while consistently ranking the wrong class
    // above it, and the tutor would then cite whichever the reranker prefers.
    const results = [
      {
        ranked: [
          { chunkId: 'class9', score: 0.95 },
          { chunkId: 'class10', score: 0.9 },
        ],
        relevantChunkId: 'class10',
        hardNegativeChunkIds: ['class9'],
      },
    ];

    const metrics = scoreRetrieval(results, [5]);

    assert.equal(metrics.recallAtK[5], 1, 'the right chunk is present…');
    assert.equal(metrics.hardNegativeConfusionRate, 1, '…but it is outranked by the wrong one');
  });

  it('counts a missing correct chunk as a confusion when a negative ranked', () => {
    const metrics = scoreRetrieval([
      {
        ranked: [{ chunkId: 'negative', score: 0.9 }],
        relevantChunkId: 'absent',
        hardNegativeChunkIds: ['negative'],
      },
    ]);

    assert.equal(metrics.mrr, 0);
    assert.equal(metrics.hardNegativeConfusionRate, 1);
  });

  it('handles an empty run', () => {
    const metrics = scoreRetrieval([]);
    assert.equal(metrics.queryCount, 0);
    assert.equal(metrics.mrr, 0);
  });
});

describe('characterAccuracy', () => {
  it('is 1 for an exact transcription', () => {
    const text = 'ত্বরণ কাকে বলে?';
    assert.equal(characterAccuracy(text, text), 1);
  });

  it('degrades gracefully rather than failing a near-miss outright', () => {
    // A single mangled conjunct must not score the same as an unreadable line
    // — that distinction is the point of dimension-level OCR scoring.
    const expected = 'ত্বরণ কাকে বলে?';
    const nearMiss = 'তরণ কাকে বলে?';

    const accuracy = characterAccuracy(expected, nearMiss);
    assert.ok(accuracy > 0.8, `near miss should stay high, got ${accuracy}`);
    assert.ok(accuracy < 1);
  });

  it('scores unrelated text near zero', () => {
    assert.ok(characterAccuracy('ত্বরণ কাকে বলে?', 'completely different') < 0.3);
  });

  it('normalizes so composed and decomposed Bangla compare equal', () => {
    const composed = 'ক্ষ'.normalize('NFC');
    const decomposed = 'ক্ষ'.normalize('NFD');
    assert.equal(characterAccuracy(composed, decomposed), 1);
  });

  it('handles empty strings', () => {
    assert.equal(characterAccuracy('', ''), 1);
    assert.equal(characterAccuracy('', 'x'), 0);
    assert.equal(characterAccuracy('x', ''), 0);
  });
});
