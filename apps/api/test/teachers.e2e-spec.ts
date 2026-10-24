import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const ITEM_KEYS = ['fullName', 'id'];

describe('teachers (e2e)', () => {
  let app: INestApplication;
  let teacherA: { id: string };
  let teacherZ: { id: string };
  const cookies: Partial<Record<Actor, string>> = {};

  function get(actor: Actor) {
    const req = request(app.getHttpServer()).get('/teachers').set('Origin', TEST_ORIGIN);
    return actor === 'anonymous' ? req : req.set('Cookie', cookies[actor]!);
  }

  beforeAll(async () => {
    app = await createTestApp();

    teacherA = await ensureTeacher(app, 'teachers-teacher-a@e2e.test', 'Aaa Teachers Test');
    teacherZ = await ensureTeacher(app, 'teachers-teacher-z@e2e.test', 'Zzz Teachers Test');
    await ensureUser(app, 'teachers-student@e2e.test', 'student');
    await ensureUser(app, 'teachers-admin@e2e.test', 'admin');

    cookies.teacher = await loginAs(app, 'teachers-teacher-a@e2e.test');
    cookies.student = await loginAs(app, 'teachers-student@e2e.test');
    cookies.admin = await loginAs(app, 'teachers-admin@e2e.test');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /teachers: role x endpoint matrix', () => {
    const EXPECTED: Record<Actor, number> = { anonymous: 401, student: 403, teacher: 403, admin: 200 };

    it.each(ACTORS)('%s', async (actor) => {
      const res = await get(actor);
      expect(res.status).toBe(EXPECTED[actor]);
    });
  });

  it('lists the teachers, including the seed teacher', async () => {
    const res = await get('admin').expect(200);
    const ids = res.body.map((t: { id: string }) => t.id);
    expect(ids).toContain(teacherA.id);
    expect(ids).toContain(teacherZ.id);

    const seedTeacher = res.body.find((t: { fullName: string }) => t.fullName === 'E2E Seed Teacher');
    expect(seedTeacher).toBeDefined();
  });

  it('is sorted by fullName', async () => {
    const res = await get('admin').expect(200);
    const names: string[] = res.body.map((t: { fullName: string }) => t.fullName);
    expect(names.indexOf('Aaa Teachers Test')).toBeLessThan(names.indexOf('Zzz Teachers Test'));
  });

  it('returns exactly id and fullName: no userId, timeZone or telegramChatId', async () => {
    const res = await get('admin').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const item of res.body) expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
  });
});
