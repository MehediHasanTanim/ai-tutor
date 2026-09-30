import { detectQueryLanguage, preferredChunkLanguages } from './query-language';

describe('detectQueryLanguage', () => {
  it('detects Bangla from script', () => {
    const result = detectQueryLanguage('ত্বরণ কাকে বলে?');
    expect(result.language).toBe('bn');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('treats a Bangla question with English terms as Bangla', () => {
    // The normal case in this product: scientific terms stay English inside
    // a Bangla sentence. Calling it 'en' would send the wrong prompt.
    expect(detectQueryLanguage('ত্বরণ হলো velocity এর পরিবর্তনের হার কি?').language).toBe('bn');
  });

  it('detects English', () => {
    const result = detectQueryLanguage('What is the difference between speed and velocity?');
    expect(result.language).toBe('en');
  });

  it('detects Banglish from function words, not content words', () => {
    // Content words are identical between a Banglish and an English physics
    // question — both contain "velocity". The grammar around them differs.
    const result = detectQueryLanguage('Toron kake bole ar er unit ki?');
    expect(result.language).toBe('banglish');
    expect(result.matchedMarkers).toContain('kake');
  });

  it('detects Banglish in an imperative homework question', () => {
    const result = detectQueryLanguage('Ei proshno ta somadhan koro');
    expect(result.language).toBe('banglish');
  });

  it('does not call a long English sentence Banglish over one stray token', () => {
    // "ta" is a Banglish marker and also appears in English text. Scaling by
    // share of words rather than raw count is what prevents the false positive.
    const english =
      'Explain the relationship between force and acceleration in detail, ' +
      'including the units and how ta relates to mass in the equation.';
    expect(detectQueryLanguage(english).language).toBe('en');
  });

  it('is more confident about dense Banglish than sparse', () => {
    const dense = detectQueryLanguage('Eta ki? Kivabe hobe? Bolo');
    const sparse = detectQueryLanguage(
      'Describe the process of photosynthesis and its importance ki',
    );
    expect(dense.confidence).toBeGreaterThan(sparse.confidence);
  });

  it('defaults a formula-only query to Bangla with low confidence', () => {
    // Nothing to detect from. Defaulting to the student's primary language
    // beats guessing, and low confidence records that it was a guess.
    const result = detectQueryLanguage('a = (v - u) / t');
    expect(result.confidence).toBeLessThan(0.8);
  });

  it('handles an empty query without throwing', () => {
    expect(() => detectQueryLanguage('')).not.toThrow();
  });
});

describe('preferredChunkLanguages', () => {
  it('prefers Bangla chunks for a Banglish question', () => {
    // Banglish is a typing convenience; the student reads Bangla.
    expect(preferredChunkLanguages('banglish')[0]).toBe('BN');
  });

  it('prefers English chunks for an English question', () => {
    expect(preferredChunkLanguages('en')[0]).toBe('EN');
  });

  it('always lists both, so the other language is still retrievable', () => {
    // An English explanation the tutor translates beats no explanation.
    for (const language of ['bn', 'en', 'banglish'] as const) {
      expect(preferredChunkLanguages(language)).toHaveLength(2);
    }
  });
});
