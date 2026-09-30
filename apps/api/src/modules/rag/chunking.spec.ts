import {
  chunkBlocks,
  estimateTokens,
  normalizeExtractedText,
  toBlocks,
  type TextBlock,
} from './chunking';
import { detectLanguage } from './ingestion.worker';

describe('estimateTokens', () => {
  it('counts Bangla as denser than Latin', () => {
    // Bangla tokenizes to roughly twice as many tokens per character. A
    // single chars/4 heuristic would under-count Bangla chunks by half and
    // produce chunks that blow the context budget.
    const bangla = 'ত্বরণ হলো বেগের পরিবর্তনের হার';
    const latin = 'Acceleration is the rate of change';

    expect(bangla.length).toBeLessThan(latin.length + 5);
    expect(estimateTokens(bangla)).toBeGreaterThan(estimateTokens(latin));
  });

  it('handles mixed script without under-counting', () => {
    const mixed = 'ত্বরণ হলো velocity এর rate of change';
    expect(estimateTokens(mixed)).toBeGreaterThan(estimateTokens('velocity rate of change'));
  });

  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('normalizeExtractedText', () => {
  it('normalises Bangla to NFC', () => {
    // Extractors differ; every downstream comparison assumes one form.
    const decomposed = 'ক্ষ'.normalize('NFD');
    expect(normalizeExtractedText(decomposed)).toBe('ক্ষ'.normalize('NFC'));
  });

  it('strips zero-width spaces and BOMs, which are pure artefacts', () => {
    expect(normalizeExtractedText('\u0989\u200B')).toBe('\u0989');
    expect(normalizeExtractedText('\uFEFF\u0989')).toBe('\u0989');
  });

  it('preserves ZWJ and ZWNJ, which are orthographic in Bangla', () => {
    // ZWNJ suppresses a conjunct and ZWJ forces a particular form. Stripping
    // them changes how the word renders — which is the corruption this
    // function exists to prevent, caused by the function itself.
    const ZWNJ = String.fromCharCode(0x200c);
    const ZWJ = String.fromCharCode(0x200d);

    expect(normalizeExtractedText(`\u0995${ZWNJ}\u09b7`)).toContain(ZWNJ);
    expect(normalizeExtractedText(`\u0995${ZWJ}\u09b7`)).toContain(ZWJ);
  });

  it('removes bare page numbers in both numeral systems', () => {
    const text = 'First paragraph.\n\n42\n\nSecond paragraph.';
    const banglaNumerals = 'প্রথম অনুচ্ছেদ।\n\n৪২\n\nদ্বিতীয় অনুচ্ছেদ।';

    expect(normalizeExtractedText(text)).not.toMatch(/^42$/m);
    expect(normalizeExtractedText(banglaNumerals)).not.toMatch(/^৪২$/m);
  });

  it('keeps a number that is part of a sentence', () => {
    const text = 'The answer is 42 joules.';
    expect(normalizeExtractedText(text)).toContain('42');
  });

  it('collapses runaway blank lines but keeps paragraph breaks', () => {
    const result = normalizeExtractedText('One.\n\n\n\n\nTwo.');
    expect(result).toBe('One.\n\nTwo.');
  });
});

describe('chunkBlocks', () => {
  const paragraph = (text: string, section?: string): TextBlock => ({ text, section });

  it('packs small blocks together rather than emitting one chunk each', () => {
    const blocks = Array.from({ length: 10 }, (_, i) =>
      paragraph(`Paragraph ${i}. ${'word '.repeat(20)}`),
    );

    const chunks = chunkBlocks(blocks);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(blocks.length);
  });

  it('never splits a worked example across chunks', () => {
    // The rule doc 07 states explicitly. A severed derivation retrieves as
    // two plausible chunks, neither containing the method.
    const longExample = `Example 1: A body accelerates from rest. ${'Step detail. '.repeat(200)}`;
    const blocks = [paragraph('Intro text.'), paragraph(longExample), paragraph('Outro text.')];

    const chunks = chunkBlocks(blocks);
    const holding = chunks.filter((chunk) => chunk.content.includes('Example 1'));

    expect(holding).toHaveLength(1);
    expect(holding[0]!.content).toContain('Step detail.');
  });

  it('keeps a Bangla worked example intact too', () => {
    const banglaExample = `উদাহরণ ১: একটি বস্তু স্থিরাবস্থা থেকে যাত্রা শুরু করে। ${'ধাপের বিবরণ। '.repeat(150)}`;
    const chunks = chunkBlocks([paragraph('ভূমিকা।'), paragraph(banglaExample)]);

    expect(chunks.filter((c) => c.content.includes('উদাহরণ ১'))).toHaveLength(1);
  });

  it('does not pack across a section boundary', () => {
    const chunks = chunkBlocks([
      paragraph('Motion content.', 'Motion'),
      paragraph('Force content.', 'Force'),
    ]);

    const motion = chunks.find((c) => c.content.includes('Motion content'));
    expect(motion?.content).not.toContain('Force content');
  });

  it('assigns contiguous chunk indices', () => {
    const blocks = Array.from({ length: 30 }, (_, i) =>
      paragraph(`Distinct paragraph ${i}. ${'filler '.repeat(40)}`),
    );

    const chunks = chunkBlocks(blocks);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it('drops duplicate chunks produced by overlap', () => {
    // Overlap plus a repeated page header generates these; a duplicate wastes
    // an embedding call and skews retrieval toward whatever it repeats.
    const repeated = paragraph('NCTB Physics Class 10 — page header');
    const chunks = chunkBlocks([repeated, repeated, repeated, repeated]);

    const contents = chunks.map((c) => c.content);
    expect(new Set(contents).size).toBe(contents.length);
  });

  it('carries page and section metadata onto the chunk', () => {
    const chunks = chunkBlocks([
      { text: 'Content about acceleration.', pageNumber: 42, section: 'Motion' },
    ]);

    expect(chunks[0]).toMatchObject({ pageNumber: 42, section: 'Motion' });
  });

  it('returns nothing for empty input', () => {
    expect(chunkBlocks([])).toEqual([]);
    expect(chunkBlocks([paragraph('   ')])).toEqual([]);
  });

  it('records a token count on every chunk', () => {
    const chunks = chunkBlocks([paragraph('Some real content here.')]);
    expect(chunks[0]!.tokenCount).toBeGreaterThan(0);
  });
});

describe('toBlocks', () => {
  it('splits on paragraph boundaries and drops blanks', () => {
    expect(toBlocks('One.\n\nTwo.\n\n\n\nThree.')).toHaveLength(3);
  });

  it('attaches the page number to every block', () => {
    const blocks = toBlocks('One.\n\nTwo.', 7, 'Motion');
    expect(blocks.every((b) => b.pageNumber === 7 && b.section === 'Motion')).toBe(true);
  });
});

describe('detectLanguage', () => {
  it('classifies by majority script', () => {
    expect(detectLanguage('ত্বরণ হলো বেগের পরিবর্তনের হার')).toBe('BN');
    expect(detectLanguage('Acceleration is the rate of change of velocity')).toBe('EN');
  });

  it('treats a Bangla sentence with English terms as Bangla', () => {
    // The normal case in an NCTB text, and getting it wrong would file the
    // chunk under the wrong language filter at retrieval time.
    expect(detectLanguage('ত্বরণ হলো velocity পরিবর্তনের হার, একক m/s²')).toBe('BN');
  });
});
