import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const SEED_CODES = ['EUR', 'USDC', 'USDT'];
const INACTIVE_CODE = 'CXT';
const ITEM_KEYS = ['code', 'decimals', 'isActive', 'name'];

describe('currencies (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies: Partial<Record<Actor, string>> = {};

  function get(actor: Actor, path = '/currencies') {
    const req = request(app.getHttpServer()).get(path).set('Origin', TEST_ORIGIN);
    return actor === 'anonymous' ? req : req.set('Cookie', cookies[actor]!);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await ensureUser(app, 'currencies-student@e2e.test', 'student');
    await ensureUser(app, 'currencies-teacher@e2e.test', 'teacher');
    await ensureUser(app, 'currencies-admin@e2e.test', 'admin');
    cookies.student = await loginAs(app, 'currencies-student@e2e.test');
    cookies.teacher = await loginAs(app, 'currencies-teacher@e2e.test');
    cookies.admin = await loginAs(app, 'currencies-admin@e2e.test');

    await prisma.currency.upsert({
      where: { code: INACTIVE_CODE },
      update: { isActive: false },
      create: { code: INACTIVE_CODE, name: 'Inactive currency (e2e)', isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.currency.deleteMany({ where: { code: INACTIVE_CODE } });
    await app.close();
  });

  describe('GET /currencies: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 200, admin: 200 };

    it.each(ACTORS)('%s', async (actor) => {
      const res = await get(actor);
      expect(res.status).toBe(EXPECTED[actor]);
    });
  });

  describe('admin (has currencies.update)', () => {
    it('sees all currencies, inactive ones included, with isActive', async () => {
      const res = await get('admin').expect(200);
      const codes = res.body.map((c: { code: string }) => c.code);
      for (const code of [...SEED_CODES, INACTIVE_CODE]) expect(codes).toContain(code);

      const inactive = res.body.find((c: { code: string }) => c.code === INACTIVE_CODE);
      expect(inactive.isActive).toBe(false);
    });

    it('returns the list sorted by code', async () => {
      const res = await get('admin').expect(200);
      const codes: string[] = res.body.map((c: { code: string }) => c.code);
      expect(codes).toEqual([...codes].sort());
    });
  });

  describe('teacher (no currencies.update)', () => {
    it('sees only active currencies', async () => {
      const res = await get('teacher').expect(200);
      const codes = res.body.map((c: { code: string }) => c.code);
      for (const code of SEED_CODES) expect(codes).toContain(code);
      expect(codes).not.toContain(INACTIVE_CODE);
      expect(res.body.every((c: { isActive: boolean }) => c.isActive)).toBe(true);
    });

    it('cannot ask for more through a query parameter', async () => {
      const res = await get('teacher', '/currencies?isActive=false').expect(200);
      const codes = res.body.map((c: { code: string }) => c.code);
      expect(codes).not.toContain(INACTIVE_CODE);
    });
  });

  it('returns exactly code, name, decimals and isActive', async () => {
    const res = await get('teacher').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const item of res.body) expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
  });
});
