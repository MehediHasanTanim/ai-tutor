import { Module } from '@nestjs/common';

/**
 * Users module — User records and admin-facing user management. Auth owns credentials; this module owns everything else about a user.
 *
 * Empty by design. Doc 07 (Weeks 1–2) calls for the module shape to exist from
 * day one so that later work has an obvious home and the dependency graph is
 * visible before there is code to tangle. Implementation lands in Weeks 1–2.
 */
@Module({})
export class UsersModule {}
