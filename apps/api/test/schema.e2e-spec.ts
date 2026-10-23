import type { INestApplication } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { apiRoot, TEST_ENV } from './env.js';
import { createTestApp } from './helpers.js';

const CURRENCY_CODES = ['EUR', 'USDC', 'USDT'];
const PREFIX = 'e2e-schema';

function runSeed(extraEnv: Record<string, string> = {}) {
  execFileSync(`${apiRoot}node_modules/.bin/tsx`, ['prisma/seed.ts'], {
    cwd: apiRoot,
    env: { ...process.env, ...TEST_ENV, ...extraEnv },
    stdio: 'pipe',
  });
}

describe('students schema and seed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.student.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  });

  afterAll(async () => {
    await app.close();
  });

  const seededTeacher = () =>
    prisma.teacher.findFirstOrThrow({ where: { user: { email: TEST_ENV.TEACHER_EMAIL } } });

  it('seed creates the five active currencies with two decimals', async () => {
    const currencies = await prisma.currency.findMany({ orderBy: { code: 'asc' } });
    expect(currencies.map((c) => c.code)).toEqual(CURRENCY_CODES);
    expect(currencies.every((c) => c.isActive && c.decimals === 2)).toBe(true);
  });

  it('seed creates the teacher user with the teacher role, a working password and a Teacher record', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_ENV.TEACHER_EMAIL },
      include: { role: true },
    });
    expect(user.role.name).toBe('teacher');
    expect(await argon2.verify(user.passwordHash, TEST_ENV.TEACHER_PASSWORD)).toBe(true);

    const teacher = await seededTeacher();
    expect(teacher.userId).toBe(user.id);
    expect(teacher.fullName).toBe(TEST_ENV.TEACHER_NAME);
  });

  it('a second seed run creates no duplicates and keeps the teacher password', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { email: TEST_ENV.TEACHER_EMAIL } });

    runSeed({ TEACHER_PASSWORD: 'another-password-after-first-run' });

    expect(await prisma.currency.count()).toBe(CURRENCY_CODES.length);
    expect(await prisma.teacher.count({ where: { user: { email: TEST_ENV.TEACHER_EMAIL } } })).toBe(1);
    const after = await prisma.user.findUniqueOrThrow({ where: { email: TEST_ENV.TEACHER_EMAIL } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('seed skips the teacher when TEACHER_* are not set', async () => {
    const teachers = await prisma.teacher.count();
    const users = await prisma.user.count();

    runSeed({ TEACHER_EMAIL: '', TEACHER_PASSWORD: '', TEACHER_NAME: '' });

    expect(await prisma.teacher.count()).toBe(teachers);
    expect(await prisma.user.count()).toBe(users);
  });

  it('a student is created with only a name; the optional fields are empty and it is active', async () => {
    const student = await prisma.student.create({ data: { fullName: `${PREFIX} minimal` } });
    expect(student).toMatchObject({
      telegramUsername: null,
      telegramChatId: null,
      englishLevel: null,
      comment: null,
      defaultCurrencyCode: null,
      lessonPrice: null,
      userId: null,
      isActive: true,
    });
  });

  it('a student cannot reference a currency that does not exist', async () => {
    await expect(
      prisma.student.create({
        data: { fullName: `${PREFIX} bad currency`, defaultCurrencyCode: 'XXX' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('a currency used by a student cannot be deleted', async () => {
    await prisma.student.create({
      data: { fullName: `${PREFIX} currency in use`, defaultCurrencyCode: 'EUR' },
    });
    await expect(prisma.currency.delete({ where: { code: 'EUR' } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('the same student-teacher pair cannot be linked twice, but a student can have two teachers', async () => {
    const teacher = await seededTeacher();
    const student = await prisma.student.create({ data: { fullName: `${PREFIX} pair` } });
    await prisma.studentTeacher.create({
      data: { studentId: student.id, teacherId: teacher.id },
    });
    await expect(
      prisma.studentTeacher.create({ data: { studentId: student.id, teacherId: teacher.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const other = await prisma.user.create({
      data: {
        email: `${PREFIX}-second-teacher@e2e.test`,
        passwordHash: 'x',
        roleId: (await prisma.role.findUniqueOrThrow({ where: { name: 'teacher' } })).id,
        teacher: { create: { fullName: `${PREFIX} second teacher` } },
      },
      include: { teacher: true },
    });
    await prisma.studentTeacher.create({
      data: { studentId: student.id, teacherId: other.teacher!.id },
    });
    expect(await prisma.studentTeacher.count({ where: { studentId: student.id } })).toBe(2);

    await prisma.student.delete({ where: { id: student.id } });
    await prisma.user.delete({ where: { id: other.id } });
  });

  it('deleting a student removes its teacher links and keeps the teacher', async () => {
    const teacher = await seededTeacher();
    const student = await prisma.student.create({ data: { fullName: `${PREFIX} cascade` } });
    await prisma.studentTeacher.create({
      data: { studentId: student.id, teacherId: teacher.id },
    });

    await prisma.student.delete({ where: { id: student.id } });

    expect(await prisma.studentTeacher.count({ where: { studentId: student.id } })).toBe(0);
    expect(await prisma.teacher.findUnique({ where: { id: teacher.id } })).not.toBeNull();
  });

  it('telegramChatId is unique, while many students may have it empty', async () => {
    await prisma.student.create({ data: { fullName: `${PREFIX} tg a`, telegramChatId: 777000111n } });
    await expect(
      prisma.student.create({ data: { fullName: `${PREFIX} tg b`, telegramChatId: 777000111n } }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.student.create({ data: { fullName: `${PREFIX} empty a` } });
    await prisma.student.create({ data: { fullName: `${PREFIX} empty b` } });
  });

  it('one user cannot have two Teacher records', async () => {
    const teacher = await seededTeacher();
    await expect(
      prisma.teacher.create({ data: { userId: teacher.userId, fullName: `${PREFIX} duplicate` } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
