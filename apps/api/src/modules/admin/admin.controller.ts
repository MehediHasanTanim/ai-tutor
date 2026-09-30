import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { DocumentStatus } from '@prisma/client';
import { UserRole } from '@ai-tutor/shared-types';
import type {
  KnowledgeBaseStatus,
  KnowledgeChunkDetail,
  KnowledgeDocumentSummary,
  UploadDocumentResponse,
} from '@ai-tutor/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { DOCUMENT_LIMITS } from '../files/file-validation';
import { AdminService } from './admin.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

class DocumentListQueryDto {
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsUUID('4')
  subject_id?: string;
}

class ChunkQueryDto {
  @IsOptional()
  @IsUUID('4')
  document_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

/**
 * Admin endpoints — doc 04 "Admin".
 *
 * `@Roles(ADMIN)` on the class, so every route here is admin-only by default
 * and a new endpoint cannot be added without RBAC by forgetting a decorator.
 */
@ApiTags('admin')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('documents')
  @UseInterceptors(
    FileInterceptor('file', {
      // Multer's own ceiling, so an oversized upload is rejected while
      // streaming rather than after the whole file is buffered in memory.
      limits: { fileSize: DOCUMENT_LIMITS.maxBytes },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a document and queue it for ingestion',
    description:
      'Deduplicates on content hash: uploading identical bytes returns the ' +
      'existing document with `deduplicated: true`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'document_type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        document_type: { type: 'string', enum: Object.values(DocumentStatus) },
        subject_id: { type: 'string' },
        chapter_id: { type: 'string' },
        source: { type: 'string' },
      },
    },
  })
  uploadDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
  ): Promise<UploadDocumentResponse> {
    return this.admin.uploadDocument(file, dto);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List uploaded documents and their processing state' })
  listDocuments(@Query() query: DocumentListQueryDto): Promise<KnowledgeDocumentSummary[]> {
    return this.admin.listDocuments({ status: query.status, subjectId: query.subject_id });
  }

  @Post('documents/:id/process')
  @ApiOperation({
    summary: 'Re-run ingestion for a document',
    description: 'Existing chunks are replaced, not appended to.',
  })
  reprocess(@Param('id', ParseUUIDPipe) id: string): Promise<KnowledgeDocumentSummary> {
    return this.admin.reprocessDocument(id);
  }

  @Get('knowledge-base/status')
  @ApiOperation({ summary: 'Corpus and queue health' })
  status(): Promise<KnowledgeBaseStatus> {
    return this.admin.knowledgeBaseStatus();
  }

  @Get('knowledge-base/chunks')
  @ApiOperation({
    summary: 'Chunk inspector',
    description:
      'Search chunk text to find which passage produced a given answer — or ' + 'that none did.',
  })
  chunks(@Query() query: ChunkQueryDto): Promise<KnowledgeChunkDetail[]> {
    return this.admin.inspectChunks({
      documentId: query.document_id,
      search: query.search,
      limit: query.limit ?? 50,
    });
  }
}
