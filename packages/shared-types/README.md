# @ai-tutor/shared-types

The single source of truth for the API contract: request/response shapes, shared enums, and the
error code table.

Doc 07 §3: the Flutter side mirrors these in Dart, and drift between the two is a bug, not a style
preference.

## Contents

| File        | What                                                                                   |
| ----------- | -------------------------------------------------------------------------------------- |
| `enums.ts`  | Doc 07 Appendix B enums, plus `UserRole`, `UserStatus`, `Medium`, `SubscriptionStatus` |
| `errors.ts` | `ErrorCode`, the error envelope, and `ERROR_MESSAGES`                                  |
| `auth.ts`   | Auth request/response shapes                                                           |
| `health.ts` | Probe response shapes                                                                  |

Enums are `const` objects rather than TypeScript `enum`s, so values survive `isolatedModules` and
serialize predictably.

## The Bangla guarantee

`ERROR_MESSAGES` is typed `Record<ErrorCode, ErrorDefinition>`. Adding an error code without a
Bangla string is a compile error, not something review has to catch. Doc 07 §5.3 requires every
code to have one; this is how that requirement is enforced.

## Two resolved contradictions

- **Follow-up actions.** Feature spec §6 lists four quick actions, architecture §8 returned three.
  Resolved to four — `show_formula` is included (doc 07 §7.7).
- **Prisma enums.** `apps/api/prisma/schema.prisma` declares the same enums for the database.
  They must be kept in step; the shapes here are what crosses the wire.
