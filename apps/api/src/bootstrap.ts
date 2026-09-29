import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';

/**
 * Everything about how requests are routed and validated, in one place.
 *
 * Called by `main.ts`, by `scripts/generate-openapi.ts`, and by the e2e test
 * harness. Three copies of this configuration would mean the OpenAPI document
 * and the tests could each describe a different API from the one that ships.
 */
export function configureApp(app: INestApplication): void {
  // /api/v1 per doc 04. Health probes are excluded from the prefix here and
  // marked VERSION_NEUTRAL on their controller, so they stay at /health/*.
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      // Drop unknown properties, then reject payloads that carried any — a
      // client sending `role: "ADMIN"` to /auth/register gets a 400, not a
      // silent strip.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
}
