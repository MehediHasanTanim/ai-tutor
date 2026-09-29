import { z } from 'zod';

/**
 * Environment contract. The process refuses to boot on a violation — a missing
 * JWT secret should fail at startup, not at the first login attempt.
 *
 * Keys mirror doc 07 Appendix A. AI provider keys are optional for now because
 * D-09/D-10/D-11 are still open; they become required in the week that uses them.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  /** Comma-separated. Empty means "reflect any origin" — development only. */
  CORS_ORIGINS: z.string().default(''),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),

  FREE_DAILY_QUESTIONS: z.coerce.number().int().nonnegative().default(10),
  FREE_DAILY_IMAGES: z.coerce.number().int().nonnegative().default(3),
  FREE_DAILY_QUIZZES: z.coerce.number().int().nonnegative().default(2),
  PREMIUM_DAILY_QUESTIONS: z.coerce.number().int().nonnegative().default(200),
  PREMIUM_DAILY_IMAGES: z.coerce.number().int().nonnegative().default(50),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}
