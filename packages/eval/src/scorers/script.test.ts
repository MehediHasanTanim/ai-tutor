import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeBanglish, profileScript, scoreScriptMatch } from './script.js';

const BANGLA_ANSWER = 'ত্বরণ হলো বেগের পরিবর্তনের হার। এর একক m/s²। বেগ বাড়লে ত্বরণ ধনাত্মক হয়।';
const ENGLISH_ANSWER = 'Acceleration is the rate of change of velocity, measured in m/s².';

describe('profileScript', () => {
  it('measures the Bengali share of a Bangla answer with English terms', () => {
    const profile = profileScript(BANGLA_ANSWER);
    assert.ok(profile.hasBengali);
    assert.ok(profile.bengaliRatio > 0.8, `expected mostly Bengali, got ${profile.bengaliRatio}`);
  });

  it('reports zero Bengali for pure English', () => {
    const profile = profileScript(ENGLISH_ANSWER);
    assert.equal(profile.hasBengali, false);
    assert.equal(profile.bengaliRatio, 0);
  });

  it('handles text with no letters at all', () => {
    const profile = profileScript('123 + 456 = 579');
    assert.equal(profile.bengaliRatio, 0);
    assert.equal(profile.latinRatio, 0);
  });
});

describe('scoreScriptMatch', () => {
  it('scores a Bangla answer to a Bangla question as 1', () => {
    assert.equal(scoreScriptMatch(BANGLA_ANSWER, 'bn'), 1);
  });

  it('penalises an English answer to a Bangla question', () => {
    // The failure mode that matters most: doc 07 R-04.
    assert.equal(scoreScriptMatch(ENGLISH_ANSWER, 'bn'), 0);
  });

  it('expects a Bangla answer to a Banglish question', () => {
    // Banglish is an input mode, not an output one (doc 02 §2). A student
    // typing Romanized because it is faster still wants Bangla back.
    assert.equal(scoreScriptMatch(BANGLA_ANSWER, 'banglish'), 1);
    assert.ok(scoreScriptMatch(ENGLISH_ANSWER, 'banglish') < 0.5);
  });

  it('tolerates English scientific terms inside a Bangla answer', () => {
    const mixed =
      'সালোকসংশ্লেষণ প্রক্রিয়ায় chlorophyll আলোক শক্তি শোষণ করে এবং glucose ও oxygen উৎপন্ন হয়।';
    assert.equal(scoreScriptMatch(mixed, 'bn'), 1, 'keeping English terms must not be penalised');
  });

  it('scores an empty answer as 0 rather than crashing', () => {
    assert.equal(scoreScriptMatch('', 'bn'), 0);
  });
});

describe('looksLikeBanglish', () => {
  it('recognises Romanized Bangla', () => {
    assert.ok(looksLikeBanglish('Toron kake bole ar er unit ki?'));
    assert.ok(looksLikeBanglish('Gach kivabe khabar toiri kore?'));
  });

  it('rejects plain English and Bangla script', () => {
    assert.equal(looksLikeBanglish('What is acceleration?'), false);
    assert.equal(looksLikeBanglish(BANGLA_ANSWER), false);
  });
});
