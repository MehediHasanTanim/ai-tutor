import { Module } from '@nestjs/common';

/**
 * Tutor module — Chat sessions, messages, SSE streaming, and the image-question endpoint. Serves the /api/v1/tutor/* group in doc 04; split out from `learning` because the two have different lifecycles and quota rules.
 *
 * Empty by design. Doc 07 (Weeks 1–2) calls for the module shape to exist from
 * day one so that later work has an obvious home and the dependency graph is
 * visible before there is code to tangle. Implementation lands in Weeks 5–6.
 */
@Module({})
export class TutorModule {}
