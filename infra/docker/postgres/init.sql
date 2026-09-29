-- Runs once, on first container start.
--
-- Deliberately does NOT create extensions. Prisma owns them declaratively via
-- the `extensions` list in schema.prisma, and creating them here as well makes
-- every fresh clone's first `prisma migrate dev` report drift and offer to
-- reset the database. One owner for schema: the migrations.
--
-- Left in place as the hook for anything that genuinely must exist before the
-- first migration runs (roles, schemas, database-level settings).

DO $$ BEGIN
  RAISE NOTICE 'ai-tutor: database initialized; schema is managed by Prisma migrations';
END $$;
