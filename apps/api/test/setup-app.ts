import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { RedisService } from '../src/infra/redis/redis.service';

/**
 * Boots the real application against the real local Postgres and Redis.
 *
 * Deliberately not mocked: doc 07 §11 asks for integration tests against a real
 * test database, and the things most likely to break here — unique constraints,
 * Redis-backed rotation, the validation pipe, the global filter — are exactly
 * what mocks would paper over.
 *
 * Routing and validation come from the same `configureApp` the production
 * bootstrap uses, so these tests cannot drift from what actually ships.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);

  await app.init();
  return app;
}

/** Removes only what a test created, so a shared dev database stays usable. */
export async function cleanupUsers(app: INestApplication, phones: string[]): Promise<void> {
  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);

  const users = await prisma.user.findMany({ where: { phone: { in: phones } } });
  for (const user of users) {
    await redis.deleteByPrefix(`rt:${user.id}:`);
    await redis.deleteByPrefix(`rtf:${user.id}:`);
  }

  await prisma.user.deleteMany({ where: { phone: { in: phones } } });
}
