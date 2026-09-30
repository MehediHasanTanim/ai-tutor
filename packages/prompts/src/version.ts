/**
 * Prompt versioning.
 *
 * Doc 07 §3: "`packages/prompts` versions every prompt. A prompt change that
 * alters output quality is a reviewable change, same as code."
 *
 * The version is not decoration. Doc 07 §12 requires the prompt version to be
 * logged on every AI call, and §11 warns that "a prompt tweak that improves
 * one subject can quietly degrade another" — neither is possible unless a
 * given output can be traced back to the exact text that produced it.
 *
 * Rules:
 *   - Bump `minor` for wording changes that could move output quality.
 *   - Bump `major` when the output contract changes, because a consumer has
 *     to change with it.
 *   - Never edit a released prompt's text without bumping. A silent edit
 *     makes every historical eval result unattributable.
 */

export interface PromptVersion {
  id: string;
  version: `${number}.${number}`;
  /** Why this version exists. Read by whoever is diagnosing a regression. */
  changelog: string;
}

export const PROMPT_VERSIONS = {
  TUTOR_SYSTEM: {
    id: 'tutor.system',
    version: '0.1',
    changelog: 'First draft. Grounding, language policy, injection defense, academic integrity.',
  },
  VISION_EXTRACT: {
    id: 'vision.extract',
    version: '0.1',
    changelog: 'First draft. Question extraction with confidence and retake guidance.',
  },
  QUIZ_GENERATE: {
    id: 'quiz.generate',
    version: '0.1',
    changelog: 'First draft. Grounded generation with a self-check before returning.',
  },
} as const satisfies Record<string, PromptVersion>;

export type PromptId = (typeof PROMPT_VERSIONS)[keyof typeof PROMPT_VERSIONS]['id'];

/** Stamp for logs and `usage_records`, e.g. "tutor.system@0.1". */
export function versionTag(prompt: PromptVersion): string {
  return `${prompt.id}@${prompt.version}`;
}
