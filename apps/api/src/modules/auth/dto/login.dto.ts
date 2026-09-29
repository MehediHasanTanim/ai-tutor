import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength } from 'class-validator';
import { normalizeBdPhone } from './register.dto';

export class LoginDto {
  @ApiProperty({
    example: '+8801712345678',
    description: 'Phone number or email address.',
  })
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => normalizeIdentifier(value))
  identifier: string;

  @ApiProperty({ example: 'correct-horse-battery' })
  @IsString()
  @Length(1, 128)
  password: string;
}

/** Phone inputs are normalized to E.164; anything else is treated as an email. */
function normalizeIdentifier(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return normalizeBdPhone(trimmed);
}
