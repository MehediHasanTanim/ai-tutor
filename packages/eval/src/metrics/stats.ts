/**
 * Latency statistics — doc 07 §6 dimension 7.
 *
 * p50 and p95, not mean. The mean hides the tail, and the tail is what a
 * student on mobile data actually experiences. Doc 07 §5.4 budgets AI first
 * token at p95 < 2.5 s, so p95 is the number that decides whether a candidate
 * can meet the target at all.
 */

/**
 * Nearest-rank percentile.
 *
 * Chosen over linear interpolation because at n=60 the interpolated value is
 * a number no request actually took, and these results get quoted in a
 * decision document.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p <= 0) return Math.min(...values);
  if (p >= 100) return Math.max(...values);

  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1]!;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  return percentile(values, 50);
}

export interface LatencySummary {
  p50Ms: number;
  p95Ms: number;
  p50TtftMs: number;
  p95TtftMs: number;
  meanTtftMs: number;
  sampleCount: number;
}

export function summarizeLatency(
  samples: Array<{ timeToFirstTokenMs: number; totalMs: number }>,
): LatencySummary {
  const ttft = samples.map((s) => s.timeToFirstTokenMs);
  const total = samples.map((s) => s.totalMs);

  return {
    p50Ms: percentile(total, 50),
    p95Ms: percentile(total, 95),
    p50TtftMs: percentile(ttft, 50),
    p95TtftMs: percentile(ttft, 95),
    meanTtftMs: mean(ttft),
    sampleCount: samples.length,
  };
}
