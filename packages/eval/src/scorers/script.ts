/**
 * Script detection — is the answer actually in the language we asked for?
 *
 * This catches the most common and most damaging failure for this product:
 * a model that answers a Bangla question in English, or that replies in
 * Bangla-script transliteration of English sentences. Doc 07 R-04 calls out
 * "Bangla output that reads as translated English" as a high-impact risk;
 * this is the cheap deterministic half of detecting it. The other half —
 * whether the Bangla is *natural* — needs a native speaker (§6 dimension 2).
 */

/** Bengali block, U+0980–U+09FF. */
const BENGALI = /[ঀ-৿]/u;
const BENGALI_GLOBAL = /[ঀ-৿]/gu;
const LATIN_LETTER = /[A-Za-z]/gu;

export interface ScriptProfile {
  /** Share of letter characters that are Bengali, 0–1. */
  bengaliRatio: number;
  /** Share of letter characters that are Latin, 0–1. */
  latinRatio: number;
  bengaliCount: number;
  latinCount: number;
  hasBengali: boolean;
}

export function profileScript(text: string): ScriptProfile {
  const bengaliCount = (text.match(BENGALI_GLOBAL) ?? []).length;
  const latinCount = (text.match(LATIN_LETTER) ?? []).length;
  const total = bengaliCount + latinCount;

  return {
    bengaliRatio: total === 0 ? 0 : bengaliCount / total,
    latinRatio: total === 0 ? 0 : latinCount / total,
    bengaliCount,
    latinCount,
    hasBengali: BENGALI.test(text),
  };
}

/**
 * Scores whether the answer is in the expected script.
 *
 * A Bangla answer is *expected* to carry some Latin — scientific terms stay in
 * English, which dimension 3 rewards. So the bar is a majority of Bengali
 * letters, not purity. The threshold is deliberately generous for that reason.
 */
export function scoreScriptMatch(text: string, expected: 'bn' | 'en' | 'banglish'): number {
  const profile = profileScript(text);

  if (profile.bengaliCount + profile.latinCount === 0) return 0;

  switch (expected) {
    case 'bn':
      // 60% Bengali letters. Below that the answer has drifted to English
      // with Bangla decoration.
      return profile.bengaliRatio >= 0.6 ? 1 : profile.bengaliRatio / 0.6;

    case 'en':
      return profile.latinRatio >= 0.9 ? 1 : profile.latinRatio / 0.9;

    case 'banglish':
      // A Banglish *question* should still get a Bangla-script answer: the
      // student is writing Romanized because it is faster to type, not
      // because they want English back. Doc 02 §2 treats Banglish as an input
      // mode, not an output one.
      return profile.bengaliRatio >= 0.6 ? 1 : profile.bengaliRatio / 0.6;
  }
}

/**
 * Detects Bangla written in Latin letters — the input form students use.
 *
 * Used to validate the test set itself: a "banglish" prompt that contains
 * Bengali characters is mislabelled, and would quietly make dimension 4
 * measure nothing.
 */
export function looksLikeBanglish(text: string): boolean {
  if (BENGALI.test(text)) return false;

  // Widened after the dataset validator flagged real prompts this missed:
  // imperatives ("koro", "dekhao", "lekho") and the plural/definite suffixes
  // ("gulo", "ta", "ti") carry most of the signal in how students actually
  // type, and the first list only had interrogatives.
  const markers = [
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
    // imperatives — the most common shape of a homework question
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
    // pronouns and copulas
    'ekta',
    'amake',
    'amar',
    'ami',
    'tumi',
    'tar',
    'eta',
    'era',
    'hoy',
    'hobe',
    'hole',
    'ache',
    'chilo',
    // suffixes and particles that appear as standalone tokens
    'gulo',
    'gula',
    'ta',
    'ti',
    'tar',
    'er',
    'ar',
    'soho',
    'diye',
    'theke',
    // common nouns in question stems
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
  ];

  const words = text.toLowerCase().split(/\W+/u).filter(Boolean);
  if (words.length === 0) return false;

  return words.some((word) => markers.includes(word));
}
