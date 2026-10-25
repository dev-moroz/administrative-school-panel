import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

// Every record created here starts with TAG, so the cleanup never touches other data.
const TAG = `e2e${Date.now().toString(36)}`;
const ADMIN_EMAIL = 'ledger-admin@e2e.test';

const BALANCE_KEYS = ['balance', 'isDebt'];
const ENTRY_KEYS = ['id', 'delta', 'type', 'comment', 'createdAt', 'createdBy'];

describe('ledger (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let teacher: { id: string };
  let adminId: string;
  const cookies: Partial<Record<Actor, string>> = {};
  let counter = 0;

  function call(actor: Actor, method: Method, path: string, body?: object) {
    const req = request(server)[method](path).set('Origin', TEST_ORIGIN);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    return body === undefined ? req : req.send(body);
  }

  async function seedStudent() {
    counter += 1;
    return prisma.student.create({
      data: { fullName: `${TAG} seed ${counter}`, teachers: { create: { teacherId: teacher.id } } },
    });
  }

  // Direct DB insert, the way payments and lessons will write later.
  async function seedEntry(studentId: string, delta: number, type = 'MANUAL_ADJUSTMENT', comment: string | null = 'seed') {
    return prisma.ledgerEntry.create({
      data: { studentId, delta, type: type as never, comment, createdById: adminId },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    teacher = await ensureTeacher(app, 'ledger-teacher@e2e.test', 'Ledger Teacher');
    await ensureUser(app, 'ledger-student@e2e.test', 'student');
    await ensureUser(app, ADMIN_EMAIL, 'admin');
    adminId = (await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })).id;

    cookies.teacher = await loginAs(app, 'ledger-teacher@e2e.test');
    cookies.student = await loginAs(app, 'ledger-student@e2e.test');
    cookies.admin = await loginAs(app, ADMIN_EMAIL);
  });

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { student: { fullName: { startsWith: TAG } } } });
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
        name: 'GET /students/:id/balance',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/students/${(await seedStudent()).id}/balance`),
      },
      {
        name: 'GET /students/:id/ledger',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/students/${(await seedStudent()).id}/ledger`),
      },
      {
        name: 'POST /students/:id/ledger/adjustments',
        expected: { anonymous: 401, student: 403, teacher: 403, admin: 201 },
        run: async (actor) =>
          call(actor, 'post', `/students/${(await seedStudent()).id}/ledger/adjustments`, {
            delta: 1,
            comment: 'matrix',
          }),
      },
    ];

    describe.each(MATRIX)('$name', (row) => {
      it.each(ACTORS)('%s', async (actor) => {
        const res = await row.run(actor);
        expect(res.status).toBe(row.expected[actor]);
      });
    });

    it('a forbidden adjustment writes nothing', async () => {
      const student = await seedStudent();
      await call('teacher', 'post', `/students/${student.id}/ledger/adjustments`, { delta: 1, comment: 'x' }).expect(403);
      expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(0);
    });

    it('checks permissions before looking up the student (401/403 before 404)', async () => {
      const id = randomUUID();
      await call('anonymous', 'get', `/students/${id}/balance`).expect(401);
      await call('student', 'get', `/students/${id}/balance`).expect(403);
      await call('teacher', 'get', `/students/${id}/balance`).expect(404);
    });

    it('the seed gives the teacher role balance.read but not balance.adjust', async () => {
      const keys = (
        await prisma.rolePermission.findMany({
          where: { role: { name: 'teacher' }, permission: { key: { startsWith: 'balance.' } } },
          select: { permission: { select: { key: true } } },
        })
      ).map((r) => r.permission.key);

      expect(keys).toEqual(['balance.read']);
    });
  });

  describe('balance', () => {
    it('is 0 and not a debt for a student without entries', async () => {
      const student = await seedStudent();
      const res = await call('teacher', 'get', `/students/${student.id}/balance`).expect(200);

      expect(Object.keys(res.body).sort()).toEqual([...BALANCE_KEYS].sort());
      expect(res.body).toEqual({ balance: 0, isDebt: false });
    });

    it('is SUM(delta) over all entry types', async () => {
      const student = await seedStudent();
      await seedEntry(student.id, 8, 'PURCHASE', null);
      await seedEntry(student.id, -1, 'LESSON_CHARGE', null);
      await seedEntry(student.id, -1, 'LESSON_CHARGE', null);
      await seedEntry(student.id, 1, 'LESSON_REVERSAL', null);

      const res = await call('teacher', 'get', `/students/${student.id}/balance`).expect(200);
      expect(res.body).toEqual({ balance: 7, isDebt: false });
    });

    it('can go negative and is shown as a debt', async () => {
      const student = await seedStudent();
      await call('admin', 'post', `/students/${student.id}/ledger/adjustments`, { delta: 5, comment: 'first' }).expect(201);
      await call('admin', 'post', `/students/${student.id}/ledger/adjustments`, { delta: -8, comment: 'second' }).expect(201);

      const res = await call('admin', 'get', `/students/${student.id}/balance`).expect(200);
      expect(res.body).toEqual({ balance: -3, isDebt: true });
    });

    it('counts only the requested student', async () => {
      const a = await seedStudent();
      const b = await seedStudent();
      await seedEntry(a.id, 4);
      await seedEntry(b.id, 9);

      const res = await call('teacher', 'get', `/students/${a.id}/balance`).expect(200);
      expect(res.body.balance).toBe(4);
    });

    it('404 for an unknown student; 400 for a bad uuid', async () => {
      await call('teacher', 'get', `/students/${randomUUID()}/balance`).expect(404);
      await call('teacher', 'get', '/students/not-a-uuid/balance').expect(400);
    });
  });

  describe('adjustment', () => {
    it('admin: creates a MANUAL_ADJUSTMENT; response goes through the DTO; createdBy is the session user', async () => {
      const student = await seedStudent();
      const res = await call('admin', 'post', `/students/${student.id}/ledger/adjustments`, {
        delta: 2,
        comment: '  compensation  ',
      }).expect(201);

      expect(Object.keys(res.body).sort()).toEqual([...ENTRY_KEYS].sort());
      expect(res.body).toMatchObject({ delta: 2, type: 'MANUAL_ADJUSTMENT', comment: 'compensation' });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);

      const row = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.createdById).toBe(adminId);
      expect(row.studentId).toBe(student.id);
    });

    it('createdById and type in the body are ignored or rejected, never trusted', async () => {
      const student = await seedStudent();
      const res = await call('admin', 'post', `/students/${student.id}/ledger/adjustments`, {
        delta: 1,
        comment: 'x',
        type: 'PURCHASE',
        createdById: randomUUID(),
      });

      if (res.status === 201) {
        const row = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: res.body.id } });
        expect(row.type).toBe('MANUAL_ADJUSTMENT');
        expect(row.createdById).toBe(adminId);
      } else {
        expect(res.status).toBe(400);
        expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(0);
      }
    });

    it.each([
      ['no comment', { delta: 1 }],
      ['empty comment', { delta: 1, comment: '' }],
      ['whitespace comment', { delta: 1, comment: '   ' }],
      ['no delta', { comment: 'x' }],
      ['delta as a string', { delta: '1', comment: 'x' }],
      ['delta 0', { delta: 0, comment: 'x' }],
      ['fractional delta', { delta: 1.5, comment: 'x' }],
      ['delta 51', { delta: 51, comment: 'x' }],
      ['delta -51', { delta: -51, comment: 'x' }],
      ['comment too long', { delta: 1, comment: 'x'.repeat(1001) }],
    ])('400 and nothing is written: %s', async (_label, body) => {
      const student = await seedStudent();
      await call('admin', 'post', `/students/${student.id}/ledger/adjustments`, body).expect(400);
      expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(0);
    });

    it('accepts the limit: +50 and -50', async () => {
      const student = await seedStudent();
      await call('admin', 'post', `/students/${student.id}/ledger/adjustments`, { delta: 50, comment: 'x' }).expect(201);
      await call('admin', 'post', `/students/${student.id}/ledger/adjustments`, { delta: -50, comment: 'x' }).expect(201);
    });

    it('404 for an unknown student; 400 for a bad uuid', async () => {
      await call('admin', 'post', `/students/${randomUUID()}/ledger/adjustments`, { delta: 1, comment: 'x' }).expect(404);
      await call('admin', 'post', '/students/not-a-uuid/ledger/adjustments', { delta: 1, comment: 'x' }).expect(400);
    });
  });

  describe('history', () => {
    it('lists entries newest first with the paged shape and DTO fields only', async () => {
      const student = await seedStudent();
      await seedEntry(student.id, 8, 'PURCHASE', null);
      await new Promise((r) => setTimeout(r, 5));
      await seedEntry(student.id, -1, 'LESSON_CHARGE', null);
      await new Promise((r) => setTimeout(r, 5));
      await seedEntry(student.id, 1, 'MANUAL_ADJUSTMENT', 'fix');

      const res = await call('teacher', 'get', `/students/${student.id}/ledger`).expect(200);

      expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
      expect(res.body.items.map((e: { delta: number }) => e.delta)).toEqual([1, -1, 8]);
      for (const item of res.body.items) {
        expect(Object.keys(item).sort()).toEqual([...ENTRY_KEYS].sort());
      }
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    });

    it('paginates and caps pageSize at 100', async () => {
      const student = await seedStudent();
      for (let i = 1; i <= 5; i += 1) await seedEntry(student.id, i);

      const page2 = await call('teacher', 'get', `/students/${student.id}/ledger?page=2&pageSize=2`).expect(200);
      expect(page2.body).toMatchObject({ total: 5, page: 2, pageSize: 2 });
      expect(page2.body.items).toHaveLength(2);

      await call('teacher', 'get', `/students/${student.id}/ledger?pageSize=101`).expect(400);
      await call('teacher', 'get', `/students/${student.id}/ledger?page=0`).expect(400);
    });

    it('shows only the requested student entries', async () => {
      const a = await seedStudent();
      const b = await seedStudent();
      await seedEntry(a.id, 1);
      await seedEntry(b.id, 2);

      const res = await call('teacher', 'get', `/students/${a.id}/ledger`).expect(200);
      expect(res.body.total).toBe(1);
    });

    it('404 for an unknown student', async () => {
      await call('teacher', 'get', `/students/${randomUUID()}/ledger`).expect(404);
    });
  });

  describe('entries are never edited or deleted through the API', () => {
    it.each<[Method, string]>([
      ['patch', '/ledger/:entryId'],
      ['delete', '/ledger/:entryId'],
      ['put', '/ledger/:entryId'],
      ['patch', '/students/:id/ledger/:entryId'],
      ['delete', '/students/:id/ledger/:entryId'],
    ])('admin %s %s: no such route, the entry is intact', async (method, template) => {
      const student = await seedStudent();
      const entry = await seedEntry(student.id, 3);
      const path = template.replace(':entryId', entry.id).replace(':id', student.id);

      const res = await call('admin', method, path, method === 'delete' ? undefined : { delta: 99 });

      expect([403, 404]).toContain(res.status);
      const row = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: entry.id } });
      expect(row.delta).toBe(3);
    });
  });

  describe('student with history', () => {
    it('DELETE /students/:id is 409 once the student has ledger entries, and the student stays', async () => {
      const student = await seedStudent();
      await seedEntry(student.id, 1);

      await call('admin', 'delete', `/students/${student.id}`).expect(409);
      expect(await prisma.student.count({ where: { id: student.id } })).toBe(1);
      expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(1);
    });

    it('DELETE /students/:id still works for a student without entries', async () => {
      const student = await seedStudent();
      await call('admin', 'delete', `/students/${student.id}`).expect(204);
    });
  });
});
