/**
 * The candidate interface.
 *
 * Mirrors `AIProvider` in architecture §4, narrowed to what evaluation needs.
 * Adding a candidate to the comparison means implementing this and
 * registering it — nothing in the runners, scorers or report knows which
 * providers exist.
 *
 * Deliberately separate from the production `AIProvider` in `apps/api`: the
 * harness needs per-call latency and token usage returned inline, which
 * production code has no reason to carry.
 */

import type { ChatResponse, EmbeddingResponse, Language, VisionResponse } from '../types.js';
import type { ModelPricing } from '../metrics/cost.js';

export interface ChatRequest {
  systemPrompt: string;
  userPrompt: string;
  /** The language the answer is expected in. */
  targetLanguage: Language;
  /** True when the candidate should be asked for the architecture §8 JSON. */
  requireStructuredOutput: boolean;
  maxTokens?: number;
}

export interface VisionRequest {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface EmbeddingRequest {
  texts: string[];
}

export interface EvalCandidate {
  /** Stable id used in results and the report, e.g. "claude-opus-5-5". */
  readonly id: string;
  readonly model: string;
  readonly pricing: ModelPricing;

  /** Which suites this candidate can be measured on. */
  readonly capabilities: {
    chat: boolean;
    vision: boolean;
    embedding: boolean;
  };

  chat?(request: ChatRequest): Promise<ChatResponse>;
  vision?(request: VisionRequest): Promise<VisionResponse>;
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

/**
 * Wraps a call so a provider failure becomes a recorded result rather than an
 * aborted run.
 *
 * A candidate that rate-limits on question 40 of 60 should still produce a
 * scorecard for the 39 that worked, with the failures counted — that is data
 * about the candidate, not a reason to lose the run.
 */
export async function guarded<T extends { error?: string }>(
  call: () => Promise<T>,
  onError: (message: string) => T,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    return onError(error instanceof Error ? error.message : String(error));
  }
}
