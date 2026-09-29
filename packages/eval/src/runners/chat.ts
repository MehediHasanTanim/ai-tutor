/**
 * Chat suite — the D-09 measurement.
 *
 * Runs every case in every language against every candidate and scores the
 * five dimensions that can be automated. Dimension 2 (Bangla fluency) is not
 * here by design: it needs a native speaker, and the review sheet is how it
 * gets collected.
 */

import type { Language } from '@ai-tutor/shared-types';
import { estimateCostUsd } from '../metrics/cost.js';
import { summarizeLatency } from '../metrics/stats.js';
import { scoreScriptMatch } from '../scorers/script.js';
import { scoreStructure } from '../scorers/structure.js';
import { scoreFactCoverage, scoreTerminology } from '../scorers/terminology.js';
import type { EvalCandidate } from '../providers/provider.js';
import type { CandidateSummary, CaseResult, ChatTestCase, DimensionScore } from '../types.js';

const LANGUAGES: Language[] = ['bn', 'en', 'banglish'];

/**
 * The tutor system prompt used for evaluation.
 *
 * Deliberately close to what production will send (architecture §7), because
 * a candidate measured under a different prompt than it will run under is not
 * measured. Kept here rather than in `packages/prompts` only until that
 * package exists — at which point this should import from it.
 */
export function buildSystemPrompt(testCase: ChatTestCase, language: Language): string {
  return [
    'You are a tutor for Bangladeshi students following the NCTB national curriculum.',
    `The student is in Class ${testCase.classLevel} and is asking about ${testCase.subject}.`,
    '',
    languageInstruction(language),
    '',
    'Keep scientific and technical terms in English, the way they appear in the',
    "student's textbook. Do not translate them into Bangla.",
    '',
    'If the question falls outside the Class 9-10 NCTB syllabus, say so plainly and',
    'suggest the nearest topic that is covered. Do not attempt an answer.',
    '',
    'Respond with a single JSON object and nothing else:',
    '{"type":"explanation"|"solution"|"hint"|"refusal","language":"bn"|"en"|"banglish",',
    '"answer":string,"key_points":string[],"formulas":string[],"examples":string[],',
    '"follow_up_actions":("simplify"|"give_example"|"quiz_me"|"show_formula")[]}',
  ].join('\n');
}

function languageInstruction(language: Language): string {
  switch (language) {
    case 'bn':
      return 'Answer in natural Bangla, as a Bangladeshi teacher would speak it.';
    case 'en':
      return 'Answer in English.';
    case 'banglish':
      // The instruction that makes dimension 4 a real test: Banglish in,
      // Bangla out. Doc 02 §2 treats Romanized input as a typing convenience.
      return [
        'The student has typed their question in Banglish (Bangla written with English',
        'letters). Understand it as Bangla and answer in natural Bangla script.',
      ].join(' ');
  }
}

export interface ChatRunOptions {
  cases: ChatTestCase[];
  candidates: EvalCandidate[];
  languages?: Language[];
  /** Called after each case so a long run shows progress. */
  onProgress?: (done: number, total: number, label: string) => void;
}

export async function runChatSuite(
  options: ChatRunOptions,
): Promise<{ results: CaseResult[]; summaries: CandidateSummary[] }> {
  const languages = options.languages ?? LANGUAGES;
  const chatCandidates = options.candidates.filter((candidate) => candidate.capabilities.chat);

  const results: CaseResult[] = [];
  const total = chatCandidates.length * options.cases.length * languages.length;
  let done = 0;

  for (const candidate of chatCandidates) {
    for (const testCase of options.cases) {
      for (const language of languages) {
        const result = await runOne(candidate, testCase, language);
        results.push(result);

        done += 1;
        options.onProgress?.(done, total, `${candidate.id} · ${testCase.id} · ${language}`);
      }
    }
  }

  return { results, summaries: summarize(chatCandidates, results) };
}

async function runOne(
  candidate: EvalCandidate,
  testCase: ChatTestCase,
  language: Language,
): Promise<CaseResult> {
  const empty = { inputTokens: 0, outputTokens: 0 };
  const noLatency = { timeToFirstTokenMs: 0, totalMs: 0 };

  if (!candidate.chat) {
    return {
      caseId: testCase.id,
      candidateId: candidate.id,
      language,
      scores: [],
      usage: empty,
      latency: noLatency,
      estimatedCostUsd: 0,
      rawOutput: '',
      error: 'candidate does not implement chat',
    };
  }

  let response;
  try {
    response = await candidate.chat({
      systemPrompt: buildSystemPrompt(testCase, language),
      userPrompt: testCase.prompts[language],
      targetLanguage: language,
      requireStructuredOutput: true,
    });
  } catch (error) {
    // A provider failure is data about the candidate, not a reason to lose
    // the other 59 results.
    return {
      caseId: testCase.id,
      candidateId: candidate.id,
      language,
      scores: [],
      usage: empty,
      latency: noLatency,
      estimatedCostUsd: 0,
      rawOutput: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const cost = estimateCostUsd(response.usage, candidate.pricing);

  return {
    caseId: testCase.id,
    candidateId: candidate.id,
    language,
    scores: response.error ? [] : scoreResponse(response.text, testCase, language),
    usage: response.usage,
    latency: response.latency,
    estimatedCostUsd: cost,
    rawOutput: response.text,
    error: response.error,
  };
}

export function scoreResponse(
  text: string,
  testCase: ChatTestCase,
  language: Language,
): DimensionScore[] {
  const structure = scoreStructure(text);

  // Score the answer field when the JSON parsed; otherwise the whole response,
  // so a candidate that ignores the contract is still graded on content.
  const answerText = structure.parsed?.answer ?? text;

  const scores: DimensionScore[] = [
    {
      dimension: 'instruction_adherence',
      score: structure.score,
      automated: true,
      notes: structure.issues.join('; ') || undefined,
    },
    {
      dimension: 'script_match',
      score: scoreScriptMatch(answerText, language),
      automated: true,
    },
  ];

  if (testCase.outOfCurriculum) {
    // For an out-of-syllabus probe the correct behaviour is refusal, so
    // "fact coverage" is meaningless and would reward a confident fabrication.
    const refused =
      structure.parsed?.type === 'refusal' ||
      /not (?:covered|in)|সিলেবাসে নেই|পাঠ্যসূচিতে নেই/iu.test(answerText);

    scores.push({
      dimension: 'declines_out_of_curriculum',
      score: refused ? 1 : 0,
      automated: true,
      notes: refused ? undefined : 'answered a question outside the syllabus',
    });

    return scores;
  }

  const terminology = scoreTerminology(answerText, testCase.reference.expectedEnglishTerms);
  const facts = scoreFactCoverage(answerText, testCase.reference.requiredFacts);

  scores.push(
    {
      dimension: 'terminology',
      score: terminology.score,
      automated: true,
      notes:
        terminology.missing.length > 0 ? `missing: ${terminology.missing.join(', ')}` : undefined,
    },
    {
      dimension: 'fact_coverage',
      score: facts.score,
      automated: true,
      notes: facts.missing.length > 0 ? `missing: ${facts.missing.join(', ')}` : undefined,
    },
  );

  return scores;
}

function summarize(candidates: EvalCandidate[], results: CaseResult[]): CandidateSummary[] {
  return candidates.map((candidate) => {
    const own = results.filter((result) => result.candidateId === candidate.id);
    const successful = own.filter((result) => !result.error);

    const dimensionMeans: Record<string, number> = {};
    const buckets = new Map<string, number[]>();

    for (const result of successful) {
      for (const score of result.scores) {
        const bucket = buckets.get(score.dimension) ?? [];
        bucket.push(score.score);
        buckets.set(score.dimension, bucket);
      }
    }
    for (const [dimension, values] of buckets) {
      dimensionMeans[dimension] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    const totalCost = own.reduce((sum, result) => sum + result.estimatedCostUsd, 0);
    const latency = summarizeLatency(successful.map((result) => result.latency));

    return {
      candidateId: candidate.id,
      model: candidate.model,
      caseCount: own.length,
      errorCount: own.length - successful.length,
      dimensionMeans,
      latency: {
        p50Ms: latency.p50Ms,
        p95Ms: latency.p95Ms,
        p50TtftMs: latency.p50TtftMs,
        p95TtftMs: latency.p95TtftMs,
      },
      cost: {
        totalUsd: totalCost,
        perQuestionUsd: own.length === 0 ? 0 : totalCost / own.length,
      },
    };
  });
}
