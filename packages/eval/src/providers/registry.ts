/**
 * Candidate registry.
 *
 * D-09, D-10 and D-11 are open by design — this file is where candidates get
 * added as the team gets access to them. Nothing else in the harness needs to
 * change when one appears.
 *
 * Only the Claude adapter ships implemented. Adapters for other providers are
 * a small, well-specified task: implement `EvalCandidate` against that
 * vendor's own SDK, stream the chat call so time-to-first-token is real, and
 * register it below. They are deliberately not stubbed out here — a stub that
 * silently returns nothing would produce a scorecard that looks like a
 * measurement and is not one.
 */

import { AnthropicCandidate } from './anthropic.js';
import type { EvalCandidate } from './provider.js';
import type { PricingTable } from '../metrics/cost.js';

export interface RegistryOptions {
  pricing: PricingTable;
  /** Restrict the run to these candidate ids. */
  only?: string[];
}

/**
 * Builds the candidate list.
 *
 * A candidate whose credentials are absent is skipped with a warning rather
 * than failing the run, so a partial comparison still produces a report.
 */
export function buildCandidates(options: RegistryOptions): EvalCandidate[] {
  const candidates: EvalCandidate[] = [];

  const hasAnthropicCreds =
    Boolean(process.env.ANTHROPIC_API_KEY) ||
    Boolean(process.env.ANTHROPIC_AUTH_TOKEN) ||
    Boolean(process.env.ANTHROPIC_PROFILE);

  if (hasAnthropicCreds) {
    for (const [id, model, effort] of ANTHROPIC_CANDIDATES) {
      const pricing = options.pricing[model];
      if (!pricing) {
        console.warn(`skipping ${id}: no pricing entry for "${model}" in pricing.json`);
        continue;
      }
      candidates.push(new AnthropicCandidate({ id, model, pricing, effort }));
    }
  } else {
    console.warn(
      'skipping Claude candidates: no ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN, and no ' +
        'ANTHROPIC_PROFILE. Run `ant auth login` or export a key.',
    );
  }

  if (!options.only) return candidates;
  return candidates.filter((candidate) => options.only!.includes(candidate.id));
}

/**
 * Which Claude configurations to compare.
 *
 * Effort is swept alongside model, because doc 07 §10 lists model tiering as
 * a cost guardrail: if a cheaper model or a lower effort holds quality on this
 * curriculum, that is the finding, and it is worth more than the model choice
 * itself.
 */
const ANTHROPIC_CANDIDATES: ReadonlyArray<
  [id: string, model: string, effort: 'low' | 'medium' | 'high']
> = [
  ['claude-opus-5-5-medium', 'claude-opus-5-5', 'medium'],
  ['claude-opus-5-5-high', 'claude-opus-5-5', 'high'],
  ['claude-sonnet-5-5-medium', 'claude-sonnet-5-5', 'medium'],
  ['claude-haiku-4-5-medium', 'claude-haiku-4-5', 'medium'],
];
