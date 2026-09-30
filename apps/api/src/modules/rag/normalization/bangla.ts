/**
 * Bangla text repair — doc 07 Weeks 3–4, "repair broken conjuncts if
 * extraction mangles them", and R-02 ("Bangla PDF extraction produces
 * corrupted text · High impact · **High likelihood**").
 *
 * PDF text extraction returns glyphs in *visual* order. Bengali is not
 * written in logical order: several vowel signs are drawn to the left of the
 * consonant they follow, and some are drawn on both sides at once. An
 * extractor that concatenates glyphs left-to-right therefore produces text
 * that looks almost right and is wrong — the vowel binds to the wrong
 * consonant, or the string will not match anything a student types.
 *
 * This is the single highest-likelihood corruption in the ingestion path,
 * and it is invisible unless you know to look for it: the mangled text
 * renders as *something*, just not the word that was on the page.
 */

// ---------------------------------------------------------------------------
// Code points
// ---------------------------------------------------------------------------

const VIRAMA = '্'; // হসন্ত — joins two consonants into a conjunct
const ZWNJ = '‌';
const ZWJ = '‍';

/**
 * Vowel signs that are *drawn* to the left of their consonant but belong
 * after it logically. An extractor reading glyph order emits these first.
 */
const PRE_BASE_VOWELS = new Set(['ি', 'ে', 'ৈ']); // ি ে ৈ

/**
 * Two-part vowel signs, drawn partly before and partly after the consonant.
 * Extractors often emit the two halves as separate characters surrounding
 * the consonant instead of the single combined sign.
 */
const SPLIT_VOWELS: Array<{ left: string; right: string; combined: string }> = [
  { left: 'ে', right: 'া', combined: 'ো' }, // ে + া → ো
  { left: 'ে', right: 'ৗ', combined: 'ৌ' }, // ে + ৗ → ৌ
];

const BENGALI_CONSONANT = /[ক-হড়-য়ৰৱ]/u;
const BENGALI_ANY = /[ঀ-৿]/u;

function isConsonant(ch: string): boolean {
  return BENGALI_CONSONANT.test(ch);
}

// ---------------------------------------------------------------------------
// Repairs
// ---------------------------------------------------------------------------

export interface RepairReport {
  text: string;
  /** How many of each repair fired. Surfaced so extraction quality is visible. */
  repairs: {
    reorderedPreBaseVowels: number;
    recombinedSplitVowels: number;
    repairedViramaSpacing: number;
    strippedArtefacts: number;
  };
}

/**
 * Detects whether the text is in visual order.
 *
 * This has to be decided per document, not per character. Given `পিরব`,
 * both readings are valid Bengali — `পি` + `রব` in logical order, or `প` +
 * `রি` + `ব` in visual order — and nothing local distinguishes them. An
 * earlier version of this file tested "is the previous character a
 * consonant", which is wrong in both directions: it silently corrupts
 * correct text and leaves mangled text unrepaired.
 *
 * The reliable signal is a pre-base vowel at a word boundary. In correct
 * logical-order Bengali that cannot happen — a combining vowel always
 * follows its consonant. In visual order it happens on every word whose
 * first consonant carries one of these vowels, which in running Bangla text
 * is common.
 *
 * So: one such occurrence means the extractor emitted visual order, and
 * every pre-base vowel in the document is misplaced.
 */
export function isVisualOrder(text: string): boolean {
  const chars = [...text];

  for (let i = 0; i < chars.length; i += 1) {
    if (!PRE_BASE_VOWELS.has(chars[i]!)) continue;

    const previous = chars[i - 1];
    const atWordStart = previous === undefined || !BENGALI_ANY.test(previous);
    const followedByConsonant = chars[i + 1] !== undefined && isConsonant(chars[i + 1]!);

    if (atWordStart && followedByConsonant) return true;
  }

  return false;
}

/**
 * Moves every pre-base vowel after the consonant cluster it belongs to.
 *
 * Applied only when `isVisualOrder` says the document needs it. A pre-base
 * vowel attaches to the whole cluster, not its first consonant: in
 * `ক` + virama + `ষ` + `ি` the vowel follows `ক্ষ`, and inserting it in the
 * middle would break the conjunct.
 */
function reorderPreBaseVowels(text: string): { text: string; count: number } {
  if (!isVisualOrder(text)) return { text, count: 0 };

  const chars = [...text];
  const out: string[] = [];
  let count = 0;

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!;

    if (!PRE_BASE_VOWELS.has(ch)) {
      out.push(ch);
      continue;
    }

    // Find the cluster this vowel was drawn in front of.
    let j = i + 1;
    if (j >= chars.length || !isConsonant(chars[j]!)) {
      // Nothing to attach to. Leave it rather than guess — visibly broken
      // text beats text that looks fine and is wrong.
      out.push(ch);
      continue;
    }

    const cluster: string[] = [];
    while (j < chars.length) {
      const next = chars[j]!;
      if (!isConsonant(next)) break;

      cluster.push(next);
      j += 1;

      if (chars[j] === VIRAMA && chars[j + 1] !== undefined && isConsonant(chars[j + 1]!)) {
        cluster.push(chars[j]!);
        j += 1;
        continue;
      }
      break;
    }

    out.push(...cluster, ch);
    count += 1;
    i = j - 1;
  }

  return { text: out.join(''), count };
}

/**
 * Recombines a two-part vowel whose halves were emitted on either side of
 * the consonant.
 *
 * `ে` + `ক` + `া` is what the extractor sees; the text says `কো`.
 */
function recombineSplitVowels(text: string): { text: string; count: number } {
  let result = text;
  let count = 0;

  for (const { left, right, combined } of SPLIT_VOWELS) {
    // consonant cluster sandwiched between the two halves
    const pattern = new RegExp(
      `${left}([\\u0995-\\u09B9\\u09DC-\\u09DF](?:${VIRAMA}[\\u0995-\\u09B9\\u09DC-\\u09DF])*)${right}`,
      'gu',
    );

    result = result.replace(pattern, (_match, cluster: string) => {
      count += 1;
      return `${cluster}${combined}`;
    });
  }

  return { text: result, count };
}

/**
 * Removes whitespace that extraction inserted around a virama.
 *
 * A space between a consonant and its hasant breaks the conjunct entirely:
 * `ক ্ ষ` renders as three separate letters where the page showed `ক্ষ`.
 */
function repairViramaSpacing(text: string): { text: string; count: number } {
  let count = 0;

  const result = text.replace(
    new RegExp(
      `([\\u0995-\\u09B9])\\s+${VIRAMA}\\s*|([\\u0995-\\u09B9])${VIRAMA}\\s+(?=[\\u0995-\\u09B9])`,
      'gu',
    ),
    (match, a: string | undefined, b: string | undefined) => {
      count += 1;
      return `${a ?? b}${VIRAMA}`;
    },
  );

  return { text: result, count };
}

/**
 * Strips extraction artefacts.
 *
 * Only ZERO WIDTH SPACE and BYTE ORDER MARK. **Not** ZWJ or ZWNJ: in Bangla
 * those are orthographic — ZWNJ suppresses a conjunct, ZWJ forces a
 * particular form — so removing them changes how a word renders.
 */
function stripArtefacts(text: string): { text: string; count: number } {
  let count = 0;
  const result = text.replace(new RegExp('[\\u200B\\uFEFF]', 'gu'), () => {
    count += 1;
    return '';
  });
  return { text: result, count };
}

/**
 * Runs every repair, in dependency order.
 *
 * Split-vowel recombination goes first: it consumes a `ে` that the pre-base
 * reorderer would otherwise move, producing `কে` + a stray `া` instead of
 * `কো`.
 */
export function repairBanglaText(input: string): RepairReport {
  // NFC first so every subsequent comparison sees one canonical form.
  let text = input.normalize('NFC');

  const artefacts = stripArtefacts(text);
  text = artefacts.text;

  const virama = repairViramaSpacing(text);
  text = virama.text;

  const split = recombineSplitVowels(text);
  text = split.text;

  const reordered = reorderPreBaseVowels(text);
  text = reordered.text;

  return {
    text: text.normalize('NFC'),
    repairs: {
      reorderedPreBaseVowels: reordered.count,
      recombinedSplitVowels: split.count,
      repairedViramaSpacing: virama.count,
      strippedArtefacts: artefacts.count,
    },
  };
}

// ---------------------------------------------------------------------------
// Quality signals
// ---------------------------------------------------------------------------

export interface BanglaQuality {
  /** Share of characters that are Bengali. */
  bengaliRatio: number;
  /**
   * Combining marks with no consonant before them. Each one is a dotted
   * circle on screen and a word that will never match a query — the
   * clearest single signal that extraction mangled the text.
   */
  orphanedMarks: number;
  /** Viramas at the end of a word, which usually means a dropped consonant. */
  danglingViramas: number;
  /** Runs of replacement characters — a missing font encoding. */
  replacementChars: number;
  /**
   * Share of Bengali tokens that are one or two characters long.
   *
   * The signal that catches the corruption the other three miss. A PDF
   * text layer that drops and reorders glyphs shatters words into
   * fragments — "ত্বরণ" comes out as "ত্ব রণ", "ক্ষেত্রফল" as "ত্র ফল" —
   * and each fragment is individually well-formed, so orphan and virama
   * counts stay low while the text is unreadable. Real Bangla words
   * average four to six characters; a high fragment rate means the
   * extractor is losing the page.
   */
  shortFragmentRatio: number;
  /** True when the text is clean enough to ingest. */
  usable: boolean;
  /**
   * True when the text passed but something looks off.
   *
   * The gate below catches *structural* corruption — dotted circles,
   * replacement characters, extreme fragmentation. It cannot reliably catch
   * glyph-level loss and reordering, where the extractor drops characters
   * and every surviving fragment is individually well-formed. Measured
   * against a Bangla PDF that lost characters outright, every structural
   * signal stayed inside its threshold while the text was unreadable.
   *
   * So this is a floor, not a guarantee, and `suspicious` is how the floor
   * admits it. A suspicious document still ingests; it asks for a native
   * reader to look, which doc 07's Weeks 3–4 exit criteria require anyway
   * ("Bangla text survives extraction without conjunct corruption —
   * spot-checked by a native reader").
   */
  suspicious: boolean;
  /** Human-readable reasons behind `suspicious`. */
  warnings: string[];
}

const COMBINING_MARK = /[া-ৌৗৢৣ]/u;

/**
 * Scores extracted Bangla without needing a reference transcription.
 *
 * This is what makes R-02 checkable on a real NCTB PDF before anyone has
 * transcribed a page by hand: orphaned marks and dangling viramas cannot
 * occur in correctly-ordered Bengali, so any count above zero is evidence of
 * corruption rather than a judgement call.
 */
export function assessBanglaQuality(text: string): BanglaQuality {
  const chars = [...text];
  const bengali = chars.filter((ch) => BENGALI_ANY.test(ch)).length;

  let orphanedMarks = 0;
  let danglingViramas = 0;

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]!;

    if (COMBINING_MARK.test(ch)) {
      const previous = chars[i - 1];
      if (previous === undefined || !(isConsonant(previous) || previous === VIRAMA)) {
        orphanedMarks += 1;
      }
    }

    if (ch === VIRAMA) {
      const next = chars[i + 1];
      // A virama may legitimately end a word before ZWJ/ZWNJ (khanda ta,
      // forced half-forms), so only a true terminal virama counts.
      if (next === undefined || (!isConsonant(next) && next !== ZWJ && next !== ZWNJ)) {
        danglingViramas += 1;
      }
    }
  }

  const replacementChars = (text.match(/�/gu) ?? []).length;
  const total = chars.length || 1;

  const shortFragmentRatio = measureFragmentation(text);

  const warnings: string[] = [];
  if (shortFragmentRatio >= 0.2) {
    warnings.push(
      `${(shortFragmentRatio * 100).toFixed(0)}% of Bangla tokens are 1-2 characters. ` +
        'Real Bangla words average four to six, so the extractor may be splitting ' +
        'or dropping glyphs.',
    );
  }
  if (orphanedMarks > 0) {
    warnings.push(`${orphanedMarks} combining mark(s) have no consonant to attach to.`);
  }
  if (danglingViramas > 0) {
    warnings.push(`${danglingViramas} virama(s) end a word, which usually means a lost consonant.`);
  }

  return {
    bengaliRatio: bengali / total,
    orphanedMarks,
    danglingViramas,
    replacementChars,
    shortFragmentRatio,
    // Thresholds are proportional: a long chapter may carry one artefact
    // without being unusable, but a page of dotted circles is not.
    //
    // The fragment threshold is the one that does the work. Measured against
    // a Bangla PDF whose text layer drops and reorders glyphs, the other
    // three signals all passed while the text was unreadable.
    usable:
      replacementChars / total < 0.01 &&
      orphanedMarks / Math.max(bengali, 1) < 0.02 &&
      danglingViramas / Math.max(bengali, 1) < 0.02 &&
      shortFragmentRatio < 0.4,
    suspicious: warnings.length > 0,
    warnings,
  };
}

/**
 * Share of Bengali tokens that are one or two characters.
 *
 * Tokens with no Bengali are ignored, so an English-heavy passage is not
 * judged by this metric. Fewer than five Bengali tokens returns 0 — too
 * small a sample to tell a fragment from a genuinely short word.
 */
function measureFragmentation(text: string): number {
  const tokens = text
    .split(/[\s।॥।,;:()[\]]+/u)
    .map((token) => [...token].filter((ch) => BENGALI_ANY.test(ch)).length)
    .filter((length) => length > 0);

  if (tokens.length < 5) return 0;

  const short = tokens.filter((length) => length <= 2).length;
  return short / tokens.length;
}
