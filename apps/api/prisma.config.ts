import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * The repository keeps one `.env` at the root, so every app and script reads
 * the same values. The Prisma CLI runs with `apps/api` as its working
 * directory and would otherwise find no `DATABASE_URL` at all.
 *
 * Also replaces the deprecated `package.json#prisma` block, which Prisma 7
 * removes.
 */
loadEnv({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: resolve(__dirname, 'prisma/schema.prisma'),
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
