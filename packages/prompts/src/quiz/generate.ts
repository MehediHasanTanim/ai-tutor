/**
 * Quiz generation — doc 07 Weeks 9–10.
 *
 * Two requirements from the plan shape this prompt:
 *
 *   - "AI quiz generation grounded in retrieved curriculum content, not the
 *     model's general knowledge."
 *   - "Validation layer on generated questions... Reject and regenerate on
 *     failure — generation without validation ships broken quizzes."
 *
 * The server-side validator is the enforcement point. This prompt states the
 * same rules so that most generations pass it on the first attempt: every
 * rejected quiz is a second paid call.
 */

import type { Language } from '@ai-tutor/shared-types';
import { PROMPT_VERSIONS, versionTag } from '../version.js';
import { UNTRUSTED_CONTENT_POLICY, wrapUntrusted } from '../shared/untrusted.js';
import type { RetrievedChunk } from '../tutor/system.js';

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'NUMERICAL';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuizContext {
  classLevel: number;
  curriculum: string;
  subject: string;
  chapter?: string;
  language: Language;
  difficulty: Difficulty;
  questionCount: number;
  types: QuestionType[];
  retrieved: RetrievedChunk[];
}

export function buildQuizGenerationPrompt(context: QuizContext): {
  system: string;
  promptVersion: string;
  retrievedChunkIds: string[];
} {
  const excerpts = context.retrieved.map((chunk) => {
    const wrap = wrapUntrusted('retrieved', chunk.content);
    return `[${chunk.id}]\n${wrap.block}`;
  });

  const system = [
    'You write quiz questions for Bangladeshi secondary-school students.',
    '',
    `Student: Class ${context.classLevel}, ${context.curriculum.toUpperCase()}.`,
    `Subject: ${context.subject}${context.chapter ? ` · ${context.chapter}` : ''}.`,
    `Difficulty: ${context.difficulty}. Count: ${context.questionCount}.`,
    `Types allowed: ${context.types.join(', ')}.`,
    '',
    '---',
    '',
    UNTRUSTED_CONTENT_POLICY,
    '',
    '---',
    '',
    groundingRule(context.retrieved.length > 0),
    '',
    '---',
    '',
    languageRule(context.language),
    '',
    '---',
    '',
    VALIDATION_RULES,
    '',
    '---',
    '',
    excerpts.length > 0 ? ['## Curriculum excerpts', '', ...excerpts].join('\n\n') : '',
    excerpts.length > 0 ? '\n---\n' : '',
    outputContract(context.questionCount),
  ]
    .filter((section) => section !== '')
    .join('\n');

  return {
    system,
    promptVersion: versionTag(PROMPT_VERSIONS.QUIZ_GENERATE),
    retrievedChunkIds: context.retrieved.map((chunk) => chunk.id),
  };
}

function groundingRule(hasRetrieved: boolean): string {
  if (!hasRetrieved) {
    return [
      '## Grounding',
      '',
      'No curriculum excerpts were retrieved. Do not generate a quiz. Return',
      '`{"questions": [], "error": "no_curriculum_content"}` — a quiz invented',
      'from general knowledge will test things the student was never taught.',
    ].join('\n');
  }

  return [
    '## Grounding',
    '',
    'Every question must be answerable from the curriculum excerpts below.',
    'Cite the excerpt id it came from in `source_chunk_id`.',
    '',
    'Do not test facts that are not in the excerpts, however well you know them.',
    "A question the student's textbook does not cover is a question that",
    'punishes them for their syllabus.',
  ].join('\n');
}

/**
 * Doc 07 §7.7 resolves the half-bilingual `quiz_questions` schema by
 * generating per language and dropping the `_bn` columns: "it halves
 * generation cost and avoids half-translated quizzes."
 */
function languageRule(language: Language): string {
  const target = language === 'en' ? 'English' : 'Bangla';

  return [
    '## Language',
    '',
    `Write the entire quiz in ${target} — question, options, answer and`,
    'explanation. Do not mix languages between a question and its options.',
    '',
    target === 'Bangla'
      ? 'Keep scientific and technical terms in English, as the textbook does.'
      : 'Keep the English simple; the student reads it as a second language.',
  ].join('\n');
}

/**
 * Mirrors the server-side validator. Stated here so most generations pass
 * first time — each rejection is a second paid call.
 */
const VALIDATION_RULES = [
  '## Rules every question must satisfy',
  '',
  'These are checked before the quiz reaches a student. A question that fails',
  'is discarded and regenerated, so getting them right the first time matters.',
  '',
  '1. An MCQ has exactly four options and exactly one correct answer.',
  '2. No two options are the same, or paraphrases of each other.',
  '3. `correct_answer` matches one of the options exactly, character for character.',
  '4. No "all of the above" or "none of the above".',
  '5. The wrong options are plausible — a misconception a student actually has,',
  '   not filler. An option nobody would pick tests nothing.',
  '6. `explanation` is non-empty and says why the answer is right, not just',
  '   that it is.',
  '7. A NUMERICAL question states its units, and the answer carries them.',
  '8. No question depends on a diagram, since none is shown.',
  '',
  'Before returning, re-read each question and check it against this list.',
  'Silently fix anything that fails.',
].join('\n');

function outputContract(count: number): string {
  return [
    '## Response format',
    '',
    'Reply with a single JSON object and nothing else. No code fence.',
    '',
    '{',
    '  "questions": [',
    '    {',
    '      "type": "MCQ" | "TRUE_FALSE" | "SHORT" | "NUMERICAL",',
    '      "question": string,',
    '      "options": string[],',
    '      "correct_answer": string,',
    '      "explanation": string,',
    '      "difficulty": "EASY" | "MEDIUM" | "HARD",',
    '      "topic": string,',
    '      "source_chunk_id": string',
    '    }',
    '  ]',
    '}',
    '',
    `Return exactly ${count} questions. Use an empty \`options\` array for SHORT`,
    'and NUMERICAL types.',
  ].join('\n');
}
