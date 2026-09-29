import { Injectable } from '@nestjs/common';
import type { DependencyHealth, LivenessResponse, ReadinessResponse } from '@ai-tutor/shared-types';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

const READINESS_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();
  private readonly version = process.env.npm_package_version ?? '0.1.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness never touches a dependency: a dead Redis must not trigger a restart loop. */
  liveness(): LivenessResponse {
    return {
      status: 'ok',
      uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
      version: this.version,
    };
  }

  async readiness(): Promise<ReadinessResponse> {
    const [postgres, redis] = await Promise.all([
      this.check(() => this.prisma.ping()),
      this.check(() => this.redis.ping()),
    ]);

    const checks = { postgres, redis };
    const status = Object.values(checks).every((c) => c.status === 'ok') ? 'ok' : 'error';

    return { status, checks };
  }

  private async check(probe: () => Promise<unknown>): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      await withTimeout(probe(), READINESS_TIMEOUT_MS);
      return { status: 'ok', latency_ms: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'error',
        latency_ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/** A hung dependency must not hang the probe — the orchestrator is waiting on it. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Health check timed out after ${ms}ms`)), ms).unref(),
    ),
  ]);
}
