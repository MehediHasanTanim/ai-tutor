import { parseImageAnalysis } from './anthropic.provider';
import { ProviderError } from '../ai-provider.interface';

const COMPLETE = {
  extracted_question: 'ত্বরণ কাকে বলে?',
  detected_language: 'bn',
  confidence: 0.92,
  retake_reason: null,
  subject: 'physics',
  chapter_guess: 'Motion',
  other_questions_visible: [],
  answer: 'ত্বরণ হলো বেগের পরিবর্তনের হার।',
};

describe('parseImageAnalysis', () => {
  it('parses a well-formed response', () => {
    const result = parseImageAnalysis(JSON.stringify(COMPLETE));

    expect(result.extracted_question).toBe('ত্বরণ কাকে বলে?');
    expect(result.confidence).toBe(0.92);
    expect(result.subject).toBe('physics');
  });

  it('parses through a code fence', () => {
    // Models add fences despite being told not to, and a fence is not a
    // reason to reject a student's photo.
    const result = parseImageAnalysis('```json\n' + JSON.stringify(COMPLETE) + '\n```');
    expect(result.extracted_question).toBe('ত্বরণ কাকে বলে?');
  });

  it('parses through a prose preamble', () => {
    const result = parseImageAnalysis('Here is what I read:\n' + JSON.stringify(COMPLETE));
    expect(result.extracted_question).toBe('ত্বরণ কাকে বলে?');
  });

  it('treats a missing confidence as zero, not as certainty', () => {
    // The failure must land on the safe side of the retake threshold:
    // architecture §9 would otherwise show a confident wrong answer.
    const { confidence, ...withoutConfidence } = COMPLETE;
    const result = parseImageAnalysis(JSON.stringify(withoutConfidence));

    expect(result.confidence).toBe(0);
  });

  it('defaults the optional fields', () => {
    const result = parseImageAnalysis(JSON.stringify({ extracted_question: 'x', confidence: 0.8 }));

    expect(result.other_questions_visible).toEqual([]);
    expect(result.retake_reason).toBeNull();
    expect(result.answer).toBeNull();
    expect(result.detected_language).toBe('mixed');
  });

  it('preserves a low-confidence retake reason', () => {
    const result = parseImageAnalysis(
      JSON.stringify({
        ...COMPLETE,
        confidence: 0.3,
        retake_reason: 'glare covers the formula',
        answer: null,
      }),
    );

    expect(result.confidence).toBe(0.3);
    expect(result.retake_reason).toBe('glare covers the formula');
    expect(result.answer).toBeNull();
  });

  it('throws on prose with no JSON', () => {
    expect(() => parseImageAnalysis('I could not read the image.')).toThrow(ProviderError);
  });

  it('throws when the required field is absent', () => {
    // A response without the question is not a partial success.
    expect(() => parseImageAnalysis(JSON.stringify({ confidence: 0.9 }))).toThrow(ProviderError);
  });

  it('throws on empty input', () => {
    expect(() => parseImageAnalysis('')).toThrow(ProviderError);
  });
});
