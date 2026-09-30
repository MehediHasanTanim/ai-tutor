/**
 * The provider abstraction — architecture §4.
 *
 * Every LLM, vision and embedding call in the system goes through this
 * interface. Nothing outside `providers/` imports a vendor SDK, which is what
 * makes D-09, D-10 and D-11 reversible: swapping a provider is adding an
 * adapter and changing a config value, not a refactor.
 *
 * Architecture §4 sketches four methods. This widens `chat` into a streaming
 * variant as well, because doc 07 Weeks 5–6 requires SSE streaming and a
 * buffered-only interface would force every caller to wait for the full
 * answer before showing anything.
 */

import type { Language } from '@ai-tutor/shared-types';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  model: string;
  /** From `packages/prompts`, e.g. "tutor.system@0.1" — doc 07 §12. */
  promptVersion?: string;
  latencyMs: number;
}

/** Every provider response carries usage, so cost recording is never optional. */
export interface ProviderResult<T> {
  data: T;
  usage: ProviderUsage;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatRequest {
  systemPrompt: string;
  /** Prior turns, oldest first. Already wrapped by `packages/prompts`. */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  /** Depth/cost trade-off. Adapters map this onto whatever their vendor calls it. */
  effort?: 'low' | 'medium' | 'high';
}

/** The architecture §8 structured response. */
export interface TutorAnswer {
  type: 'explanation' | 'solution' | 'hint' | 'refusal';
  language: Language;
  answer: string;
  key_points: string[];
  formulas: string[];
  examples: string[];
  follow_up_actions: string[];
}

export interface ChatChunk {
  /** Incremental text. Empty on the final chunk. */
  delta: string;
  /** Present only on the final chunk. */
  usage?: ProviderUsage;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Vision
// ---------------------------------------------------------------------------

export interface ImageAnalysisRequest {
  systemPrompt: string;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  userPrompt?: string;
  maxTokens?: number;
}

export interface ImageAnalysis {
  extracted_question: string;
  detected_language: 'bn' | 'en' | 'mixed';
  /** 0–1. Below the retake threshold the caller must not show an answer. */
  confidence: number;
  retake_reason: string | null;
  subject: string | null;
  chapter_guess: string | null;
  other_questions_visible: string[];
  answer: string | null;
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

export interface EmbeddingRequest {
  texts: string[];
  /** Some providers embed queries and documents differently. */
  inputType?: 'query' | 'document';
}

export interface EmbeddingResult {
  vectors: number[][];
  /**
   * Dimensionality. Recorded because it must match the pgvector column, and a
   * provider change that alters it invalidates the entire corpus (D-11).
   */
  dimensions: number;
}

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

export interface AIProvider {
  readonly name: string;

  /** What this adapter can do. Not every provider does all three. */
  readonly capabilities: {
    chat: boolean;
    streaming: boolean;
    vision: boolean;
    embedding: boolean;
  };

  chat(request: ChatRequest): Promise<ProviderResult<string>>;

  /**
   * Streaming chat. The final chunk carries usage.
   *
   * An async iterator rather than a callback so the SSE controller can simply
   * `for await` and the backpressure story stays the transport's problem.
   */
  streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;

  analyzeImage(request: ImageAnalysisRequest): Promise<ProviderResult<ImageAnalysis>>;

  embed(request: EmbeddingRequest): Promise<ProviderResult<EmbeddingResult>>;
}

/** DI token. Bound in `ai.module.ts` to whichever adapter config selects. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

/**
 * Thrown when a provider fails in a way the caller should surface.
 *
 * Carries an `ErrorCode` so the global exception filter can produce the
 * §5.3 envelope — including the Bangla string — without every call site
 * remembering to map it.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'rate_limit' | 'refusal' | 'invalid_response' | 'upstream',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ProviderError';
  }
}
