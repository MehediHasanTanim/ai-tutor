import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Bangladeshi mobile numbers in E.164: +880 followed by 1, then 9 digits.
 * Operator prefixes in use are 013–019.
 */
const BD_PHONE = /^\+8801[3-9]\d{8}$/;

export class RegisterDto {
  @ApiProperty({ example: 'Tanim Ahmed', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({
    example: '+8801712345678',
    description: 'Primary identifier. Bangladeshi mobile number in E.164 format.',
  })
  @IsString()
  @Matches(BD_PHONE, {
    message: 'phone must be a Bangladeshi mobile number in E.164 format, e.g. +8801712345678',
  })
  @Transform(({ value }) => normalizeBdPhone(value))
  phone: string;

  @ApiPropertyOptional({ example: 'student@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim().toLowerCase() : undefined,
  )
  email?: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'correct-horse-battery' })
  @IsString()
  @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
  password: string;
}

/**
 * Accepts the forms students actually type — 01712345678, 8801712345678,
 * 01712-345678 — and normalizes to E.164 before validation runs.
 */
export function normalizeBdPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const digits = value.replace(/[\s()-]/g, '');

  if (/^01[3-9]\d{8}$/.test(digits)) return `+880${digits.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return `+${digits}`;
  return digits;
}
