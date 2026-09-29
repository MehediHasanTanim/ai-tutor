import { Module } from '@nestjs/common';

/**
 * Recommendations module — Rules-based recommendation engine per architecture §10. Deliberately rules, not ML.
 *
 * Empty by design. Doc 07 (Weeks 1–2) calls for the module shape to exist from
 * day one so that later work has an obvious home and the dependency graph is
 * visible before there is code to tangle. Implementation lands in Weeks 11–12.
 */
@Module({})
export class RecommendationsModule {}
