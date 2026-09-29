import { Module } from '@nestjs/common';

/**
 * Usage module — Quota enforcement and cost recording. Redis holds the hot counters; usage_records is the durable ledger.
 *
 * Empty by design. Doc 07 (Weeks 1–2) calls for the module shape to exist from
 * day one so that later work has an obvious home and the dependency graph is
 * visible before there is code to tangle. Implementation lands in Weeks 5–6.
 */
@Module({})
export class UsageModule {}
