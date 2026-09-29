/**
 * Core types for the provider evaluation harness — doc 07 §6.
 *
 * The harness exists so that D-09 (chat LLM), D-10 (vision/OCR) and D-11
 * (embedding model) are decided by measurement rather than reputation. Every
 * type here is shaped by the seven scoring dimensions in §6.
 */

export type { Language } from '@ai-tutor/shared-types';
import type { Language } from '@ai-tutor/shared-types';

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

export type Subject = 'physics' | 'chemistry' | 'biology' | 'math' | 'ict' | 'english';

/**
 * One question, phrased in each language the product supports.
 *
 * The same question in three phrasings is the point: §6 dimension 4 is
 * Banglish comprehension, and you can only measure it by comparing the answer
 * to a Romanized question against the answer to the same question in Bangla.
 */
export interface ChatTestCase {
  id: string;
  subject: Subject;
  classLevel: 9 | 10;
  chapter: string;

  /** The same question in each phrasing. */
  prompts: Record<Language, string>;

  /** What a correct answer must contain. Graded against, not string-matched. */
  reference: {
    /** The answer a teacher would accept. */
    answer: string;
    /** Facts that must appear for the answer to count as correct. */
    requiredFacts: string[];
    /**
     * English terms a Bangla answer should keep in English — doc 07 §6
     * dimension 3. Students expect "velocity", not a coined Bangla calque.
     */
    expectedEnglishTerms: string[];
    /** Formulas the answer should cite, if any. */
    formulas?: string[];
  };

  /**
   * True when the question is deliberately outside the NCTB syllabus. The
   * model should decline rather than answer (doc 07 Weeks 5–6 exit criteria).
   */
  outOfCurriculum?: boolean;

  /** Whether a subject-matter expert has signed off on the reference answer. */
  reviewed: boolean;
}

export interface VisionTestCase {
  id: string;
  /** Path relative to datasets/vision/images. */
  image: string;
  subject: Subject;
  classLevel: 9 | 10;

  /** Conditions this photo deliberately exercises — doc 07 §6. */
  conditions: Array<
    | 'angled'
    | 'shadowed'
    | 'glare'
    | 'creased'
    | 'low_light'
    | 'low_end_camera'
    | 'multi_question'
    | 'handwritten'
    | 'clean'
  >;

  /** The exact question text visible in the photo, transcribed by a human. */
  groundTruthText: string;
  /** Which question to extract when the photo contains several. */
  targetQuestion?: string;
  reviewed: boolean;
}

/**
 * Retrieval probe for D-11.
 *
 * An embedding model that cannot separate Bangla physics from Bangla
 * chemistry makes the whole RAG layer useless, and re-embedding the corpus
 * later is expensive — hence a dedicated probe set.
 */
export interface EmbeddingTestCase {
  id: string;
  query: string;
  queryLanguage: Language;
  /** Chunk id that must rank first. */
  relevantChunkId: string;
  /**
   * Chunks that are topically adjacent but wrong — the same concept from a
   * different subject or class. These are what a weak multilingual model
   * confuses with the right answer.
   */
  hardNegativeChunkIds: string[];
}

export interface EmbeddingChunk {
  id: string;
  content: string;
  subject: Subject;
  classLevel: 9 | 10;
  language: Language;
}

// ---------------------------------------------------------------------------
// Provider results
// ---------------------------------------------------------------------------

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface LatencySample {
  /** Time to first token, ms. The number a student actually perceives. */
  timeToFirstTokenMs: number;
  /** Total wall-clock, ms. */
  totalMs: number;
}

export interface ChatResponse {
  text: string;
  usage: TokenUsage;
  latency: LatencySample;
  /** Parsed structured output, when the candidate returned valid JSON. */
  structured?: unknown;
  /** Populated when the provider declined or errored. */
  error?: string;
}

export interface VisionResponse {
  /** Question text the model read out of the image. */
  extractedText: string;
  usage: TokenUsage;
  latency: LatencySample;
  /** The model's own confidence, when it reports one. */
  confidence?: number;
  error?: string;
}

export interface EmbeddingResponse {
  vectors: number[][];
  usage: Pick<TokenUsage, 'inputTokens'>;
  latency: LatencySample;
  error?: string;
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

/**
 * One scored dimension. `automated` distinguishes what the harness measured
 * from what a human supplied — §6 dimension 2 (Bangla fluency) can only come
 * from a native speaker, and a report that blurs the two is misleading.
 */
export interface DimensionScore {
  dimension: string;
  /** 0–1 for automated checks; 1–5 rescaled to 0–1 for human ratings. */
  score: number;
  automated: boolean;
  notes?: string;
}

export interface CaseResult {
  caseId: string;
  candidateId: string;
  language: Language;
  scores: DimensionScore[];
  usage: TokenUsage;
  latency: LatencySample;
  estimatedCostUsd: number;
  rawOutput: string;
  error?: string;
}

export interface CandidateSummary {
  candidateId: string;
  model: string;
  caseCount: number;
  errorCount: number;

  /** Mean of each dimension across all cases, keyed by dimension name. */
  dimensionMeans: Record<string, number>;

  latency: { p50Ms: number; p95Ms: number; p50TtftMs: number; p95TtftMs: number };
  cost: { totalUsd: number; perQuestionUsd: number };
}

export interface RunReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  suite: 'chat' | 'vision' | 'embedding';
  datasetVersion: string;
  candidates: CandidateSummary[];
  results: CaseResult[];
  /** Cases whose reference answer has not been SME-reviewed. */
  unreviewedCaseIds: string[];
}
