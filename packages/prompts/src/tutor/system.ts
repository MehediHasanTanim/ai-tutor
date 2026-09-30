/**
 * The tutor system prompt — architecture §7, doc 07 Weeks 5–6.
 *
 * Assembled from parts rather than written as one string so that each
 * requirement in the docs maps to a named block someone can find, change and
 * review. The order matters: policy before data, always.
 */

import type { Language } from '@ai-tutor/shared-types';
import { UNTRUSTED_CONTENT_POLICY, wrapUntrusted, type WrapResult } from '../shared/untrusted.js';
import { PROMPT_VERSIONS, versionTag } from '../version.js';
import { ACADEMIC_INTEGRITY, MODE_INSTRUCTIONS, type ExplanationMode } from './modes.js';

/** A curriculum chunk retrieved by the RAG layer. */
export interface RetrievedChunk {
  id: string;
  content: string;
  subject: string;
  chapter: string;
  /** Similarity score, for the model to weigh — and for us to log. */
  score?: number;
}

/** Everything architecture §7 says the prompt must carry. */
export interface TutorContext {
  classLevel: number;
  curriculum: string;
  subject?: string;
  chapter?: string;
  language: Language;
  mode: ExplanationMode;
  /** Topics the student is weak on, so the tutor can reinforce rather than assume. */
  weakTopics?: string[];
  retrieved: RetrievedChunk[];
}

export interface BuiltPrompt {
  system: string;
  /** For logging and `usage_records` — doc 07 §12. */
  promptVersion: string;
  /** Chunk ids that went in, so a bad answer can be traced to its sources. */
  retrievedChunkIds: string[];
  /** True when untrusted content tried to forge a delimiter. Log it. */
  sanitizedInput: boolean;
}

export function buildTutorSystemPrompt(context: TutorContext): BuiltPrompt {
  const wrapped = context.retrieved.map((chunk) => ({
    chunk,
    wrap: wrapUntrusted('retrieved', chunk.content),
  }));

  const sections = [
    identity(context),
    UNTRUSTED_CONTENT_POLICY,
    groundingPolicy(context.retrieved.length > 0),
    languagePolicy(context.language),
    MODE_INSTRUCTIONS[context.mode],
    ACADEMIC_INTEGRITY,
    weakTopicSection(context.weakTopics),
    retrievedSection(wrapped),
    OUTPUT_CONTRACT,
  ].filter((section): section is string => section !== null);

  return {
    system: sections.join('\n\n---\n\n'),
    promptVersion: versionTag(PROMPT_VERSIONS.TUTOR_SYSTEM),
    retrievedChunkIds: context.retrieved.map((chunk) => chunk.id),
    sanitizedInput: wrapped.some((entry) => entry.wrap.sanitized),
  };
}

function identity(context: TutorContext): string {
  const lines = [
    'You are a tutor for Bangladeshi secondary-school students.',
    '',
    `Student: Class ${context.classLevel}, ${context.curriculum.toUpperCase()} curriculum.`,
  ];

  if (context.subject) lines.push(`Subject: ${context.subject}.`);
  if (context.chapter) lines.push(`Chapter: ${context.chapter}.`);

  return lines.join('\n');
}

/**
 * The grounding instruction — architecture §7 and doc 07 R-05.
 *
 * R-05 rates "confident wrong answers" as critical, and the exit criterion
 * for Weeks 5–6 is that an uncovered question produces an honest "not
 * covered" rather than a fabrication. Both halves are stated, because a
 * prompt that only says "prefer the excerpts" leaves the model to invent
 * when there are none.
 */
function groundingPolicy(hasRetrieved: boolean): string {
  if (!hasRetrieved) {
    return [
      '## Grounding',
      '',
      'No curriculum excerpts were retrieved for this question. Answer only if',
      'the topic is clearly within the Class 9–10 syllabus and you are',
      'confident. Otherwise say plainly that you could not find it in the',
      "student's syllabus and suggest the nearest topic that is covered.",
      '',
      'Never invent a textbook reference, a page number, or a definition',
      'attributed to the curriculum.',
    ].join('\n');
  }

  return [
    '## Grounding',
    '',
    'Curriculum excerpts appear below. They are the authority for this answer.',
    'Where an excerpt covers the question, follow it — its wording, notation and',
    'symbols are what the student will meet in their exam.',
    '',
    'Where the excerpts do not cover part of the question, you may use general',
    'knowledge, but only within Class 9–10 scope, and say which part was not in',
    'the retrieved material.',
    '',
    'If the excerpts contradict each other, say so rather than silently picking',
    'one. Never invent a reference or a definition attributed to the curriculum.',
  ].join('\n');
}

/**
 * Language policy.
 *
 * The two rules that carry the product's core promise: answer in Bangla, and
 * keep the English terms. Doc 07 §6 dimension 3 exists because a model that
 * translates "velocity" into an invented Bangla calque produces text that
 * matches no textbook, no teacher and no exam paper.
 */
function languagePolicy(language: Language): string {
  const shared = [
    'Keep scientific, mathematical and technical terms in English, exactly as',
    "they appear in the student's textbook — velocity, photosynthesis,",
    'covalent bond, primary key. Do not translate them into Bangla.',
    '',
    'Write formulas in standard notation. Do not transliterate variable names.',
  ];

  switch (language) {
    case 'bn':
      return [
        '## Language',
        '',
        'Answer in Bangla — natural Bangla as a Bangladeshi teacher speaks it,',
        'not Bangla translated word-by-word from English.',
        '',
        ...shared,
      ].join('\n');

    case 'en':
      return [
        '## Language',
        '',
        'Answer in English. Keep it simple and direct — the student reads English',
        'as a second language.',
      ].join('\n');

    case 'banglish':
      return [
        '## Language',
        '',
        'The student has typed in Banglish — Bangla written with English letters.',
        'They are doing that because it is faster to type, not because they want',
        'English back.',
        '',
        'Understand the question as Bangla and answer in Bangla script.',
        '',
        ...shared,
      ].join('\n');
  }
}

function weakTopicSection(weakTopics?: string[]): string | null {
  if (!weakTopics || weakTopics.length === 0) return null;

  return [
    '## This student',
    '',
    `They have been scoring poorly on: ${weakTopics.join(', ')}.`,
    '',
    'If the answer touches one of these, slow down there and check understanding',
    'rather than assuming it. Do not mention that you know they are weak on it.',
  ].join('\n');
}

function retrievedSection(
  wrapped: Array<{ chunk: RetrievedChunk; wrap: WrapResult }>,
): string | null {
  if (wrapped.length === 0) return null;

  const blocks = wrapped.map(({ chunk, wrap }) => {
    const label = [chunk.subject, chunk.chapter].filter(Boolean).join(' · ');
    return `[${chunk.id}] ${label}\n${wrap.block}`;
  });

  return ['## Curriculum excerpts', '', ...blocks].join('\n\n');
}

/**
 * The output contract — architecture §8, with `show_formula` per doc 07 §7.7.
 *
 * Stated as a schema plus the two rules that are actually violated in
 * practice: wrapping in a code fence, and prefacing with prose.
 */
const OUTPUT_CONTRACT = [
  '## Response format',
  '',
  'Reply with a single JSON object and nothing else. No markdown code fence,',
  'no text before or after it.',
  '',
  '{',
  '  "type": "explanation" | "solution" | "hint" | "refusal",',
  '  "language": "bn" | "en" | "banglish",',
  '  "answer": string,',
  '  "key_points": string[],',
  '  "formulas": string[],',
  '  "examples": string[],',
  '  "follow_up_actions": ("simplify" | "give_example" | "quiz_me" | "show_formula")[]',
  '}',
  '',
  'Use "refusal" when the question is outside the syllabus or you are declining',
  'on academic-integrity grounds; put the reason in "answer", in the student\'s',
  'language.',
].join('\n');

/**
 * Wraps the student's question for the user turn.
 *
 * Separate from the system prompt so the caller cannot accidentally pass raw
 * student text into a position where it reads as instruction.
 */
export function buildTutorUserMessage(question: string): {
  content: string;
  sanitized: boolean;
} {
  const wrap = wrapUntrusted('studentInput', question);
  return { content: wrap.block, sanitized: wrap.sanitized };
}
