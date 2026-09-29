import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { cleanupUsers, createTestApp } from './setup-app';

const PHONE = '+8801799000001';
const PASSWORD = 'e2e-strong-pass-123';

const REGISTRATION = {
  name: 'E2E Student',
  phone: PHONE,
  email: 'e2e-student@aitutor.local',
  password: PASSWORD,
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer();
    await cleanupUsers(app, [PHONE]);
  });

  afterAll(async () => {
    await cleanupUsers(app, [PHONE]);
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('creates an account and returns a token pair', async () => {
      const res = await request(http).post('/api/v1/auth/register').send(REGISTRATION).expect(201);

      expect(res.body.user).toMatchObject({
        name: 'E2E Student',
        phone: PHONE,
        role: 'STUDENT',
        status: 'ACTIVE',
      });
      expect(res.body.tokens.token_type).toBe('Bearer');
      expect(res.body.tokens.expires_in).toBeGreaterThan(0);
      // No academic setup has happened yet.
      expect(res.body.profile).toBeNull();
    });

    it('never returns the password hash', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ identifier: PHONE, password: PASSWORD })
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('argon2');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('rejects a duplicate phone with PHONE_ALREADY_EXISTS', async () => {
      const res = await request(http)
        .post('/api/v1/auth/register')
        .send({ ...REGISTRATION, email: 'different@aitutor.local' })
        .expect(409);

      expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
      expect(res.body.error.message_bn).toBeTruthy();
      expect(res.body.error.request_id).toMatch(/^req_/);
    });

    it('normalizes a locally-formatted phone number to E.164', async () => {
      // Registering with the local form must collide with the E.164 record.
      const res = await request(http)
        .post('/api/v1/auth/register')
        .send({ ...REGISTRATION, phone: '01799000001', email: 'other@aitutor.local' })
        .expect(409);

      expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    });

    it('returns field-level detail on a validation failure', async () => {
      const res = await request(http)
        .post('/api/v1/auth/register')
        .send({ name: 'X', phone: '12345', password: 'short' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(res.body.error.details)).toEqual(
        expect.arrayContaining(['name', 'phone', 'password']),
      );
    });

    it('strips unknown properties rather than accepting them', async () => {
      await request(http)
        .post('/api/v1/auth/register')
        .send({ ...REGISTRATION, phone: '+8801799000099', role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('accepts either phone or email as the identifier', async () => {
      await request(http)
        .post('/api/v1/auth/login')
        .send({ identifier: PHONE, password: PASSWORD })
        .expect(200);

      await request(http)
        .post('/api/v1/auth/login')
        .send({ identifier: REGISTRATION.email, password: PASSWORD })
        .expect(200);
    });

    it('returns INVALID_CREDENTIALS for a wrong password', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ identifier: PHONE, password: 'definitely-wrong' })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns the same error for an unknown account, not NOT_FOUND', async () => {
      // Distinguishing the two would turn login into an account-existence oracle.
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ identifier: '+8801799999999', password: PASSWORD })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    async function freshRefreshToken(): Promise<string> {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ identifier: PHONE, password: PASSWORD })
        .expect(200);
      return res.body.tokens.refresh_token;
    }

    it('rotates the pair', async () => {
      const original = await freshRefreshToken();

      const res = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: original })
        .expect(200);

      expect(res.body.tokens.refresh_token).not.toBe(original);
      expect(res.body.tokens.access_token).toBeTruthy();
    });

    it('revokes the whole chain when a consumed token is replayed', async () => {
      const original = await freshRefreshToken();

      const rotated = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: original })
        .expect(200);
      const successor = rotated.body.tokens.refresh_token;

      const replay = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: original })
        .expect(401);
      expect(replay.body.error.code).toBe('TOKEN_REUSED');

      // The successor was legitimately issued, but the chain is compromised.
      const successorAttempt = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: successor })
        .expect(401);
      expect(successorAttempt.body.error.code).toBe('TOKEN_REUSED');
    });

    it('leaves other sessions alone when one chain is revoked', async () => {
      const sessionA = await freshRefreshToken();
      const sessionB = await freshRefreshToken();

      await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: sessionA })
        .expect(200);
      await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: sessionA })
        .expect(401);

      // Logging in on a phone must not sign the student out on a tablet.
      await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: sessionB })
        .expect(200);
    });

    it('rejects a malformed token at validation', async () => {
      const res = await request(http)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: 'not-a-jwt' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('ends the session and is idempotent', async () => {
      const login = await request(http)
        .post('/api/v1/auth/login')
        .send({ identifier: PHONE, password: PASSWORD })
        .expect(200);
      const token = login.body.tokens.refresh_token;

      await request(http).post('/api/v1/auth/logout').send({ refresh_token: token }).expect(204);
      await request(http).post('/api/v1/auth/logout').send({ refresh_token: token }).expect(204);

      // A logged-out token cannot be refreshed.
      await request(http).post('/api/v1/auth/refresh').send({ refresh_token: token }).expect(401);
    });
  });
});
