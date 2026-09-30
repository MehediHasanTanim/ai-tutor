import { registerAs } from '@nestjs/config';
import { validateEnv, type Env } from './env.validation';

/**
 * Typed view over the validated environment. Feature code reads from here
 * rather than from `process.env`, so the shape is discoverable and mockable.
 */
export interface AppConfig {
  nodeEnv: Env['NODE_ENV'];
  port: number;
  apiBaseUrl: string;
  corsOrigins: string[];
  isProduction: boolean;
  database: { url: string };
  redis: { url: string };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  ai: {
    /** Empty until D-09 is decided. */
    provider: string;
    apiKey?: string;
    chatModel?: string;
    fastModel?: string;
    visionProvider?: string;
    visionModel?: string;
    embeddingProvider?: string;
    embeddingModel?: string;
    embeddingDimensions?: number;
  };
  storage: {
    endpoint?: string;
    bucket?: string;
    accessKey?: string;
    secretKey?: string;
    region: string;
  };
  quotas: {
    free: { questions: number; images: number; quizzes: number };
    premium: { questions: number; images: number };
  };
  throttle: { ttlSeconds: number; limit: number };
  observability: { sentryDsn?: string; logLevel: Env['LOG_LEVEL'] };
}

export function buildConfig(env: Env): AppConfig {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    apiBaseUrl: env.API_BASE_URL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    isProduction: env.NODE_ENV === 'production',
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    ai: {
      provider: env.LLM_PROVIDER,
      apiKey: env.LLM_API_KEY,
      chatModel: env.LLM_MODEL_CHAT,
      fastModel: env.LLM_MODEL_FAST,
      visionProvider: env.VISION_PROVIDER,
      visionModel: env.VISION_MODEL,
      embeddingProvider: env.EMBEDDING_PROVIDER,
      embeddingModel: env.EMBEDDING_MODEL,
      embeddingDimensions: env.EMBEDDING_DIMENSIONS,
    },
    storage: {
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      region: env.S3_REGION,
    },
    quotas: {
      free: {
        questions: env.FREE_DAILY_QUESTIONS,
        images: env.FREE_DAILY_IMAGES,
        quizzes: env.FREE_DAILY_QUIZZES,
      },
      premium: {
        questions: env.PREMIUM_DAILY_QUESTIONS,
        images: env.PREMIUM_DAILY_IMAGES,
      },
    },
    throttle: { ttlSeconds: env.THROTTLE_TTL_SECONDS, limit: env.THROTTLE_LIMIT },
    observability: { sentryDsn: env.SENTRY_DSN, logLevel: env.LOG_LEVEL },
  };
}

/** Config namespace key. `configuration.KEY` is the injection token. */
export const APP_CONFIG = 'app';

/**
 * Re-parses rather than trusting `process.env` directly: the schema is what
 * coerces PORT and the quota values from strings into numbers.
 */
export default registerAs(APP_CONFIG, (): AppConfig => buildConfig(validateEnv(process.env)));
