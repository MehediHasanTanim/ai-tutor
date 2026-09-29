import { JwtService } from '@nestjs/jwt';
import { ErrorCode } from '@ai-tutor/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import type { AppConfig } from '../../config/configuration';
import { RefreshTokenStore } from './refresh-token.store';
import { TokenService } from './token.service';

/**
 * In-memory stand-in for the Redis-backed store. The rotation rules are the
 * thing under test, not Redis itself.
 */
class FakeStore implements Pick<RefreshTokenStore, 'save' | 'consume' | 'revokeFamily'> {
  private live = new Map<string, string>();
  private families = new Map<string, Set<string>>();
  revokedFamilies: string[] = [];

  async save(userId: string, sid: string, jti: string): Promise<void> {
    this.live.set(`${userId}:${jti}`, sid);
    const key = `${userId}:${sid}`;
    if (!this.families.has(key)) this.families.set(key, new Set());
    this.families.get(key)!.add(jti);
  }

  async consume(userId: string, jti: string): Promise<boolean> {
    return this.live.delete(`${userId}:${jti}`);
  }

  async revokeFamily(userId: string, sid: string): Promise<void> {
    this.revokedFamilies.push(sid);
    for (const jti of this.families.get(`${userId}:${sid}`) ?? []) {
      this.live.delete(`${userId}:${jti}`);
    }
  }

  isLive(userId: string, jti: string): boolean {
    return this.live.has(`${userId}:${jti}`);
  }
}

const config = {
  jwt: {
    accessSecret: 'test-access-secret-at-least-16-chars',
    refreshSecret: 'test-refresh-secret-at-least-16-chars',
    accessTtl: '15m',
    refreshTtl: '30d',
  },
} as AppConfig;

describe('TokenService', () => {
  const USER = 'user-1';
  let store: FakeStore;
  let jwt: JwtService;
  let service: TokenService;

  beforeEach(() => {
    store = new FakeStore();
    jwt = new JwtService({});
    service = new TokenService(config, jwt, store as unknown as RefreshTokenStore);
  });

  it('issues a pair whose access token carries the user id and role', async () => {
    const { accessToken, expiresInSeconds } = await service.issuePair(USER, 'STUDENT');

    const payload = jwt.verify(accessToken, { secret: config.jwt.accessSecret });
    expect(payload.sub).toBe(USER);
    expect(payload.role).toBe('STUDENT');
    expect(expiresInSeconds).toBe(900);
  });

  it('rotates: the old token is consumed and the new one differs', async () => {
    const first = await service.issuePair(USER, 'STUDENT');
    const second = await service.rotate(first.refreshToken, 'STUDENT');

    expect(second.refreshToken).not.toBe(first.refreshToken);

    const oldJti = jwt.decode(first.refreshToken).jti;
    expect(store.isLive(USER, oldJti)).toBe(false);
  });

  it('keeps the session id stable across a rotation', async () => {
    const first = await service.issuePair(USER, 'STUDENT');
    const second = await service.rotate(first.refreshToken, 'STUDENT');

    expect(jwt.decode(second.refreshToken).sid).toBe(jwt.decode(first.refreshToken).sid);
  });

  it('rejects a replayed token and revokes the whole chain', async () => {
    const first = await service.issuePair(USER, 'STUDENT');
    const second = await service.rotate(first.refreshToken, 'STUDENT');

    await expect(service.rotate(first.refreshToken, 'STUDENT')).rejects.toMatchObject({
      code: ErrorCode.TOKEN_REUSED,
    });

    // The chain is down, so the legitimately-issued successor is dead too.
    const secondJti = jwt.decode(second.refreshToken).jti;
    expect(store.isLive(USER, secondJti)).toBe(false);
    expect(store.revokedFamilies).toHaveLength(1);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign(
      { sub: USER, sid: 's', jti: 'j' },
      { secret: 'a-different-secret-16+' },
    );

    await expect(service.rotate(forged, 'STUDENT')).rejects.toMatchObject({
      code: ErrorCode.TOKEN_INVALID,
    });
  });

  it('reports an expired token distinctly from an invalid one', async () => {
    const expired = jwt.sign(
      { sub: USER, sid: 's', jti: 'j' },
      { secret: config.jwt.refreshSecret, expiresIn: -10 },
    );

    await expect(service.rotate(expired, 'STUDENT')).rejects.toMatchObject({
      code: ErrorCode.TOKEN_EXPIRED,
    });
  });

  it('will not accept an access token on the refresh path', async () => {
    const { accessToken } = await service.issuePair(USER, 'STUDENT');

    await expect(service.rotate(accessToken, 'STUDENT')).rejects.toBeInstanceOf(AppException);
  });

  it('revoking is idempotent', async () => {
    const { refreshToken } = await service.issuePair(USER, 'STUDENT');

    await expect(service.revoke(refreshToken)).resolves.toBeUndefined();
    await expect(service.revoke(refreshToken)).resolves.toBeUndefined();
  });
});
