import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

// Every record created here starts with TAG, so the cleanup and the searches never touch other data.
const TAG = `e2e${Date.now().toString(36)}`;

const RESPONSE_KEYS = [
  'id',
  'fullName',
  'telegramUsername',
  'englishLevel',
  'comment',
  'defaultCurrencyCode',
  'lessonPrice',
  'isActive',
  'teacher',
  'telegramLinked',
  'createdAt',
  'updatedAt',
];

const LIST_ITEM_KEYS = ['id', 'fullName', 'telegramUsername'];

describe('students (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let teacherA: { id: string };
  let teacherB: { id: string };
  const cookies: Partial<Record<Actor, string>> = {};
  let counter = 0;

  function call(actor: Actor, method: Method, path: string, body?: object) {
    const req = request(server)[method](path).set('Origin', TEST_ORIGIN);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    return body === undefined ? req : req.send(body);
  }

  // Direct DB insert, linked to teacher A unless told otherwise.
  async function seedStudent(data: Record<string, unknown> = {}, teacherId = teacherA.id) {
    counter += 1;
    return prisma.student.create({
      data: {
        fullName: `${TAG} seed ${counter}`,
        ...data,
        teachers: { create: { teacherId } },
      } as never,
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    teacherA = await ensureTeacher(app, 'students-teacher-a@e2e.test', 'Students Teacher A');
    teacherB = await ensureTeacher(app, 'students-teacher-b@e2e.test', 'Students Teacher B');
    await ensureUser(app, 'students-student@e2e.test', 'student');
    await ensureUser(app, 'students-admin@e2e.test', 'admin');

    cookies.teacher = await loginAs(app, 'students-teacher-a@e2e.test');
    cookies.student = await loginAs(app, 'students-student@e2e.test');
    cookies.admin = await loginAs(app, 'students-admin@e2e.test');

    await prisma.currency.upsert({
      where: { code: 'TST' },
      update: { isActive: false },
      create: { code: 'TST', name: 'Inactive test currency', isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.student.deleteMany({ where: { fullName: { startsWith: TAG } } });
    await prisma.currency.deleteMany({ where: { code: 'TST' } });
    await app.close();
  });

  describe('role x endpoint matrix', () => {
    const MATRIX: {
      name: string;
      expected: Record<Actor, number>;
      run: (actor: Actor) => PromiseLike<{ status: number }>;
    }[] = [
      {
        name: 'GET /students',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: (actor) => call(actor, 'get', `/students?q=${TAG}`),
      },
      {
        name: 'GET /students/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', `/students/${(await seedStudent()).id}`),
      },
      {
        name: 'POST /students',
        expected: { anonymous: 401, student: 403, teacher: 201, admin: 201 },
        run: (actor) =>
          call(actor, 'post', '/students', {
            fullName: `${TAG} matrix`,
            ...(actor === 'admin' ? { teacherId: teacherA.id } : {}),
          }),
      },
      {
        name: 'PATCH /students/:id',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) =>
          call(actor, 'patch', `/students/${(await seedStudent()).id}`, { comment: 'matrix' }),
      },
      {
        name: 'DELETE /students/:id',
        expected: { anonymous: 401, student: 403, teacher: 403, admin: 204 },
        run: async (actor) => call(actor, 'delete', `/students/${(await seedStudent()).id}`),
      },
    ];

    describe.each(MATRIX)('$name', (row) => {
      it.each(ACTORS)('%s', async (actor) => {
        const res = await row.run(actor);
        expect(res.status).toBe(row.expected[actor]);
      });
    });

    it('checks permissions before looking up the student (401/403 before 404)', async () => {
      const id = randomUUID();
      await call('anonymous', 'get', `/students/${id}`).expect(401);
      await call('student', 'get', `/students/${id}`).expect(403);
      await call('teacher', 'get', `/students/${id}`).expect(404);
    });
  });

  describe('create: teacher binding', () => {
    it('teacher: binds the student to her own Teacher record', async () => {
      const res = await call('teacher', 'post', '/students', { fullName: `${TAG} by teacher` }).expect(201);

      expect(res.body.teacher.id).toBe(teacherA.id);
      expect(await prisma.studentTeacher.count({ where: { studentId: res.body.id } })).toBe(1);
    });

    it('admin: binds the student to the given teacherId', async () => {
      const res = await call('admin', 'post', '/students', {
        fullName: `${TAG} by admin`,
        teacherId: teacherB.id,
      }).expect(201);

      expect(res.body.teacher.id).toBe(teacherB.id);
      expect(await prisma.studentTeacher.count({ where: { studentId: res.body.id } })).toBe(1);
    });

    it('admin without teacherId: 400 (the admin has no Teacher record)', async () => {
      await call('admin', 'post', '/students', { fullName: `${TAG} no teacher` }).expect(400);
      expect(await prisma.student.count({ where: { fullName: `${TAG} no teacher` } })).toBe(0);
    });

    it.each([
      ['unknown teacher', randomUUID()],
      ['not a uuid', 'not-a-uuid'],
    ])('admin with a bad teacherId (%s): 400', async (_label, teacherId) => {
      await call('admin', 'post', '/students', { fullName: `${TAG} bad teacher`, teacherId }).expect(400);
      expect(await prisma.student.count({ where: { fullName: `${TAG} bad teacher` } })).toBe(0);
    });

    it.each([
      ['her own id', () => teacherA.id],
      ['another teacher id', () => teacherB.id],
    ])('teacher sending teacherId (%s): 403 and nothing is created', async (_label, pick) => {
      await call('teacher', 'post', '/students', {
        fullName: `${TAG} forbidden teacherId`,
        teacherId: pick(),
      }).expect(403);
      expect(await prisma.student.count({ where: { fullName: `${TAG} forbidden teacherId` } })).toBe(0);
    });
  });

  describe('create: validation and fields', () => {
    it('stores all fields and returns exactly the response DTO', async () => {
      const res = await call('teacher', 'post', '/students', {
        fullName: `${TAG} full`,
        telegramUsername: `${TAG}_full`,
        englishLevel: 'B1',
        comment: 'prefers evenings',
        defaultCurrencyCode: 'EUR',
        lessonPrice: 25,
      }).expect(201);

      expect(Object.keys(res.body).sort()).toEqual([...RESPONSE_KEYS].sort());
      expect(res.body).toMatchObject({
        fullName: `${TAG} full`,
        telegramUsername: `${TAG}_full`,
        englishLevel: 'B1',
        comment: 'prefers evenings',
        defaultCurrencyCode: 'EUR',
        isActive: true,
        telegramLinked: false,
      });
      expect(res.body.lessonPrice).toBeTypeOf('string');
      expect(Number(res.body.lessonPrice)).toBe(25);
      expect(Object.keys(res.body.teacher).sort()).toEqual(['fullName', 'id']);
    });

    it('optional fields default to null; no currency is not an error', async () => {
      const res = await call('teacher', 'post', '/students', { fullName: `${TAG} minimal` }).expect(201);

      expect(res.body).toMatchObject({
        telegramUsername: null,
        englishLevel: null,
        comment: null,
        defaultCurrencyCode: null,
        lessonPrice: null,
        isActive: true,
      });
    });

    it.each(['A0', 'C2'])('accepts English level %s', async (englishLevel) => {
      await call('teacher', 'post', '/students', { fullName: `${TAG} level ${englishLevel}`, englishLevel }).expect(201);
    });

    it.each([0, 1500, 1500.5, 1500.25])('accepts lessonPrice %s (up to 2 decimals)', async (lessonPrice) => {
      const res = await call('teacher', 'post', '/students', {
        fullName: `${TAG} price ${lessonPrice}`,
        lessonPrice,
      }).expect(201);

      expect(Number(res.body.lessonPrice)).toBe(lessonPrice);
    });

    it('strips a leading @ from the Telegram username', async () => {
      const res = await call('teacher', 'post', '/students', {
        fullName: `${TAG} at sign`,
        telegramUsername: `@${TAG}_at`,
      }).expect(201);

      expect(res.body.telegramUsername).toBe(`${TAG}_at`);
    });

    it.each<[string, object]>([
      ['missing fullName', {}],
      ['empty fullName', { fullName: '' }],
      ['blank fullName', { fullName: '   ' }],
      ['fullName over 120 chars', { fullName: 'x'.repeat(121) }],
      ['unknown English level', { fullName: `${TAG} v`, englishLevel: 'Z9' }],
      ['negative lessonPrice', { fullName: `${TAG} v`, lessonPrice: -1 }],
      ['lessonPrice with 3 decimals', { fullName: `${TAG} v`, lessonPrice: 1.255 }],
      // numeric(12,2) holds 10 integer digits; anything bigger must be a 400, not a DB error
      ['lessonPrice too large', { fullName: `${TAG} v`, lessonPrice: 1e10 }],
      ['lessonPrice not a number', { fullName: `${TAG} v`, lessonPrice: 'abc' }],
      ['username too short', { fullName: `${TAG} v`, telegramUsername: 'ab' }],
      ['username with a space', { fullName: `${TAG} v`, telegramUsername: 'bad name' }],
      ['comment over 2000 chars', { fullName: `${TAG} v`, comment: 'x'.repeat(2001) }],
      ['unknown currency', { fullName: `${TAG} v`, defaultCurrencyCode: 'XXX' }],
      ['inactive currency', { fullName: `${TAG} v`, defaultCurrencyCode: 'TST' }],
      ['userId in the body', { fullName: `${TAG} v`, userId: randomUUID() }],
      ['telegramChatId in the body', { fullName: `${TAG} v`, telegramChatId: 123456 }],
    ])('rejects: %s (400)', async (_label, body) => {
      await call('teacher', 'post', '/students', body).expect(400);
    });
  });

  describe('read', () => {
    it('GET /students/:id returns the DTO; unknown id is 404, bad uuid is 400', async () => {
      const student = await seedStudent();
      const res = await call('teacher', 'get', `/students/${student.id}`).expect(200);

      expect(Object.keys(res.body).sort()).toEqual([...RESPONSE_KEYS].sort());
      expect(res.body.id).toBe(student.id);
      expect(res.body.teacher.id).toBe(teacherA.id);

      await call('teacher', 'get', `/students/${randomUUID()}`).expect(404);
      await call('teacher', 'get', '/students/not-a-uuid').expect(400);
    });

    it('never leaks userId or telegramChatId; telegramLinked reflects the chat link', async () => {
      const student = await seedStudent({ telegramChatId: BigInt(777000111) });
      const res = await call('teacher', 'get', `/students/${student.id}`).expect(200);

      expect(res.body.telegramLinked).toBe(true);
      expect(res.body).not.toHaveProperty('telegramChatId');
      expect(res.body).not.toHaveProperty('userId');
    });

    // MVP limitation (docs/DECISIONS.md, "Known MVP limitations"): no filtering by teacher yet.
    it('a teacher sees students of another teacher', async () => {
      const student = await seedStudent({}, teacherB.id);
      await call('teacher', 'get', `/students/${student.id}`).expect(200);
    });
  });

  describe('list: search, filters, pagination', () => {
    it('returns compact items only: no card fields, userId or telegramChatId', async () => {
      await seedStudent({ fullName: `${TAG}cmp A`, comment: 'secret', lessonPrice: 30, telegramChatId: BigInt(555000222) });
      const res = await call('teacher', 'get', `/students?q=${TAG}cmp`).expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(Object.keys(res.body.items[0]).sort()).toEqual([...LIST_ITEM_KEYS].sort());
    });

    it('searches by name, ignoring case', async () => {
      await seedStudent({ fullName: `${TAG}srch Maria Ivanova`, telegramUsername: `${TAG}srch_masha` });
      await seedStudent({ fullName: `${TAG}srch Other Person` });

      const res = await call('teacher', 'get', `/students?q=${`${TAG}srch MARIA`.toUpperCase()}`).expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items.map((s: { fullName: string }) => s.fullName)).toEqual([`${TAG}srch Maria Ivanova`]);
    });

    it('searches by Telegram username', async () => {
      const res = await call('teacher', 'get', `/students?q=${TAG}srch_masha`).expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].telegramUsername).toBe(`${TAG}srch_masha`);
    });

    it('returns an empty page when nothing matches', async () => {
      const res = await call('teacher', 'get', `/students?q=${TAG}nomatch`).expect(200);

      expect(res.body).toMatchObject({ items: [], total: 0 });
    });

    it('filters by isActive', async () => {
      await seedStudent({ fullName: `${TAG}act A` });
      await seedStudent({ fullName: `${TAG}act B`, isActive: false });

      const names = async (query: string) => {
        const res = await call('teacher', 'get', `/students?q=${TAG}act${query}`).expect(200);
        return res.body.items.map((s: { fullName: string }) => s.fullName);
      };

      expect(await names('&isActive=false')).toEqual([`${TAG}act B`]);
      expect(await names('&isActive=true')).toEqual([`${TAG}act A`]);
      expect(await names('')).toEqual([`${TAG}act A`, `${TAG}act B`]);
      await call('teacher', 'get', `/students?q=${TAG}act&isActive=abc`).expect(400);
    });

    describe('pagination', () => {
      beforeAll(async () => {
        for (let i = 1; i <= 5; i += 1) await seedStudent({ fullName: `${TAG}pg ${i}` });
      });

      it('uses page 1 and pageSize 20 by default', async () => {
        const res = await call('teacher', 'get', `/students?q=${TAG}pg`).expect(200);

        expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 20 });
        expect(res.body.items).toHaveLength(5);
      });

      it('splits results into ordered, non-overlapping pages with a stable total', async () => {
        const page = async (n: number) => {
          const res = await call('teacher', 'get', `/students?q=${TAG}pg&page=${n}&pageSize=2`).expect(200);
          expect(res.body).toMatchObject({ total: 5, page: n, pageSize: 2 });
          return res.body.items.map((s: { fullName: string }) => s.fullName);
        };

        expect(await page(1)).toEqual([`${TAG}pg 1`, `${TAG}pg 2`]);
        expect(await page(2)).toEqual([`${TAG}pg 3`, `${TAG}pg 4`]);
        expect(await page(3)).toEqual([`${TAG}pg 5`]);
        expect(await page(4)).toEqual([]);
      });

      it.each([
        ['pageSize over 100', 'pageSize=101'],
        ['pageSize 0', 'pageSize=0'],
        ['page 0', 'page=0'],
        ['page not a number', 'page=abc'],
      ])('rejects %s (400)', async (_label, query) => {
        await call('teacher', 'get', `/students?q=${TAG}pg&${query}`).expect(400);
      });

      it('accepts pageSize 100', async () => {
        await call('teacher', 'get', `/students?q=${TAG}pg&pageSize=100`).expect(200);
      });
    });
  });

  describe('update', () => {
    it('deactivates and reactivates through PATCH', async () => {
      const student = await seedStudent();

      const off = await call('teacher', 'patch', `/students/${student.id}`, { isActive: false }).expect(200);
      expect(off.body.isActive).toBe(false);

      const on = await call('teacher', 'patch', `/students/${student.id}`, { isActive: true }).expect(200);
      expect(on.body.isActive).toBe(true);
    });

    it('changes only the given fields', async () => {
      const student = await seedStudent({ comment: 'keep me', englishLevel: 'B2' });
      const res = await call('teacher', 'patch', `/students/${student.id}`, { englishLevel: 'A0' }).expect(200);

      expect(res.body).toMatchObject({ englishLevel: 'A0', comment: 'keep me' });
      expect(res.body.teacher.id).toBe(teacherA.id);
    });

    it('clears lessonPrice and defaultCurrencyCode with null', async () => {
      const student = await seedStudent({ lessonPrice: 20, defaultCurrencyCode: 'EUR' });
      const res = await call('teacher', 'patch', `/students/${student.id}`, {
        lessonPrice: null,
        defaultCurrencyCode: null,
      }).expect(200);

      expect(res.body).toMatchObject({ lessonPrice: null, defaultCurrencyCode: null });
    });

    it('applies the same validation as create', async () => {
      const student = await seedStudent();
      await call('teacher', 'patch', `/students/${student.id}`, { defaultCurrencyCode: 'XXX' }).expect(400);
      await call('teacher', 'patch', `/students/${student.id}`, { lessonPrice: 1.255 }).expect(400);
      await call('teacher', 'patch', `/students/${student.id}`, { fullName: '' }).expect(400);
    });

    it.each<[string, () => object]>([
      ['teacherId', () => ({ teacherId: teacherB.id })],
      ['userId', () => ({ userId: randomUUID() })],
      ['telegramChatId', () => ({ telegramChatId: 123456 })],
      ['id', () => ({ id: randomUUID() })],
      ['createdAt', () => ({ createdAt: new Date().toISOString() })],
    ])('rejects %s in the body (400); the teacher stays the same', async (_field, body) => {
      const student = await seedStudent();
      await call('admin', 'patch', `/students/${student.id}`, body()).expect(400);

      const links = await prisma.studentTeacher.findMany({ where: { studentId: student.id } });
      expect(links.map((l) => l.teacherId)).toEqual([teacherA.id]);
    });

    it('unknown id is 404, bad uuid is 400', async () => {
      await call('teacher', 'patch', `/students/${randomUUID()}`, { comment: 'x' }).expect(404);
      await call('teacher', 'patch', '/students/not-a-uuid', { comment: 'x' }).expect(400);
    });
  });

  describe('delete', () => {
    it('admin removes a student without history; its links go with it, the teacher stays', async () => {
      const student = await seedStudent();
      await call('admin', 'delete', `/students/${student.id}`).expect(204);

      await call('admin', 'get', `/students/${student.id}`).expect(404);
      expect(await prisma.studentTeacher.count({ where: { studentId: student.id } })).toBe(0);
      expect(await prisma.teacher.count({ where: { id: teacherA.id } })).toBe(1);
    });

    it('a repeated delete is 404; a bad uuid is 400', async () => {
      const student = await seedStudent();
      await call('admin', 'delete', `/students/${student.id}`).expect(204);
      await call('admin', 'delete', `/students/${student.id}`).expect(404);
      await call('admin', 'delete', '/students/not-a-uuid').expect(400);
    });

    it('a teacher cannot delete: the student is still there', async () => {
      const student = await seedStudent();
      await call('teacher', 'delete', `/students/${student.id}`).expect(403);
      await call('teacher', 'get', `/students/${student.id}`).expect(200);
    });
  });

  describe('permissions and routes that must not exist yet', () => {
    it('students.assign-teacher belongs to the admin only', async () => {
      const permissions = async (actor: Actor) =>
        (await call(actor, 'get', '/auth/me').expect(200)).body.permissions as string[];

      expect(await permissions('admin')).toContain('students.assign-teacher');
      expect(await permissions('teacher')).not.toContain('students.assign-teacher');
    });

    // MVP limitation: the teacher of a student cannot be changed yet.
    it('there is no endpoint to change the teacher', async () => {
      const student = await seedStudent();
      await call('admin', 'put', `/students/${student.id}/teacher`, { teacherId: teacherB.id }).expect(404);
    });
  });
});
