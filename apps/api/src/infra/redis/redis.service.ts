import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import configuration from '../../config/configuration';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(
    @Inject(configuration.KEY)
    config: ConfigType<typeof configuration>,
  ) {
    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      // Redis is load-bearing for refresh tokens and quotas; surface outages
      // rather than queueing commands indefinitely behind a dead connection.
      enableOfflineQueue: false,
    });

    this.client.on('error', (error) => this.logger.error(`Redis error: ${error.message}`));
    this.client.on('connect', () => this.logger.log('Connected to Redis'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Used by the readiness probe. */
  async ping(): Promise<string> {
    return this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  /** Increments a counter and sets its TTL on first write. Used for quotas. */
  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const results = await this.client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
    const value = results?.[0]?.[1];
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  /** Deletes every key under a prefix without blocking Redis on a KEYS scan. */
  async deleteByPrefix(prefix: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }
}
