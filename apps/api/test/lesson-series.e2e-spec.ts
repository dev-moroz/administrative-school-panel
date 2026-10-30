import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { LessonSeriesService } from '../src/lesson-series/lesson-series.service.js';
import { zonedToUtc } from '../src/lesson-series/series-slots.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { apiRoot } from './env.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const TAG = `e2e${Date.now().toString(36)}`;
// Series slots are Moscow wall time; the teacher zone must not matter.
const TZ = 'Europe/Moscow';
const TEACHER_TZ = 'Asia/Tokyo';
const DAY = 24 * 3_600_000;
const HORIZON_WEEKS = 4;

const SERIES_KEYS = [
  'id', 'student', 'teacher', 'weekday', 'startTime', 'durationMin',
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
    await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: TEACHER_TZ } });
    await ensureUser(app, 'series-student@e2e.test', 'student');
    await ensureUser(app, 'series-admin@e2e.test', 'admin');

    cookies.teacher = await loginAs(app, 'series-teacher@e2e.test');
    cookies.student = await loginAs(app, 'series-student@e2e.test');
    cookies.admin = await loginAs(app, 'series-admin@e2e.test');
  });

  // Every test uses the same teacher and slot; leftovers would block generation as overlaps.
  async function cleanup() {
    const student = { fullName: { startsWith: TAG } };
    await prisma.ledgerEntry.deleteMany({ where: { student } });
    await prisma.lesson.deleteMany({ where: { participants: { some: { student } } } });
    await prisma.absence.deleteMany({ where: { student } });
    await prisma.seriesSkip.deleteMany({ where: { series: { student } } });
    await prisma.lessonSeries.deleteMany({ where: { student } });
  }

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.student.deleteMany({ where: { fullName: { startsWith: TAG } } });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: TEACHER_TZ } });
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
    it('returns only DTO fields plus warnings, without a time zone', async () => {
      const { res } = await createSeries();
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual([...SERIES_KEYS, 'warnings'].sort());
      expect(res.body.warnings).toEqual([]);
      expect(res.body).not.toHaveProperty('timeZone');
      expect(res.body.endsOn).toBeNull();
    });

    it('generates exactly 4 weeks of lessons at the Moscow slot time, whatever the teacher zone', async () => {
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

    it('lesson DTO exposes seriesId and originalDate as YYYY-MM-DD', async () => {
      const { res, studentId } = await createSeries();
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 7 * DAY).toISOString();
      const list = await call('teacher', 'get', `/lessons?from=${from}&to=${to}&studentId=${studentId}`).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ seriesId: res.body.id, originalDate: tomorrow() });

      const one = await call('teacher', 'get', `/lessons/${list.body[0].id}`).expect(200);
      expect(one.body).toMatchObject({ seriesId: res.body.id, originalDate: tomorrow() });
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
      await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: 'America/New_York' } });
      try {
        await seriesService.generate(res.body.id, new Date(Date.now() + 7 * DAY));
      } finally {
        await prisma.teacher.update({ where: { id: teacher.id }, data: { timeZone: TEACHER_TZ } });
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

  describe('overlaps (generator)', () => {
    async function busyLesson(date: string, time: string, opts: { durationMin?: number; status?: string } = {}) {
      const student = await seedStudent();
      return prisma.lesson.create({
        data: {
          teacherId: teacher.id,
          startsAt: zonedToUtc(date, time, TZ),
          durationMin: opts.durationMin ?? 60,
          status: (opts.status ?? 'SCHEDULED') as never,
          participants: { create: { studentId: student.id } },
        },
      });
    }
    const skipsOf = (seriesId: string) => prisma.seriesSkip.findMany({ where: { seriesId } });

    it('skips a busy slot, records it once and generates the other slots', async () => {
      const busy = await busyLesson(tomorrow(), '10:30');
      const { res } = await createSeries();
      const lessons = await lessonsOf(res.body.id);
      expect(lessons).toHaveLength(HORIZON_WEEKS - 1);
      expect(lessons.map((l) => ymd(l.originalDate))).not.toContain(tomorrow());

      const skips = await skipsOf(res.body.id);
      expect(skips).toHaveLength(1);
      expect(skips[0]).toMatchObject({ reason: 'OVERLAP', conflictLessonId: busy.id });
      expect(ymd(skips[0].originalDate)).toBe(tomorrow());
    });

    it('never retries a skipped slot, even after the time is freed', async () => {
      const busy = await busyLesson(tomorrow(), '10:00');
      const { res } = await createSeries();
      await prisma.lesson.update({ where: { id: busy.id }, data: { status: 'CANCELLED' } });

      await seriesService.generate(res.body.id, new Date());
      await seriesService.generateAll(new Date());
      expect(await lessonsOf(res.body.id)).toHaveLength(HORIZON_WEEKS - 1);
      expect(await skipsOf(res.body.id)).toHaveLength(1);
    });

    it('a back-to-back lesson does not block the slot', async () => {
      await busyLesson(tomorrow(), '09:00');
      await busyLesson(tomorrow(), '11:00');
      const { res } = await createSeries();
      expect(await lessonsOf(res.body.id)).toHaveLength(HORIZON_WEEKS);
      expect(await skipsOf(res.body.id)).toHaveLength(0);
    });

    it('a cancelled lesson does not block the slot', async () => {
      await busyLesson(tomorrow(), '10:00', { status: 'CANCELLED' });
      const { res } = await createSeries();
      expect(await lessonsOf(res.body.id)).toHaveLength(HORIZON_WEEKS);
      expect(await skipsOf(res.body.id)).toHaveLength(0);
    });

    it('a second series on the same slot is skipped entirely', async () => {
      const { res: first } = await createSeries();
      const { res: second } = await createSeries();
      expect(await lessonsOf(first.body.id)).toHaveLength(HORIZON_WEEKS);
      expect(await lessonsOf(second.body.id)).toHaveLength(0);
      expect(await skipsOf(second.body.id)).toHaveLength(HORIZON_WEEKS);
    });

    it('creation reports skipped slots as warnings with a code, not text', async () => {
      await busyLesson(tomorrow(), '10:00');
      await busyLesson(addDays(tomorrow(), 14), '10:00');
      const { res } = await createSeries();
      expect(res.status).toBe(201);
      expect(res.body.warnings).toEqual([
        { code: 'SERIES_SLOT_SKIPPED', date: tomorrow(), reason: 'OVERLAP' },
        { code: 'SERIES_SLOT_SKIPPED', date: addDays(tomorrow(), 14), reason: 'OVERLAP' },
      ]);
    });

    it('split reports the slots its new series skipped', async () => {
      const { res } = await createSeries();
      const [, pivot] = await lessonsOf(res.body.id);
      await busyLesson(ymd(pivot.originalDate), '12:00');
      const split = await call('teacher', 'post', `/lesson-series/${res.body.id}/split`, { fromLessonId: pivot.id, startTime: '12:00' }).expect(201);
      expect(split.body.warnings).toEqual([{ code: 'SERIES_SLOT_SKIPPED', date: ymd(pivot.originalDate), reason: 'OVERLAP' }]);
    });

    it('GET does not carry warnings', async () => {
      await busyLesson(tomorrow(), '10:00');
      const { res } = await createSeries();
      const one = await call('teacher', 'get', `/lesson-series/${res.body.id}`).expect(200);
      expect(one.body).not.toHaveProperty('warnings');
    });

    it('a top-up skips a busy slot on the new horizon date', async () => {
      const { res } = await createSeries();
      await busyLesson(addDays(tomorrow(), 7 * HORIZON_WEEKS), '10:00');
      await seriesService.generate(res.body.id, new Date(Date.now() + 7 * DAY));
      expect(await lessonsOf(res.body.id)).toHaveLength(HORIZON_WEEKS);
      expect(await skipsOf(res.body.id)).toHaveLength(1);
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
      expect(Object.keys(split.body).sort()).toEqual([...SERIES_KEYS, 'warnings'].sort());
      expect(split.body.warnings).toEqual([]);
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
      const b = await createSeries('teacher', { startTime: '15:00' });
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

  describe('manuallyChanged', () => {
    // Moves a lesson away and back: the time matches the slot again, but the lesson was changed by hand.
    async function moveAndReturn(lesson: { id: string; startsAt: Date }) {
      const away = new Date(lesson.startsAt.getTime() + 3_600_000).toISOString();
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { startsAt: away }).expect(200);
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { startsAt: lesson.startsAt.toISOString() }).expect(200);
    }

    it('end keeps a lesson moved and returned to its slot', async () => {
      const { res } = await createSeries();
      const old = await lessonsOf(res.body.id);
      await moveAndReturn(old[3]);
      await call('teacher', 'post', `/lesson-series/${res.body.id}/end`, { endsOn: ymd(old[1].originalDate) }).expect(200);
      expect((await lessonsOf(res.body.id)).map((l) => l.id)).toEqual([old[0].id, old[1].id, old[3].id]);
    });

    it('split keeps a lesson moved and returned to its slot and regenerates untouched ones', async () => {
      const { res, studentId } = await createSeries();
      const old = await lessonsOf(res.body.id);
      await moveAndReturn(old[2]);
      const split = await call('teacher', 'post', `/lesson-series/${res.body.id}/split`, {
        fromLessonId: old[1].id,
        startTime: '12:00',
      }).expect(201);

      const all = await lessonsOfStudent(studentId);
      const kept = all.find((l) => l.id === old[2].id)!;
      expect(kept.startsAt.toISOString()).toBe(old[2].startsAt.toISOString());
      expect(kept.seriesId).toBe(split.body.id);
      expect(all.find((l) => l.id === old[1].id)).toBeUndefined();
      expect(all.find((l) => l.id === old[3].id)).toBeUndefined();
      const regenerated = all.filter((l) => l.seriesId === split.body.id && l.id !== old[2].id);
      expect(regenerated.map((l) => l.startsAt.toISOString())).toEqual(
        regenerated.map((l) => zonedToUtc(ymd(l.originalDate), '12:00', TZ).toISOString()),
      );
      expect(regenerated).toHaveLength(2);
    });

    it('generated lessons start without the flag', async () => {
      const { res } = await createSeries();
      expect((await lessonsOf(res.body.id)).every((l) => !l.manuallyChanged)).toBe(true);
    });
  });

  describe('manuallyChanged backfill migration', () => {
    function backfillSql() {
      const dir = join(apiRoot, 'prisma/migrations');
      const name = readdirSync(dir).find((d) => d.endsWith('_lesson_manually_changed'))!;
      const sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8');
      return sql.slice(sql.indexOf('-- backfill'));
    }

    it('flags series lessons that differ from their slot or were cancelled by hand', async () => {
      const { res } = await createSeries();
      const [untouched, moved, longer, cancelled] = await lessonsOf(res.body.id);
      const second = await createSeries('teacher', { startTime: '15:00' });
      const [completed, noShow] = await lessonsOf(second.res.body.id);
      const oneOff = await prisma.lesson.create({
        data: {
          teacherId: teacher.id,
          startsAt: new Date(Date.now() + 3 * DAY),
          durationMin: 60,
          status: 'CANCELLED',
          participants: { create: { studentId: second.studentId } },
        },
      });

      const ids = [untouched, moved, longer, cancelled, completed, noShow, oneOff].map((l) => l.id);
      const rollback = new Error('rollback');
      let flags: Record<string, boolean> = {};
      await prisma
        .$transaction(async (tx) => {
          await tx.lesson.update({ where: { id: moved.id }, data: { startsAt: new Date(moved.startsAt.getTime() + 3_600_000) } });
          await tx.lesson.update({ where: { id: longer.id }, data: { durationMin: 90 } });
          await tx.lesson.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
          await tx.lesson.update({ where: { id: completed.id }, data: { status: 'COMPLETED', charged: true } });
          await tx.lesson.update({ where: { id: noShow.id }, data: { status: 'NO_SHOW' } });
          await tx.lesson.updateMany({ where: { id: { in: ids } }, data: { manuallyChanged: false } });
          await tx.$executeRawUnsafe(backfillSql());
          const rows = await tx.lesson.findMany({ where: { id: { in: ids } }, select: { id: true, manuallyChanged: true } });
          flags = Object.fromEntries(rows.map((r) => [r.id, r.manuallyChanged]));
          throw rollback;
        })
        .catch((e) => {
          if (e !== rollback) throw e;
        });

      expect(flags).toEqual({
        [untouched.id]: false,
        [moved.id]: true,
        [longer.id]: true,
        [cancelled.id]: true,
        [completed.id]: false,
        [noShow.id]: true,
        [oneOff.id]: false,
      });
    });
  });

  describe('student deactivation', () => {
    const inDays = (days: number) => new Date(Date.now() + days * DAY);

    async function futureLesson(studentIds: string[], data: object = {}) {
      return prisma.lesson.create({
        data: {
          teacherId: teacher.id,
          startsAt: inDays(40),
          durationMin: 60,
          participants: { create: studentIds.map((studentId) => ({ studentId })) },
          ...data,
        },
      });
    }

    async function freeze(studentId: string, startsOn: string, endsOn: string) {
      const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'series-admin@e2e.test' } });
      return prisma.absence.create({
        data: {
          kind: 'STUDENT_FREEZE',
          studentId,
          startsOn: new Date(`${startsOn}T00:00:00Z`),
          endsOn: new Date(`${endsOn}T00:00:00Z`),
          createdById: admin.id,
        },
      });
    }

    it('returns 409 with a code and the number of future lessons and keeps everything', async () => {
      const { studentId } = await createSeries();
      const res = await call('admin', 'patch', `/students/${studentId}`, { isActive: false });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('STUDENT_HAS_FUTURE_LESSONS');
      expect(res.body.futureLessons).toBe(HORIZON_WEEKS);
      expect(res.body.keptLessons).toBe(0);
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

    it('deletes future solo lessons in any status', async () => {
      const student = await seedStudent();
      await futureLesson([student.id], { status: 'CANCELLED', cancelReasonCode: 'STUDENT_FREEZE', startsAt: inDays(41) });
      await futureLesson([student.id], { status: 'SCHEDULED', startsAt: inDays(42) });

      const res = await call('admin', 'patch', `/students/${student.id}`, { isActive: false });
      expect(res.status).toBe(409);
      expect(res.body.futureLessons).toBe(2);

      await call('admin', 'patch', `/students/${student.id}`, { isActive: false, deleteFutureLessons: true }).expect(200);
      expect(await lessonsOfStudent(student.id)).toHaveLength(0);
    });

    it('keeps a future group lesson for the others and removes only the student', async () => {
      const [leaving, staying] = [await seedStudent(), await seedStudent()];
      const group = await futureLesson([leaving.id, staying.id]);

      const res = await call('admin', 'patch', `/students/${leaving.id}`, { isActive: false });
      expect(res.body.futureLessons).toBe(1);

      await call('admin', 'patch', `/students/${leaving.id}`, { isActive: false, deleteFutureLessons: true }).expect(200);
      const participants = await prisma.lessonParticipant.findMany({ where: { lessonId: group.id } });
      expect(participants.map((p) => p.studentId)).toEqual([staying.id]);
    });

    it('keeps a future lesson that already has ledger entries and counts it as kept', async () => {
      const student = await seedStudent();
      const charged = await futureLesson([student.id], { status: 'CANCELLED', charged: true, startsAt: inDays(1) });
      await prisma.ledgerEntry.create({
        data: { studentId: student.id, delta: -1, type: 'LESSON_CHARGE', lessonId: charged.id },
      });
      await futureLesson([student.id], { startsAt: inDays(43) });

      const res = await call('admin', 'patch', `/students/${student.id}`, { isActive: false });
      expect(res.body).toMatchObject({ futureLessons: 1, keptLessons: 1 });

      await call('admin', 'patch', `/students/${student.id}`, { isActive: false, deleteFutureLessons: true }).expect(200);
      expect((await lessonsOfStudent(student.id)).map((l) => l.id)).toEqual([charged.id]);
    });

    it('deletes a future lesson whose entries sum to 0, keeps the entries without a link and the balance', async () => {
      const student = await seedStudent();
      const restored = await futureLesson([student.id], { manuallyChanged: true });
      await prisma.ledgerEntry.createMany({
        data: [
          { studentId: student.id, delta: -1, type: 'LESSON_CHARGE', lessonId: restored.id },
          { studentId: student.id, delta: 1, type: 'LESSON_REVERSAL', lessonId: restored.id },
        ],
      });

      const res = await call('admin', 'patch', `/students/${student.id}`, { isActive: false });
      expect(res.body).toMatchObject({ futureLessons: 1, keptLessons: 0 });

      await call('admin', 'patch', `/students/${student.id}`, { isActive: false, deleteFutureLessons: true }).expect(200);
      expect(await lessonsOfStudent(student.id)).toHaveLength(0);
      const entries = await prisma.ledgerEntry.findMany({ where: { studentId: student.id } });
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.lessonId === null)).toBe(true);
      expect(entries.reduce((sum, e) => sum + e.delta, 0)).toBe(0);
    });

    it('deactivates without a dialog when only charged lessons are in the future', async () => {
      const student = await seedStudent();
      const charged = await futureLesson([student.id], { status: 'CANCELLED', charged: true });
      await prisma.ledgerEntry.create({
        data: { studentId: student.id, delta: -1, type: 'LESSON_CHARGE', lessonId: charged.id },
      });
      await call('admin', 'patch', `/students/${student.id}`, { isActive: false }).expect(200);
    });

    it('deletes not started freezes and cuts a running one to today', async () => {
      const student = await seedStudent();
      const running = await freeze(student.id, today(), addDays(today(), 10));
      const upcoming = await freeze(student.id, addDays(today(), 20), addDays(today(), 30));
      const past = await freeze(student.id, addDays(today(), -10), addDays(today(), -5));

      await call('admin', 'patch', `/students/${student.id}`, { isActive: false }).expect(200);

      const left = await prisma.absence.findMany({ where: { studentId: student.id }, orderBy: { startsOn: 'asc' } });
      expect(left.map((a) => [a.id, ymd(a.startsOn), ymd(a.endsOn)])).toEqual([
        [past.id, addDays(today(), -10), addDays(today(), -5)],
        [running.id, today(), today()],
      ]);
      expect(left.some((a) => a.id === upcoming.id)).toBe(false);
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
