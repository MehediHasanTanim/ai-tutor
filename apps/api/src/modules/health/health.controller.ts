import { Controller, Get, HttpCode, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { LivenessResponse } from '@ai-tutor/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

/**
 * Mounted outside /api/v1 — orchestrators probe /health/live and /health/ready
 * directly (doc 07 Appendix C).
 *
 * VERSION_NEUTRAL matters as much as the global-prefix exclusion: without it
 * URI versioning still injects /v1, and the probe path in a Kubernetes manifest
 * or load-balancer config silently stops matching.
 */
@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe. Does not touch dependencies.' })
  liveness(): LivenessResponse {
    return this.health.liveness();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe. Checks Postgres and Redis.' })
  async readiness(@Res() res: Response): Promise<void> {
    const result = await this.health.readiness();
    // 503 on failure, so a load balancer takes the instance out of rotation
    // rather than reading a 200 body it does not parse.
    const status = result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(status).json(result);
  }

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  root(): LivenessResponse {
    return this.health.liveness();
  }
}
