import { assessBanglaQuality, repairBanglaText } from './bangla';

// Code points spelled out, because Prettier rewrites \u escapes inside
// string literals into the actual characters — and an invisible character
// in a test fixture is a test nobody can read.
const I_KAR = String.fromCharCode(0x09bf); // ি  pre-base
const E_KAR = String.fromCharCode(0x09c7); // ে  pre-base
const AA_KAR = String.fromCharCode(0x09be); // া  post-base
const O_KAR = String.fromCharCode(0x09cb); // ো  two-part
const AU_KAR = String.fromCharCode(0x09cc); // ৌ  two-part
const OU_MARK = String.fromCharCode(0x09d7); // ৗ
const VIRAMA = String.fromCharCode(0x09cd); // ্  হসন্ত
const ZWJ = String.fromCharCode(0x200d);
const ZWNJ = String.fromCharCode(0x200c);
const ZWSP = String.fromCharCode(0x200b);
const BOM = String.fromCharCode(0xfeff);

const KA = 'ক';
const SSA = 'ষ';
const TA = 'ত';

describe('repairBanglaText', () => {
  describe('pre-base vowel reordering', () => {
    it('moves a vowel emitted before its consonant to after it', () => {
      // Visual order is what a PDF extractor sees; logical order is what
      // the text means. Getting this wrong yields a string starting with a
      // combining mark — a dotted circle on screen, and a word that never
      // matches what a student types.
      const visual = I_KAR + KA;
      const { text, repairs } = repairBanglaText(visual);

      expect(text).toBe(KA + I_KAR);
      expect(repairs.reorderedPreBaseVowels).toBe(1);
    });

    it('handles ে and ৈ the same way', () => {
      expect(repairBanglaText(E_KAR + KA).text).toBe(KA + E_KAR);
      expect(repairBanglaText(String.fromCharCode(0x09c8) + KA).text).toBe(
        KA + String.fromCharCode(0x09c8),
      );
    });

    it('places the vowel after a whole conjunct, not its first consonant', () => {
      // ক্ষ is one cluster. The vowel belongs after ষ, not between ক and ষ —
      // putting it in the middle breaks the conjunct entirely.
      const visual = I_KAR + KA + VIRAMA + SSA;
      expect(repairBanglaText(visual).text).toBe(KA + VIRAMA + SSA + I_KAR);
    });

    it('leaves correctly ordered text alone', () => {
      const correct = KA + I_KAR;
      const { text, repairs } = repairBanglaText(correct);

      expect(text).toBe(correct);
      expect(repairs.reorderedPreBaseVowels).toBe(0);
    });

    it('does not move a vowel with no consonant to attach to', () => {
      // Better to leave visibly broken text than to guess and produce
      // something that looks fine and is wrong.
      const orphan = I_KAR + ' ';
      expect(repairBanglaText(orphan).text.trim()).toBe(I_KAR);
    });

    it('repairs several occurrences in one string', () => {
      const visual = I_KAR + KA + ' ' + E_KAR + TA;
      const { repairs } = repairBanglaText(visual);
      expect(repairs.reorderedPreBaseVowels).toBe(2);
    });
  });

  describe('split vowel recombination', () => {
    it('recombines ে + consonant + া into ো', () => {
      const split = E_KAR + KA + AA_KAR;
      const { text, repairs } = repairBanglaText(split);

      expect(text).toBe(KA + O_KAR);
      expect(repairs.recombinedSplitVowels).toBe(1);
    });

    it('recombines ে + consonant + ৗ into ৌ', () => {
      expect(repairBanglaText(E_KAR + KA + OU_MARK).text).toBe(KA + AU_KAR);
    });

    it('recombines across a conjunct', () => {
      const split = E_KAR + KA + VIRAMA + SSA + AA_KAR;
      expect(repairBanglaText(split).text).toBe(KA + VIRAMA + SSA + O_KAR);
    });

    it('runs before reordering, so ে is not moved out from under it', () => {
      // If the reorderer ran first it would turn this into কে + a stray া
      // rather than কো — the ordering bug that makes both repairs useless.
      const { text, repairs } = repairBanglaText(E_KAR + KA + AA_KAR);

      expect(text).toBe(KA + O_KAR);
      expect(repairs.reorderedPreBaseVowels).toBe(0);
    });
  });

  describe('virama spacing', () => {
    it('removes a space inserted between a consonant and its hasant', () => {
      // ক ্ ষ renders as three separate letters where the page showed ক্ষ.
      const broken = KA + ' ' + VIRAMA + SSA;
      const { text, repairs } = repairBanglaText(broken);

      expect(text).toBe(KA + VIRAMA + SSA);
      expect(repairs.repairedViramaSpacing).toBe(1);
    });

    it('removes a space after the hasant', () => {
      expect(repairBanglaText(KA + VIRAMA + ' ' + SSA).text).toBe(KA + VIRAMA + SSA);
    });
  });

  describe('artefacts', () => {
    it('strips zero-width space and BOM', () => {
      const { text, repairs } = repairBanglaText(KA + ZWSP + TA + BOM);

      expect(text).toBe(KA + TA);
      expect(repairs.strippedArtefacts).toBe(2);
    });

    it('preserves ZWJ and ZWNJ, which are orthographic', () => {
      // ZWNJ suppresses a conjunct, ZWJ forces a particular form. Removing
      // them changes how the word renders — the corruption this module
      // exists to prevent, caused by the module.
      expect(repairBanglaText(KA + ZWNJ + SSA).text).toContain(ZWNJ);
      expect(repairBanglaText(TA + VIRAMA + ZWJ).text).toContain(ZWJ);
    });
  });

  it('normalises to NFC', () => {
    const decomposed = 'ক্ষ'.normalize('NFD');
    expect(repairBanglaText(decomposed).text).toBe('ক্ষ'.normalize('NFC'));
  });

  it('leaves English untouched', () => {
    const english = 'Acceleration is the rate of change of velocity.';
    expect(repairBanglaText(english).text).toBe(english);
  });

  it('leaves a clean mixed-script sentence untouched', () => {
    const mixed = 'ত্বরণ হলো velocity পরিবর্তনের হার, একক m/s²।';
    const { text, repairs } = repairBanglaText(mixed);

    expect(text).toBe(mixed.normalize('NFC'));
    expect(Object.values(repairs).every((count) => count === 0)).toBe(true);
  });
});

describe('assessBanglaQuality', () => {
  it('passes clean Bangla', () => {
    const quality = assessBanglaQuality('ত্বরণ হলো বেগের পরিবর্তনের হার। এর একক m/s²।');

    expect(quality.orphanedMarks).toBe(0);
    expect(quality.danglingViramas).toBe(0);
    expect(quality.usable).toBe(true);
  });

  it('counts a combining mark with no consonant before it', () => {
    // This cannot occur in correctly-ordered Bengali, so any count above
    // zero is evidence of corruption rather than a judgement call — which
    // is what makes R-02 checkable without a hand transcription.
    const quality = assessBanglaQuality(I_KAR + I_KAR + I_KAR);
    expect(quality.orphanedMarks).toBeGreaterThan(0);
  });

  it('rejects a page of mangled text', () => {
    const mangled = (I_KAR + E_KAR).repeat(40);
    expect(assessBanglaQuality(mangled).usable).toBe(false);
  });

  it('counts replacement characters as a missing font encoding', () => {
    const quality = assessBanglaQuality('�'.repeat(30));
    expect(quality.replacementChars).toBe(30);
    expect(quality.usable).toBe(false);
  });

  it('does not count a virama before ZWJ or ZWNJ as dangling', () => {
    // Khanda ta and forced half-forms legitimately end with a virama plus
    // a joiner; flagging those would reject correct text.
    expect(assessBanglaQuality(TA + VIRAMA + ZWJ).danglingViramas).toBe(0);
    expect(assessBanglaQuality(KA + VIRAMA + ZWNJ).danglingViramas).toBe(0);
  });

  it('counts a truly terminal virama', () => {
    expect(assessBanglaQuality(KA + VIRAMA).danglingViramas).toBe(1);
  });

  it('reports the Bengali ratio', () => {
    expect(assessBanglaQuality('ত্বরণ').bengaliRatio).toBeGreaterThan(0.9);
    expect(assessBanglaQuality('acceleration').bengaliRatio).toBe(0);
  });

  it('tolerates one artefact in a long clean passage', () => {
    // Thresholds are proportional: a chapter may carry a stray mark without
    // being unusable, but a page of dotted circles is not ingestable.
    const longClean = 'ত্বরণ হলো বেগের পরিবর্তনের হার। '.repeat(20);
    expect(assessBanglaQuality(longClean + I_KAR).usable).toBe(true);
  });

  it('handles empty input without dividing by zero', () => {
    const quality = assessBanglaQuality('');
    expect(quality.bengaliRatio).toBe(0);
    expect(Number.isNaN(quality.bengaliRatio)).toBe(false);
  });
});

describe('round trip', () => {
  /**
   * Reproduces what a PDF extractor does: emits each pre-base vowel before
   * the consonant cluster it belongs to, in visual order.
   */
  function mangleToVisualOrder(text: string): string {
    const preBase = new Set([I_KAR, E_KAR, String.fromCharCode(0x09c8)]);
    const isConsonant = (ch: string) => /[\u0995-\u09B9\u09DC-\u09DF]/u.test(ch);

    const chars = [...text];
    const out: string[] = [];

    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i]!;
      if (!isConsonant(ch)) {
        out.push(ch);
        continue;
      }

      // Collect the cluster, then look for a pre-base vowel after it.
      const cluster = [ch];
      let j = i + 1;
      while (chars[j] === VIRAMA && chars[j + 1] && isConsonant(chars[j + 1]!)) {
        cluster.push(chars[j]!, chars[j + 1]!);
        j += 2;
      }

      if (chars[j] !== undefined && preBase.has(chars[j]!)) {
        out.push(chars[j]!, ...cluster);
        i = j;
      } else {
        out.push(...cluster);
        i = j - 1;
      }
    }

    return out.join('');
  }

  const CLEAN = 'ত্বরণ হলো বেগের পরিবর্তনের হার। এর একক মিটার প্রতি সেকেন্ড বর্গ।';

  it('mangling then repairing restores the original text', () => {
    // The end-to-end claim: extractor output that fails the gate becomes
    // text that passes it, and is the text that was on the page.
    const mangled = mangleToVisualOrder(CLEAN);

    expect(mangled).not.toBe(CLEAN);
    expect(assessBanglaQuality(mangled).usable).toBe(false);

    const repaired = repairBanglaText(mangled);

    expect(repaired.text).toBe(CLEAN.normalize('NFC'));
    expect(assessBanglaQuality(repaired.text).usable).toBe(true);
  });

  it('repairing already-correct text is a no-op', () => {
    // Idempotence matters: the repair runs on every page, including pages
    // an extractor got right.
    const once = repairBanglaText(CLEAN).text;
    const twice = repairBanglaText(once).text;

    expect(once).toBe(CLEAN.normalize('NFC'));
    expect(twice).toBe(once);
  });

  it('flags fragmented text as suspicious even when it passes', () => {
    // The gate cannot catch an extractor that drops characters while
    // leaving each fragment well-formed, so it says so rather than
    // implying the text is verified.
    const fragmented = 'ত্ব রণ হলো বগ র পিরবত ন ের হার ত্র ফল ও কৗ ণিক';
    const quality = assessBanglaQuality(fragmented);

    expect(quality.suspicious).toBe(true);
    expect(quality.warnings.length).toBeGreaterThan(0);
  });
});
