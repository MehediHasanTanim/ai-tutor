import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { ErrorCode } from '@ai-tutor/shared-types';
import type { MeResponse, StudentProfileDetail, SubscriptionSummary } from '@ai-tutor/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { toPublicUser } from '../auth/dto/auth-response.dto';
import { toSubjectSummary } from '../curriculum/curriculum.service';
import type { UpdateMeDto } from './dto/update-me.dto';

const PROFILE_INCLUDE = {
  curriculum: true,
  subjects: {
    include: {
      subject: { include: { _count: { select: { chapters: { where: { isActive: true } } } } } },
    },
  },
} satisfies Prisma.StudentProfileInclude;

type ProfileRow = Prisma.StudentProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: {
          include: {
            ...PROFILE_INCLUDE,
            subscriptions: {
              where: { status: SubscriptionStatus.ACTIVE },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) throw new AppException(ErrorCode.NOT_FOUND, { message: 'User not found' });

    const profile = user.studentProfile;

    return {
      user: toPublicUser(user),
      profile: profile ? toProfileDetail(profile) : null,
      subscription: profile?.subscriptions[0]
        ? toSubscriptionSummary(profile.subscriptions[0])
        : null,
    };
  }

  /**
   * Creates the profile on first call, updates it thereafter.
   *
   * Upsert rather than separate create/update because the client cannot know
   * which it is doing: academic setup and "edit my class" are the same screen,
   * and a create-then-409 dance would be a worse API for no benefit.
   */
  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeResponse> {
    const existing = await this.prisma.studentProfile.findUnique({ where: { userId } });

    const curriculumId = await this.resolveCurriculumId(
      dto.curriculum_code,
      existing?.curriculumId,
    );
    const classLevel = dto.class_level ?? existing?.classLevel;

    if (!existing && classLevel === undefined) {
      // The tutor cannot scope retrieval without a class, so a profile
      // without one would be worse than no profile at all.
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: 'class_level is required when creating a profile',
        details: { class_level: ['class_level is required on first setup'] },
      });
    }

    if (dto.subject_ids) {
      await this.assertSubjectsValid(dto.subject_ids, classLevel!, curriculumId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.user.update({ where: { id: userId }, data: { name: dto.name } });
      }

      const profile = await tx.studentProfile.upsert({
        where: { userId },
        create: {
          userId,
          classLevel: classLevel!,
          curriculumId,
          ...(dto.medium ? { medium: dto.medium } : {}),
          ...(dto.target_exam !== undefined ? { targetExam: dto.target_exam } : {}),
          ...(dto.daily_goal_minutes ? { dailyGoalMinutes: dto.daily_goal_minutes } : {}),
          ...(dto.preferred_language ? { preferredLanguage: dto.preferred_language } : {}),
        },
        update: {
          ...(dto.class_level !== undefined ? { classLevel: dto.class_level } : {}),
          ...(dto.curriculum_code !== undefined ? { curriculumId } : {}),
          ...(dto.medium !== undefined ? { medium: dto.medium } : {}),
          ...(dto.target_exam !== undefined ? { targetExam: dto.target_exam } : {}),
          ...(dto.daily_goal_minutes !== undefined
            ? { dailyGoalMinutes: dto.daily_goal_minutes }
            : {}),
          ...(dto.preferred_language !== undefined
            ? { preferredLanguage: dto.preferred_language }
            : {}),
        },
      });

      if (dto.subject_ids) {
        // Replace wholesale. Inside the transaction so a student is never
        // left with no subjects if the insert fails.
        await tx.studentSubject.deleteMany({ where: { studentId: profile.id } });
        if (dto.subject_ids.length > 0) {
          await tx.studentSubject.createMany({
            data: dto.subject_ids.map((subjectId) => ({ studentId: profile.id, subjectId })),
            skipDuplicates: true,
          });
        }
      }

      // A free subscription on first setup, so quota checks always find a
      // row and never have to special-case "no subscription".
      if (!existing) {
        await tx.subscription.create({ data: { studentId: profile.id } });
      }
    });

    this.logger.log(`Profile ${existing ? 'updated' : 'created'} for user ${userId}`);
    return this.getMe(userId);
  }

  private async resolveCurriculumId(code: string | undefined, fallback?: string): Promise<string> {
    if (!code) {
      if (fallback) return fallback;

      // D-02 fixes the MVP to NCTB, so defaulting is safe and saves the app
      // from sending a constant on every setup.
      const nctb = await this.prisma.curriculum.findUnique({ where: { code: 'nctb' } });
      if (!nctb) {
        throw new AppException(ErrorCode.INTERNAL_ERROR, {
          message: 'Default curriculum "nctb" is missing — run the seed',
        });
      }
      return nctb.id;
    }

    const curriculum = await this.prisma.curriculum.findUnique({ where: { code } });
    if (!curriculum) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: `Unknown curriculum "${code}"`,
        details: { curriculum_code: [`Unknown curriculum "${code}"`] },
      });
    }
    return curriculum.id;
  }

  /**
   * Rejects subjects that are not this student's.
   *
   * Without this a Class 9 student could select Class 10 chemistry, and every
   * downstream retrieval filter would then be scoped to content they were
   * never taught — the exact cross-class leak doc 07 Weeks 3–4 tests for.
   */
  private async assertSubjectsValid(
    subjectIds: string[],
    classLevel: number,
    curriculumId: string,
  ): Promise<void> {
    const unique = [...new Set(subjectIds)];

    const valid = await this.prisma.subject.findMany({
      where: { id: { in: unique }, classLevel, curriculumId, isActive: true },
      select: { id: true },
    });

    if (valid.length === unique.length) return;

    const validIds = new Set(valid.map((subject) => subject.id));
    const rejected = unique.filter((id) => !validIds.has(id));

    throw new AppException(ErrorCode.VALIDATION_ERROR, {
      message: 'One or more subjects are not available for this class and curriculum',
      details: {
        subject_ids: rejected.map((id) => `${id} is not an active subject for class ${classLevel}`),
      },
    });
  }
}

function toProfileDetail(profile: ProfileRow): StudentProfileDetail {
  return {
    id: profile.id,
    class_level: profile.classLevel,
    curriculum: {
      id: profile.curriculum.id,
      code: profile.curriculum.code,
      name: profile.curriculum.name,
      name_bn: profile.curriculum.nameBn,
    },
    medium: profile.medium,
    target_exam: profile.targetExam,
    daily_goal_minutes: profile.dailyGoalMinutes,
    preferred_language: profile.preferredLanguage,
    subjects: profile.subjects
      .map((link) => toSubjectSummary(link.subject))
      .sort((a, b) => a.sort_order - b.sort_order),
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString(),
  };
}

function toSubscriptionSummary(subscription: {
  plan: string;
  status: string;
  expiresAt: Date | null;
}): SubscriptionSummary {
  return {
    plan: subscription.plan as SubscriptionSummary['plan'],
    status: subscription.status as SubscriptionSummary['status'],
    expires_at: subscription.expiresAt?.toISOString() ?? null,
  };
}
