import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './setup-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live is unversioned and unauthenticated', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(res.body).toMatchObject({ status: 'ok', version: expect.any(String) });
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('does not expose the probe under the versioned prefix', async () => {
    // Guards against URI versioning quietly moving the path a k8s manifest points at.
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(404);
    await request(app.getHttpServer()).get('/v1/health/live').expect(404);
  });

  it('GET /health/ready reports both dependencies', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.checks.postgres.status).toBe('ok');
    expect(res.body.checks.redis.status).toBe('ok');
  });

  it('attaches a request id to every response', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('echoes a caller-supplied request id', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', 'trace-abc-123')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('replaces a malformed caller-supplied request id rather than reflecting it', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', 'bad id <script>')
      .expect(200);

    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });
});
