import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Medium } from '@prisma/client';

/**
 * `PATCH /api/v1/me`.
 *
 * Serves both first-time academic setup and later edits. One endpoint because
 * the mobile app genuinely does both from the same screen, and two would
 * drift.
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Rafi Hasan' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 10, description: 'MVP supports 9 and 10 only (D-02).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([9, 10], { message: 'class_level must be 9 or 10' })
  class_level?: number;

  @ApiPropertyOptional({ example: 'nctb' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  curriculum_code?: string;

  @ApiPropertyOptional({ enum: Medium })
  @IsOptional()
  @IsEnum(Medium)
  medium?: Medium;

  @ApiPropertyOptional({ example: 'SSC', nullable: true })
  @IsOptional()
  // Explicit null clears the target exam; undefined leaves it alone. Without
  // this the two are indistinguishable and a student can never unset it.
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(60)
  target_exam?: string | null;

  @ApiPropertyOptional({ example: 45, minimum: 15, maximum: 240 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  daily_goal_minutes?: number;

  @ApiPropertyOptional({ enum: ['bn', 'en', 'banglish'] })
  @IsOptional()
  @IsIn(['bn', 'en', 'banglish'])
  preferred_language?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Replaces the entire selection. Send the full list, not a delta — a ' +
      'student dropping a subject has to be expressible.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  subject_ids?: string[];
}
