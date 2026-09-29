/**
 * Instruction adherence — doc 07 §6 dimension 5.
 *
 * Architecture §8 defines the structured response the tutor depends on. A
 * model that writes beautiful Bangla but ignores the JSON contract cannot
 * back this product: the app renders `key_points`, `formulas` and
 * `follow_up_actions` as distinct UI, not as prose.
 */

import { z } from 'zod';
import { FollowUpAction } from '@ai-tutor/shared-types';

/** The contract from architecture §8, with `show_formula` added per doc 07 §7.7. */
export const tutorResponseSchema = z.object({
  type: z.enum(['explanation', 'solution', 'hint', 'refusal']),
  language: z.enum(['bn', 'en', 'banglish']),
  answer: z.string().min(1),
  key_points: z.array(z.string()).default([]),
  formulas: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  follow_up_actions: z
    .array(z.enum(Object.values(FollowUpAction) as [string, ...string[]]))
    .default([]),
});

export type TutorResponse = z.infer<typeof tutorResponseSchema>;

export interface StructureResult {
  score: number;
  parsed?: TutorResponse;
  /** Why it failed, for the report. */
  issues: string[];
}

/**
 * Scores JSON contract adherence on a 0–1 scale rather than pass/fail.
 *
 * Partial credit is deliberate: "returned valid JSON but omitted key_points"
 * and "returned prose with no JSON at all" are different failures, and a
 * binary score would rank them the same when choosing between candidates.
 */
export function scoreStructure(rawText: string): StructureResult {
  const issues: string[] = [];

  const json = extractJson(rawText);
  if (json === null) {
    return { score: 0, issues: ['no JSON object found in the response'] };
  }

  if (json.wasFenced) {
    // Not fatal — the app can strip a fence — but a model that always wraps
    // is one prompt revision away from a parser change.
    issues.push('JSON was wrapped in a markdown code fence');
  }
  if (json.hadPreamble) {
    issues.push('response contained prose before the JSON');
  }

  const parsed = tutorResponseSchema.safeParse(json.value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }

    // Valid JSON with a wrong shape still beats no JSON at all.
    const required = Object.keys(tutorResponseSchema.shape);
    const present =
      typeof json.value === 'object' && json.value !== null
        ? Object.keys(json.value as object).filter((key) => required.includes(key))
        : [];

    return { score: 0.25 + 0.5 * (present.length / required.length), issues };
  }

  // Clean parse, but penalise the cosmetic problems that make parsing fragile.
  const penalty = (json.wasFenced ? 0.05 : 0) + (json.hadPreamble ? 0.1 : 0);
  return { score: Math.max(0, 1 - penalty), parsed: parsed.data, issues };
}

interface ExtractedJson {
  value: unknown;
  wasFenced: boolean;
  hadPreamble: boolean;
}

/**
 * Pulls a JSON object out of a response that may be wrapped or prefaced.
 *
 * Models do all three of: return bare JSON, wrap it in ```json fences, and
 * preface it with "Here is the response:". The harness has to see through all
 * of them to score the *content* separately from the packaging.
 */
function extractJson(raw: string): ExtractedJson | null {
  const trimmed = raw.trim();

  const direct = tryParse(trimmed);
  if (direct !== undefined) {
    return { value: direct, wasFenced: false, hadPreamble: false };
  }

  const fence = /```(?:json)?\s*([\s\S]*?)```/u.exec(trimmed);
  if (fence?.[1]) {
    const value = tryParse(fence[1].trim());
    if (value !== undefined) {
      return {
        value,
        wasFenced: true,
        hadPreamble: trimmed.indexOf(fence[0]) > 0,
      };
    }
  }

  // Last resort: the outermost brace pair.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const value = tryParse(trimmed.slice(start, end + 1));
    if (value !== undefined) {
      return { value, wasFenced: false, hadPreamble: start > 0 };
    }
  }

  return null;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
