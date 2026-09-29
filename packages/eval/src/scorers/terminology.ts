/**
 * Terminology handling — doc 07 §6 dimension 3.
 *
 * Bangladeshi science students learn "velocity", "photosynthesis" and
 * "covalent bond" as English terms inside Bangla sentences. A model that
 * translates them into invented Bangla calques produces text that is
 * technically Bangla and pedagogically useless — the student then cannot match
 * it to their textbook, their teacher, or their exam paper.
 *
 * This scores the opposite of what a naive "is it Bangla" check would.
 */

export interface TerminologyResult {
  score: number;
  found: string[];
  missing: string[];
}

/**
 * Fraction of expected English terms that survived into the answer.
 *
 * Matching is case-insensitive and tolerates the term appearing in either
 * script-neighbourhood, but requires a word boundary so "ion" does not match
 * inside "combination".
 */
export function scoreTerminology(text: string, expectedTerms: string[]): TerminologyResult {
  if (expectedTerms.length === 0) {
    return { score: 1, found: [], missing: [] };
  }

  const found: string[] = [];
  const missing: string[] = [];

  for (const term of expectedTerms) {
    if (containsTerm(text, term)) {
      found.push(term);
    } else {
      missing.push(term);
    }
  }

  return { score: found.length / expectedTerms.length, found, missing };
}

function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b does not behave usefully next to Bengali characters, so the boundary is
  // expressed as "not a Latin letter or digit" on either side.
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'iu');
  return pattern.test(text);
}

/**
 * Fraction of required facts present in the answer.
 *
 * A blunt keyword check, and deliberately so: it is the cheap pre-filter that
 * runs on every response, in front of the expensive LLM judge. A low score
 * here is a reliable signal the answer is wrong; a high score is not proof it
 * is right, which is why `judge.ts` exists.
 */
export function scoreFactCoverage(text: string, requiredFacts: string[]): TerminologyResult {
  if (requiredFacts.length === 0) {
    return { score: 1, found: [], missing: [] };
  }

  const haystack = normalize(text);
  const found: string[] = [];
  const missing: string[] = [];

  for (const fact of requiredFacts) {
    if (haystack.includes(normalize(fact))) {
      found.push(fact);
    } else {
      missing.push(fact);
    }
  }

  return { score: found.length / requiredFacts.length, found, missing };
}

function normalize(value: string): string {
  // NFC matters for Bangla: the same conjunct can arrive decomposed from one
  // provider and composed from another, and they would not compare equal.
  return value.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
}
