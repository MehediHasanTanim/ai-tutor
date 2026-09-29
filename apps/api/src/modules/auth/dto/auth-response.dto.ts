import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Prisma, User } from '@prisma/client';
import type { AuthResponse, PublicUser, StudentProfileSummary } from '@ai-tutor/shared-types';
import type { IssuedTokens } from '../token.types';

/** Swagger-visible shapes. The wire contract lives in @ai-tutor/shared-types. */
export class AuthTokensDto {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
  @ApiProperty({ description: 'Access token lifetime in seconds.' }) expires_in: number;
  @ApiProperty({ enum: ['Bearer'] }) token_type: 'Bearer';
}

export class PublicUserDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() phone: string;
  @ApiProperty({ nullable: true, type: String }) email: string | null;
  @ApiProperty({ enum: ['STUDENT', 'ADMIN'] }) role: string;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] }) status: string;
  @ApiProperty() created_at: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: PublicUserDto }) user: PublicUserDto;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Null until the student completes academic setup.',
  })
  profile: StudentProfileSummary | null;
  @ApiProperty({ type: AuthTokensDto }) tokens: AuthTokensDto;
}

type ProfileRow = Prisma.StudentProfileGetPayload<{ include: { curriculum: true } }>;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.createdAt.toISOString(),
  };
}

export function toProfileSummary(profile: ProfileRow | null): StudentProfileSummary | null {
  if (!profile) return null;

  return {
    id: profile.id,
    class_level: profile.classLevel,
    curriculum: profile.curriculum.code,
    medium: profile.medium,
    target_exam: profile.targetExam,
    daily_goal_minutes: profile.dailyGoalMinutes,
  };
}

export function toAuthResponse(
  user: User,
  profile: ProfileRow | null,
  tokens: IssuedTokens,
): AuthResponse {
  return {
    user: toPublicUser(user),
    profile: toProfileSummary(profile),
    tokens: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresInSeconds,
      token_type: 'Bearer',
    },
  };
}
