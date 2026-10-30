import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];
const PATH = '/settings/school';
const DEFAULT_THRESHOLD = 2;

describe('school settings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies: Partial<Record<Actor, string>> = {};

  function send(method: 'get' | 'patch', actor: Actor, body?: object) {
    const req = request(app.getHttpServer())[method](PATH).set('Origin', TEST_ORIGIN);
    const authed = actor === 'anonymous' ? req : req.set('Cookie', cookies[actor]!);
    return body ? authed.send(body) : authed;
  }
  const get = (actor: Actor) => send('get', actor);
  const patch = (actor: Actor, body: object) => send('patch', actor, body);
  const stored = async () => (await prisma.schoolSettings.findUniqueOrThrow({ where: { id: 1 } })).lowBalanceThreshold;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await ensureUser(app, 'school-student@e2e.test', 'student');
    await ensureUser(app, 'school-teacher@e2e.test', 'teacher');
    await ensureUser(app, 'school-admin@e2e.test', 'admin');
    cookies.student = await loginAs(app, 'school-student@e2e.test');
    cookies.teacher = await loginAs(app, 'school-teacher@e2e.test');
    cookies.admin = await loginAs(app, 'school-admin@e2e.test');
  });

  beforeEach(async () => {
    await prisma.schoolSettings.update({ where: { id: 1 }, data: { lowBalanceThreshold: DEFAULT_THRESHOLD } });
  });

  afterAll(async () => {
    await prisma.schoolSettings.update({ where: { id: 1 }, data: { lowBalanceThreshold: DEFAULT_THRESHOLD } });
    await app.close();
  });

  describe('GET /settings/school: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 200, admin: 200 };

    it.each(ACTORS)('%s', async (actor) => {
      expect((await get(actor)).status).toBe(EXPECTED[actor]);
    });
  });

  describe('PATCH /settings/school: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 403, admin: 200 };

    it.each(ACTORS)('%s', async (actor) => {
      expect((await patch(actor, { lowBalanceThreshold: 5 })).status).toBe(EXPECTED[actor]);
    });

    it.each(['student', 'teacher', 'anonymous'] as Actor[])('%s changes nothing', async (actor) => {
      await patch(actor, { lowBalanceThreshold: 5 });
      expect(await stored()).toBe(DEFAULT_THRESHOLD);
    });
  });

  describe('GET /settings/school', () => {
    it('returns exactly lowBalanceThreshold, by default 2', async () => {
      const res = await get('teacher').expect(200);
      expect(res.body).toEqual({ lowBalanceThreshold: DEFAULT_THRESHOLD });
    });
  });

  describe('PATCH /settings/school', () => {
    it('saves the threshold, returns exactly lowBalanceThreshold, and GET returns the new value', async () => {
      const res = await patch('admin', { lowBalanceThreshold: 5 }).expect(200);
      expect(res.body).toEqual({ lowBalanceThreshold: 5 });
      expect((await get('teacher').expect(200)).body).toEqual({ lowBalanceThreshold: 5 });
    });

    it.each([0, 100])('accepts the boundary value %i', async (value) => {
      await patch('admin', { lowBalanceThreshold: value }).expect(200);
      expect(await stored()).toBe(value);
    });

    it.each([
      ['empty body', {}],
      ['negative', { lowBalanceThreshold: -1 }],
      ['fractional', { lowBalanceThreshold: 2.5 }],
      ['above 100', { lowBalanceThreshold: 101 }],
      ['a string', { lowBalanceThreshold: 'three' }],
      ['null', { lowBalanceThreshold: null }],
      ['an extra field', { lowBalanceThreshold: 3, id: 2 }],
    ])('answers 400: %s, and changes nothing', async (_label, body) => {
      await patch('admin', body).expect(400);
      expect(await stored()).toBe(DEFAULT_THRESHOLD);
    });
  });
});
