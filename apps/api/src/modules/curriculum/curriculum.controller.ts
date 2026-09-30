import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type {
  ChapterDetail,
  ChapterSummary,
  CurriculumSummary,
  SubjectDetail,
  SubjectSummary,
  TopicSummary,
} from '@ai-tutor/shared-types';
import { CurriculumService } from './curriculum.service';

class SubjectListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  class_level?: number;

  @IsOptional()
  @IsString()
  curriculum?: string;
}

/**
 * Curriculum read endpoints — doc 04.
 *
 * Three controllers would match architecture §3's module list more literally,
 * but these six routes are one cohesive read surface over one service. Split
 * them when they stop being that.
 *
 * Authenticated, not public: the tree is scoped to what a student is studying,
 * and anonymous scraping of the curriculum has no product purpose.
 */
@ApiTags('curriculum')
@Controller()
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('curriculum')
  @ApiOperation({ summary: 'List active curricula and the classes they cover' })
  listCurricula(): Promise<CurriculumSummary[]> {
    return this.curriculum.listCurricula();
  }

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects, optionally filtered by class and curriculum' })
  @ApiQuery({ name: 'class_level', required: false, example: 10 })
  @ApiQuery({ name: 'curriculum', required: false, example: 'nctb' })
  listSubjects(@Query() query: SubjectListQueryDto): Promise<SubjectSummary[]> {
    return this.curriculum.listSubjects({
      classLevel: query.class_level,
      curriculumCode: query.curriculum,
    });
  }

  @Get('subjects/:id')
  @ApiOperation({ summary: 'One subject with its chapters' })
  getSubject(@Param('id', ParseUUIDPipe) id: string): Promise<SubjectDetail> {
    return this.curriculum.getSubject(id);
  }

  @Get('subjects/:id/chapters')
  @ApiOperation({ summary: 'Chapters of a subject' })
  listChapters(@Param('id', ParseUUIDPipe) id: string): Promise<ChapterSummary[]> {
    return this.curriculum.listChapters(id);
  }

  @Get('chapters/:id')
  @ApiOperation({ summary: 'One chapter with its topics' })
  getChapter(@Param('id', ParseUUIDPipe) id: string): Promise<ChapterDetail> {
    return this.curriculum.getChapter(id);
  }

  @Get('chapters/:id/topics')
  @ApiOperation({ summary: 'Topics of a chapter' })
  listTopics(@Param('id', ParseUUIDPipe) id: string): Promise<TopicSummary[]> {
    return this.curriculum.listTopics(id);
  }
}
