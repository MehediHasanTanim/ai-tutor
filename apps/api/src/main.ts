import './load-env';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import type { AppConfig } from './config/configuration';
import { ConfigService } from '@nestjs/config';
import { SWAGGER_PATH, setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService).getOrThrow<AppConfig>('app');

  app.use(helmet());

  app.enableCors({
    // An empty CORS_ORIGINS reflects the request origin — acceptable locally,
    // which is why staging and production must set the variable explicitly.
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  configureApp(app);

  app.enableShutdownHooks();

  setupSwagger(app);

  await app.listen(config.port, '0.0.0.0');

  logger.log(`API listening on http://localhost:${config.port}/api/v1`);
  logger.log(`OpenAPI UI at http://localhost:${config.port}/${SWAGGER_PATH}`);
  logger.log(`Environment: ${config.nodeEnv}`);
}

void bootstrap();
