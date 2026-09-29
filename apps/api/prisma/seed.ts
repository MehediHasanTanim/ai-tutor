/**
 * Baseline seed — idempotent, safe to re-run.
 *
 * Weeks 1–2 scope: the NCTB curriculum row and the six Science subjects for
 * Class 9 and 10, which is the minimum needed for academic setup to work, plus
 * a development admin and student account.
 *
 * The full chapter/topic tree is Weeks 3–4 work (doc 07) and is deliberately
 * not invented here — placeholder chapters would make the RAG milestone look
 * satisfied when it is not.
 */
import '../src/load-env';

import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

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
      await prisma.studentProfile.upsert({
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
    }

    console.log(`  ${account.role.toLowerCase()}: ${account.phone}`);
  }
}

async function main() {
  console.log('Seeding...');
  const curriculum = await seedCurriculum();
  await seedDevAccounts(curriculum.id);
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
