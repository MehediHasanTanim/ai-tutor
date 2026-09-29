# @ai-tutor/api

NestJS backend. Modular monolith (D-07 — explicitly not microservices).

## Layout

```text
src/
├── main.ts                 # process bootstrap: helmet, CORS, listen
├── bootstrap.ts            # routing + validation, shared with tests and the OpenAPI generator
├── app.module.ts           # module graph, global guards and filter
├── swagger.ts              # OpenAPI document
├── config/                 # zod-validated env, typed AppConfig
├── common/                 # error envelope, request id, decorators, utils
├── infra/                  # PrismaService, RedisService
└── modules/                # architecture §3 modules
```

Most modules under `modules/` are empty `@Module({})` declarations. That is deliberate: doc 07
asks for the module shape to exist from day one so later work has an obvious home and the
dependency graph is visible before there is code to tangle. Each file names the week it gets
filled in.

## Implemented

| Module          | State                                                              |
| --------------- | ------------------------------------------------------------------ |
| `auth`          | Register, login, refresh with rotation and reuse detection, logout |
| `health`        | `/health/live`, `/health/ready`                                    |
| everything else | Skeleton only                                                      |

## How the pieces fit

**Error handling.** Feature code throws `AppException(ErrorCode.X)`. `AllExceptionsFilter`
converts it — plus `HttpException`, `ThrottlerException`, Prisma errors and anything unrecognised
— into the one envelope. 5xx causes are logged with the request id and never returned to the
client, so a Prisma error cannot leak column names.

**Authentication.** `JwtAuthGuard` is registered globally, so a new endpoint is protected unless
someone writes `@Public()`. Access tokens are verified statelessly and carry no database read;
revocation and account status are re-checked on the refresh path.

**Refresh rotation.** Redis holds one key per live refresh token plus a set per rotation chain.
A refresh consumes its key and issues a successor in the same chain. A token that verifies but has
no live key is a replay, and the whole chain is revoked. `token.service.spec.ts` covers the cases.

**Configuration.** `env.validation.ts` is a zod schema; the process refuses to boot on a violation.
Feature code reads the typed `AppConfig`, not `process.env`.

## Database

Prisma against PostgreSQL 17 with pgvector. The first migration covers users, student profiles,
the curriculum tree, student subject selection, subscriptions and usage records. Tables for RAG,
chat, quizzes and mastery arrive with the weeks that need them rather than up front.

Extensions (`vector`, `pg_trgm`, `uuid-ossp`) are owned by the Prisma migration, not by the
container's `init.sql` — declaring them in both makes every fresh clone's first `migrate dev`
report drift.

## Testing

```bash
pnpm test        # unit — business logic, no I/O
pnpm test:e2e    # integration — real Postgres and Redis, needs `pnpm dev:infra`
```

Integration tests boot the real application through the same `configureApp` as production and
clean up only the rows they created.

## OpenAPI

```bash
pnpm openapi:generate
```

Writes `openapi.json` without starting a listener, so the spec is reviewable in a diff. CI fails
if the committed file is stale.
