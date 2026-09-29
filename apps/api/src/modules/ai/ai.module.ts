import { Module } from '@nestjs/common';

/**
 * Ai module — AIProvider abstraction and the per-provider adapters. Every LLM/vision/embedding call in the system goes through here — nothing else imports a provider SDK.
 *
 * Empty by design. Doc 07 (Weeks 1–2) calls for the module shape to exist from
 * day one so that later work has an obvious home and the dependency graph is
 * visible before there is code to tangle. Implementation lands in Weeks 1–2.
 */
@Module({})
export class AiModule {}
