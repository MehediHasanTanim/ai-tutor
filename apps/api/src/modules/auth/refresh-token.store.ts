import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/redis/redis.service';

/**
 * Server-side record of which refresh tokens are still live.
 *
 * A refresh JWT verifying is not sufficient to accept it — it must also still
 * be present here. That is what makes rotation enforceable: once a token is
 * consumed its record is deleted, so a second presentation of the same token
 * is provably a replay.
 *
 * Keys:
 *   rt:{userId}:{jti}   -> sid         (the live token record)
 *   rtf:{userId}:{sid}  -> set of jti  (the rotation chain, for bulk revoke)
 */
@Injectable()
export class RefreshTokenStore {
  constructor(private readonly redis: RedisService) {}

  private tokenKey(userId: string, jti: string): string {
    return `rt:${userId}:${jti}`;
  }

  private familyKey(userId: string, sid: string): string {
    return `rtf:${userId}:${sid}`;
  }

  async save(userId: string, sid: string, jti: string, ttlSeconds: number): Promise<void> {
    const familyKey = this.familyKey(userId, sid);

    await this.redis.client
      .multi()
      .set(this.tokenKey(userId, jti), sid, 'EX', ttlSeconds)
      .sadd(familyKey, jti)
      // The family must outlive its longest-lived member, otherwise a revoke
      // arriving late finds nothing to revoke.
      .expire(familyKey, ttlSeconds)
      .exec();
  }

  /** True when this exact token is still live. */
  async exists(userId: string, jti: string): Promise<boolean> {
    return (await this.redis.client.exists(this.tokenKey(userId, jti))) === 1;
  }

  /** Consumes a token. Returns false if it was already used or revoked. */
  async consume(userId: string, jti: string): Promise<boolean> {
    return (await this.redis.client.del(this.tokenKey(userId, jti))) === 1;
  }

  /**
   * Revokes an entire rotation chain. Called when a consumed token is
   * presented again — that means either a replay or a stolen token, and in
   * neither case should the rest of the chain stay usable.
   */
  async revokeFamily(userId: string, sid: string): Promise<void> {
    const familyKey = this.familyKey(userId, sid);
    const jtis = await this.redis.client.smembers(familyKey);
    const keys = jtis.map((jti) => this.tokenKey(userId, jti));

    await this.redis.del(...keys, familyKey);
  }

  /** Revokes every session for a user — password change, suspension, support action. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.redis.deleteByPrefix(`rt:${userId}:`);
    await this.redis.deleteByPrefix(`rtf:${userId}:`);
  }
}
