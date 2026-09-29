import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * OpenAPI document — the contract `packages/shared-types` and the Flutter
 * models are checked against (doc 07 §5.1, point 3).
 *
 * Built here rather than inline in main.ts so `scripts/generate-openapi.ts` can
 * produce the same document without starting an HTTP listener.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AI Tutor Bangladesh API')
    .setDescription(
      'Curriculum-grounded AI tutor for Class 9–10 Science (NCTB).\n\n' +
        'All errors share one envelope: `{ error: { code, message, message_bn, request_id } }`. ' +
        'Error codes are enumerated in `@ai-tutor/shared-types`.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addServer('http://localhost:4000', 'Local')
    .addTag('auth', 'Registration, login, token rotation')
    .addTag('health', 'Liveness and readiness probes')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export const SWAGGER_PATH = 'api/docs';

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    jsonDocumentUrl: 'api/docs-json',
  });

  return document;
}
