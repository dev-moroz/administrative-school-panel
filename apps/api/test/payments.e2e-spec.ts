import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

// Every record created here starts with TAG, so the cleanup never touches other data.
const TAG = `e2e${Date.now().toString(36)}`;
const ADMIN_EMAIL = 'payments-admin@e2e.test';
const TEACHER_EMAIL = 'payments-teacher@e2e.test';
const INACTIVE_CODE = 'XPI';
const ZERO_DECIMALS_CODE = 'XPZ';
const INACTIVE_METHOD = 'XPM';

const PAYMENT_KEYS = [
  'amount',
  'comment',
  'createdAt',
  'createdBy',
  'currencyCode',
  'id',
  'lessonsGranted',
  'method',
  'paidAt',
  'proofFile',
  'proofUrl',
  'student',
];

describe('payments (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let teacher: { id: string };
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

  function validBody(studentId: string, over: Record<string, unknown> = {}) {
    return { studentId, amount: '400.00', currencyCode: 'EUR', method: 'TRANSFER', lessonsGranted: 8, ...over };
  }

  function post(actor: Actor, body: object) {
    return call(actor, 'post', '/payments', body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    teacher = await ensureTeacher(app, TEACHER_EMAIL, 'Payments Teacher');
    await ensureUser(app, 'payments-student@e2e.test', 'student');
    await ensureUser(app, ADMIN_EMAIL, 'admin');
    cookies.teacher = await loginAs(app, TEACHER_EMAIL);
    cookies.student = await loginAs(app, 'payments-student@e2e.test');
    cookies.admin = await loginAs(app, ADMIN_EMAIL);

    await prisma.currency.upsert({
      where: { code: INACTIVE_CODE },
      update: { isActive: false },
      create: { code: INACTIVE_CODE, name: 'Inactive currency (e2e payments)', isActive: false },
    });
    await prisma.currency.upsert({
      where: { code: ZERO_DECIMALS_CODE },
      update: { decimals: 0, isActive: true },
      create: { code: ZERO_DECIMALS_CODE, name: 'Zero decimals (e2e payments)', decimals: 0 },
    });
    await prisma.paymentMethod.upsert({
      where: { code: INACTIVE_METHOD },
      update: { isActive: false },
      create: { code: INACTIVE_METHOD, name: 'Inactive method (e2e payments)', icon: 'wallet', isActive: false },
    });
  });

  afterAll(async () => {
    const students = { student: { fullName: { startsWith: TAG } } };
    await prisma.ledgerEntry.deleteMany({ where: { OR: [students, { payment: students }] } });
    await prisma.payment.deleteMany({ where: students });
    await prisma.student.deleteMany({ where: { fullName: { startsWith: TAG } } });
    await prisma.currency.deleteMany({ where: { code: { in: [INACTIVE_CODE, ZERO_DECIMALS_CODE] } } });
    await prisma.paymentMethod.deleteMany({ where: { code: INACTIVE_METHOD } });
    await app.close();
  });

  describe('role x endpoint matrix', () => {
    const MATRIX: {
      name: string;
      expected: Record<Actor, number>;
      run: (actor: Actor) => PromiseLike<{ status: number }>;
    }[] = [
      {
        name: 'POST /payments',
        expected: { anonymous: 401, student: 403, teacher: 201, admin: 201 },
        run: async (actor) => post(actor, validBody((await seedStudent()).id)),
      },
      {
        name: 'GET /payments',
        expected: { anonymous: 401, student: 403, teacher: 200, admin: 200 },
        run: async (actor) => call(actor, 'get', '/payments'),
      },
    ];

    describe.each(MATRIX)('$name', (row) => {
      it.each(ACTORS)('%s', async (actor) => {
        const res = await row.run(actor);
        expect(res.status).toBe(row.expected[actor]);
      });
    });

    it('a forbidden payment writes nothing', async () => {
      const student = await seedStudent();
      await post('student', validBody(student.id)).expect(403);
      await post('anonymous', validBody(student.id)).expect(401);
      expect(await prisma.payment.count({ where: { studentId: student.id } })).toBe(0);
      expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(0);
    });

    it('checks permissions before looking up the student (401/403 before 404)', async () => {
      const body = validBody(randomUUID());
      await post('anonymous', body).expect(401);
      await post('student', body).expect(403);
      await post('teacher', body).expect(404);
    });
  });

  describe('POST /payments', () => {
    it('creates one payment and one PURCHASE entry linked to it, and the balance grows', async () => {
      const student = await seedStudent();
      const res = await post('teacher', validBody(student.id, { lessonsGranted: 6, comment: 'first package' })).expect(201);

      const payments = await prisma.payment.findMany({ where: { studentId: student.id } });
      expect(payments).toHaveLength(1);
      expect(payments[0]).toMatchObject({ currencyCode: 'EUR', methodCode: 'TRANSFER', lessonsGranted: 6, comment: 'first package' });
      expect(payments[0].amount.toString()).toBe('400');

      const entries = await prisma.ledgerEntry.findMany({ where: { studentId: student.id } });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ type: 'PURCHASE', delta: 6, paymentId: payments[0].id });
      expect(res.body.id).toBe(payments[0].id);

      const balance = await call('teacher', 'get', `/students/${student.id}/balance`).expect(200);
      expect(balance.body.balance).toBe(6);
    });

    it('adds to an existing balance, including a debt', async () => {
      const student = await seedStudent();
      await prisma.ledgerEntry.create({
        data: {
          studentId: student.id,
          delta: -2,
          type: 'MANUAL_ADJUSTMENT',
          comment: 'seed debt',
          createdById: (await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })).id,
        },
      });
      await post('admin', validBody(student.id, { lessonsGranted: 8 })).expect(201);
      const balance = await call('admin', 'get', `/students/${student.id}/balance`).expect(200);
      expect(balance.body.balance).toBe(6);
    });

    it('returns exactly the documented fields, the amount as a string, the author from the session', async () => {
      const student = await seedStudent();
      const res = await post('teacher', validBody(student.id, { amount: '1500.5', currencyCode: 'USDC', proofUrl: 'https://example.com/receipt.png' })).expect(201);

      expect(Object.keys(res.body).sort()).toEqual(PAYMENT_KEYS);
      expect(res.body).toMatchObject({
        amount: '1500.50',
        currencyCode: 'USDC',
        method: { code: 'TRANSFER', name: 'Bank transfer', icon: 'landmark' },
        lessonsGranted: 8,
        comment: null,
        proofUrl: 'https://example.com/receipt.png',
        student: { id: student.id, fullName: student.fullName },
      });
      expect(res.body.createdBy.email).toBe(TEACHER_EMAIL);
      expect(Object.keys(res.body.createdBy).sort()).toEqual(['email', 'id', 'name']);
      expect(Object.keys(res.body.student).sort()).toEqual(['fullName', 'id']);
      expect(Object.keys(res.body.method).sort()).toEqual(['code', 'icon', 'name']);
    });

    it('paidAt defaults to now and an explicit past date is kept', async () => {
      const student = await seedStudent();
      const before = Date.now();
      const auto = await post('teacher', validBody(student.id)).expect(201);
      expect(Math.abs(new Date(auto.body.paidAt).getTime() - before)).toBeLessThan(60_000);

      const past = '2026-01-15T10:00:00.000Z';
      const explicit = await post('teacher', validBody(student.id, { paidAt: past })).expect(201);
      expect(new Date(explicit.body.paidAt).toISOString()).toBe(past);
    });

    it('tolerates a client clock that is slightly fast (paidAt one minute ahead is accepted)', async () => {
      const student = await seedStudent();
      await post('teacher', validBody(student.id, { paidAt: new Date(Date.now() + 60_000).toISOString() })).expect(201);
    });

    it('accepts payments in different currencies for one student', async () => {
      const student = await seedStudent();
      await post('teacher', validBody(student.id, { currencyCode: 'EUR', amount: '100' })).expect(201);
      await post('teacher', validBody(student.id, { currencyCode: 'USDT', amount: '100', method: 'CRYPTO' })).expect(201);
      expect(await prisma.payment.count({ where: { studentId: student.id } })).toBe(2);
    });

    it('is atomic: when the ledger write fails, no payment is left', async () => {
      const student = await seedStudent();
      const spy = vi.spyOn(app.get(LedgerService), 'addEntry').mockRejectedValueOnce(new Error('boom'));
      try {
        await post('teacher', validBody(student.id)).expect(500);
      } finally {
        spy.mockRestore();
      }
      expect(await prisma.payment.count({ where: { studentId: student.id } })).toBe(0);
      expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(0);
    });

    it('404 for an unknown student, 400 for a malformed studentId', async () => {
      await post('teacher', validBody(randomUUID())).expect(404);
      await post('teacher', validBody('not-a-uuid')).expect(400);
      await post('teacher', { ...validBody(randomUUID()), studentId: undefined }).expect(400);
    });

    describe('validation (400, nothing written)', () => {
      const BAD: [string, Record<string, unknown>][] = [
        ['amount 0', { amount: '0' }],
        ['negative amount', { amount: '-5' }],
        ['non-numeric amount', { amount: 'abc' }],
        ['exponent amount', { amount: '1e3' }],
        ['amount as a number, not a string', { amount: 400 }],
        ['too many decimals for the currency (USDC)', { amount: '10.555', currencyCode: 'USDC' }],
        ['fraction for a zero-decimals currency', { amount: '10.5', currencyCode: ZERO_DECIMALS_CODE }],
        ['unknown currency', { currencyCode: 'QQQ' }],
        ['inactive currency', { currencyCode: INACTIVE_CODE }],
        ['missing currency', { currencyCode: undefined }],
        ['lessonsGranted 0', { lessonsGranted: 0 }],
        ['lessonsGranted negative', { lessonsGranted: -1 }],
        ['lessonsGranted fractional', { lessonsGranted: 1.5 }],
        ['lessonsGranted 101', { lessonsGranted: 101 }],
        ['lessonsGranted as a string', { lessonsGranted: '8' }],
        ['missing lessonsGranted', { lessonsGranted: undefined }],
        ['unknown method', { method: 'PAYPAL' }],
        ['inactive method', { method: INACTIVE_METHOD }],
        ['method as an object', { method: { code: 'CASH' } }],
        ['method in lower case', { method: 'cash' }],
        ['missing method', { method: undefined }],
        ['paidAt in the future (10 minutes ahead, beyond the 5 minute tolerance)', { paidAt: new Date(Date.now() + 10 * 60_000).toISOString() }],
        ['paidAt not a date', { paidAt: 'yesterday' }],
        ['javascript: proofUrl', { proofUrl: 'javascript:alert(1)' }],
        ['ftp proofUrl', { proofUrl: 'ftp://example.com/a.png' }],
        ['proofUrl not a URL', { proofUrl: 'receipt' }],
        ['too long comment', { comment: 'x'.repeat(1001) }],
        ['unknown field createdById', { createdById: randomUUID() }],
        ['unknown field remainder', { remainder: '10' }],
      ];

      it.each(BAD)('%s', async (_name, over) => {
        const student = await seedStudent();
        await post('teacher', validBody(student.id, over)).expect(400);
        expect(await prisma.payment.count({ where: { studentId: student.id } })).toBe(0);
        expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(0);
      });

      it('boundaries are accepted: lessonsGranted 1 and 100, zero-decimals currency with a whole amount', async () => {
        const student = await seedStudent();
        await post('teacher', validBody(student.id, { lessonsGranted: 1 })).expect(201);
        await post('teacher', validBody(student.id, { lessonsGranted: 100 })).expect(201);
        await post('teacher', validBody(student.id, { amount: '500', currencyCode: ZERO_DECIMALS_CODE })).expect(201);
      });
    });
  });

  describe('GET /payments', () => {
    it('lists newest first by paidAt, with different currencies in one list', async () => {
      const student = await seedStudent();
      await post('teacher', validBody(student.id, { paidAt: '2026-03-01T10:00:00.000Z', currencyCode: 'EUR', amount: '100' })).expect(201);
      await post('teacher', validBody(student.id, { paidAt: '2026-05-01T10:00:00.000Z', currencyCode: 'USDC', amount: '9000' })).expect(201);
      await post('teacher', validBody(student.id, { paidAt: '2026-04-01T10:00:00.000Z', currencyCode: 'USDT', amount: '50', method: 'CRYPTO' })).expect(201);

      const res = await call('teacher', 'get', `/payments?studentId=${student.id}`).expect(200);
      expect(res.body.total).toBe(3);
      expect(res.body.items.map((p: { currencyCode: string }) => p.currencyCode)).toEqual(['USDC', 'USDT', 'EUR']);
      expect(Object.keys(res.body.items[0]).sort()).toEqual(PAYMENT_KEYS);
    });

    it('filters by studentId and shows all students without the filter', async () => {
      const a = await seedStudent();
      const b = await seedStudent();
      await post('admin', validBody(a.id)).expect(201);
      await post('admin', validBody(b.id)).expect(201);

      const onlyA = await call('admin', 'get', `/payments?studentId=${a.id}`).expect(200);
      expect(onlyA.body.items.every((p: { student: { id: string } }) => p.student.id === a.id)).toBe(true);
      expect(onlyA.body.total).toBe(1);

      const all = await call('admin', 'get', '/payments?pageSize=100').expect(200);
      const ids = all.body.items.map((p: { student: { id: string } }) => p.student.id);
      expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    });

    it('an unknown studentId gives an empty list, a malformed one gives 400', async () => {
      const res = await call('teacher', 'get', `/payments?studentId=${randomUUID()}`).expect(200);
      expect(res.body).toMatchObject({ items: [], total: 0 });
      await call('teacher', 'get', '/payments?studentId=nope').expect(400);
    });

    it('paginates and reports total, page and pageSize', async () => {
      const student = await seedStudent();
      for (let day = 1; day <= 5; day += 1) {
        await post('teacher', validBody(student.id, { paidAt: `2026-02-0${day}T10:00:00.000Z` })).expect(201);
      }
      const page1 = await call('teacher', 'get', `/payments?studentId=${student.id}&page=1&pageSize=2`).expect(200);
      const page3 = await call('teacher', 'get', `/payments?studentId=${student.id}&page=3&pageSize=2`).expect(200);
      expect(page1.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
      expect(page1.body.items).toHaveLength(2);
      expect(page3.body.items).toHaveLength(1);
      expect(new Date(page3.body.items[0].paidAt).toISOString()).toBe('2026-02-01T10:00:00.000Z');
    });

    it('rejects a bad page or pageSize', async () => {
      await call('teacher', 'get', '/payments?page=0').expect(400);
      await call('teacher', 'get', '/payments?pageSize=101').expect(400);
      await call('teacher', 'get', '/payments?pageSize=abc').expect(400);
    });
  });

  describe('immutability and history', () => {
    it('there are no routes to change or delete a payment', async () => {
      const student = await seedStudent();
      const created = await post('admin', validBody(student.id)).expect(201);
      const url = `/payments/${created.body.id}`;
      await call('admin', 'patch', url, { comment: 'x' }).expect(404);
      await call('admin', 'put', url, validBody(student.id)).expect(404);
      await call('admin', 'delete', url).expect(404);
      expect(await prisma.payment.count({ where: { id: created.body.id } })).toBe(1);
    });

    it('deleting a student with a payment is 409 and keeps the payment', async () => {
      const student = await seedStudent();
      await post('admin', validBody(student.id)).expect(201);
      await call('admin', 'delete', `/students/${student.id}`).expect(409);
      expect(await prisma.payment.count({ where: { studentId: student.id } })).toBe(1);
    });
  });
});
