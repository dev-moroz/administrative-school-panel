import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];
const PATH = '/settings/school';
const DEFAULTS = {
  lowBalanceThreshold: 2,
  dayStartsAt: '12:00',
  eveningStartsAt: '17:00',
  lateWindowMin: 60,
};

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
  const stored = async () => {
    const { id: _id, updatedAt: _updatedAt, ...rest } = await prisma.schoolSettings.findUniqueOrThrow({ where: { id: 1 } });
    return rest;
  };
  const reset = () => prisma.schoolSettings.update({ where: { id: 1 }, data: DEFAULTS });

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

  beforeEach(reset);

  afterAll(async () => {
    await reset();
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
      await patch(actor, { lowBalanceThreshold: 5, lateWindowMin: 90 });
      expect(await stored()).toEqual(DEFAULTS);
    });
  });

  describe('GET /settings/school', () => {
    it('returns exactly the settings with their defaults', async () => {
      const res = await get('teacher').expect(200);
      expect(res.body).toEqual(DEFAULTS);
    });
  });

  describe('PATCH /settings/school', () => {
    it('saves the threshold, returns all settings, and GET returns the new value', async () => {
      const res = await patch('admin', { lowBalanceThreshold: 5 }).expect(200);
      expect(res.body).toEqual({ ...DEFAULTS, lowBalanceThreshold: 5 });
      expect((await get('teacher').expect(200)).body).toEqual({ ...DEFAULTS, lowBalanceThreshold: 5 });
    });

    it('saves the cancellation rules and keeps the other fields', async () => {
      const rules = { dayStartsAt: '11:30', eveningStartsAt: '18:00', lateWindowMin: 120 };
      const res = await patch('admin', rules).expect(200);
      expect(res.body).toEqual({ ...DEFAULTS, ...rules });
      expect(await stored()).toEqual({ ...DEFAULTS, ...rules });
    });

    it.each([0, 100])('accepts the threshold boundary value %i', async (value) => {
      await patch('admin', { lowBalanceThreshold: value }).expect(200);
      expect((await stored()).lowBalanceThreshold).toBe(value);
    });

    it.each([0, 1440])('accepts the late window boundary value %i', async (value) => {
      await patch('admin', { lateWindowMin: value }).expect(200);
      expect((await stored()).lateWindowMin).toBe(value);
    });

    it('accepts the time boundary values 00:00 and 23:59', async () => {
      await patch('admin', { dayStartsAt: '00:00', eveningStartsAt: '23:59' }).expect(200);
      expect(await stored()).toMatchObject({ dayStartsAt: '00:00', eveningStartsAt: '23:59' });
    });

    it('checks the order against the stored value when only one time is sent', async () => {
      await patch('admin', { dayStartsAt: '17:00' }).expect(400);
      await patch('admin', { eveningStartsAt: '12:00' }).expect(400);
      await patch('admin', { dayStartsAt: '16:59' }).expect(200);
    });

    it.each([
      ['empty body', {}],
      ['negative threshold', { lowBalanceThreshold: -1 }],
      ['fractional threshold', { lowBalanceThreshold: 2.5 }],
      ['threshold above 100', { lowBalanceThreshold: 101 }],
      ['threshold as a string', { lowBalanceThreshold: 'three' }],
      ['null threshold', { lowBalanceThreshold: null }],
      ['an extra field', { lowBalanceThreshold: 3, id: 2 }],
      ['hour 24', { dayStartsAt: '24:00' }],
      ['minute 60', { dayStartsAt: '11:60' }],
      ['no leading zero', { dayStartsAt: '9:00' }],
      ['not a time', { eveningStartsAt: 'noon' }],
      ['null time', { dayStartsAt: null }],
      ['evening not after day', { dayStartsAt: '15:00', eveningStartsAt: '15:00' }],
      ['evening before day', { dayStartsAt: '18:00', eveningStartsAt: '12:00' }],
      ['negative late window', { lateWindowMin: -1 }],
      ['late window above a day', { lateWindowMin: 1441 }],
      ['fractional late window', { lateWindowMin: 30.5 }],
      ['the removed sameDayMorningCharged', { sameDayMorningCharged: false }],
    ])('answers 400: %s, and changes nothing', async (_label, body) => {
      await patch('admin', body).expect(400);
      expect(await stored()).toEqual(DEFAULTS);
    });
  });
});
