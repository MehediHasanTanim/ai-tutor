/**
 * Dataset loading and validation.
 *
 * The schemas here are strict on purpose. A test set is the measuring
 * instrument for a one-way decision (D-11 in particular — changing the
 * embedding model means re-embedding the whole corpus), and a silently
 * malformed case would produce a scorecard that looks authoritative and
 * measures the wrong thing.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { looksLikeBanglish } from '../scorers/script.js';
import type { ChatTestCase, EmbeddingChunk, EmbeddingTestCase } from '../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATASET_ROOT = resolve(HERE, '../../datasets');

const subjectSchema = z.enum(['physics', 'chemistry', 'biology', 'math', 'ict', 'english']);
const languageSchema = z.enum(['bn', 'en', 'banglish']);

const chatCaseSchema = z.object({
  id: z.string().min(1),
  subject: subjectSchema,
  classLevel: z.union([z.literal(9), z.literal(10)]),
  chapter: z.string(),
  prompts: z.object({
    bn: z.string().min(1),
    en: z.string().min(1),
    banglish: z.string().min(1),
  }),
  reference: z.object({
    answer: z.string().min(1),
    requiredFacts: z.array(z.string()),
    expectedEnglishTerms: z.array(z.string()),
    formulas: z.array(z.string()).optional(),
  }),
  outOfCurriculum: z.boolean().optional(),
  reviewed: z.boolean(),
});

const chatDatasetSchema = z.object({
  version: z.string(),
  targetSize: z.number().int().positive(),
  note: z.string().optional(),
  cases: z.array(chatCaseSchema).min(1),
});

export interface ChatDataset {
  version: string;
  targetSize: number;
  cases: ChatTestCase[];
  /** Problems that do not block the run but should be visible. */
  warnings: string[];
}

export function loadChatDataset(path = resolve(DATASET_ROOT, 'chat/questions.json')): ChatDataset {
  const parsed = chatDatasetSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  const warnings: string[] = [];

  const ids = new Set<string>();
  for (const testCase of parsed.cases) {
    if (ids.has(testCase.id)) {
      throw new Error(`Duplicate case id "${testCase.id}" in ${path}`);
    }
    ids.add(testCase.id);

    // A "banglish" prompt containing Bengali characters is mislabelled, and
    // would make §6 dimension 4 silently measure nothing.
    if (!looksLikeBanglish(testCase.prompts.banglish)) {
      warnings.push(
        `${testCase.id}: the "banglish" prompt does not look like Romanized Bangla — ` +
          'dimension 4 (Banglish comprehension) will not be measuring what it claims to.',
      );
    }

    if (!testCase.reviewed) {
      warnings.push(`${testCase.id}: reference answer has not been SME-reviewed.`);
    }
  }

  if (parsed.cases.length < parsed.targetSize) {
    warnings.push(
      `Dataset holds ${parsed.cases.length} of the ${parsed.targetSize} cases doc 07 §6 asks for. ` +
        'Results are directional, not conclusive.',
    );
  }

  return {
    version: parsed.version,
    targetSize: parsed.targetSize,
    cases: parsed.cases as ChatTestCase[],
    warnings,
  };
}

const embeddingChunkSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  subject: subjectSchema,
  classLevel: z.union([z.literal(9), z.literal(10)]),
  language: languageSchema,
});

const embeddingProbeSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  queryLanguage: languageSchema,
  relevantChunkId: z.string().min(1),
  hardNegativeChunkIds: z.array(z.string()),
  note: z.string().optional(),
});

const embeddingDatasetSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  chunks: z.array(embeddingChunkSchema).min(1),
  probes: z.array(embeddingProbeSchema).min(1),
});

export interface EmbeddingDataset {
  version: string;
  chunks: EmbeddingChunk[];
  probes: EmbeddingTestCase[];
  warnings: string[];
}

export function loadEmbeddingDataset(
  path = resolve(DATASET_ROOT, 'embedding/retrieval-probes.json'),
): EmbeddingDataset {
  const parsed = embeddingDatasetSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  const warnings: string[] = [];

  const chunkIds = new Set(parsed.chunks.map((chunk) => chunk.id));

  for (const probe of parsed.probes) {
    // A dangling reference would quietly score as "the model failed to
    // retrieve it", which is a false accusation against the candidate.
    if (!chunkIds.has(probe.relevantChunkId)) {
      throw new Error(`Probe ${probe.id} references unknown chunk "${probe.relevantChunkId}"`);
    }
    for (const negativeId of probe.hardNegativeChunkIds) {
      if (!chunkIds.has(negativeId)) {
        throw new Error(`Probe ${probe.id} references unknown hard negative "${negativeId}"`);
      }
    }
    if (probe.hardNegativeChunkIds.length === 0) {
      warnings.push(
        `${probe.id}: no hard negatives. Any embedding model passes a probe with only ` +
          'easy distractors, so this one contributes nothing to the D-11 decision.',
      );
    }
  }

  return {
    version: parsed.version,
    chunks: parsed.chunks as EmbeddingChunk[],
    probes: parsed.probes as EmbeddingTestCase[],
    warnings,
  };
}
