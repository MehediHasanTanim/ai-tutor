/**
 * Query language detection — the first stage of retrieval.
 *
 * Three languages, and the third is the hard one. Bangla and English separate
 * trivially by script. Banglish — Bangla written in Latin letters — looks
 * exactly like English to a script check, and telling them apart matters for
 * two reasons: the tutor prompt differs (doc 02 §2 treats Banglish as an
 * input mode wanting Bangla output), and retrieval should prefer Bangla
 * chunks for a Banglish question even though the query has no Bengali in it.
 */

import type { QueryLanguage } from './retrieval.types';

const BENGALI = /[ঀ-৿]/u;
const BENGALI_GLOBAL = /[ঀ-৿]/gu;
const LATIN_GLOBAL = /[A-Za-z]/gu;

/**
 * Romanized Bangla function words.
 *
 * Function words rather than content words on purpose: a Banglish physics
 * question contains "velocity" and "acceleration" just as an English one
 * does, so content words carry no signal. What differs is the grammar around
 * them — "ki", "kake", "koro", "bujhiye dao".
 *
 * Kept in sync with the same list in `packages/eval`, which uses it to
 * validate that the test set's Banglish prompts really are Banglish.
 */
const BANGLISH_MARKERS = new Set([
  // interrogatives
  'ki',
  'kake',
  'kano',
  'keno',
  'kivabe',
  'kibhabe',
  'kothay',
  'koto',
  'kon',
  'kar',
  // imperatives — most homework questions are one
  'bolo',
  'bujhiye',
  'bujhao',
  'koro',
  'kore',
  'korte',
  'dekhao',
  'lekho',
  'likho',
  'ber',
  'nirnoy',
  'somadhan',
  'bakkha',
  'bornona',
  'dao',
  'debe',
  // pronouns and copulas
  'ekta',
  'amake',
  'amar',
  'ami',
  'tumi',
  'tar',
  'eta',
  'era',
  'oi',
  'hoy',
  'hobe',
  'hole',
  'holo',
  'ache',
  'chilo',
  'noy',
  // particles and suffixes that appear as standalone tokens
  'gulo',
  'gula',
  'ta',
  'ti',
  'er',
  'ar',
  'soho',
  'diye',
  'theke',
  'jonno',
  'moddhe',
  // common question-stem nouns
  'niyom',
  'sutro',
  'proshno',
  'uttor',
  'pora',
  'shikha',
  'parthokko',
  'karon',
  'ortho',
  'prokriya',
  'mane',
]);

export interface LanguageDetection {
  language: QueryLanguage;
  /** 0–1. Low confidence on a short query is expected, not a problem. */
  confidence: number;
  /** Which Banglish markers fired, for the retrieval log. */
  matchedMarkers: string[];
}

export function detectQueryLanguage(query: string): LanguageDetection {
  const bengaliCount = (query.match(BENGALI_GLOBAL) ?? []).length;
  const latinCount = (query.match(LATIN_GLOBAL) ?? []).length;

  // Any Bengali script at all means Bangla. A Bangla question containing
  // "velocity" is still a Bangla question, and the reverse — an English
  // question with one Bengali word — is vanishingly rare in practice.
  if (bengaliCount > 0) {
    const total = bengaliCount + latinCount;
    return {
      language: 'bn',
      confidence: total === 0 ? 0.5 : Math.min(1, 0.6 + (bengaliCount / total) * 0.4),
      matchedMarkers: [],
    };
  }

  if (latinCount === 0) {
    // Digits, symbols, or a bare formula. Default to the student's primary
    // language rather than guessing from nothing.
    return { language: 'bn', confidence: 0.3, matchedMarkers: [] };
  }

  const words = query
    .toLowerCase()
    .split(/[^a-z]+/u)
    .filter(Boolean);
  const matched = words.filter((word) => BANGLISH_MARKERS.has(word));

  // Share, not raw count. Several markers are short words that also occur in
  // English — "ta", "er", "ar", "ki" — so one of them inside a long English
  // sentence is noise, while the same word in a five-word question is signal.
  // Thresholding on count alone misclassifies "...how ta relates to mass..."
  // as Banglish, which sends the wrong prompt and the wrong chunk language.
  const share = words.length === 0 ? 0 : matched.length / words.length;

  if (share < BANGLISH_SHARE_THRESHOLD) {
    return {
      language: 'en',
      confidence: matched.length === 0 ? 0.75 : 0.6,
      matchedMarkers: [...new Set(matched)],
    };
  }

  return {
    language: 'banglish',
    confidence: Math.min(1, 0.5 + share * 1.5),
    matchedMarkers: [...new Set(matched)],
  };
}

/**
 * Minimum share of words that must be Banglish markers.
 *
 * Calibrated against real phrasings: "Toron kake bole ar er unit ki?" scores
 * 0.71 and "Gach kivabe khabar toiri kore?" scores 0.40, while an English
 * sentence with one incidental marker lands near 0.04. Anything in between is
 * genuinely ambiguous, and 0.15 puts the boundary well clear of both.
 */
const BANGLISH_SHARE_THRESHOLD = 0.15;

/**
 * Which chunk languages to prefer for a query.
 *
 * Not a hard filter — a Bangla question about a topic that only has English
 * chunks should still retrieve them, because an English explanation the tutor
 * translates beats no explanation. So this returns a preference order that
 * reranking weights, and retrieval itself stays language-agnostic.
 */
export function preferredChunkLanguages(language: QueryLanguage): Array<'BN' | 'EN'> {
  switch (language) {
    case 'en':
      return ['EN', 'BN'];
    case 'bn':
    case 'banglish':
      // Banglish is a typing convenience; the student reads Bangla.
      return ['BN', 'EN'];
  }
}

export function hasBengali(text: string): boolean {
  return BENGALI.test(text);
}
