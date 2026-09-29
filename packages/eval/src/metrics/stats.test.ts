import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mean, percentile, summarizeLatency } from './stats.js';

describe('percentile', () => {
  it('uses nearest-rank, so the result is a value that actually occurred', () => {
    const values = [10, 20, 30, 40, 50];
    assert.equal(percentile(values, 50), 30);
    assert.equal(percentile(values, 100), 50);
    assert.equal(percentile(values, 0), 10);
  });

  it('does not require sorted input', () => {
    assert.equal(percentile([50, 10, 30, 20, 40], 50), 30);
  });

  it('returns 0 for an empty sample rather than NaN', () => {
    assert.equal(percentile([], 95), 0);
  });

  it('picks the tail value at p95', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(values, 95), 95);
  });

  it('is not fooled by a long tail the way the mean is', () => {
    // The whole reason doc 07 §6 asks for p50/p95 rather than an average:
    // one 10-second response is what the student remembers.
    const values = [100, 100, 100, 100, 100, 100, 100, 100, 100, 10_000];
    assert.equal(percentile(values, 50), 100);
    assert.ok(mean(values) > 1000);
  });
});

describe('summarizeLatency', () => {
  it('reports both time-to-first-token and total', () => {
    const samples = [
      { timeToFirstTokenMs: 800, totalMs: 3000 },
      { timeToFirstTokenMs: 1200, totalMs: 4000 },
      { timeToFirstTokenMs: 2400, totalMs: 9000 },
    ];
    const summary = summarizeLatency(samples);

    assert.equal(summary.p50TtftMs, 1200);
    assert.equal(summary.p95TtftMs, 2400);
    assert.equal(summary.sampleCount, 3);
  });

  it('handles an empty run', () => {
    const summary = summarizeLatency([]);
    assert.equal(summary.p95TtftMs, 0);
    assert.equal(summary.sampleCount, 0);
  });
});
