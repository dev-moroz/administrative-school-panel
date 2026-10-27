import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const ITEM_KEYS = ['code', 'icon', 'isActive', 'name'];
const ACTIVE = 'ZMACTIVE';
const OFF = 'ZMOFF';
const USED = 'ZMUSED';
const CREATED = 'ZMNEW';
const ALL_CODES = [ACTIVE, OFF, USED, CREATED, 'ZM_LOWER', 'ZM_DUP', 'ZM_A', 'ZM_B'];
const STUDENT_NAME = 'E2E payment methods';

describe('payment methods (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies: Partial<Record<Actor, string>> = {};

  function call(method: 'get' | 'post' | 'patch' | 'delete', actor: Actor, path: string, body?: object) {
    const req = request(app.getHttpServer())[method](path).set('Origin', TEST_ORIGIN);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    return body === undefined ? req : req.send(body);
  }
  const list = (actor: Actor) => call('get', actor, '/payment-methods');
  const post = (actor: Actor, body: object = {}) => call('post', actor, '/payment-methods', body);
  const patch = (actor: Actor, code: string, body: object = {}) =>
    call('patch', actor, `/payment-methods/${code}`, body);
  const codes = (res: request.Response) => res.body.map((m: { code: string }) => m.code);

  async function cleanup() {
    await prisma.ledgerEntry.deleteMany({ where: { payment: { student: { fullName: STUDENT_NAME } } } });
    await prisma.payment.deleteMany({ where: { methodCode: { in: ALL_CODES } } });
    await prisma.student.deleteMany({ where: { fullName: STUDENT_NAME } });
    await prisma.paymentMethod.deleteMany({ where: { code: { in: ALL_CODES } } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await ensureUser(app, 'pm-student@e2e.test', 'student');
    await ensureUser(app, 'pm-teacher@e2e.test', 'teacher');
    await ensureUser(app, 'pm-admin@e2e.test', 'admin');
    cookies.student = await loginAs(app, 'pm-student@e2e.test');
    cookies.teacher = await loginAs(app, 'pm-teacher@e2e.test');
    cookies.admin = await loginAs(app, 'pm-admin@e2e.test');
  });

  beforeEach(async () => {
    await cleanup();
    await prisma.paymentMethod.createMany({
      data: [
        { code: ACTIVE, name: 'Zeta active', icon: 'wallet' },
        { code: OFF, name: 'Zeta inactive', icon: 'wallet', isActive: false },
        { code: USED, name: 'Zeta used', icon: 'wallet' },
      ],
    });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'pm-admin@e2e.test' } });
    const student = await prisma.student.create({ data: { fullName: STUDENT_NAME } });
    await prisma.payment.create({
      data: {
        studentId: student.id,
        amount: '100',
        currencyCode: 'EUR',
        paidAt: new Date(),
        methodCode: USED,
        lessonsGranted: 1,
        createdById: admin.id,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('GET /payment-methods: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 200, admin: 200 };
    it.each(ACTORS)('%s', async (actor) => {
      expect((await list(actor)).status).toBe(EXPECTED[actor]);
    });
  });

  describe('POST /payment-methods: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 403, admin: 201 };
    it.each(ACTORS)('%s', async (actor) => {
      const res = await post(actor, { code: CREATED, name: 'New method', icon: 'wallet' });
      expect(res.status).toBe(EXPECTED[actor]);
    });

    it.each(['student', 'teacher', 'anonymous'] as Actor[])('%s creates nothing', async (actor) => {
      await post(actor, { code: CREATED, name: 'New method', icon: 'wallet' });
      expect(await prisma.paymentMethod.count({ where: { code: CREATED } })).toBe(0);
    });
  });

  describe('PATCH /payment-methods/:code: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 403, admin: 200 };
    it.each(ACTORS)('%s', async (actor) => {
      expect((await patch(actor, ACTIVE, { name: 'Renamed' })).status).toBe(EXPECTED[actor]);
    });

    it.each(['student', 'teacher', 'anonymous'] as Actor[])('%s changes nothing', async (actor) => {
      await patch(actor, ACTIVE, { name: 'Renamed' });
      expect((await prisma.paymentMethod.findUniqueOrThrow({ where: { code: ACTIVE } })).name).toBe('Zeta active');
    });
  });

  it('has no DELETE endpoint', async () => {
    const res = await call('delete', 'admin', `/payment-methods/${ACTIVE}`);
    expect([403, 404]).toContain(res.status);
    expect(await prisma.paymentMethod.count({ where: { code: ACTIVE } })).toBe(1);
  });

  describe('GET /payment-methods', () => {
    it('returns exactly code, name, icon and isActive per item', async () => {
      const res = await list('admin').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      for (const item of res.body) expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
    });

    it('the admin sees inactive methods, the teacher only active ones', async () => {
      expect(codes(await list('admin'))).toEqual(expect.arrayContaining([ACTIVE, OFF, USED]));
      const teacherCodes = codes(await list('teacher'));
      expect(teacherCodes).toEqual(expect.arrayContaining([ACTIVE, USED]));
      expect(teacherCodes).not.toContain(OFF);
    });

    it.each(['admin', 'teacher'] as Actor[])('is sorted by name for the %s', async (actor) => {
      await prisma.paymentMethod.createMany({
        data: [
          { code: 'ZM_B', name: 'Zeta b', icon: 'wallet' },
          { code: 'ZM_A', name: 'Zeta a', icon: 'wallet' },
        ],
      });
      const names: string[] = (await list(actor).expect(200)).body.map((m: { name: string }) => m.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(names.indexOf('Zeta a')).toBeLessThan(names.indexOf('Zeta b'));
    });
  });

  describe('POST /payment-methods', () => {
    it('creates an active method and returns exactly code, name, icon and isActive', async () => {
      const res = await post('admin', { code: CREATED, name: 'New method', icon: 'bitcoin' }).expect(201);
      expect(Object.keys(res.body).sort()).toEqual(ITEM_KEYS);
      expect(res.body).toEqual({ code: CREATED, name: 'New method', icon: 'bitcoin', isActive: true });
      expect(await prisma.paymentMethod.findUnique({ where: { code: CREATED } })).not.toBeNull();
    });

    it('uppercases the code', async () => {
      const res = await post('admin', { code: 'zm_lower', name: 'Lower', icon: 'wallet' }).expect(201);
      expect(res.body.code).toBe('ZM_LOWER');
    });

    it('accepts an underscore and the length boundaries 2 and 20', async () => {
      await post('admin', { code: 'ZM_DUP', name: 'Underscore', icon: 'wallet' }).expect(201);
      await prisma.paymentMethod.deleteMany({ where: { code: { in: ['ZM', 'Z'.repeat(20)] } } });
      await post('admin', { code: 'ZM', name: 'Two chars', icon: 'wallet' }).expect(201);
      await post('admin', { code: 'Z'.repeat(20), name: 'Twenty chars', icon: 'wallet' }).expect(201);
      await prisma.paymentMethod.deleteMany({ where: { code: { in: ['ZM', 'Z'.repeat(20)] } } });
    });

    it('answers 409 for an existing code, also in another case', async () => {
      await post('admin', { code: ACTIVE, name: 'Duplicate', icon: 'wallet' }).expect(409);
      await post('admin', { code: ACTIVE.toLowerCase(), name: 'Duplicate', icon: 'wallet' }).expect(409);
      expect((await prisma.paymentMethod.findUniqueOrThrow({ where: { code: ACTIVE } })).name).toBe('Zeta active');
    });

    it.each([
      ['missing code', { name: 'X', icon: 'wallet' }],
      ['code too short', { code: 'Z', name: 'X', icon: 'wallet' }],
      ['code too long', { code: 'Z'.repeat(21), name: 'X', icon: 'wallet' }],
      ['code with a symbol', { code: 'ZM-1', name: 'X', icon: 'wallet' }],
      ['code with a space', { code: 'ZM 1', name: 'X', icon: 'wallet' }],
      ['missing name', { code: 'ZM_DUP', icon: 'wallet' }],
      ['empty name', { code: 'ZM_DUP', name: '', icon: 'wallet' }],
      ['name too long', { code: 'ZM_DUP', name: 'x'.repeat(51), icon: 'wallet' }],
      ['missing icon', { code: 'ZM_DUP', name: 'X' }],
      ['icon not in the whitelist', { code: 'ZM_DUP', name: 'X', icon: 'rocket' }],
      ['icon as a number', { code: 'ZM_DUP', name: 'X', icon: 1 }],
      ['isActive in the body', { code: 'ZM_DUP', name: 'X', icon: 'wallet', isActive: false }],
    ])('answers 400: %s', async (_label, body) => {
      await post('admin', body).expect(400);
      expect(await prisma.paymentMethod.count({ where: { code: 'ZM_DUP' } })).toBe(0);
    });
  });

  describe('PATCH /payment-methods/:code', () => {
    it('changes name and icon and returns exactly code, name, icon and isActive', async () => {
      const res = await patch('admin', ACTIVE, { name: 'Renamed', icon: 'landmark' }).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(ITEM_KEYS);
      expect(res.body).toEqual({ code: ACTIVE, name: 'Renamed', icon: 'landmark', isActive: true });
    });

    it('deactivates and reactivates a method', async () => {
      expect((await patch('admin', ACTIVE, { isActive: false }).expect(200)).body.isActive).toBe(false);
      expect((await patch('admin', ACTIVE, { isActive: true }).expect(200)).body.isActive).toBe(true);
    });

    it('deactivating a method that payments use is allowed', async () => {
      const res = await patch('admin', USED, { isActive: false }).expect(200);
      expect(res.body.isActive).toBe(false);
      expect(await prisma.payment.count({ where: { methodCode: USED } })).toBe(1);
    });

    it('a deactivated method is hidden from the teacher and visible to the admin', async () => {
      await patch('admin', ACTIVE, { isActive: false }).expect(200);
      expect(codes(await list('teacher'))).not.toContain(ACTIVE);
      expect(codes(await list('admin'))).toContain(ACTIVE);
    });

    it.each([
      ['code', { code: 'ZM_OTHER' }],
      ['code with a valid field', { name: 'X', code: 'ZM_OTHER' }],
    ])('answers 400 when the body has %s, and changes nothing', async (_label, body) => {
      await patch('admin', ACTIVE, body).expect(400);
      expect(await prisma.paymentMethod.findUniqueOrThrow({ where: { code: ACTIVE } })).toMatchObject({
        name: 'Zeta active',
        icon: 'wallet',
      });
    });

    it.each([
      ['empty body', {}],
      ['empty name', { name: '' }],
      ['name too long', { name: 'x'.repeat(51) }],
      ['icon not in the whitelist', { icon: 'rocket' }],
      ['isActive as a string', { isActive: 'yes' }],
    ])('answers 400: %s', async (_label, body) => {
      await patch('admin', ACTIVE, body).expect(400);
    });

    it('answers 404 for an unknown code', async () => {
      await patch('admin', 'ZMNONE', { name: 'X' }).expect(404);
    });
  });
});
