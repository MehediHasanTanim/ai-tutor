import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads the repository-root `.env`.
 *
 * The monorepo keeps one env file so the API, the seed script, the OpenAPI
 * generator and the tests all read the same values. Node processes started
 * from `apps/api` would otherwise look only at `apps/api/.env`, and keeping a
 * second copy there is how the two drift.
 *
 * Import this first — before anything that reads `process.env`. Existing
 * variables win, so a real environment (CI, staging, production) is never
 * overwritten by a file that happens to be present.
 */
const ROOT = resolve(__dirname, '../../..');

for (const file of ['.env.local', '.env']) {
  const path = resolve(ROOT, file);
  if (existsSync(path)) {
    loadDotenv({ path, override: false, quiet: true });
  }
}
