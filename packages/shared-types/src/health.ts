/**
 * Health endpoint contract — doc 07 Appendix C.
 *
 * `/health/live`  — the process is up. Never touches a dependency.
 * `/health/ready` — the process can serve traffic: Postgres and Redis reachable.
 */

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface DependencyHealth {
  status: HealthStatus;
  latency_ms?: number;
  error?: string;
}

export interface LivenessResponse {
  status: HealthStatus;
  uptime_seconds: number;
  version: string;
}

export interface ReadinessResponse {
  status: HealthStatus;
  checks: Record<string, DependencyHealth>;
}
