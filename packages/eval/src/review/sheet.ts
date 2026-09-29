/**
 * Blind human review — doc 07 §6 dimension 2.
 *
 * Bangla fluency can only be rated by a native speaker, and doc 07 D-09 is
 * explicit that the choice must be made "by measured Bangla quality, not
 * reputation". A review sheet that shows provider names invites exactly the
 * reputation bias the decision register warns against, so this emits shuffled
 * responses behind opaque labels and keeps the mapping in a separate file the
 * reviewer never opens.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { CaseResult } from '../types.js';

export interface ReviewItem {
  /** Opaque label shown to the reviewer, e.g. "R-07". */
  label: string;
  caseId: string;
  language: string;
  questionText: string;
  responseText: string;
}

export interface ReviewSheet {
  sheetId: string;
  createdAt: string;
  items: ReviewItem[];
  instructions: string;
}

/** label -> candidateId. Kept out of the reviewer's file. */
export type ReviewKey = Record<string, { candidateId: string; caseId: string; language: string }>;

export function buildReviewSheet(
  results: CaseResult[],
  questionLookup: (caseId: string, language: string) => string,
): { sheet: ReviewSheet; key: ReviewKey } {
  const sheetId = randomUUID();

  // Deterministic shuffle seeded by the sheet id: the order is unpredictable
  // to the reviewer but reproducible for anyone debugging the sheet later.
  const ordered = shuffle(
    results.filter((result) => !result.error && result.rawOutput.trim() !== ''),
    sheetId,
  );

  const items: ReviewItem[] = [];
  const key: ReviewKey = {};

  ordered.forEach((result, index) => {
    const label = `R-${String(index + 1).padStart(3, '0')}`;

    items.push({
      label,
      caseId: result.caseId,
      language: result.language,
      questionText: questionLookup(result.caseId, result.language),
      responseText: result.rawOutput,
    });

    key[label] = {
      candidateId: result.candidateId,
      caseId: result.caseId,
      language: result.language,
    };
  });

  return {
    sheet: { sheetId, createdAt: new Date().toISOString(), items, instructions: INSTRUCTIONS },
    key,
  };
}

/**
 * Renders the sheet as Markdown for a reviewer who is a teacher, not an
 * engineer — no JSON, no tooling, just a document with a score line to fill in.
 */
export function renderSheetMarkdown(sheet: ReviewSheet): string {
  const lines: string[] = [
    '# AI Tutor — Bangla quality review',
    '',
    `Sheet: \`${sheet.sheetId}\` · Generated ${sheet.createdAt.slice(0, 10)}`,
    '',
    sheet.instructions,
    '',
    '---',
    '',
  ];

  for (const item of sheet.items) {
    lines.push(
      `## ${item.label}`,
      '',
      `**Question (${item.language}):** ${item.questionText}`,
      '',
      '**Answer:**',
      '',
      item.responseText.trim(),
      '',
      '| | Score (1–5) |',
      '|---|---|',
      '| Bangla fluency — does it read as natural Bangla, not translated English? | |',
      '| Terminology — are English scientific terms kept where a student expects them? | |',
      '| Correctness — is it factually right for this class level? | |',
      '',
      '**Comments:**',
      '',
      '---',
      '',
    );
  }

  return lines.join('\n');
}

const INSTRUCTIONS = [
  'Rate each answer on three scales, 1 (poor) to 5 (excellent). Do not skip any.',
  '',
  '**Bangla fluency** — 5 means it reads like a Bangladeshi teacher wrote it. 1 means it',
  'reads like English run through a translator: stiff word order, unnatural compounds,',
  'or Bangla words no student would use.',
  '',
  '**Terminology** — 5 means scientific terms a student meets in English stay in English',
  '("velocity", "photosynthesis"). 1 means they have been translated into invented Bangla',
  'that does not match the textbook.',
  '',
  '**Correctness** — 5 means factually correct and appropriate for Class 9–10. 1 means wrong.',
  '',
  'The answers are shuffled and unlabelled on purpose. You are not meant to know which AI',
  'wrote which answer.',
].join('\n');

/** FNV-1a seeded Fisher-Yates — deterministic given the same seed. */
function shuffle<T>(items: T[], seed: string): T[] {
  const result = [...items];
  let state = Number.parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);

  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return result;
}
