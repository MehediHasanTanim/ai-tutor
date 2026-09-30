/**
 * Baseline seed — idempotent, safe to re-run.
 *
 * Weeks 1–2 scope: the NCTB curriculum row and the six Science subjects for
 * Class 9 and 10, which is the minimum needed for academic setup to work, plus
 * a development admin and student account.
 *
 * Weeks 3–4 adds the chapter and topic tree for all six subjects, seeded
 * against both class levels (the NCTB Science syllabus is combined for
 * Class 9–10). The tree lives in `curriculum-tree.ts`; it still needs
 * subject-matter review before being treated as authoritative.
 */
import '../src/load-env';

import { Difficulty, PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { CURRICULUM_TREE } from './curriculum-tree';

const prisma = new PrismaClient();

/** Development-only credentials. Never seeded outside local/staging. */
const DEV_ACCOUNTS = [
  {
    name: 'Dev Admin',
    phone: '+8801700000001',
    email: 'admin@aitutor.local',
    password: 'DevAdmin!2026',
    role: UserRole.ADMIN,
  },
  {
    name: 'Dev Student',
    phone: '+8801700000002',
    email: 'student@aitutor.local',
    password: 'DevStudent!2026',
    role: UserRole.STUDENT,
  },
];

const SUBJECTS = [
  { code: 'math', name: 'Mathematics', nameBn: 'গণিত' },
  { code: 'physics', name: 'Physics', nameBn: 'পদার্থবিজ্ঞান' },
  { code: 'chemistry', name: 'Chemistry', nameBn: 'রসায়ন' },
  { code: 'biology', name: 'Biology', nameBn: 'জীববিজ্ঞান' },
  { code: 'ict', name: 'ICT', nameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি' },
  { code: 'english', name: 'English', nameBn: 'ইংরেজি' },
];

const CLASS_LEVELS = [9, 10];

async function seedCurriculum() {
  const curriculum = await prisma.curriculum.upsert({
    where: { code: 'nctb' },
    update: { name: 'NCTB National Curriculum', nameBn: 'এনসিটিবি জাতীয় শিক্ষাক্রম' },
    create: {
      code: 'nctb',
      name: 'NCTB National Curriculum',
      nameBn: 'এনসিটিবি জাতীয় শিক্ষাক্রম',
    },
  });

  let count = 0;
  for (const classLevel of CLASS_LEVELS) {
    for (const [index, subject] of SUBJECTS.entries()) {
      await prisma.subject.upsert({
        where: {
          curriculumId_classLevel_code: {
            curriculumId: curriculum.id,
            classLevel,
            code: subject.code,
          },
        },
        update: { name: subject.name, nameBn: subject.nameBn, sortOrder: index },
        create: {
          curriculumId: curriculum.id,
          classLevel,
          code: subject.code,
          name: subject.name,
          nameBn: subject.nameBn,
          sortOrder: index,
        },
      });
      count += 1;
    }
  }

  console.log(`  curriculum: nctb, subjects: ${count}`);
  return curriculum;
}

/**
 * Seeds chapters and topics for every subject.
 *
 * Idempotent by (subject, chapterNumber) and (chapter, title): re-running
 * updates titles rather than appending a second copy of the syllabus.
 */
async function seedCurriculumTree(curriculumId: string) {
  let chapters = 0;
  let topics = 0;

  for (const classLevel of CLASS_LEVELS) {
    for (const [subjectCode, chapterSeeds] of Object.entries(CURRICULUM_TREE)) {
      const subject = await prisma.subject.findUnique({
        where: {
          curriculumId_classLevel_code: { curriculumId, classLevel, code: subjectCode },
        },
      });
      if (!subject) continue;

      for (const chapterSeed of chapterSeeds) {
        const chapter = await prisma.chapter.upsert({
          where: {
            subjectId_chapterNumber: {
              subjectId: subject.id,
              chapterNumber: chapterSeed.number,
            },
          },
          update: { title: chapterSeed.title, titleBn: chapterSeed.titleBn },
          create: {
            subjectId: subject.id,
            chapterNumber: chapterSeed.number,
            title: chapterSeed.title,
            titleBn: chapterSeed.titleBn,
          },
        });
        chapters += 1;

        for (const [index, topicSeed] of chapterSeed.topics.entries()) {
          // Topic has no natural unique key, so find-then-write rather than
          // upsert. Matching on title keeps re-runs from duplicating.
          const existing = await prisma.topic.findFirst({
            where: { chapterId: chapter.id, title: topicSeed.title },
          });

          const data = {
            titleBn: topicSeed.titleBn,
            difficulty: (topicSeed.difficulty ?? 'MEDIUM') as Difficulty,
            sortOrder: index,
          };

          if (existing) {
            await prisma.topic.update({ where: { id: existing.id }, data });
          } else {
            await prisma.topic.create({
              data: { chapterId: chapter.id, title: topicSeed.title, ...data },
            });
          }
          topics += 1;
        }
      }
    }
  }

  console.log(`  chapters: ${chapters}, topics: ${topics}`);
}

async function seedDevAccounts(curriculumId: string) {
  if (process.env.NODE_ENV === 'production') {
    console.log('  dev accounts: skipped (NODE_ENV=production)');
    return;
  }

  for (const account of DEV_ACCOUNTS) {
    const passwordHash = await argon2.hash(account.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const user = await prisma.user.upsert({
      where: { phone: account.phone },
      update: { name: account.name, email: account.email, role: account.role },
      create: {
        name: account.name,
        phone: account.phone,
        email: account.email,
        passwordHash,
        role: account.role,
      },
    });

    if (account.role === UserRole.STUDENT) {
      const profile = await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          classLevel: 10,
          curriculumId,
          medium: 'BANGLA',
          targetExam: 'SSC',
          dailyGoalMinutes: 45,
        },
      });

      // Every profile gets a FREE subscription, matching what the students
      // module does on first setup. Quota enforcement assumes the row exists
      // and should never have to special-case its absence.
      const hasSubscription = await prisma.subscription.count({
        where: { studentId: profile.id },
      });
      if (hasSubscription === 0) {
        await prisma.subscription.create({ data: { studentId: profile.id } });
      }
    }

    console.log(`  ${account.role.toLowerCase()}: ${account.phone}`);
  }
}

async function main() {
  console.log('Seeding...');
  const curriculum = await seedCurriculum();
  await seedCurriculumTree(curriculum.id);
  await seedDevAccounts(curriculum.id);
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
