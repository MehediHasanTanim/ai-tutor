# AI Tutor Bangladesh

A curriculum-grounded AI tutor for Bangladeshi Class 9–10 Science students (NCTB), built
Bangla-first. See [`docs/`](docs/) for the product, architecture and delivery plan; this README
covers running the thing.

**Status:** Weeks 1–2 of the 16-week plan — foundation. Auth, health, error contract and the
module skeleton exist. Curriculum, RAG, tutor, quizzes and personalization do not yet.

---

## Prerequisites

| Tool    | Version                                                             |
| ------- | ------------------------------------------------------------------- |
| Node    | 22+                                                                 |
| pnpm    | 9.15 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`) |
| Docker  | with Compose v2                                                     |
| Flutter | 3.27+ (only once `apps/mobile` is scaffolded)                       |

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev:infra                                   # Postgres+pgvector, Redis, S3
pnpm --filter @ai-tutor/shared-types build
pnpm --filter @ai-tutor/api exec prisma migrate dev
pnpm db:seed
pnpm dev:api
```

The API is then at <http://localhost:4000/api/v1> and Swagger UI at
<http://localhost:4000/api/docs>.

Verify:

```bash
curl http://localhost:4000/health/ready
```

## Ports

Every port is deliberately off the service default so this stack coexists with other local
projects. Full map in [`docs/architecture/08_Port_Allocation.md`](docs/architecture/08_Port_Allocation.md).

| Port | Service                          |
| ---- | -------------------------------- |
| 4000 | API                              |
| 4001 | Admin panel (not yet scaffolded) |
| 5442 | PostgreSQL 17 + pgvector         |
| 6380 | Redis 7                          |
| 9010 | S3 API                           |
| 9011 | S3 admin UI                      |

## Layout

```text
apps/
  api/                NestJS backend — the only app that currently exists
  admin/              Next.js admin panel        (Weeks 3–4)
  mobile/             Flutter application        (Weeks 1–2, not yet scaffolded)
packages/
  shared-types/       API contract types and shared enums — single source of truth
  prompts/            Versioned prompt templates (Weeks 1–2, pending provider decision)
  eval/               AI quality evaluation harness (Weeks 1–2, pending)
infra/
  docker/             Container init and config
docs/                 Specifications 01–08
```

## Commands

```bash
pnpm dev:infra          # start Postgres, Redis, S3
pnpm dev:infra:down     # stop them
pnpm dev:api            # API in watch mode
pnpm db:migrate         # create and apply a migration
pnpm db:seed            # idempotent baseline seed
pnpm lint               # every workspace
pnpm typecheck          # every workspace
pnpm test               # unit tests
pnpm format             # prettier write
```

API-specific:

```bash
pnpm --filter @ai-tutor/api test:e2e            # integration tests (needs dev:infra up)
pnpm --filter @ai-tutor/api openapi:generate    # regenerate openapi.json
pnpm --filter @ai-tutor/api db:studio           # Prisma Studio on :4005
```

## Conventions

- **Error envelope.** Every failure returns
  `{ error: { code, message, message_bn, request_id } }`. Codes are enumerated in
  `@ai-tutor/shared-types`, and every one carries a Bangla string — enforced by the type system,
  not by review.
- **Request IDs.** Every response carries `x-request-id`, echoed from the caller when supplied.
- **Auth is default-on.** The JWT guard is global; routes opt out with `@Public()`.
- **Refresh rotation.** Each refresh consumes its token. Replaying a consumed token revokes the
  entire session chain and returns `TOKEN_REUSED`.
- **Shared types are the contract.** An API change updates `packages/shared-types` and
  `openapi.json` in the same PR. CI fails on a stale spec.

## Known deviations from the docs

| Doc     | Says                           | Here                 | Why                                                                                                      |
| ------- | ------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------- |
| 07 §4   | MinIO for local object storage | SeaweedFS S3 gateway | MinIO's images now require Docker Hub authentication. Same S3 API; deployed environments are unaffected. |
| 07 §3   | Postgres on its default port   | 5442                 | 5433 was already taken by another local project — the exact clash non-default ports are for.             |
| Arch §3 | `learning` module              | `learning` + `tutor` | Doc 04 defines a distinct `/api/v1/tutor/*` route group with its own lifecycle and quota rules.          |
