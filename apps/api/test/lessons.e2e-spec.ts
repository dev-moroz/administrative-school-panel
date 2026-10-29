import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { LessonsService } from '../src/lessons/lessons.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

// Every student created here starts with TAG, so the cleanup never touches other data.
const TAG = `e2e${Date.now().toString(36)}`;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Lessons of one teacher must not overlap, so each default slot gets its own 6-hour window.
const FREE_BASE = Date.now() + 40 * DAY;

const LESSON_KEYS = [
  'id', 'startsAt', 'durationMin', 'status', 'charged', 'cancelledAt', 'cancelReason',
  'comment', 'notes', 'student', 'teacher', 'seriesId', 'originalDate', 'manuallyChanged', 'createdAt', 'updatedAt',
];

describe('lessons (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let lessons: LessonsService;
  let teacher: { id: string };
  const cookies: Partial<Record<Actor, string>> = {};
  let counter = 0;
  let slots = 0;
  const slot = () => new Date(FREE_BASE + (slots += 1) * 6 * HOUR);

  function call(actor: Actor, method: Method, path: string, body?: object) {
    const req = request(server)[method](path).set('Origin', TEST_ORIGIN);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    return body === undefined ? req : req.send(body);
  }

  async function seedStudent(isActive = true) {
    counter += 1;
    return prisma.student.create({
      data: { fullName: `${TAG} student ${counter}`, isActive, teachers: { create: { teacherId: teacher.id } } },
    });
  }

  async function seedLesson(opts: { startsAt?: Date; durationMin?: number; status?: string; charged?: boolean; studentId?: string } = {}) {
    const studentId = opts.studentId ?? (await seedStudent()).id;
    const lesson = await prisma.lesson.create({
      data: {
        teacherId: teacher.id,
        startsAt: opts.startsAt ?? slot(),
        durationMin: opts.durationMin ?? 60,
        status: (opts.status ?? 'SCHEDULED') as never,
        charged: opts.charged ?? false,
        participants: { create: { studentId } },
      },
    });
    return { lesson, studentId };
  }

  const entriesOf = (lessonId: string) =>
    prisma.ledgerEntry.findMany({ where: { lessonId }, orderBy: { createdAt: 'asc' } });
  const sumOf = async (lessonId: string) => (await entriesOf(lessonId)).reduce((s, e) => s + e.delta, 0);

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    lessons = app.get(LessonsService);

    teacher = await ensureTeacher(app, 'lessons-teacher@e2e.test', 'Lessons Teacher');
    await ensureUser(app, 'lessons-student@e2e.test', 'student');
    await ensureUser(app, 'lessons-admin@e2e.test', 'admin');

    cookies.teacher = await loginAs(app, 'lessons-teacher@e2e.test');
    cookies.student = await loginAs(app, 'lessons-student@e2e.test');
    cookies.admin = await loginAs(app, 'lessons-admin@e2e.test');
  });

  afterAll(async () => {
    const where = { participants: { some: { student: { fullName: { startsWith: TAG } } } } };
    await prisma.ledgerEntry.deleteMany({ where: { student: { fullName: { startsWith: TAG } } } });
    await prisma.lesson.deleteMany({ where });
    await prisma.student.deleteMany({ where: { fullName: { startsWith: TAG } } });
    await app.close();
  });

  describe('role x endpoint matrix', () => {
    const MATRIX: {
      name: string;
      expected: Record<Actor, number>;
      run: (actor: Actor) => PromiseLike<{ status: number }>;
    }[] = [
      {
        name: 'GET /lessons',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: (actor) => {
          const from = new Date().toISOString();
          const to = new Date(Date.now() + 7 * DAY).toISOString();
          return call(actor, 'get', `/lessons?from=${from}&to=${to}`);
        },
      },
      {
        name: 'GET /lessons/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/lessons/${(await seedLesson()).lesson.id}`),
      },
      {
        name: 'POST /lessons',
        expected: { anonymous: 401, student: 403, teacher: 201, admin: 201 },
        run: async (actor) =>
          call(actor, 'post', '/lessons', {
            studentId: (await seedStudent()).id,
            startsAt: slot().toISOString(),
            durationMin: 60,
          }),
      },
      {
        name: 'PATCH /lessons/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'patch', `/lessons/${(await seedLesson()).lesson.id}`, { notes: 'n' }),
      },
      {
        name: 'POST /lessons/:id/status',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) =>
          call(actor, 'post', `/lessons/${(await seedLesson()).lesson.id}/status`, {
            status: 'CANCELLED',
            reason: 'STUDENT_ILL',
          }),
      },
      {
        name: 'GET /lessons/:id/cancel-preview',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/lessons/${(await seedLesson()).lesson.id}/cancel-preview`),
      },
      {
        name: 'DELETE /lessons/:id',
        expected: { anonymous: 401, student: 403, teacher: 204, admin: 204 },
        run: async (actor) => call(actor, 'delete', `/lessons/${(await seedLesson()).lesson.id}`),
      },
      {
        name: 'GET /cancel-reasons',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: (actor) => call(actor, 'get', '/cancel-reasons'),
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

  describe('GET /cancel-reasons', () => {
    it('returns the active seeded reasons as { code, name }', async () => {
      const res = await call('teacher', 'get', '/cancel-reasons').expect(200);
      const codes = res.body.map((r: { code: string }) => r.code);
      expect(codes).toEqual(
        expect.arrayContaining(['TEACHER_VACATION', 'STUDENT_ILL', 'STUDENT_REQUEST', 'TEACHER_REQUEST', 'CHARGED_BY_MISTAKE', 'OTHER']),
      );
      for (const r of res.body) expect(Object.keys(r).sort()).toEqual(['code', 'name']);
    });
  });

  describe('POST /lessons', () => {
    it('creates a scheduled lesson for the student and their teacher', async () => {
      const student = await seedStudent();
      const startsAt = slot().toISOString();
      const res = await call('teacher', 'post', '/lessons', { studentId: student.id, startsAt, durationMin: 45, notes: 'unit 3' }).expect(201);

      expect(Object.keys(res.body).sort()).toEqual([...LESSON_KEYS].sort());
      expect(res.body).toMatchObject({
        startsAt,
        durationMin: 45,
        status: 'SCHEDULED',
        charged: false,
        cancelledAt: null,
        cancelReason: null,
        seriesId: null,
        originalDate: null,
        manuallyChanged: false,
        notes: 'unit 3',
        student: { id: student.id, fullName: student.fullName },
        teacher: { id: teacher.id, fullName: 'Lessons Teacher' },
      });
      expect(await prisma.lessonParticipant.count({ where: { lessonId: res.body.id, studentId: student.id } })).toBe(1);
      expect(await entriesOf(res.body.id)).toHaveLength(0);
    });

    it.each([
      ['durationMin below 15', { durationMin: 10 }],
      ['durationMin above 240', { durationMin: 300 }],
      ['invalid startsAt', { startsAt: 'tomorrow' }],
      ['unknown field', { status: 'COMPLETED' }],
    ])('400 on %s', async (_name, patch) => {
      const student = await seedStudent();
      await call('teacher', 'post', '/lessons', {
        studentId: student.id,
        startsAt: new Date(Date.now() + DAY).toISOString(),
        durationMin: 60,
        ...patch,
      }).expect(400);
    });

    it('400 for an inactive student', async () => {
      const student = await seedStudent(false);
      await call('teacher', 'post', '/lessons', {
        studentId: student.id,
        startsAt: new Date(Date.now() + DAY).toISOString(),
        durationMin: 60,
      }).expect(400);
    });

    it('404 for an unknown student', async () => {
      await call('teacher', 'post', '/lessons', {
        studentId: randomUUID(),
        startsAt: new Date(Date.now() + DAY).toISOString(),
        durationMin: 60,
      }).expect(404);
    });
  });

  describe('GET /lessons', () => {
    it('returns lessons in [from, to) filtered by student, ordered by startsAt', async () => {
      const student = await seedStudent();
      const base = Date.now() + 10 * DAY;
      const late = await seedLesson({ studentId: student.id, startsAt: new Date(base + 2 * HOUR) });
      const early = await seedLesson({ studentId: student.id, startsAt: new Date(base) });
      await seedLesson({ studentId: student.id, startsAt: new Date(base + 5 * DAY) });
      await seedLesson({ startsAt: new Date(base + HOUR) });

      const from = new Date(base - HOUR).toISOString();
      const to = new Date(base + DAY).toISOString();
      const res = await call('teacher', 'get', `/lessons?from=${from}&to=${to}&studentId=${student.id}`).expect(200);
      expect(res.body.map((l: { id: string }) => l.id)).toEqual([early.lesson.id, late.lesson.id]);
    });

    it.each([
      ['missing from/to', ''],
      ['range over 62 days', `?from=2026-01-01T00:00:00Z&to=2026-03-05T00:00:00Z`],
      ['to before from', `?from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z`],
    ])('400 on %s', async (_name, qs) => {
      await call('teacher', 'get', `/lessons${qs}`).expect(400);
    });
  });

  describe('GET /lessons/:id', () => {
    it('404 for an unknown lesson', async () => {
      await call('teacher', 'get', `/lessons/${randomUUID()}`).expect(404);
    });
  });

  describe('PATCH /lessons/:id', () => {
    it('reschedules a scheduled lesson and updates notes', async () => {
      const { lesson } = await seedLesson();
      const startsAt = slot().toISOString();
      const res = await call('teacher', 'patch', `/lessons/${lesson.id}`, { startsAt, durationMin: 90, notes: 'moved' }).expect(200);
      expect(res.body).toMatchObject({ startsAt, durationMin: 90, notes: 'moved', status: 'SCHEDULED' });
    });

    it('409 when moving a lesson that is not scheduled', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - DAY), status: 'COMPLETED', charged: true });
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { startsAt: new Date(Date.now() + DAY).toISOString() }).expect(409);
    });

    it('allows notes on a lesson that is not scheduled', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - DAY), status: 'COMPLETED', charged: true });
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { notes: 'went well' }).expect(200);
    });
  });

  describe('completeDue (automatic charge)', () => {
    it('completes ended scheduled lessons and charges each once, by System', async () => {
      const ended = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR), durationMin: 60 });
      const running = await seedLesson({ startsAt: new Date(Date.now() - 30 * 60_000), durationMin: 60 });
      const cancelled = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR), status: 'CANCELLED' });

      await lessons.completeDue(new Date());

      const after = await prisma.lesson.findUniqueOrThrow({ where: { id: ended.lesson.id } });
      expect(after).toMatchObject({ status: 'COMPLETED', charged: true });
      const entries = await entriesOf(ended.lesson.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ type: 'LESSON_CHARGE', delta: -1, studentId: ended.studentId, createdById: null });

      expect((await prisma.lesson.findUniqueOrThrow({ where: { id: running.lesson.id } })).status).toBe('SCHEDULED');
      expect(await entriesOf(running.lesson.id)).toHaveLength(0);
      expect(await entriesOf(cancelled.lesson.id)).toHaveLength(0);
    });

    it('is a no-op on a repeated and on a concurrent run', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR) });
      const now = new Date();
      await Promise.all([lessons.completeDue(now), lessons.completeDue(now)]);
      await lessons.completeDue(now);
      expect(await entriesOf(lesson.id)).toHaveLength(1);
    });

    it('the System charge is shown in the ledger history with createdBy null', async () => {
      const { lesson, studentId } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR) });
      await lessons.completeDue(new Date());
      const res = await call('teacher', 'get', `/students/${studentId}/ledger`).expect(200);
      expect(res.body.items[0]).toMatchObject({ type: 'LESSON_CHARGE', delta: -1, createdBy: null });
      expect(await sumOf(lesson.id)).toBe(-1);
    });

    it('lets the balance go negative', async () => {
      const { studentId } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR) });
      await lessons.completeDue(new Date());
      const res = await call('teacher', 'get', `/students/${studentId}/balance`).expect(200);
      expect(res.body).toEqual({ balance: -1, isDebt: true });
    });
  });

  describe('POST /lessons/:id/status', () => {
    const status = (id: string, body: object, actor: Actor = 'teacher') => call(actor, 'post', `/lessons/${id}/status`, body);

    it('cancelling far ahead is not charged by default and writes nothing', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() + 3 * DAY) });
      const res = await status(lesson.id, { status: 'CANCELLED', reason: 'STUDENT_ILL', comment: 'flu' }).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', charged: false, comment: 'flu', cancelReason: { code: 'STUDENT_ILL' } });
      expect(res.body.cancelledAt).not.toBeNull();
      expect(await entriesOf(lesson.id)).toHaveLength(0);
    });

    it('a late cancellation is charged by default (policy)', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() + 20 * 60_000) });
      const res = await status(lesson.id, { status: 'CANCELLED', reason: 'STUDENT_REQUEST' }).expect(200);
      expect(res.body.charged).toBe(true);
      expect(await sumOf(lesson.id)).toBe(-1);
    });

    it('an explicit charged overrides the suggestion', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() + 20 * 60_000) });
      await status(lesson.id, { status: 'CANCELLED', reason: 'STUDENT_REQUEST', charged: false }).expect(200);
      expect(await entriesOf(lesson.id)).toHaveLength(0);
    });

    it('no-show is charged by default', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 10 * 60_000) });
      const res = await status(lesson.id, { status: 'NO_SHOW' }).expect(200);
      expect(res.body).toMatchObject({ status: 'NO_SHOW', charged: true });
      expect(await sumOf(lesson.id)).toBe(-1);
    });

    it('retroactive cancel of a completed lesson writes LESSON_REVERSAL (not charged by default)', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR) });
      await lessons.completeDue(new Date());
      const res = await status(lesson.id, { status: 'CANCELLED', reason: 'CHARGED_BY_MISTAKE' }).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', charged: false });
      const entries = await entriesOf(lesson.id);
      expect(entries.map((e) => [e.type, e.delta])).toEqual([['LESSON_CHARGE', -1], ['LESSON_REVERSAL', 1]]);
      expect(entries[1].createdById).not.toBeNull();
    });

    it('toggling charged back and forth keeps the invariant', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 10 * 60_000) });
      await status(lesson.id, { status: 'NO_SHOW', charged: true }).expect(200);
      expect(await sumOf(lesson.id)).toBe(-1);
      await status(lesson.id, { status: 'NO_SHOW', charged: true }).expect(200);
      expect(await entriesOf(lesson.id)).toHaveLength(1);
      await status(lesson.id, { status: 'NO_SHOW', charged: false }).expect(200);
      expect(await sumOf(lesson.id)).toBe(0);
      await status(lesson.id, { status: 'CANCELLED', reason: 'OTHER', charged: true }).expect(200);
      expect(await sumOf(lesson.id)).toBe(-1);
      expect(await entriesOf(lesson.id)).toHaveLength(3);
    });

    it('back to SCHEDULED before the end reverses a charge and clears the cancellation', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() + 20 * 60_000) });
      await status(lesson.id, { status: 'CANCELLED', reason: 'STUDENT_REQUEST', charged: true }).expect(200);
      const res = await status(lesson.id, { status: 'SCHEDULED' }).expect(200);
      expect(res.body).toMatchObject({ status: 'SCHEDULED', charged: false, cancelledAt: null, cancelReason: null });
      expect(await sumOf(lesson.id)).toBe(0);
    });

    it('409 back to SCHEDULED after the lesson ended', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR), status: 'CANCELLED' });
      await status(lesson.id, { status: 'SCHEDULED' }).expect(409);
    });

    it('409 on setting COMPLETED by hand', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR) });
      await status(lesson.id, { status: 'COMPLETED' }).expect(409);
    });

    it('400 when cancelling without a reason or with an unknown reason', async () => {
      const { lesson } = await seedLesson();
      await status(lesson.id, { status: 'CANCELLED' }).expect(400);
      await status(lesson.id, { status: 'CANCELLED', reason: 'NOPE' }).expect(400);
    });

    it('404 for an unknown lesson', async () => {
      await status(randomUUID(), { status: 'NO_SHOW' }).expect(404);
    });

    it('concurrent requests produce a single charge', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 10 * 60_000) });
      await Promise.all(Array.from({ length: 5 }, () => status(lesson.id, { status: 'NO_SHOW', charged: true })));
      expect(await entriesOf(lesson.id)).toHaveLength(1);
      expect(await sumOf(lesson.id)).toBe(-1);
    });
  });

  describe('GET /lessons/:id/cancel-preview', () => {
    it('suggests charging a late cancellation', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() + 20 * 60_000) });
      const res = await call('teacher', 'get', `/lessons/${lesson.id}/cancel-preview`).expect(200);
      expect(res.body).toEqual({ suggestedCharged: true });
    });

    it('suggests not charging a cancellation days ahead', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() + 3 * DAY) });
      const res = await call('teacher', 'get', `/lessons/${lesson.id}/cancel-preview`).expect(200);
      expect(res.body).toEqual({ suggestedCharged: false });
    });

    it('suggests not charging a retroactive cancel of a completed lesson', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR), status: 'COMPLETED', charged: true });
      const res = await call('teacher', 'get', `/lessons/${lesson.id}/cancel-preview`).expect(200);
      expect(res.body).toEqual({ suggestedCharged: false });
    });
  });

  describe('manuallyChanged flag', () => {
    const flagOf = async (id: string) => (await prisma.lesson.findUniqueOrThrow({ where: { id } })).manuallyChanged;
    const status = (id: string, body: object) => call('teacher', 'post', `/lessons/${id}/status`, body);

    it('moving a lesson sets the flag', async () => {
      const { lesson } = await seedLesson();
      const res = await call('teacher', 'patch', `/lessons/${lesson.id}`, {
        startsAt: new Date(lesson.startsAt.getTime() + HOUR).toISOString(),
      }).expect(200);
      expect(res.body.manuallyChanged).toBe(true);
      expect(await flagOf(lesson.id)).toBe(true);
    });

    it('changing the duration sets the flag', async () => {
      const { lesson } = await seedLesson();
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { durationMin: 90 }).expect(200);
      expect(await flagOf(lesson.id)).toBe(true);
    });

    it('editing only notes does not set the flag', async () => {
      const { lesson } = await seedLesson();
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { notes: 'unit 4' }).expect(200);
      expect(await flagOf(lesson.id)).toBe(false);
    });

    it('sending the same start and duration does not set the flag', async () => {
      const { lesson } = await seedLesson();
      await call('teacher', 'patch', `/lessons/${lesson.id}`, {
        startsAt: lesson.startsAt.toISOString(),
        durationMin: lesson.durationMin,
      }).expect(200);
      expect(await flagOf(lesson.id)).toBe(false);
    });

    it('cancelling sets the flag and going back to scheduled keeps it', async () => {
      const { lesson } = await seedLesson();
      const res = await status(lesson.id, { status: 'CANCELLED', reason: 'STUDENT_ILL' }).expect(200);
      expect(res.body.manuallyChanged).toBe(true);
      await status(lesson.id, { status: 'SCHEDULED' }).expect(200);
      expect(await flagOf(lesson.id)).toBe(true);
    });

    it('no-show sets the flag', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 10 * 60_000) });
      await status(lesson.id, { status: 'NO_SHOW' }).expect(200);
      expect(await flagOf(lesson.id)).toBe(true);
    });

    it('the automatic charge does not set the flag', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR) });
      await lessons.completeDue(new Date());
      expect(await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).toMatchObject({
        status: 'COMPLETED',
        manuallyChanged: false,
      });
    });
  });

  describe('overlaps', () => {
    const MIN = 60_000;
    const create = (studentId: string, startsAt: Date, durationMin = 60, extra: object = {}) =>
      call('teacher', 'post', '/lessons', { studentId, startsAt: startsAt.toISOString(), durationMin, ...extra });

    it('409 LESSON_OVERLAP with the conflicting lessons, nothing created', async () => {
      const { lesson, studentId: busyStudent } = await seedLesson();
      const student = await seedStudent();
      const res = await create(student.id, new Date(lesson.startsAt.getTime() + 30 * MIN)).expect(409);
      expect(res.body.code).toBe('LESSON_OVERLAP');
      expect(res.body.overlaps).toHaveLength(1);
      expect(res.body.overlaps[0]).toMatchObject({
        id: lesson.id,
        startsAt: lesson.startsAt.toISOString(),
        durationMin: 60,
        student: { id: busyStudent },
      });
      expect(await prisma.lesson.count({ where: { participants: { some: { studentId: student.id } } } })).toBe(0);
    });

    it('creates anyway with force: true', async () => {
      const { lesson } = await seedLesson();
      const student = await seedStudent();
      await create(student.id, lesson.startsAt, 60, { force: true }).expect(201);
    });

    it('back-to-back lessons do not conflict', async () => {
      const { lesson } = await seedLesson();
      const student = await seedStudent();
      await create(student.id, new Date(lesson.startsAt.getTime() + 60 * MIN)).expect(201);
      await create(student.id, new Date(lesson.startsAt.getTime() - 45 * MIN), 45).expect(201);
    });

    it('a lesson inside a longer one conflicts', async () => {
      const { lesson } = await seedLesson({ durationMin: 120 });
      const student = await seedStudent();
      await create(student.id, new Date(lesson.startsAt.getTime() + 30 * MIN), 30).expect(409);
    });

    it('a cancelled lesson does not occupy time', async () => {
      const { lesson } = await seedLesson({ status: 'CANCELLED' });
      const student = await seedStudent();
      await create(student.id, lesson.startsAt).expect(201);
    });

    it.each(['COMPLETED', 'NO_SHOW'])('a %s lesson occupies time', async (status) => {
      const { lesson } = await seedLesson({ status, charged: true });
      const student = await seedStudent();
      await create(student.id, lesson.startsAt).expect(409);
    });

    it("another teacher's lesson does not conflict", async () => {
      const other = await ensureTeacher(app, 'lessons-other-teacher@e2e.test', 'Other Teacher');
      const otherStudent = await seedStudent();
      const startsAt = slot();
      await prisma.lesson.create({
        data: { teacherId: other.id, startsAt, durationMin: 60, participants: { create: { studentId: otherStudent.id } } },
      });
      const student = await seedStudent();
      await create(student.id, startsAt).expect(201);
    });

    it('moving onto a busy time is 409 and keeps the lesson; force moves it', async () => {
      const { lesson: busy } = await seedLesson();
      const { lesson } = await seedLesson();
      const body = { startsAt: new Date(busy.startsAt.getTime() + 15 * MIN).toISOString() };
      const res = await call('teacher', 'patch', `/lessons/${lesson.id}`, body).expect(409);
      expect(res.body).toMatchObject({ code: 'LESSON_OVERLAP', overlaps: [{ id: busy.id }] });
      expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).startsAt).toEqual(lesson.startsAt);

      await call('teacher', 'patch', `/lessons/${lesson.id}`, { ...body, force: true }).expect(200);
    });

    it('extending the duration into the next lesson is 409', async () => {
      const { lesson } = await seedLesson();
      await seedLesson({ startsAt: new Date(lesson.startsAt.getTime() + 60 * MIN) });
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { durationMin: 90 }).expect(409);
    });

    it('a lesson does not conflict with itself when moved within its own time', async () => {
      const { lesson } = await seedLesson();
      await call('teacher', 'patch', `/lessons/${lesson.id}`, {
        startsAt: new Date(lesson.startsAt.getTime() + 15 * MIN).toISOString(),
      }).expect(200);
    });

    it('editing only notes is not checked even if the lesson already overlaps', async () => {
      const { lesson } = await seedLesson();
      await seedLesson({ startsAt: lesson.startsAt });
      await call('teacher', 'patch', `/lessons/${lesson.id}`, { notes: 'still here' }).expect(200);
    });

    it('400 on a non-boolean force', async () => {
      const student = await seedStudent();
      await create(student.id, slot(), 60, { force: 'yes' }).expect(400);
    });
  });

  describe('DELETE /lessons/:id', () => {
    it('deletes a scheduled lesson without entries', async () => {
      const { lesson } = await seedLesson();
      await call('teacher', 'delete', `/lessons/${lesson.id}`).expect(204);
      expect(await prisma.lesson.findUnique({ where: { id: lesson.id } })).toBeNull();
    });

    it('409 for a lesson that is not scheduled', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() - 2 * HOUR), status: 'CANCELLED' });
      await call('teacher', 'delete', `/lessons/${lesson.id}`).expect(409);
    });

    it('409 for a scheduled lesson that has ledger entries (charged, then back to scheduled)', async () => {
      const { lesson } = await seedLesson({ startsAt: new Date(Date.now() + 20 * 60_000) });
      await call('teacher', 'post', `/lessons/${lesson.id}/status`, { status: 'CANCELLED', reason: 'OTHER', charged: true }).expect(200);
      await call('teacher', 'post', `/lessons/${lesson.id}/status`, { status: 'SCHEDULED' }).expect(200);
      await call('teacher', 'delete', `/lessons/${lesson.id}`).expect(409);
    });

    it('404 for an unknown lesson', async () => {
      await call('teacher', 'delete', `/lessons/${randomUUID()}`).expect(404);
    });
  });
});
