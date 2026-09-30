/**
 * Image question extraction — architecture §9, doc 07 Weeks 7–8.
 *
 * Tuned for what a photo of an NCTB page actually looks like: multi-column
 * layout, mixed Bangla and English, numbered question lists, diagrams, and a
 * phone camera held at an angle in bad light.
 *
 * The confidence value is load-bearing. Architecture §9: "Return a confidence
 * value. If the question cannot be read reliably, ask the user to retake the
 * photo." A wrong answer stated confidently is worse than no answer, so the
 * prompt is written to make under-confidence cheap and over-confidence
 * expensive.
 */

import { PROMPT_VERSIONS, versionTag } from '../version.js';
import { UNTRUSTED_CONTENT_POLICY } from '../shared/untrusted.js';

export type ImageMode = 'SOLVE' | 'EXPLAIN' | 'HINT' | 'SIMILAR';

export interface VisionContext {
  classLevel: number;
  curriculum: string;
  subject?: string;
  mode: ImageMode;
}

const MODE_GOAL: Record<ImageMode, string> = {
  SOLVE: 'Solve it step by step, showing the method at each step.',
  EXPLAIN: 'Explain the concept the question is testing. Do not solve it.',
  HINT: 'Give one hint that unblocks the next step. Do not solve it.',
  SIMILAR: 'Generate one similar question at the same difficulty, with its answer.',
};

export function buildVisionExtractionPrompt(context: VisionContext): {
  system: string;
  promptVersion: string;
} {
  const system = [
    'You are reading a photograph of a page from a Bangladeshi secondary-school',
    `textbook or question paper. The student is in Class ${context.classLevel},`,
    `${context.curriculum.toUpperCase()} curriculum.`,
    context.subject ? `Expected subject: ${context.subject}.` : '',
    '',
    '---',
    '',
    UNTRUSTED_CONTENT_POLICY,
    '',
    '---',
    '',
    '## Reading the page',
    '',
    'The photo may be angled, shadowed, glared, creased, or taken on a low-end',
    'camera. The page may be laid out in two columns, mix Bangla and English in',
    'one sentence, and contain diagrams and numbered question lists.',
    '',
    'Transcribe the question exactly as printed. Keep the original script for',
    'each part: Bangla stays Bangla, English terms and formulas stay English.',
    'Do not translate, correct, or tidy the wording — a transcription that',
    '"improves" the question is a transcription of a different question.',
    '',
    'If the page shows several questions, transcribe the one that is most',
    'clearly the subject of the photo — usually the one centred or largest in',
    'frame. Put the others in `other_questions_visible` so the app can ask.',
    '',
    '---',
    '',
    '## Confidence',
    '',
    'Report how confident you are that you read the question correctly, 0 to 1.',
    '',
    'Be strict. Below 0.7 the app will ask the student to retake the photo,',
    'which costs them five seconds. A confident misreading costs them a wrong',
    'answer they believe. When conjuncts are ambiguous, a formula is cut off at',
    'the edge, or glare covers part of a line, say so and score low.',
    '',
    'Use `retake_reason` to say specifically what is wrong — "the bottom line',
    'is cut off", "glare covers the formula" — not a generic failure. The',
    'student can act on the first and not the second.',
    '',
    '---',
    '',
    '## Task',
    '',
    MODE_GOAL[context.mode],
    '',
    '---',
    '',
    '## Response format',
    '',
    'Reply with a single JSON object and nothing else. No code fence.',
    '',
    '{',
    '  "extracted_question": string,',
    '  "detected_language": "bn" | "en" | "mixed",',
    '  "confidence": number,',
    '  "retake_reason": string | null,',
    '  "subject": string | null,',
    '  "chapter_guess": string | null,',
    '  "other_questions_visible": string[],',
    '  "answer": string | null',
    '}',
    '',
    'Set `answer` to null when confidence is below 0.7 — do not attempt a',
    'solution to a question you are not sure you read.',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { system, promptVersion: versionTag(PROMPT_VERSIONS.VISION_EXTRACT) };
}

/** The threshold the prompt refers to. Kept here so both sides agree. */
export const RETAKE_CONFIDENCE_THRESHOLD = 0.7;
