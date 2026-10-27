import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const ITEM_KEYS = ['code', 'decimals', 'isActive', 'name'];
const FREE = 'ZFREE';
const WITH_STUDENT = 'ZSTUD';
const WITH_PAYMENT = 'ZPAY';
const CREATED = 'ZNEW';
const ALL_CODES = [FREE, WITH_STUDENT, WITH_PAYMENT, CREATED, 'ZLOWER', 'ZDUP'];

describe('currencies admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies: Partial<Record<Actor, string>> = {};

  function send(method: 'post' | 'patch', actor: Actor, path: string, body: object = {}) {
    const req = request(app.getHttpServer())[method](path).set('Origin', TEST_ORIGIN);
    return (actor === 'anonymous' ? req : req.set('Cookie', cookies[actor]!)).send(body);
  }
  const post = (actor: Actor, body: object = {}) => send('post', actor, '/currencies', body);
  const patch = (actor: Actor, code: string, body: object = {}) =>
    send('patch', actor, `/currencies/${code}`, body);

  async function cleanup() {
    await prisma.payment.deleteMany({ where: { currencyCode: { in: ALL_CODES } } });
    await prisma.student.deleteMany({ where: { fullName: { startsWith: 'E2E currencies admin' } } });
    await prisma.currency.deleteMany({ where: { code: { in: ALL_CODES } } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await ensureUser(app, 'cur-admin-student@e2e.test', 'student');
    await ensureUser(app, 'cur-admin-teacher@e2e.test', 'teacher');
    await ensureUser(app, 'cur-admin-admin@e2e.test', 'admin');
    cookies.student = await loginAs(app, 'cur-admin-student@e2e.test');
    cookies.teacher = await loginAs(app, 'cur-admin-teacher@e2e.test');
    cookies.admin = await loginAs(app, 'cur-admin-admin@e2e.test');
  });

  beforeEach(async () => {
    await cleanup();
    await prisma.currency.createMany({
      data: [
        { code: FREE, name: 'Free currency', decimals: 2 },
        { code: WITH_STUDENT, name: 'Used by a student', decimals: 2 },
        { code: WITH_PAYMENT, name: 'Used by a payment', decimals: 2 },
      ],
    });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'cur-admin-admin@e2e.test' } });
    const student = await prisma.student.create({
      data: { fullName: 'E2E currencies admin A', defaultCurrencyCode: WITH_STUDENT },
    });
    const payer = await prisma.student.create({ data: { fullName: 'E2E currencies admin B' } });
    await prisma.payment.create({
      data: {
        studentId: payer.id,
        amount: '100',
        currencyCode: WITH_PAYMENT,
        paidAt: new Date(),
        method: 'CASH',
        lessonsGranted: 1,
        createdById: admin.id,
      },
    });
    expect(student.id).toBeDefined();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('POST /currencies: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 403, admin: 201 };

    it.each(ACTORS)('%s', async (actor) => {
      const res = await post(actor, { code: CREATED, name: 'New currency', decimals: 2 });
      expect(res.status).toBe(EXPECTED[actor]);
    });

    it.each(['student', 'teacher', 'anonymous'] as Actor[])('%s creates nothing', async (actor) => {
      await post(actor, { code: CREATED, name: 'New currency', decimals: 2 });
      expect(await prisma.currency.count({ where: { code: CREATED } })).toBe(0);
    });
  });

  describe('PATCH /currencies/:code: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 403, admin: 200 };

    it.each(ACTORS)('%s', async (actor) => {
      const res = await patch(actor, FREE, { name: 'Renamed' });
      expect(res.status).toBe(EXPECTED[actor]);
    });

    it.each(['student', 'teacher', 'anonymous'] as Actor[])('%s changes nothing', async (actor) => {
      await patch(actor, FREE, { name: 'Renamed' });
      expect((await prisma.currency.findUniqueOrThrow({ where: { code: FREE } })).name).toBe('Free currency');
    });
  });

  it('has no DELETE endpoint', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/currencies/${FREE}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookies.admin!);
    expect([403, 404]).toContain(res.status);
    expect(await prisma.currency.count({ where: { code: FREE } })).toBe(1);
  });

  describe('POST /currencies', () => {
    it('creates an active currency and returns exactly code, name, decimals and isActive', async () => {
      const res = await post('admin', { code: CREATED, name: 'New currency', decimals: 3 }).expect(201);
      expect(Object.keys(res.body).sort()).toEqual(ITEM_KEYS);
      expect(res.body).toEqual({ code: CREATED, name: 'New currency', decimals: 3, isActive: true });
      expect(await prisma.currency.findUnique({ where: { code: CREATED } })).not.toBeNull();
    });

    it('uppercases the code', async () => {
      const res = await post('admin', { code: 'zlower', name: 'Lower', decimals: 2 }).expect(201);
      expect(res.body.code).toBe('ZLOWER');
    });

    it('the new currency shows up in GET /currencies for the admin', async () => {
      await post('admin', { code: CREATED, name: 'New currency', decimals: 2 }).expect(201);
      const res = await request(app.getHttpServer())
        .get('/currencies')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', cookies.admin!)
        .expect(200);
      expect(res.body.map((c: { code: string }) => c.code)).toContain(CREATED);
    });

    it('answers 409 for an existing code, also in another case', async () => {
      await post('admin', { code: FREE, name: 'Duplicate', decimals: 2 }).expect(409);
      await post('admin', { code: FREE.toLowerCase(), name: 'Duplicate', decimals: 2 }).expect(409);
      expect((await prisma.currency.findUniqueOrThrow({ where: { code: FREE } })).name).toBe('Free currency');
    });

    it.each([
      ['missing code', { name: 'X', decimals: 2 }],
      ['code too short', { code: 'Z', name: 'X', decimals: 2 }],
      ['code too long', { code: 'ZABCDEFGHIJ', name: 'X', decimals: 2 }],
      ['code with a symbol', { code: 'ZD-1', name: 'X', decimals: 2 }],
      ['code with a space', { code: 'Z D', name: 'X', decimals: 2 }],
      ['missing name', { code: 'ZDUP', decimals: 2 }],
      ['empty name', { code: 'ZDUP', name: '', decimals: 2 }],
      ['name too long', { code: 'ZDUP', name: 'x'.repeat(51), decimals: 2 }],
      ['missing decimals', { code: 'ZDUP', name: 'X' }],
      ['negative decimals', { code: 'ZDUP', name: 'X', decimals: -1 }],
      ['decimals above 8', { code: 'ZDUP', name: 'X', decimals: 9 }],
      ['fractional decimals', { code: 'ZDUP', name: 'X', decimals: 2.5 }],
      ['decimals as a string', { code: 'ZDUP', name: 'X', decimals: 'two' }],
      ['isActive in the body', { code: 'ZDUP', name: 'X', decimals: 2, isActive: false }],
    ])('answers 400: %s', async (_label, body) => {
      await post('admin', body).expect(400);
      expect(await prisma.currency.count({ where: { code: 'ZDUP' } })).toBe(0);
    });
  });

  describe('PATCH /currencies/:code', () => {
    it('changes the name and returns exactly code, name, decimals and isActive', async () => {
      const res = await patch('admin', FREE, { name: 'Renamed' }).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(ITEM_KEYS);
      expect(res.body).toEqual({ code: FREE, name: 'Renamed', decimals: 2, isActive: true });
    });

    it('deactivates and reactivates a currency that nothing uses', async () => {
      const off = await patch('admin', FREE, { isActive: false }).expect(200);
      expect(off.body.isActive).toBe(false);
      const on = await patch('admin', FREE, { isActive: true }).expect(200);
      expect(on.body.isActive).toBe(true);
    });

    it('changes name and isActive in one request', async () => {
      const res = await patch('admin', FREE, { name: 'Both', isActive: false }).expect(200);
      expect(res.body).toMatchObject({ name: 'Both', isActive: false });
    });

    it('setting the same isActive value again is fine', async () => {
      await patch('admin', FREE, { isActive: true }).expect(200);
    });

    it('answers 409 when a student uses the currency, and keeps it active', async () => {
      const res = await patch('admin', WITH_STUDENT, { isActive: false }).expect(409);
      expect(JSON.stringify(res.body)).toContain('this currency is in use, it cannot be deactivated');
      expect((await prisma.currency.findUniqueOrThrow({ where: { code: WITH_STUDENT } })).isActive).toBe(true);
    });

    it('answers 409 when a payment uses the currency, and keeps it active', async () => {
      await patch('admin', WITH_PAYMENT, { isActive: false }).expect(409);
      expect((await prisma.currency.findUniqueOrThrow({ where: { code: WITH_PAYMENT } })).isActive).toBe(true);
    });

    it('renaming a used currency is allowed', async () => {
      await patch('admin', WITH_STUDENT, { name: 'Renamed while used' }).expect(200);
    });

    it('a used currency that is already inactive can be reactivated', async () => {
      await prisma.currency.update({ where: { code: WITH_STUDENT }, data: { isActive: false } });
      const res = await patch('admin', WITH_STUDENT, { isActive: true }).expect(200);
      expect(res.body.isActive).toBe(true);
    });

    it.each([
      ['code', { code: 'ZOTHER' }],
      ['decimals', { decimals: 4 }],
      ['code with a valid field', { name: 'X', code: 'ZOTHER' }],
      ['decimals with a valid field', { name: 'X', decimals: 4 }],
    ])('answers 400 when the body has %s, and changes nothing', async (_label, body) => {
      await patch('admin', FREE, body).expect(400);
      const row = await prisma.currency.findUniqueOrThrow({ where: { code: FREE } });
      expect(row).toMatchObject({ code: FREE, name: 'Free currency', decimals: 2 });
    });

    it.each([
      ['empty body', {}],
      ['empty name', { name: '' }],
      ['name too long', { name: 'x'.repeat(51) }],
      ['isActive as a string', { isActive: 'yes' }],
    ])('answers 400: %s', async (_label, body) => {
      await patch('admin', FREE, body).expect(400);
    });

    it('answers 404 for an unknown code', async () => {
      await patch('admin', 'ZNONE', { name: 'X' }).expect(404);
    });

    it('a deactivated currency is hidden from the teacher and visible to the admin', async () => {
      await patch('admin', FREE, { isActive: false }).expect(200);
      const list = (actor: Actor) =>
        request(app.getHttpServer())
          .get('/currencies')
          .set('Origin', TEST_ORIGIN)
          .set('Cookie', cookies[actor]!)
          .expect(200);
      const codes = (res: request.Response) => res.body.map((c: { code: string }) => c.code);
      expect(codes(await list('teacher'))).not.toContain(FREE);
      expect(codes(await list('admin'))).toContain(FREE);
    });
  });
});
