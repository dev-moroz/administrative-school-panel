import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { LessonSeriesService } from '../src/lesson-series/lesson-series.service.js';
import { zonedToUtc } from '../src/lesson-series/series-slots.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const TAG = `e2e${Date.now().toString(36)}`;
const TZ = 'Europe/Belgrade';
const DAY = 24 * 3_600_000;
const HORIZON_WEEKS = 4;

const SERIES_KEYS = [
  'id', 'student', 'teacher', 'weekday', 'startTime', 'durationMin', 'timeZone',
  'startsOn', 'endsOn', 'createdAt', 'updatedAt',
];

function localDate(date: Date, timeZone = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function addDays(ymd: string, days: number) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
function isoWeekday(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7;
}

describe('lesson series (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let seriesService: LessonSeriesService;
  let teacher: { id: string };
  const cookies: Partial<Record<Actor, string>> = {};
  let counter = 0;

  // The first slot is tomorrow, so every generated lesson is in the future.
  const today = () => localDate(new Date());
  const tomorrow = () => addDays(today(), 1);

  function call(actor: Actor, method: Method, path: string, body?: object) {
    const req = request(server)[method](path).set('Origin', TEST_ORIGIN);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    return body === undefined ? req : req.send(body);
  }

  async function seedStudent() {
    counter += 1;
    return prisma.student.create({
      data: { fullName: `${TAG} student ${counter}`, teachers: { create: { teacherId: teacher.id } } },
    });
  }

  async function createSeries(actor: Actor = 'teacher', overrides: object = {}) {
    const student = await seedStudent();
    const res = await call(actor, 'post', '/lesson-series', {
      studentId: student.id,
      weekday: isoWeekday(tomorrow()),
      startTime: '10:00',
      durationMin: 60,
      startsOn: today(),
      ...overrides,
    });
    return { res, studentId: student.id };
  }

  const lessonsOf = (seriesId: string) =>
    prisma.lesson.findMany({ where: { seriesId }, orderBy: { originalDate: 'asc' } });
  const lessonsOfStudent = (studentId: string) =>
    prisma.lesson.findMany({
      where: { participants: { some: { studentId } } },
      orderBy: { startsAt: 'asc' },
    });
  const ymd = (d: Date | null) => d!.toISOString().slice(0, 10);

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    seriesService = app.get(LessonSeriesService);

    teacher = await ensureTeacher(app, 'series-teacher@e2e.test', 'Series Teacher');
    await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: TZ } });
    await ensureUser(app, 'series-student@e2e.test', 'student');
    await ensureUser(app, 'series-admin@e2e.test', 'admin');

    cookies.teacher = await loginAs(app, 'series-teacher@e2e.test');
    cookies.student = await loginAs(app, 'series-student@e2e.test');
    cookies.admin = await loginAs(app, 'series-admin@e2e.test');
  });

  afterAll(async () => {
    const student = { fullName: { startsWith: TAG } };
    await prisma.ledgerEntry.deleteMany({ where: { student } });
    await prisma.lesson.deleteMany({ where: { participants: { some: { student } } } });
    await prisma.lessonSeries.deleteMany({ where: { student } });
    await prisma.student.deleteMany({ where: student });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: TZ } });
    await app.close();
  });

  describe('role x endpoint matrix', () => {
    const MATRIX: {
      name: string;
      expected: Record<Actor, number>;
      run: (actor: Actor) => PromiseLike<{ status: number }>;
    }[] = [
      {
        name: 'POST /lesson-series',
        expected: { anonymous: 401, student: 403, teacher: 201, admin: 201 },
        run: async (actor) => (await createSeries(actor)).res,
      },
      {
        name: 'GET /lesson-series?studentId=',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/lesson-series?studentId=${(await seedStudent()).id}`),
      },
      {
        name: 'GET /lesson-series/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/lesson-series/${(await createSeries('admin')).res.body.id}`),
      },
      {
        name: 'POST /lesson-series/:id/split',
        expected: { anonymous: 401, student: 403, teacher: 201, admin: 201 },
        run: async (actor) => {
          const id = (await createSeries('admin')).res.body.id;
          const [first] = await lessonsOf(id);
          return call(actor, 'post', `/lesson-series/${id}/split`, { fromLessonId: first.id, startTime: '12:00' });
        },
      },
      {
        name: 'POST /lesson-series/:id/end',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => {
          const id = (await createSeries('admin')).res.body.id;
          return call(actor, 'post', `/lesson-series/${id}/end`, { endsOn: addDays(today(), 14) });
        },
      },
    ];

    for (const row of MATRIX) {
      for (const actor of ACTORS) {
        it(`${row.name} as ${actor} -> ${row.expected[actor]}`, async () => {
          expect((await row.run(actor)).status).toBe(row.expected[actor]);
        });
      }
    }
  });

  describe('create and generate', () => {
    it('returns only DTO fields and captures the teacher zone', async () => {
      const { res } = await createSeries();
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual([...SERIES_KEYS].sort());
      expect(res.body.timeZone).toBe(TZ);
      expect(res.body.endsOn).toBeNull();
    });

    it('generates exactly 4 weeks of lessons at the local slot time', async () => {
      const { res, studentId } = await createSeries();
      const lessons = await lessonsOf(res.body.id);
      expect(lessons).toHaveLength(HORIZON_WEEKS);
      lessons.forEach((l, i) => {
        const date = addDays(tomorrow(), 7 * i);
        expect(ymd(l.originalDate)).toBe(date);
        expect(l.startsAt.toISOString()).toBe(zonedToUtc(date, '10:00', TZ).toISOString());
        expect(l.durationMin).toBe(60);
        expect(l.status).toBe('SCHEDULED');
        expect(l.teacherId).toBe(teacher.id);
      });
      expect(await lessonsOfStudent(studentId)).toHaveLength(HORIZON_WEEKS);
    });

    it('repeated generation does not duplicate lessons', async () => {
      const { res } = await createSeries();
      await seriesService.generate(res.body.id, new Date());
      await seriesService.generateAll(new Date());
      expect(await lessonsOf(res.body.id)).toHaveLength(HORIZON_WEEKS);
    });

    it('tops the series up when the horizon moves forward', async () => {
      const { res } = await createSeries();
      await seriesService.generate(res.body.id, new Date(Date.now() + 7 * DAY));
      expect(await lessonsOf(res.body.id)).toHaveLength(HORIZON_WEEKS + 1);
    });

    it('does not recreate a moved or cancelled lesson', async () => {
      const { res } = await createSeries();
      const [first, second] = await lessonsOf(res.body.id);
      await call('teacher', 'patch', `/lessons/${first.id}`, {
        startsAt: new Date(first.startsAt.getTime() + DAY).toISOString(),
      }).expect(200);
      await call('teacher', 'post', `/lessons/${second.id}/status`, { status: 'CANCELLED', reason: 'STUDENT_ILL' }).expect(200);
      await seriesService.generate(res.body.id, new Date());
      expect(await lessonsOf(res.body.id)).toHaveLength(HORIZON_WEEKS);
    });

    it('"only this lesson" keeps the original slot', async () => {
      const { res } = await createSeries();
      const [first] = await lessonsOf(res.body.id);
      const moved = new Date(first.startsAt.getTime() + 2 * 3_600_000);
      await call('teacher', 'patch', `/lessons/${first.id}`, { startsAt: moved.toISOString() }).expect(200);
      const after = await prisma.lesson.findUniqueOrThrow({ where: { id: first.id } });
      expect(after.startsAt.toISOString()).toBe(moved.toISOString());
      expect(ymd(after.originalDate)).toBe(ymd(first.originalDate));
      expect(after.seriesId).toBe(res.body.id);
    });

    it('a teacher zone change does not shift generation', async () => {
      const { res } = await createSeries();
      await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: 'Asia/Tokyo' } });
      try {
        await seriesService.generate(res.body.id, new Date(Date.now() + 7 * DAY));
      } finally {
        await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: TZ } });
      }
      const lessons = await lessonsOf(res.body.id);
      const last = lessons[lessons.length - 1];
      expect(last.startsAt.toISOString()).toBe(zonedToUtc(ymd(last.originalDate), '10:00', TZ).toISOString());
    });

    it('rejects an invalid weekday or time', async () => {
      expect((await createSeries('teacher', { weekday: 8 })).res.status).toBe(400);
      expect((await createSeries('teacher', { startTime: '25:00' })).res.status).toBe(400);
    });

    it('returns 404 for an unknown student', async () => {
      const res = await call('teacher', 'post', '/lesson-series', {
        studentId: randomUUID(), weekday: 1, startTime: '10:00', durationMin: 60, startsOn: today(),
      });
      expect(res.status).toBe(404);
    });

    it('lists the series of a student', async () => {
      const { res, studentId } = await createSeries();
      const list = await call('teacher', 'get', `/lesson-series?studentId=${studentId}`).expect(200);
      expect(list.body.map((s: { id: string }) => s.id)).toEqual([res.body.id]);
    });
  });

  describe('this and following (split)', () => {
    it('closes the old series, regenerates untouched lessons and keeps changed ones', async () => {
      const { res, studentId } = await createSeries();
      const old = await lessonsOf(res.body.id);
      const pivot = old[1];
      await call('teacher', 'post', `/lessons/${old[2].id}/status`, { status: 'CANCELLED', reason: 'STUDENT_ILL' }).expect(200);
      const movedAt = new Date(old[3].startsAt.getTime() + DAY);
      await call('teacher', 'patch', `/lessons/${old[3].id}`, { startsAt: movedAt.toISOString() }).expect(200);

      const split = await call('teacher', 'post', `/lesson-series/${res.body.id}/split`, {
        fromLessonId: pivot.id,
        startTime: '12:00',
      });
      expect(split.status).toBe(201);
      expect(Object.keys(split.body).sort()).toEqual([...SERIES_KEYS].sort());
      expect(split.body.startsOn).toBe(ymd(pivot.originalDate));

      const closed = await prisma.lessonSeries.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(ymd(closed.endsOn)).toBe(addDays(ymd(pivot.originalDate), -1));

      const all = await lessonsOfStudent(studentId);
      expect(all).toHaveLength(HORIZON_WEEKS);
      for (const l of old.slice(0, 1)) {
        const kept = all.find((x) => x.id === l.id)!;
        expect(kept.startsAt.toISOString()).toBe(l.startsAt.toISOString());
      }
      expect(all.find((x) => x.id === old[2].id)?.status).toBe('CANCELLED');
      expect(all.find((x) => x.id === old[3].id)?.startsAt.toISOString()).toBe(movedAt.toISOString());

      const regenerated = all.filter((x) => x.startsAt >= pivot.startsAt && x.id !== old[2].id && x.id !== old[3].id);
      expect(regenerated).toHaveLength(1);
      for (const l of regenerated) {
        expect(l.seriesId).toBe(split.body.id);
        expect(l.startsAt.toISOString()).toBe(zonedToUtc(ymd(l.originalDate), '12:00', TZ).toISOString());
      }
    });

    it('rejects a split from a lesson of another series', async () => {
      const a = await createSeries();
      const b = await createSeries();
      const [foreign] = await lessonsOf(b.res.body.id);
      const res = await call('teacher', 'post', `/lesson-series/${a.res.body.id}/split`, { fromLessonId: foreign.id, startTime: '12:00' });
      expect(res.status).toBe(400);
    });

    it('rejects a split from a completed lesson', async () => {
      const { res } = await createSeries();
      const [first] = await lessonsOf(res.body.id);
      await prisma.lesson.update({ where: { id: first.id }, data: { status: 'COMPLETED' } });
      const split = await call('teacher', 'post', `/lesson-series/${res.body.id}/split`, { fromLessonId: first.id, startTime: '12:00' });
      expect(split.status).toBe(409);
    });
  });

  describe('end', () => {
    it('stops the series and deletes only untouched lessons after endsOn', async () => {
      const { res } = await createSeries();
      const old = await lessonsOf(res.body.id);
      await call('teacher', 'post', `/lessons/${old[3].id}/status`, { status: 'CANCELLED', reason: 'STUDENT_ILL' }).expect(200);
      const endsOn = ymd(old[1].originalDate);

      const end = await call('teacher', 'post', `/lesson-series/${res.body.id}/end`, { endsOn });
      expect(end.status).toBe(200);
      expect(end.body.endsOn).toBe(endsOn);

      const left = await lessonsOf(res.body.id);
      expect(left.map((l) => l.id)).toEqual([...old.slice(0, 2), old[3]].map((l) => l.id));
      await seriesService.generate(res.body.id, new Date(Date.now() + 30 * DAY));
      expect(await lessonsOf(res.body.id)).toHaveLength(3);
    });
  });

  describe('student deactivation', () => {
    it('returns 409 with the number of future lessons and keeps everything', async () => {
      const { studentId } = await createSeries();
      const res = await call('admin', 'patch', `/students/${studentId}`, { isActive: false });
      expect(res.status).toBe(409);
      expect(res.body.futureLessons).toBe(HORIZON_WEEKS);
      expect((await prisma.student.findUniqueOrThrow({ where: { id: studentId } })).isActive).toBe(true);
      expect(await lessonsOfStudent(studentId)).toHaveLength(HORIZON_WEEKS);
    });

    it('with deleteFutureLessons deletes future lessons, closes series and keeps the past', async () => {
      const { res, studentId } = await createSeries();
      const past = await prisma.lesson.create({
        data: {
          teacherId: teacher.id,
          startsAt: new Date(Date.now() - 7 * DAY),
          durationMin: 60,
          status: 'COMPLETED',
          participants: { create: { studentId } },
        },
      });

      const patch = await call('admin', 'patch', `/students/${studentId}`, { isActive: false, deleteFutureLessons: true });
      expect(patch.status).toBe(200);
      expect(patch.body.isActive).toBe(false);

      expect((await lessonsOfStudent(studentId)).map((l) => l.id)).toEqual([past.id]);
      const series = await prisma.lessonSeries.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(ymd(series.endsOn)).toBe(today());

      await seriesService.generateAll(new Date());
      expect((await lessonsOfStudent(studentId)).map((l) => l.id)).toEqual([past.id]);
    });

    it('reactivation does not resume old series', async () => {
      const { studentId } = await createSeries();
      await call('admin', 'patch', `/students/${studentId}`, { isActive: false, deleteFutureLessons: true }).expect(200);
      await call('admin', 'patch', `/students/${studentId}`, { isActive: true }).expect(200);
      await seriesService.generateAll(new Date());
      expect(await lessonsOfStudent(studentId)).toHaveLength(0);
    });

    it('deactivates as before when there are no future lessons', async () => {
      const student = await seedStudent();
      const res = await call('admin', 'patch', `/students/${student.id}`, { isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });
});
