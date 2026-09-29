import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, scoreResponse } from './chat.js';
import type { ChatTestCase } from '../types.js';

const CASE: ChatTestCase = {
  id: 'phy-10-01',
  subject: 'physics',
  classLevel: 10,
  chapter: 'Motion',
  prompts: {
    bn: 'ত্বরণ কাকে বলে?',
    en: 'What is acceleration?',
    banglish: 'Toron kake bole?',
  },
  reference: {
    answer: 'Acceleration is the rate of change of velocity.',
    requiredFacts: ['velocity', 'rate of change'],
    expectedEnglishTerms: ['acceleration', 'velocity'],
  },
  reviewed: true,
};

const OUT_OF_SYLLABUS: ChatTestCase = {
  ...CASE,
  id: 'oob-01',
  outOfCurriculum: true,
  reference: { answer: 'should refuse', requiredFacts: [], expectedEnglishTerms: [] },
};

function envelope(answer: string, type = 'explanation'): string {
  return JSON.stringify({
    type,
    language: 'bn',
    answer,
    key_points: [],
    formulas: [],
    examples: [],
    follow_up_actions: ['simplify'],
  });
}

function dimension(scores: ReturnType<typeof scoreResponse>, name: string): number {
  const found = scores.find((score) => score.dimension === name);
  assert.ok(found, `expected a "${name}" score`);
  return found.score;
}

describe('buildSystemPrompt', () => {
  it('tells the model to keep English terms', () => {
    const prompt = buildSystemPrompt(CASE, 'bn');
    assert.match(prompt, /keep scientific and technical terms in English/i);
  });

  it('asks for Bangla output even when the question is Banglish', () => {
    // Doc 02 §2: Banglish is an input convenience, not a request for
    // Romanized output. Getting this wrong makes dimension 4 untestable.
    const prompt = buildSystemPrompt(CASE, 'banglish');
    assert.match(prompt, /answer in natural Bangla script/i);
  });

  it('carries the class level so retrieval can be scoped', () => {
    assert.match(buildSystemPrompt(CASE, 'en'), /Class 10/);
  });

  it('instructs the model to decline out-of-syllabus questions', () => {
    assert.match(buildSystemPrompt(CASE, 'en'), /outside the Class 9-10 NCTB syllabus/i);
  });
});

// Fixtures are deliberately realistic in length and script mix. A short answer
// padded with English terms falls below the 60% Bengali threshold and fails
// script_match for reasons that say nothing about the code under test.
describe('scoreResponse', () => {
  it('scores a good Bangla answer well across every dimension', () => {
    const scores = scoreResponse(
      envelope(
        'ত্বরণ হলো কোনো বস্তুর velocity পরিবর্তনের হার, অর্থাৎ rate of change of velocity। যদি বস্তুর বেগ সময়ের সাথে বাড়তে থাকে তবে তার acceleration ধনাত্মক হয়, আর কমতে থাকলে ঋণাত্মক হয়। ত্বরণের একক মিটার প্রতি সেকেন্ড বর্গ।',
      ),
      CASE,
      'bn',
    );

    assert.equal(dimension(scores, 'instruction_adherence'), 1);
    assert.equal(dimension(scores, 'script_match'), 1);
    assert.equal(dimension(scores, 'terminology'), 1);
    assert.equal(dimension(scores, 'fact_coverage'), 1);
  });

  it('penalises an English answer to a Bangla question', () => {
    const scores = scoreResponse(
      envelope('Acceleration is the rate of change of velocity.'),
      CASE,
      'bn',
    );

    assert.equal(dimension(scores, 'script_match'), 0);
    // Content is still correct — the dimensions must move independently.
    assert.equal(dimension(scores, 'terminology'), 1);
  });

  it('still grades content when the model ignores the JSON contract', () => {
    // A candidate that writes prose should score 0 on adherence but must not
    // silently score 0 on everything else.
    const scores = scoreResponse(
      'ত্বরণ হলো কোনো বস্তুর velocity পরিবর্তনের হার, অর্থাৎ rate of change of velocity। যদি বস্তুর বেগ সময়ের সাথে বাড়তে থাকে তবে তার acceleration ধনাত্মক হয়, আর কমতে থাকলে ঋণাত্মক হয়। ত্বরণের একক মিটার প্রতি সেকেন্ড বর্গ।',
      CASE,
      'bn',
    );

    assert.equal(dimension(scores, 'instruction_adherence'), 0);
    assert.equal(dimension(scores, 'script_match'), 1);
    assert.equal(dimension(scores, 'terminology'), 1);
  });

  it('rewards refusing an out-of-syllabus question', () => {
    const scores = scoreResponse(
      envelope('এই বিষয়টি আপনার সিলেবাসে নেই।', 'refusal'),
      OUT_OF_SYLLABUS,
      'bn',
    );

    assert.equal(dimension(scores, 'declines_out_of_curriculum'), 1);
  });

  it('punishes answering an out-of-syllabus question confidently', () => {
    // Doc 07 R-05: a confident wrong answer is the critical failure mode.
    const scores = scoreResponse(
      envelope('রেনরমালাইজেশন হলো একটি পদ্ধতি যেখানে infinite quantity গুলো...'),
      OUT_OF_SYLLABUS,
      'bn',
    );

    assert.equal(dimension(scores, 'declines_out_of_curriculum'), 0);
  });

  it('does not score fact coverage on an out-of-syllabus probe', () => {
    // Coverage there would reward fabricating detail.
    const scores = scoreResponse(envelope('not covered', 'refusal'), OUT_OF_SYLLABUS, 'en');
    assert.equal(
      scores.find((score) => score.dimension === 'fact_coverage'),
      undefined,
    );
  });

  it('marks every automated dimension as automated', () => {
    // The report separates measured from human-supplied; mislabelling here
    // would make an unreviewed run look complete.
    const scores = scoreResponse(
      envelope(
        'ত্বরণ হলো কোনো বস্তুর velocity পরিবর্তনের হার, অর্থাৎ rate of change of velocity। যদি বস্তুর বেগ সময়ের সাথে বাড়তে থাকে তবে তার acceleration ধনাত্মক হয়, আর কমতে থাকলে ঋণাত্মক হয়। ত্বরণের একক মিটার প্রতি সেকেন্ড বর্গ।',
      ),
      CASE,
      'bn',
    );
    assert.ok(scores.every((score) => score.automated));
  });
});
