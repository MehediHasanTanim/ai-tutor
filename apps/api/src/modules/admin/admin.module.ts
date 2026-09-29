import { Module } from '@nestjs/common';

/**
 * Admin module — Admin-only endpoints: document upload, processing status, knowledge-base inspection. RBAC-guarded.
 *
 * Empty by design. Doc 07 (Weeks 1–2) calls for the module shape to exist from
 * day one so that later work has an obvious home and the dependency graph is
 * visible before there is code to tangle. Implementation lands in Weeks 3–4.
 */
@Module({})
export class AdminModule {}
