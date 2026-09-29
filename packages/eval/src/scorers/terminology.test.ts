import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFactCoverage, scoreTerminology } from './terminology.js';

describe('scoreTerminology', () => {
  it('rewards keeping English scientific terms in a Bangla answer', () => {
    const answer = 'সালোকসংশ্লেষণে chlorophyll আলোক শোষণ করে এবং chloroplast-এ glucose তৈরি হয়।';
    const result = scoreTerminology(answer, ['chlorophyll', 'chloroplast', 'glucose']);

    assert.equal(result.score, 1);
    assert.deepEqual(result.missing, []);
  });

  it('penalises translating terms into invented Bangla', () => {
    // The failure this dimension exists to catch: technically Bangla,
    // pedagogically useless because it matches no textbook.
    const answer = 'সালোকসংশ্লেষণে পত্রহরিৎ আলোক শোষণ করে এবং শর্করা তৈরি হয়।';
    const result = scoreTerminology(answer, ['chlorophyll', 'chloroplast', 'glucose']);

    assert.equal(result.score, 0);
    assert.equal(result.missing.length, 3);
  });

  it('matches case-insensitively', () => {
    assert.equal(scoreTerminology('The Velocity is constant.', ['velocity']).score, 1);
  });

  it('requires a word boundary', () => {
    // "ion" must not match inside "combination".
    assert.equal(scoreTerminology('a combination of things', ['ion']).score, 0);
    assert.equal(scoreTerminology('a positive ion forms', ['ion']).score, 1);
  });

  it('finds a term adjacent to Bengali characters', () => {
    // \b does not behave usefully next to Bengali, which is why the scorer
    // defines the boundary itself.
    assert.equal(scoreTerminology('বস্তুর velocity বৃদ্ধি পায়', ['velocity']).score, 1);
  });

  it('treats an empty expectation as satisfied', () => {
    assert.equal(scoreTerminology('anything', []).score, 1);
  });

  it('handles multi-word terms', () => {
    assert.equal(scoreTerminology('an ionic bond forms', ['ionic bond']).score, 1);
  });
});

describe('scoreFactCoverage', () => {
  it('reports the fraction of required facts present', () => {
    const answer = 'Work done is mgh = 5 × 9.8 × 10 = 490 J.';
    const result = scoreFactCoverage(answer, ['490', 'mgh', 'joule']);

    assert.equal(result.found.length, 2);
    assert.deepEqual(result.missing, ['joule']);
    assert.ok(Math.abs(result.score - 2 / 3) < 1e-9);
  });

  it('normalizes Bangla so composed and decomposed forms compare equal', () => {
    // Providers differ on Unicode normalization; without NFC the same
    // conjunct from two candidates would not match.
    const composed = 'ক্ষ'.normalize('NFC');
    const decomposed = 'ক্ষ'.normalize('NFD');
    assert.equal(scoreFactCoverage(`উত্তর ${decomposed} হবে`, [composed]).score, 1);
  });

  it('collapses whitespace differences', () => {
    assert.equal(scoreFactCoverage('the  answer   is 490', ['answer is 490']).score, 1);
  });
});
