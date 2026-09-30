import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { DocumentType } from '@prisma/client';

/**
 * Multipart fields alongside the file.
 *
 * Everything arrives as a string in multipart, so numeric and enum fields
 * need explicit handling — the JSON body assumptions elsewhere do not hold.
 */
export class UploadDocumentDto {
  @ApiProperty({ example: 'NCTB Physics Class 10 — Chapter 3: Force' })
  @IsString()
  @Length(2, 255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  document_type: DocumentType;

  @ApiPropertyOptional({ description: 'Scopes retrieval. Strongly recommended.' })
  @IsOptional()
  @IsUUID('4')
  subject_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  chapter_id?: string;

  @ApiPropertyOptional({ example: 'NCTB 2024 edition' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;
}
