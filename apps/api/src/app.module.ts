import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration, { type AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';

import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HealthModule } from './modules/health/health.module';

// Architecture §3 module shape. Empty until the week that fills them.
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { FilesModule } from './modules/files/files.module';
import { LearningModule } from './modules/learning/learning.module';
import { ProgressModule } from './modules/progress/progress.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { RagModule } from './modules/rag/rag.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { StudentsModule } from './modules/students/students.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TutorModule } from './modules/tutor/tutor.module';
import { UsageModule } from './modules/usage/usage.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Fail at boot on a bad environment, not at the first request that needs it.
      validate: validateEnv,
      // `src/load-env.ts` has normally already populated process.env from the
      // repository root; these paths are the fallback for a process that did not.
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      cache: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const app = configService.getOrThrow<AppConfig>('app');
        return {
          throttlers: [{ ttl: app.throttle.ttlSeconds * 1000, limit: app.throttle.limit }],
        };
      },
    }),

    PrismaModule,
    RedisModule,

    HealthModule,
    AuthModule,

    UsersModule,
    StudentsModule,
    CurriculumModule,
    SubjectsModule,
    ChaptersModule,
    LearningModule,
    TutorModule,
    QuizzesModule,
    QuestionsModule,
    ProgressModule,
    RecommendationsModule,
    AiModule,
    RagModule,
    FilesModule,
    SubscriptionsModule,
    UsageModule,
    AdminModule,
  ],
  providers: [
    // Order matters: the throttler runs first, then authentication, then roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
