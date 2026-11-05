import type { INestApplication } from '@nestjs/common';
import { execFileSync, spawnSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import request from 'supertest';
import { vi } from 'vitest';
import { seedDemo } from '../prisma/demo-seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { LessonSeriesService } from '../src/lesson-series/lesson-series.service.js';
import { addDays, localDate } from '../src/lesson-series/series-slots.js';
import { BASE_TIME_ZONE } from '../src/common/base-time-zone.js';
import { apiRoot } from './env.js';
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers.js';

// Runs before the imports above, so the app under test connects to its own database.
const DEMO_DB_URL = vi.hoisted(() => {
  const url = new URL(process.env.DATABASE_URL as string);
  url.pathname = `${url.pathname}_demo`;
  process.env.DATABASE_URL = url.toString();
  return url.toString();
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function recreateDatabase() {
  const url = new URL(DEMO_DB_URL);
  const name = url.pathname.slice(1);
  url.pathname = '/postgres';
  url.search = '';
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}

describe('demo seed', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  const now = new Date();

  const balances = async () => {
    const rows = await prisma.ledgerEntry.groupBy({ by: ['studentId'], _sum: { delta: true } });
    return rows.map((r) => r._sum.delta ?? 0);
  };

  beforeAll(async () => {
    await recreateDatabase();
    const opts = { cwd: apiRoot, env: process.env, stdio: 'inherit' as const };
    execFileSync(`${apiRoot}node_modules/.bin/prisma`, ['migrate', 'deploy'], opts);
    execFileSync(`${apiRoot}node_modules/.bin/tsx`, ['prisma/seed.ts'], opts);

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DEMO_DB_URL }) });
    await seedDemo(prisma, now);
    app = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  describe('students', () => {
    it('covers low, negative and healthy balances', async () => {
      const { lowBalanceThreshold } = await prisma.schoolSettings.findUniqueOrThrow({ where: { id: 1 } });
      const values = await balances();
      expect(values.some((b) => b > lowBalanceThreshold)).toBe(true);
      expect(values.some((b) => b > 0 && b <= lowBalanceThreshold)).toBe(true);
      expect(values.some((b) => b < 0)).toBe(true);
    });

    it('has an inactive student and a student frozen today', async () => {
      expect(await prisma.student.count({ where: { isActive: false } })).toBeGreaterThan(0);
      const today = new Date(localDate(now, BASE_TIME_ZONE));
      expect(
        await prisma.absence.count({
          where: { kind: 'STUDENT_FREEZE', startsOn: { lte: today }, endsOn: { gte: today } },
        }),
      ).toBeGreaterThan(0);
    });

    it('links every student to the demo teacher', async () => {
      const students = await prisma.student.findMany({ include: { teachers: true } });
      expect(students.length).toBeGreaterThanOrEqual(8);
      for (const s of students) expect(s.teachers).toHaveLength(1);
    });
  });

  describe('ledger consistency', () => {
    it('gives every payment a purchase entry for the granted lessons', async () => {
      const payments = await prisma.payment.findMany({ include: { ledgerEntry: true } });
      expect(new Set(payments.map((p) => p.currencyCode)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(payments.map((p) => p.methodCode)).size).toBeGreaterThanOrEqual(2);
      for (const p of payments) {
        expect(p.ledgerEntry?.type).toBe('PURCHASE');
        expect(p.ledgerEntry?.delta).toBe(p.lessonsGranted);
        expect(p.ledgerEntry?.studentId).toBe(p.studentId);
      }
    });

    it('charges a lesson exactly when it is marked as charged', async () => {
      const lessons = await prisma.lesson.findMany({ include: { ledgerEntries: true } });
      for (const lesson of lessons) {
        const sum = lesson.ledgerEntries.reduce((acc, e) => acc + e.delta, 0);
        expect(sum).toBe(lesson.charged ? -1 : 0);
      }
    });

    it('includes a manual adjustment', async () => {
      expect(await prisma.ledgerEntry.count({ where: { type: 'MANUAL_ADJUSTMENT' } })).toBeGreaterThan(0);
    });
  });

  describe('lessons relative to now', () => {
    it('leaves no finished lesson scheduled', async () => {
      const scheduled = await prisma.lesson.findMany({ where: { status: 'SCHEDULED' } });
      for (const l of scheduled) {
        expect(l.startsAt.getTime() + l.durationMin * 60_000).toBeGreaterThan(now.getTime());
      }
    });

    it('has six weeks of history with every outcome', async () => {
      const past = await prisma.lesson.findMany({ where: { startsAt: { lt: now } } });
      const oldest = Math.min(...past.map((l) => l.startsAt.getTime()));
      expect(now.getTime() - oldest).toBeGreaterThanOrEqual(35 * DAY_MS);
      const kinds = new Set(past.map((l) => `${l.status}:${l.charged}`));
      expect(kinds).toContain('COMPLETED:true');
      expect(kinds).toContain('CANCELLED:true');
      expect(kinds).toContain('CANCELLED:false');
      expect([...kinds].some((k) => k.startsWith('NO_SHOW'))).toBe(true);
    });

    it('fills the schedule ahead, with series and one-off lessons', async () => {
      const future = await prisma.lesson.findMany({ where: { status: 'SCHEDULED', startsAt: { gt: now } } });
      const latest = Math.max(...future.map((l) => l.startsAt.getTime()));
      expect(latest - now.getTime()).toBeGreaterThanOrEqual(21 * DAY_MS);
      expect(future.some((l) => l.seriesId)).toBe(true);
      expect(future.some((l) => !l.seriesId)).toBe(true);
    });

    it('keeps absences free of scheduled lessons', async () => {
      const absences = await prisma.absence.findMany();
      expect(absences.some((a) => a.kind === 'TEACHER_VACATION')).toBe(true);
      for (const a of absences) {
        const inside = await prisma.lesson.findMany({
          where: {
            status: 'SCHEDULED',
            ...(a.teacherId ? { teacherId: a.teacherId } : { participants: { some: { studentId: a.studentId as string } } }),
          },
        });
        for (const l of inside) {
          const day = localDate(l.startsAt, BASE_TIME_ZONE);
          const from = a.startsOn.toISOString().slice(0, 10);
          const to = a.endsOn.toISOString().slice(0, 10);
          expect(day < from || day > to).toBe(true);
        }
      }
    });

    it('marks series as generated, so the generator adds no duplicates', async () => {
      const until = addDays(localDate(now, BASE_TIME_ZONE), 28);
      const series = await prisma.lessonSeries.findMany();
      expect(series.length).toBeGreaterThan(0);
      for (const s of series) expect(s.generatedUntil?.toISOString().slice(0, 10)).toBe(until);

      const before = await prisma.lesson.count();
      await app.get(LessonSeriesService).generateAll(now);
      expect(await prisma.lesson.count()).toBe(before);
    });
  });

  describe('demo account', () => {
    let cookie: string;

    beforeAll(async () => {
      cookie = await loginAs(app, process.env.TEACHER_EMAIL as string, process.env.TEACHER_PASSWORD);
    });

    it('sees the demo students', async () => {
      await request(app.getHttpServer()).get('/students').set('Cookie', cookie).expect(200);
    });

    it('cannot change school settings', async () => {
      await request(app.getHttpServer())
        .patch('/settings/school')
        .set('Cookie', cookie)
        .set('Origin', TEST_ORIGIN)
        .send({ lowBalanceThreshold: 3 })
        .expect(403);
    });

    it('cannot create currencies', async () => {
      await request(app.getHttpServer())
        .post('/currencies')
        .set('Cookie', cookie)
        .set('Origin', TEST_ORIGIN)
        .send({ code: 'GBP', name: 'Pound', decimals: 2 })
        .expect(403);
    });

    it('cannot delete students', async () => {
      const student = await prisma.student.findFirstOrThrow();
      await request(app.getHttpServer())
        .delete(`/students/${student.id}`)
        .set('Cookie', cookie)
        .set('Origin', TEST_ORIGIN)
        .expect(403);
    });
  });

  describe('reset script guard', () => {
    it('refuses to run without DEMO_MODE and leaves the data alone', async () => {
      const before = await prisma.student.count();
      const { DEMO_MODE: _unset, ...env } = process.env;
      const result = spawnSync('sh', [`${apiRoot}scripts/demo-reset.sh`], { cwd: apiRoot, env, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('DEMO_MODE');
      expect(await prisma.student.count()).toBe(before);
    });
  });
});
