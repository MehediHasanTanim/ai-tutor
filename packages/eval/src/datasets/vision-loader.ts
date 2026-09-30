/**
 * Vision dataset loading and coverage checking — D-10.
 *
 * Stricter than the chat loader, because the vision set has a failure mode
 * the chat set does not: a set of 30 clean, flat, well-lit photos would pass
 * any modern model and report an accuracy number that collapses the moment a
 * real student photographs their textbook at night. Doc 07 §6 asks for bad
 * conditions *deliberately*; this validates that they are actually present.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { DATASET_ROOT } from './loader.js';
import type { VisionTestCase } from '../types.js';

export const VISION_CONDITIONS = [
  'angled',
  'shadowed',
  'glare',
  'creased',
  'low_light',
  'low_end_camera',
  'multi_question',
  'handwritten',
  'clean',
] as const;

/** Minimum photos per condition before the set can support a decision. */
const MIN_PER_CONDITION = 5;

const visionCaseSchema = z.object({
  id: z.string().min(1),
  /** Marks the shape example in the committed manifest. Never counted. */
  placeholder: z.boolean().optional(),
  image: z.string().min(1),
  subject: z.enum(['physics', 'chemistry', 'biology', 'math', 'ict', 'english']),
  classLevel: z.union([z.literal(9), z.literal(10)]),
  conditions: z.array(z.enum(VISION_CONDITIONS)).min(1),
  groundTruthText: z.string().min(1),
  targetQuestion: z.string().nullable().optional(),
  reviewed: z.boolean(),
});

const visionDatasetSchema = z.object({
  version: z.string(),
  targetSize: z.number().int().positive(),
  note: z.string().optional(),
  cases: z.array(visionCaseSchema),
});

export interface VisionDataset {
  version: string;
  targetSize: number;
  /** Real cases only — placeholders are excluded. */
  cases: VisionTestCase[];
  warnings: string[];
  /** True when the set can support the D-10 decision. */
  usable: boolean;
}

export function loadVisionDataset(
  manifestPath = resolve(DATASET_ROOT, 'vision/manifest.json'),
  imagesDir = resolve(DATASET_ROOT, 'vision/images'),
): VisionDataset {
  const parsed = visionDatasetSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const warnings: string[] = [];

  const real = parsed.cases.filter((entry) => !entry.placeholder);

  // Every manifest entry needs its file, and every file needs its entry —
  // an orphan image is a photo someone took and nobody scored.
  const referenced = new Set<string>();
  for (const entry of real) {
    referenced.add(entry.image);
    if (!existsSync(resolve(imagesDir, entry.image))) {
      warnings.push(`${entry.id}: image "${entry.image}" is missing from images/`);
    }
    if (!entry.reviewed) {
      warnings.push(`${entry.id}: transcription has not been second-checked.`);
    }
  }

  if (existsSync(imagesDir)) {
    const orphans = readdirSync(imagesDir).filter(
      (file) => /\.(jpe?g|png|webp)$/iu.test(file) && !referenced.has(file),
    );
    for (const orphan of orphans) {
      warnings.push(`images/${orphan} is not referenced by any manifest entry.`);
    }
  }

  if (real.length < parsed.targetSize) {
    warnings.push(
      `Vision set holds ${real.length} of the ${parsed.targetSize} photos doc 07 §6 asks for. ` +
        'D-10 cannot be decided from this, and R-03 stays untested.',
    );
  }

  // The coverage check that matters: bad conditions must actually be present.
  const counts = countConditions(real);
  const adversarial = VISION_CONDITIONS.filter((condition) => condition !== 'clean');

  for (const condition of adversarial) {
    const count = counts[condition] ?? 0;
    if (count < MIN_PER_CONDITION) {
      warnings.push(
        `only ${count} photo(s) exercise "${condition}" (want ${MIN_PER_CONDITION}). ` +
          'A set without bad conditions measures the best case, not the real one.',
      );
    }
  }

  return {
    version: parsed.version,
    targetSize: parsed.targetSize,
    cases: real as VisionTestCase[],
    warnings,
    usable: real.length >= parsed.targetSize && warnings.length === 0,
  };
}

export function countConditions(
  cases: Array<{ conditions: readonly string[] }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of cases) {
    for (const condition of entry.conditions) {
      counts[condition] = (counts[condition] ?? 0) + 1;
    }
  }
  return counts;
}
