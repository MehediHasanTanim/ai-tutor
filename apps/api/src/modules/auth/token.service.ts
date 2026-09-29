import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { ErrorCode, type UserRole } from '@ai-tutor/shared-types';
import configuration from '../../config/configuration';
import { AppException } from '../../common/exceptions/app.exception';
import { parseDurationToSeconds } from '../../common/utils/duration';
import { RefreshTokenStore } from './refresh-token.store';
import type { AccessTokenPayload, IssuedTokens, RefreshTokenPayload } from './token.types';

/**
 * Issues, verifies and rotates the token pair.
 *
 * Rotation contract: every successful refresh consumes the presented token and
 * issues a new pair in the same chain (`sid`). Presenting a token that is not
 * live revokes the whole chain — see `rotate`.
 */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    @Inject(configuration.KEY)
    private readonly config: ConfigType<typeof configuration>,
    private readonly jwt: JwtService,
    private readonly store: RefreshTokenStore,
  ) {
    this.accessTtlSeconds = parseDurationToSeconds(config.jwt.accessTtl);
    this.refreshTtlSeconds = parseDurationToSeconds(config.jwt.refreshTtl);
  }

  /** Starts a new session chain. Used by register and login. */
  async issuePair(userId: string, role: UserRole): Promise<IssuedTokens> {
    return this.mint(userId, role, randomUUID());
  }

  /**
   * Consumes `refreshToken` and issues a replacement pair.
   *
   * @throws AppException TOKEN_INVALID  — signature or shape is wrong
   * @throws AppException TOKEN_EXPIRED  — past its expiry
   * @throws AppException TOKEN_REUSED   — already consumed; chain revoked
   */
  async rotate(refreshToken: string, role: UserRole): Promise<IssuedTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const consumed = await this.store.consume(payload.sub, payload.jti);
    if (!consumed) {
      // The signature was valid but no live record exists. Either this token
      // was already rotated (replay) or it was revoked. Assume compromise and
      // take the whole chain down rather than letting the attacker continue.
      await this.store.revokeFamily(payload.sub, payload.sid);
      throw new AppException(ErrorCode.TOKEN_REUSED);
    }

    return this.mint(payload.sub, role, payload.sid);
  }

  /** Ends one session. Idempotent — logging out twice is not an error. */
  async revoke(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.store.consume(payload.sub, payload.jti);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.store.revokeAllForUser(userId);
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.jwt.refreshSecret,
      });
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new AppException(expired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID, {
        cause: error,
      });
    }
  }

  get accessTokenTtlSeconds(): number {
    return this.accessTtlSeconds;
  }

  private async mint(userId: string, role: UserRole, sid: string): Promise<IssuedTokens> {
    const refreshJti = randomUUID();

    const accessPayload: AccessTokenPayload = { sub: userId, role, jti: randomUUID() };
    const refreshPayload: RefreshTokenPayload = { sub: userId, sid, jti: refreshJti };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.accessTtlSeconds,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      }),
    ]);

    await this.store.save(userId, sid, refreshJti, this.refreshTtlSeconds);

    return { accessToken, refreshToken, expiresInSeconds: this.accessTtlSeconds };
  }
}
