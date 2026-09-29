/**
 * Cost measurement — doc 07 §6 dimension 6 and §10.
 *
 * "Measured, not estimated" is the requirement: prices come from a table the
 * team maintains, token counts come from the provider's own usage response.
 *
 * The number that decides the business (§10) is cost per active premium user
 * per month against ৳199. This module produces the per-question input to that.
 */

import type { TokenUsage } from '../types.js';

export interface ModelPricing {
  /** USD per million input tokens. */
  inputPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
  /** USD per million cached-read input tokens, when the provider offers it. */
  cachedInputPerMTok?: number;
}

/**
 * Prices are configuration, not code.
 *
 * Every entry must carry a `verifiedOn` date in `pricing.json`, because a
 * stale price silently invalidates the one number that decides whether the
 * unit economics work.
 */
export type PricingTable = Record<string, ModelPricing>;

export function estimateCostUsd(usage: TokenUsage, pricing: ModelPricing): number {
  const cached = usage.cachedInputTokens ?? 0;
  const uncachedInput = Math.max(0, usage.inputTokens - cached);

  const cachedRate = pricing.cachedInputPerMTok ?? pricing.inputPerMTok;

  return (
    (uncachedInput / 1_000_000) * pricing.inputPerMTok +
    (cached / 1_000_000) * cachedRate +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok
  );
}

/**
 * Projects a monthly per-user cost from measured per-question cost.
 *
 * This is the §10 guardrail made arithmetic: if the projection exceeds the
 * premium price net of platform fees, either the quotas or the price change
 * now, not after launch.
 */
export interface MonthlyProjection {
  costPerQuestionUsd: number;
  questionsPerMonth: number;
  monthlyCostUsd: number;
  monthlyCostBdt: number;
  /** Share of the premium price this consumes, 0–1. */
  shareOfPrice: number;
  withinBudget: boolean;
}

export function projectMonthlyCost(params: {
  costPerQuestionUsd: number;
  questionsPerDay: number;
  usdToBdt: number;
  premiumPriceBdt: number;
  /** Doc 07 R-06 triggers action above 40% of price. */
  budgetShare?: number;
}): MonthlyProjection {
  const questionsPerMonth = params.questionsPerDay * 30;
  const monthlyCostUsd = params.costPerQuestionUsd * questionsPerMonth;
  const monthlyCostBdt = monthlyCostUsd * params.usdToBdt;
  const shareOfPrice = monthlyCostBdt / params.premiumPriceBdt;

  return {
    costPerQuestionUsd: params.costPerQuestionUsd,
    questionsPerMonth,
    monthlyCostUsd,
    monthlyCostBdt,
    shareOfPrice,
    withinBudget: shareOfPrice <= (params.budgetShare ?? 0.4),
  };
}
