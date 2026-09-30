/**
 * Writes the OpenAPI document to disk without starting a listener.
 *
 * Run in CI so `openapi.json` is reviewable in a diff — an API change that
 * nobody noticed in review is exactly the drift doc 07 §5.1 is guarding against.
 *
 *   pnpm --filter @ai-tutor/api openapi:generate
 */
import '../src/load-env';

import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { buildOpenApiDocument } from '../src/swagger';

async function main(): Promise<void> {
  const outputPath = resolve(__dirname, '../openapi.json');

  const app = await NestFactory.create(AppModule, { logger: false });
  // Without this the document would list /auth/login instead of the real
  // /api/v1/auth/login — a spec that describes an API nobody is serving.
  configureApp(app);
  await app.init();

  const document = buildOpenApiDocument(app);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();

  console.log(`OpenAPI written to ${outputPath}`);

  // The ingestion worker and queue hold Redis connections that outlive
  // app.close(), so the event loop never drains and the script hangs. This
  // is a build-time generator with nothing left to flush — exit explicitly.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
