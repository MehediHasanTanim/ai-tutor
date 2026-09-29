# AI Tutor Bangladesh — Local Port Allocation

Every port in the local stack is deliberately off the service default, so the stack can run
alongside an existing local Postgres, Redis or MinIO without a clash. Nothing in the repo should
hard-code a default port; all of these are overridable through `.env`.

## Application ports

| Port | Service                       | Env var       | Notes                             |
| ---- | ----------------------------- | ------------- | --------------------------------- |
| 4000 | NestJS API (`apps/api`)       | `PORT`        | `/api/v1`, Swagger at `/api/docs` |
| 4001 | Next.js admin (`apps/admin`)  | `ADMIN_PORT`  | Weeks 3–4                         |
| 4002 | BullMQ worker / job dashboard | `WORKER_PORT` | Reserved, Weeks 3–4               |
| 4003 | Reserved                      | —             | Future service                    |

## Infrastructure ports (host side)

| Host port | Container port | Service                  | Default it replaces | Env var                   |
| --------- | -------------- | ------------------------ | ------------------- | ------------------------- |
| 5442      | 5432           | PostgreSQL 17 + pgvector | 5432                | `POSTGRES_HOST_PORT`      |
| 6380      | 6379           | Redis 7                  | 6379                | `REDIS_HOST_PORT`         |
| 9010      | 9000           | MinIO S3 API             | 9000                | `MINIO_HOST_PORT`         |
| 9011      | 9001           | MinIO web console        | 9001                | `MINIO_CONSOLE_HOST_PORT` |

## Container-internal addressing

Services inside the Compose network reach each other on **default** ports
(`postgres:5432`, `redis:6379`, `minio:9000`). Only host-published ports are remapped. Code that
runs on the host — the API in `start:dev`, Prisma CLI, seed scripts — uses the host ports above.

## Connection strings

```text
DATABASE_URL=postgresql://aitutor:aitutor@localhost:5442/aitutor?schema=public
REDIS_URL=redis://localhost:6380
S3_ENDPOINT=http://localhost:9010
```

MinIO console: <http://localhost:9011> (`aitutor` / `aitutor123`).
