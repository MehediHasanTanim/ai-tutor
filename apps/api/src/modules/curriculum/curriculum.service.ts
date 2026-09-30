import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ai-tutor/shared-types';
import type {
  ChapterDetail,
  ChapterSummary,
  CurriculumSummary,
  SubjectDetail,
  SubjectSummary,
  TopicSummary,
} from '@ai-tutor/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Read access to the curriculum tree — doc 04 "Curriculum".
 *
 * One service for the whole tree rather than one per level. Curriculum,
 * subjects, chapters and topics are only ever read together, and splitting
 * them would mean four services passing ids to each other to answer a single
 * screen.
 *
 * Everything here is read-heavy and near-static, which is why doc 05 §10 has
 * the app cache it. Admin writes live in `admin.service.ts`.
 */
@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  async listCurricula(): Promise<CurriculumSummary[]> {
    const curricula = await this.prisma.curriculum.findMany({
      where: { isActive: true },
      include: {
        subjects: { where: { isActive: true }, select: { classLevel: true } },
      },
      orderBy: { code: 'asc' },
    });

    return curricula.map((curriculum) => ({
      id: curriculum.id,
      code: curriculum.code,
      name: curriculum.name,
      name_bn: curriculum.nameBn,
      class_levels: [...new Set(curriculum.subjects.map((s) => s.classLevel))].sort(
        (a, b) => a - b,
      ),
    }));
  }

  async listSubjects(filters: {
    classLevel?: number;
    curriculumCode?: string;
  }): Promise<SubjectSummary[]> {
    const subjects = await this.prisma.subject.findMany({
      where: {
        isActive: true,
        ...(filters.classLevel ? { classLevel: filters.classLevel } : {}),
        ...(filters.curriculumCode ? { curriculum: { code: filters.curriculumCode } } : {}),
      },
      include: { _count: { select: { chapters: { where: { isActive: true } } } } },
      orderBy: [{ classLevel: 'asc' }, { sortOrder: 'asc' }],
    });

    return subjects.map(toSubjectSummary);
  }

  async getSubject(id: string): Promise<SubjectDetail> {
    const subject = await this.prisma.subject.findFirst({
      where: { id, isActive: true },
      include: {
        curriculum: true,
        _count: { select: { chapters: { where: { isActive: true } } } },
        chapters: {
          where: { isActive: true },
          orderBy: { chapterNumber: 'asc' },
          include: { _count: { select: { topics: { where: { isActive: true } } } } },
        },
      },
    });

    if (!subject) throw new AppException(ErrorCode.NOT_FOUND, { message: 'Subject not found' });

    return {
      ...toSubjectSummary(subject),
      curriculum: {
        id: subject.curriculum.id,
        code: subject.curriculum.code,
        name: subject.curriculum.name,
      },
      chapters: subject.chapters.map(toChapterSummary),
    };
  }

  async listChapters(subjectId: string): Promise<ChapterSummary[]> {
    // Checked separately so an unknown subject is a 404 rather than an empty
    // list — the app renders those very differently.
    await this.assertSubjectExists(subjectId);

    const chapters = await this.prisma.chapter.findMany({
      where: { subjectId, isActive: true },
      include: { _count: { select: { topics: { where: { isActive: true } } } } },
      orderBy: { chapterNumber: 'asc' },
    });

    return chapters.map(toChapterSummary);
  }

  async getChapter(id: string): Promise<ChapterDetail> {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id, isActive: true },
      include: {
        subject: true,
        _count: { select: { topics: { where: { isActive: true } } } },
        topics: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!chapter) throw new AppException(ErrorCode.NOT_FOUND, { message: 'Chapter not found' });

    return {
      ...toChapterSummary(chapter),
      description: chapter.description,
      description_bn: chapter.descriptionBn,
      subject: {
        id: chapter.subject.id,
        code: chapter.subject.code,
        name: chapter.subject.name,
        name_bn: chapter.subject.nameBn,
        class_level: chapter.subject.classLevel,
      },
      topics: chapter.topics.map(toTopicSummary),
    };
  }

  async listTopics(chapterId: string): Promise<TopicSummary[]> {
    const exists = await this.prisma.chapter.count({ where: { id: chapterId, isActive: true } });
    if (exists === 0) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: 'Chapter not found' });
    }

    const topics = await this.prisma.topic.findMany({
      where: { chapterId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return topics.map(toTopicSummary);
  }

  private async assertSubjectExists(subjectId: string): Promise<void> {
    const exists = await this.prisma.subject.count({ where: { id: subjectId, isActive: true } });
    if (exists === 0) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: 'Subject not found' });
    }
  }
}

// ---------------------------------------------------------------------------
// Mappers. Exported so the admin module reuses them rather than diverging.
// ---------------------------------------------------------------------------

type SubjectRow = {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  classLevel: number;
  sortOrder: number;
  _count: { chapters: number };
};

export function toSubjectSummary(subject: SubjectRow): SubjectSummary {
  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    name_bn: subject.nameBn,
    class_level: subject.classLevel,
    sort_order: subject.sortOrder,
    chapter_count: subject._count.chapters,
  };
}

type ChapterRow = {
  id: string;
  subjectId: string;
  title: string;
  titleBn: string;
  chapterNumber: number;
  _count: { topics: number };
};

export function toChapterSummary(chapter: ChapterRow): ChapterSummary {
  return {
    id: chapter.id,
    subject_id: chapter.subjectId,
    title: chapter.title,
    title_bn: chapter.titleBn,
    chapter_number: chapter.chapterNumber,
    topic_count: chapter._count.topics,
  };
}

type TopicRow = {
  id: string;
  chapterId: string;
  title: string;
  titleBn: string;
  difficulty: string;
  sortOrder: number;
};

export function toTopicSummary(topic: TopicRow): TopicSummary {
  return {
    id: topic.id,
    chapter_id: topic.chapterId,
    title: topic.title,
    title_bn: topic.titleBn,
    difficulty: topic.difficulty as TopicSummary['difficulty'],
    sort_order: topic.sortOrder,
  };
}
