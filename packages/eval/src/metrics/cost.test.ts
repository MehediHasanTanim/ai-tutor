import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCostUsd, projectMonthlyCost } from './cost.js';

const PRICING = { inputPerMTok: 4, outputPerMTok: 20, cachedInputPerMTok: 0.2 };

describe('estimateCostUsd', () => {
  it('prices input and output separately', () => {
    const cost = estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 0 }, PRICING);
    assert.equal(cost, 4);
  });

  it('prices cached input at the cache rate and the rest at full rate', () => {
    const cost = estimateCostUsd(
      { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 500_000 },
      PRICING,
    );
    // 500k at $4/MTok + 500k at $0.20/MTok
    assert.ok(Math.abs(cost - (2 + 0.1)) < 1e-9);
  });

  it('falls back to the input rate when no cache price is configured', () => {
    const cost = estimateCostUsd(
      { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 1_000_000 },
      { inputPerMTok: 4, outputPerMTok: 20 },
    );
    assert.equal(cost, 4);
  });

  it('never counts cached tokens twice', () => {
    // cachedInputTokens is a subset of inputTokens, not an addition to it.
    // Getting this wrong would overstate every cached candidate's cost.
    const cost = estimateCostUsd(
      { inputTokens: 1000, outputTokens: 0, cachedInputTokens: 1000 },
      PRICING,
    );
    assert.ok(Math.abs(cost - (1000 / 1_000_000) * 0.2) < 1e-12);
  });
});

describe('projectMonthlyCost', () => {
  it('flags a candidate that eats too much of the premium price', () => {
    // Doc 07 R-06: act when cost per active user exceeds 40% of the price.
    const projection = projectMonthlyCost({
      costPerQuestionUsd: 0.02,
      questionsPerDay: 10,
      usdToBdt: 120,
      premiumPriceBdt: 199,
    });

    assert.equal(projection.questionsPerMonth, 300);
    assert.ok(Math.abs(projection.monthlyCostUsd - 6) < 1e-9);
    assert.ok(projection.monthlyCostBdt > 199, 'this candidate costs more than the subscription');
    assert.equal(projection.withinBudget, false);
  });

  it('passes a candidate comfortably inside the budget', () => {
    const projection = projectMonthlyCost({
      costPerQuestionUsd: 0.0005,
      questionsPerDay: 10,
      usdToBdt: 120,
      premiumPriceBdt: 199,
    });

    assert.ok(projection.withinBudget);
    assert.ok(projection.shareOfPrice < 0.4);
  });
});
