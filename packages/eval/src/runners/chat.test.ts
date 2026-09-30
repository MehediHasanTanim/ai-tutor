import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorSystemPrompt } from '@ai-tutor/prompts';
import { buildSystemPrompt, evaluationPromptVersion, scoreResponse } from './chat.js';
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
  // The prompt's own wording is tested in packages/prompts. What matters here
  // is that the harness uses that prompt rather than a copy — a candidate
  // measured under a different prompt than production sends is not measured.

  it('delegates to the shared tutor prompt', () => {
    const fromEval = buildSystemPrompt(CASE, 'bn');
    const fromPrompts = buildTutorSystemPrompt({
      classLevel: CASE.classLevel,
      curriculum: 'nctb',
      subject: CASE.subject,
      chapter: CASE.chapter,
      language: 'bn',
      mode: 'normal',
      retrieved: [],
    }).system;

    assert.equal(fromEval, fromPrompts);
  });

  it('carries the case into the prompt', () => {
    const prompt = buildSystemPrompt(CASE, 'en');
    assert.match(prompt, /Class 10/);
    assert.match(prompt, /physics/i);
  });

  it('varies with the language under test', () => {
    // Dimension 4 depends on the Banglish prompt differing from the Bangla
    // one; if they were identical the suite would measure nothing.
    assert.notEqual(buildSystemPrompt(CASE, 'bn'), buildSystemPrompt(CASE, 'banglish'));
    assert.notEqual(buildSystemPrompt(CASE, 'en'), buildSystemPrompt(CASE, 'bn'));
  });

  it('reports the prompt version so results stay attributable', () => {
    // Doc 07 §11: a prompt tweak can quietly degrade one subject. A score
    // without its prompt version cannot be compared across runs.
    assert.match(evaluationPromptVersion(), /^tutor\.system@\d+\.\d+$/);
  });

  it('sends no retrieved content — this suite measures the model, not RAG', () => {
    assert.doesNotMatch(buildSystemPrompt(CASE, 'bn'), /## Curriculum excerpts/);
  });
});

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
