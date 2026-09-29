import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreStructure } from './structure.js';

const VALID = {
  type: 'explanation',
  language: 'bn',
  answer: 'ত্বরণ হলো বেগের পরিবর্তনের হার।',
  key_points: ['a = (v - u) / t'],
  formulas: ['a = (v - u) / t'],
  examples: [],
  follow_up_actions: ['simplify', 'quiz_me'],
};

describe('scoreStructure', () => {
  it('gives full marks to bare, valid JSON', () => {
    const result = scoreStructure(JSON.stringify(VALID));
    assert.equal(result.score, 1);
    assert.equal(result.parsed?.type, 'explanation');
  });

  it('accepts show_formula, which doc 07 §7.7 added to the enum', () => {
    const result = scoreStructure(
      JSON.stringify({ ...VALID, follow_up_actions: ['show_formula'] }),
    );
    assert.equal(result.score, 1);
  });

  it('parses through a markdown fence but docks a little', () => {
    const result = scoreStructure('```json\n' + JSON.stringify(VALID) + '\n```');
    assert.ok(result.score > 0.9 && result.score < 1);
    assert.ok(result.issues.some((i) => i.includes('code fence')));
  });

  it('parses through a prose preamble and docks more', () => {
    const result = scoreStructure('Here is the response:\n\n' + JSON.stringify(VALID));
    assert.ok(result.score >= 0.85 && result.score < 1);
    assert.ok(result.issues.some((i) => i.includes('prose')));
  });

  it('scores prose with no JSON as zero', () => {
    const result = scoreStructure('ত্বরণ হলো বেগের পরিবর্তনের হার। এর একক m/s²।');
    assert.equal(result.score, 0);
  });

  it('gives partial credit for valid JSON with the wrong shape', () => {
    // "valid JSON, missing a field" and "no JSON at all" are different
    // failures, and a binary score would rank them the same.
    const result = scoreStructure(JSON.stringify({ type: 'explanation', language: 'bn' }));
    assert.ok(result.score > 0, 'partial structure must beat no structure');
    assert.ok(result.score < 1);
    assert.ok(result.issues.length > 0);
  });

  it('rejects an unknown follow-up action', () => {
    const result = scoreStructure(
      JSON.stringify({ ...VALID, follow_up_actions: ['make_me_a_sandwich'] }),
    );
    assert.ok(result.score < 1);
  });

  it('rejects an empty answer string', () => {
    const result = scoreStructure(JSON.stringify({ ...VALID, answer: '' }));
    assert.ok(result.score < 1);
  });

  it('defaults the optional arrays when they are omitted', () => {
    const result = scoreStructure(
      JSON.stringify({ type: 'explanation', language: 'bn', answer: 'x' }),
    );
    assert.equal(result.score, 1);
    assert.deepEqual(result.parsed?.key_points, []);
  });
});
