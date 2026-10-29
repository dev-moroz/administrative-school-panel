import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { zonedToUtc } from '../src/lesson-series/series-slots.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const TAG = `e2e${Date.now().toString(36)}`;
const TZ = 'Europe/Moscow';
const DAY = 24 * 3_600_000;

const ABSENCE_KEYS = ['id', 'kind', 'student', 'teacher', 'startsOn', 'endsOn', 'comment', 'createdAt', 'updatedAt'];

function localDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function addDays(ymd: string, days: number) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
function isoWeekday(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7;
}

describe('absences (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let teacher: { id: string };
  let otherTeacher: { id: string };
  const cookies: Partial<Record<Actor, string>> = {};
  let counter = 0;

  const today = () => localDate(new Date());
  const day = (offset: number) => addDays(today(), offset);
  // Moscow wall time of a day relative to today.
  const at = (offset: number, time = '10:00') => zonedToUtc(day(offset), time, TZ);

  function call(actor: Actor, method: Method, path: string, body?: object) {
    const req = request(server)[method](path).set('Origin', TEST_ORIGIN);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    return body === undefined ? req : req.send(body);
  }

  async function seedStudent(teacherId = teacher.id) {
    counter += 1;
    return prisma.student.create({
      data: { fullName: `${TAG} student ${counter}`, teachers: { create: { teacherId } } },
    });
  }

  async function seedLesson(opts: {
    studentId: string;
    startsAt: Date;
    teacherId?: string;
    durationMin?: number;
    status?: string;
    manuallyChanged?: boolean;
  }) {
    return prisma.lesson.create({
      data: {
        teacherId: opts.teacherId ?? teacher.id,
        startsAt: opts.startsAt,
        durationMin: opts.durationMin ?? 60,
        status: (opts.status ?? 'SCHEDULED') as never,
        manuallyChanged: opts.manuallyChanged ?? false,
        participants: { create: { studentId: opts.studentId } },
      },
    });
  }

  const freeze = (studentId: string, startsOn: string, endsOn: string, actor: Actor = 'teacher') =>
    call(actor, 'post', '/absences', { kind: 'STUDENT_FREEZE', studentId, startsOn, endsOn });
  const vacation = (teacherId: string, startsOn: string, endsOn: string, actor: Actor = 'teacher') =>
    call(actor, 'post', '/absences', { kind: 'TEACHER_VACATION', teacherId, startsOn, endsOn });
  const reload = (id: string) => prisma.lesson.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    teacher = await ensureTeacher(app, 'absences-teacher@e2e.test', 'Absences Teacher');
    otherTeacher = await ensureTeacher(app, 'absences-other@e2e.test', 'Absences Other');
    await ensureUser(app, 'absences-student@e2e.test', 'student');
    await ensureUser(app, 'absences-admin@e2e.test', 'admin');

    cookies.teacher = await loginAs(app, 'absences-teacher@e2e.test');
    cookies.student = await loginAs(app, 'absences-student@e2e.test');
    cookies.admin = await loginAs(app, 'absences-admin@e2e.test');
  });

  async function cleanup() {
    const student = { fullName: { startsWith: TAG } };
    const teacherIds = [teacher.id, otherTeacher.id];
    await prisma.lesson.deleteMany({ where: { participants: { some: { student } } } });
    await prisma.seriesSkip.deleteMany({ where: { series: { student } } });
    await prisma.lessonSeries.deleteMany({ where: { student } });
    await prisma.absence.deleteMany({ where: { OR: [{ student }, { teacherId: { in: teacherIds } }] } });
  }

  afterEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.student.deleteMany({ where: { fullName: { startsWith: TAG } } });
    await app.close();
  });

  describe('role x endpoint matrix', () => {
    const newFreeze = async () => (await freeze((await seedStudent()).id, day(10), day(12), 'admin')).body.id;
    const MATRIX: {
      name: string;
      expected: Record<Actor, number>;
      run: (actor: Actor) => PromiseLike<{ status: number }>;
    }[] = [
      {
        name: 'POST /absences',
        expected: { anonymous: 401, student: 403, teacher: 201, admin: 201 },
        run: async (actor) => freeze((await seedStudent()).id, day(10), day(12), actor),
      },
      {
        name: 'GET /absences?studentId=',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/absences?studentId=${(await seedStudent()).id}`),
      },
      {
        name: 'GET /absences/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/absences/${await newFreeze()}`),
      },
      {
        name: 'PATCH /absences/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'patch', `/absences/${await newFreeze()}`, { endsOn: day(11) }),
      },
      {
        name: 'DELETE /absences/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'delete', `/absences/${await newFreeze()}`),
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

  describe('create', () => {
    it('returns only DTO fields plus warnings', async () => {
      const student = await seedStudent();
      const res = await freeze(student.id, day(3), day(5)).expect(201);
      expect(Object.keys(res.body).sort()).toEqual([...ABSENCE_KEYS, 'warnings'].sort());
      expect(res.body).toMatchObject({
        kind: 'STUDENT_FREEZE',
        student: { id: student.id, fullName: student.fullName },
        teacher: null,
        startsOn: day(3),
        endsOn: day(5),
        warnings: [],
      });
    });

    it('a student freeze cancels only that student\'s scheduled lessons inside the period, not charged', async () => {
      const a = await seedStudent();
      const b = await seedStudent();
      const before = await seedLesson({ studentId: a.id, startsAt: at(2) });
      const inside = await seedLesson({ studentId: a.id, startsAt: at(3) });
      const lastDay = await seedLesson({ studentId: a.id, startsAt: at(5, '23:00') });
      const after = await seedLesson({ studentId: a.id, startsAt: at(6, '00:00') });
      const other = await seedLesson({ studentId: b.id, startsAt: at(4) });

      const res = await freeze(a.id, day(3), day(5)).expect(201);

      for (const l of [inside, lastDay]) {
        expect(await reload(l.id)).toMatchObject({
          status: 'CANCELLED',
          charged: false,
          cancelReasonCode: 'STUDENT_FREEZE',
          absenceId: res.body.id,
          manuallyChanged: false,
        });
      }
      for (const l of [before, after, other]) {
        expect(await reload(l.id)).toMatchObject({ status: 'SCHEDULED', absenceId: null });
      }
      expect(await prisma.ledgerEntry.count({ where: { lessonId: { in: [inside.id, lastDay.id] } } })).toBe(0);
    });

    it('a teacher vacation cancels all her lessons in the period with TEACHER_VACATION, other teachers untouched', async () => {
      const a = await seedStudent();
      const b = await seedStudent();
      const c = await seedStudent(otherTeacher.id);
      const la = await seedLesson({ studentId: a.id, startsAt: at(3) });
      const lb = await seedLesson({ studentId: b.id, startsAt: at(4, '15:00') });
      const lc = await seedLesson({ studentId: c.id, startsAt: at(3), teacherId: otherTeacher.id });

      const res = await vacation(teacher.id, day(3), day(4)).expect(201);
      expect(res.body).toMatchObject({ kind: 'TEACHER_VACATION', student: null, teacher: { id: teacher.id } });

      for (const l of [la, lb]) {
        expect(await reload(l.id)).toMatchObject({ status: 'CANCELLED', cancelReasonCode: 'TEACHER_VACATION', absenceId: res.body.id });
      }
      expect(await reload(lc.id)).toMatchObject({ status: 'SCHEDULED' });
    });

    it('also cancels hand-changed scheduled lessons; already cancelled or no-show ones are left alone', async () => {
      const s = await seedStudent();
      const moved = await seedLesson({ studentId: s.id, startsAt: at(3), manuallyChanged: true });
      const cancelled = await seedLesson({ studentId: s.id, startsAt: at(4), status: 'CANCELLED', manuallyChanged: true });

      const res = await freeze(s.id, day(3), day(4)).expect(201);

      expect(await reload(moved.id)).toMatchObject({ status: 'CANCELLED', absenceId: res.body.id, manuallyChanged: true });
      expect(await reload(cancelled.id)).toMatchObject({ status: 'CANCELLED', absenceId: null });
    });

    it('400 when the start is before today (Moscow)', async () => {
      const s = await seedStudent();
      await freeze(s.id, day(-1), day(3)).expect(400);
    });

    it('starting today is allowed; lessons already started today are not touched', async () => {
      const s = await seedStudent();
      const past = await seedLesson({ studentId: s.id, startsAt: new Date(Date.now() - 3_600_000), durationMin: 30 });
      await freeze(s.id, day(0), day(2)).expect(201);
      expect((await reload(past.id)).absenceId).toBeNull();
    });

    it('400 when the end is before the start', async () => {
      const s = await seedStudent();
      await freeze(s.id, day(5), day(4)).expect(400);
    });

    it('400 when the owner does not match the kind', async () => {
      const s = await seedStudent();
      await call('teacher', 'post', '/absences', { kind: 'STUDENT_FREEZE', teacherId: teacher.id, startsOn: day(3), endsOn: day(4) }).expect(400);
      await call('teacher', 'post', '/absences', { kind: 'TEACHER_VACATION', studentId: s.id, startsOn: day(3), endsOn: day(4) }).expect(400);
      await call('teacher', 'post', '/absences', {
        kind: 'STUDENT_FREEZE', studentId: s.id, teacherId: teacher.id, startsOn: day(3), endsOn: day(4),
      }).expect(400);
    });

    it('404 for an unknown student or teacher', async () => {
      await freeze(randomUUID(), day(3), day(4)).expect(404);
      await vacation(randomUUID(), day(3), day(4)).expect(404);
    });

    it('409 ABSENCE_OVERLAP for intersecting absences of the same owner; another owner is fine', async () => {
      const s = await seedStudent();
      const other = await seedStudent();
      await freeze(s.id, day(3), day(6)).expect(201);
      const res = await freeze(s.id, day(6), day(8)).expect(409);
      expect(res.body.code).toBe('ABSENCE_OVERLAP');
      await freeze(s.id, day(7), day(8)).expect(201);
      await freeze(other.id, day(3), day(6)).expect(201);
    });
  });

  describe('list and get', () => {
    it('lists absences of a student or a teacher by start', async () => {
      const s = await seedStudent();
      await freeze(s.id, day(10), day(11)).expect(201);
      await freeze(s.id, day(3), day(4)).expect(201);
      await vacation(teacher.id, day(20), day(21)).expect(201);

      const byStudent = await call('teacher', 'get', `/absences?studentId=${s.id}`).expect(200);
      expect(byStudent.body.map((a: { startsOn: string }) => a.startsOn)).toEqual([day(3), day(10)]);
      expect(Object.keys(byStudent.body[0]).sort()).toEqual([...ABSENCE_KEYS].sort());

      const byTeacher = await call('teacher', 'get', `/absences?teacherId=${teacher.id}`).expect(200);
      expect(byTeacher.body).toHaveLength(1);
    });

    it('400 without a filter, 404 for an unknown id', async () => {
      await call('teacher', 'get', '/absences').expect(400);
      await call('teacher', 'get', `/absences/${randomUUID()}`).expect(404);
    });
  });

  describe('edit', () => {
    it('shortening the end restores the lessons of the freed days', async () => {
      const s = await seedStudent();
      const kept = await seedLesson({ studentId: s.id, startsAt: at(3) });
      const freed = await seedLesson({ studentId: s.id, startsAt: at(5) });
      const { body } = await freeze(s.id, day(3), day(6)).expect(201);

      const res = await call('teacher', 'patch', `/absences/${body.id}`, { endsOn: day(4) }).expect(200);
      expect(res.body).toMatchObject({ endsOn: day(4), warnings: [] });

      expect(await reload(kept.id)).toMatchObject({ status: 'CANCELLED', absenceId: body.id });
      expect(await reload(freed.id)).toMatchObject({
        status: 'SCHEDULED', cancelReasonCode: null, cancelledAt: null, absenceId: null, manuallyChanged: false,
      });
    });

    it('extending the end cancels the newly covered lessons', async () => {
      const s = await seedStudent();
      const later = await seedLesson({ studentId: s.id, startsAt: at(6) });
      const { body } = await freeze(s.id, day(3), day(4)).expect(201);

      await call('teacher', 'patch', `/absences/${body.id}`, { endsOn: day(6) }).expect(200);
      expect(await reload(later.id)).toMatchObject({ status: 'CANCELLED', absenceId: body.id });
    });

    it('moving a future start later restores, earlier cancels', async () => {
      const s = await seedStudent();
      const d3 = await seedLesson({ studentId: s.id, startsAt: at(3) });
      const d5 = await seedLesson({ studentId: s.id, startsAt: at(5) });
      const { body } = await freeze(s.id, day(5), day(7)).expect(201);

      await call('teacher', 'patch', `/absences/${body.id}`, { startsOn: day(3) }).expect(200);
      expect(await reload(d3.id)).toMatchObject({ status: 'CANCELLED', absenceId: body.id });

      await call('teacher', 'patch', `/absences/${body.id}`, { startsOn: day(6) }).expect(200);
      expect(await reload(d3.id)).toMatchObject({ status: 'SCHEDULED', absenceId: null });
      expect(await reload(d5.id)).toMatchObject({ status: 'SCHEDULED', absenceId: null });
    });

    it('400 when the new start is before today or the end before the start', async () => {
      const s = await seedStudent();
      const { body } = await freeze(s.id, day(3), day(5)).expect(201);
      await call('teacher', 'patch', `/absences/${body.id}`, { startsOn: day(-1) }).expect(400);
      await call('teacher', 'patch', `/absences/${body.id}`, { endsOn: day(2) }).expect(400);
    });

    it('409 ABSENCE_OVERLAP when an edit runs into another absence of the same owner', async () => {
      const s = await seedStudent();
      const { body } = await freeze(s.id, day(3), day(4)).expect(201);
      await freeze(s.id, day(8), day(9)).expect(201);
      const res = await call('teacher', 'patch', `/absences/${body.id}`, { endsOn: day(8) }).expect(409);
      expect(res.body.code).toBe('ABSENCE_OVERLAP');
    });

    it('a started absence: the start cannot move, the end can be shortened down to today', async () => {
      const s = await seedStudent();
      const { body } = await freeze(s.id, day(0), day(5)).expect(201);
      await call('teacher', 'patch', `/absences/${body.id}`, { startsOn: day(1) }).expect(409);
      await call('teacher', 'patch', `/absences/${body.id}`, { endsOn: day(-1) }).expect(400);
      await call('teacher', 'patch', `/absences/${body.id}`, { endsOn: day(0) }).expect(200);
    });

    it('404 for an unknown id', async () => {
      await call('teacher', 'patch', `/absences/${randomUUID()}`, { endsOn: day(3) }).expect(404);
    });
  });

  describe('delete', () => {
    it('a future absence is deleted and all its lessons come back', async () => {
      const s = await seedStudent();
      const l1 = await seedLesson({ studentId: s.id, startsAt: at(3) });
      const l2 = await seedLesson({ studentId: s.id, startsAt: at(4) });
      const { body } = await freeze(s.id, day(3), day(4)).expect(201);

      const res = await call('teacher', 'delete', `/absences/${body.id}`).expect(200);
      expect(res.body).toEqual({ warnings: [] });
      expect(await prisma.absence.findUnique({ where: { id: body.id } })).toBeNull();
      for (const l of [l1, l2]) expect(await reload(l.id)).toMatchObject({ status: 'SCHEDULED', absenceId: null });
    });

    it('409 for a started absence', async () => {
      const s = await seedStudent();
      const { body } = await freeze(s.id, day(0), day(3)).expect(201);
      await call('teacher', 'delete', `/absences/${body.id}`).expect(409);
    });

    it('404 for an unknown id', async () => {
      await call('teacher', 'delete', `/absences/${randomUUID()}`).expect(404);
    });
  });

  describe('restore rule', () => {
    it('a lesson whose time is now busy stays cancelled: OVERLAP', async () => {
      const s = await seedStudent();
      const other = await seedStudent();
      const l = await seedLesson({ studentId: s.id, startsAt: at(3) });
      const { body } = await freeze(s.id, day(3), day(3)).expect(201);
      await seedLesson({ studentId: other.id, startsAt: at(3, '10:30') });

      const res = await call('teacher', 'delete', `/absences/${body.id}`).expect(200);
      expect(res.body.warnings).toEqual([{ code: 'ABSENCE_LESSON_NOT_RESTORED', lessonId: l.id, reason: 'OVERLAP' }]);
      expect(await reload(l.id)).toMatchObject({ status: 'CANCELLED' });
    });

    it('a lesson inside another active absence stays cancelled and moves its link there: ABSENCE', async () => {
      const s = await seedStudent();
      const l = await seedLesson({ studentId: s.id, startsAt: at(3) });
      const freezeRes = await freeze(s.id, day(3), day(4)).expect(201);
      const vac = await vacation(teacher.id, day(2), day(3)).expect(201);

      const res = await call('teacher', 'delete', `/absences/${freezeRes.body.id}`).expect(200);
      expect(res.body.warnings).toEqual([{ code: 'ABSENCE_LESSON_NOT_RESTORED', lessonId: l.id, reason: 'ABSENCE' }]);
      expect(await reload(l.id)).toMatchObject({ status: 'CANCELLED', absenceId: vac.body.id });

      await call('teacher', 'delete', `/absences/${vac.body.id}`).expect(200);
      expect(await reload(l.id)).toMatchObject({ status: 'SCHEDULED', absenceId: null });
    });

    it('a hand-changed lesson is not restored automatically: MANUAL', async () => {
      const s = await seedStudent();
      const l = await seedLesson({ studentId: s.id, startsAt: at(3), manuallyChanged: true });
      const { body } = await freeze(s.id, day(3), day(3)).expect(201);

      const res = await call('teacher', 'delete', `/absences/${body.id}`).expect(200);
      expect(res.body.warnings).toEqual([{ code: 'ABSENCE_LESSON_NOT_RESTORED', lessonId: l.id, reason: 'MANUAL' }]);
      expect(await reload(l.id)).toMatchObject({ status: 'CANCELLED' });
    });
  });

  describe('series generator', () => {
    async function createSeries(studentId: string, firstSlot: string) {
      return call('teacher', 'post', '/lesson-series', {
        studentId, weekday: isoWeekday(firstSlot), startTime: '10:00', durationMin: 60, startsOn: today(),
      }).expect(201);
    }
    const seriesLessons = (seriesId: string) =>
      prisma.lesson.findMany({ where: { seriesId }, orderBy: { originalDate: 'asc' } });
    const ymd = (d: Date | null) => d!.toISOString().slice(0, 10);

    it('skips dates inside an active absence without a SeriesSkip, and fills them after the absence is shortened', async () => {
      const s = await seedStudent();
      const { body: absence } = await freeze(s.id, day(1), day(8)).expect(201);
      const series = await createSeries(s.id, day(1));

      const dates = (await seriesLessons(series.body.id)).map((l) => ymd(l.originalDate));
      expect(dates).not.toContain(day(1));
      expect(dates).not.toContain(day(8));
      expect(await prisma.seriesSkip.count({ where: { seriesId: series.body.id } })).toBe(0);

      await call('teacher', 'patch', `/absences/${absence.id}`, { endsOn: day(2) }).expect(200);
      const after = await seriesLessons(series.body.id);
      expect(after.find((l) => ymd(l.originalDate) === day(8))).toMatchObject({ status: 'SCHEDULED' });
      expect(after.some((l) => ymd(l.originalDate) === day(1))).toBe(false);
    });

    it('skips dates inside a teacher vacation', async () => {
      const s = await seedStudent();
      await vacation(teacher.id, day(1), day(1)).expect(201);
      const series = await createSeries(s.id, day(1));
      const dates = (await seriesLessons(series.body.id)).map((l) => ymd(l.originalDate));
      expect(dates).not.toContain(day(1));
      expect(dates).toContain(day(8));
    });
  });

  describe('manual back to schedule', () => {
    const back = (id: string, extra: object = {}) =>
      call('teacher', 'post', `/lessons/${id}/status`, { status: 'SCHEDULED', ...extra });

    it('409 LESSON_RESTORE_CONFLICT inside an active absence, then force restores and unlinks', async () => {
      const s = await seedStudent();
      const l = await seedLesson({ studentId: s.id, startsAt: at(3) });
      const { body: absence } = await freeze(s.id, day(3), day(4)).expect(201);

      const res = await back(l.id).expect(409);
      expect(res.body).toMatchObject({
        code: 'LESSON_RESTORE_CONFLICT',
        absence: { id: absence.id, kind: 'STUDENT_FREEZE', startsOn: day(3), endsOn: day(4) },
        overlaps: [],
      });

      await back(l.id, { force: true }).expect(200);
      expect(await reload(l.id)).toMatchObject({ status: 'SCHEDULED', absenceId: null, manuallyChanged: true });
    });

    it('409 LESSON_RESTORE_CONFLICT when the time is busy, with absence null', async () => {
      const s = await seedStudent();
      const other = await seedStudent();
      const l = await seedLesson({ studentId: s.id, startsAt: at(3), status: 'CANCELLED' });
      const busy = await seedLesson({ studentId: other.id, startsAt: at(3, '10:30') });

      const res = await back(l.id).expect(409);
      expect(res.body).toMatchObject({ code: 'LESSON_RESTORE_CONFLICT', absence: null });
      expect(res.body.overlaps.map((o: { id: string }) => o.id)).toEqual([busy.id]);
    });

    it('a free cancelled lesson outside absences goes back without force', async () => {
      const s = await seedStudent();
      const l = await seedLesson({ studentId: s.id, startsAt: at(3), status: 'CANCELLED' });
      await back(l.id).expect(200);
    });
  });
});
