import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureUser, loginAs } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

// Expected statuses come from the spec (PLAN.md section 4, the seed), not from the code.
const MATRIX: ({ path: string } & Record<Actor, number>)[] = [
  { path: '/probe/public', anonymous: 200, student: 200, teacher: 200, admin: 200 },
  { path: '/probe/unmarked', anonymous: 401, student: 403, teacher: 403, admin: 403 },
  { path: '/probe/authenticated', anonymous: 401, student: 200, teacher: 200, admin: 200 },
  { path: '/probe/students-read', anonymous: 401, student: 403, teacher: 200, admin: 200 },
  { path: '/probe/students-delete', anonymous: 401, student: 403, teacher: 403, admin: 200 },
  { path: '/auth/me', anonymous: 401, student: 200, teacher: 200, admin: 200 },
];

describe('auth (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  const cookies: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    for (const role of ['student', 'teacher', 'admin']) {
      const email = `${role}@e2e.test`;
      await ensureUser(app, email, role);
      cookies[role] = await loginAs(app, email);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(MATRIX)('GET $path', (row) => {
    it.each(ACTORS)('%s', async (actor) => {
      const req = request(server).get(row.path);
      if (actor !== 'anonymous') req.set('Cookie', cookies[actor]);
      await req.expect(row[actor]);
    });
  });

  it('GET /auth/me does not leak the password hash', async () => {
    const res = await request(server).get('/auth/me').set('Cookie', cookies.teacher).expect(200);

    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body.role).toBe('teacher');
    expect(res.body.permissions).toContain('students.read.all');
    expect(res.body.permissions).not.toContain('students.delete');
  });

  it('keeps only the user id in the access token', () => {
    const token = /access_token=([^;]+)/.exec(cookies.teacher)![1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

    expect(payload.sub).toBeTypeOf('string');
    expect(Object.keys(payload).filter((k) => !['sub', 'iat', 'exp'].includes(k))).toEqual([]);
  });

  it('rejects a still-valid token once the user is deactivated', async () => {
    const prisma = app.get(PrismaService);
    const email = 'inactive@e2e.test';
    await ensureUser(app, email, 'teacher');
    const cookie = await loginAs(app, email);
    const call = () => request(server).get('/probe/authenticated').set('Cookie', cookie);

    await call().expect(200);
    await prisma.user.update({ where: { email }, data: { isActive: false } });
    await call().expect(401);
  });

  it('reads permissions from the DB on every request, not from the token', async () => {
    const prisma = app.get(PrismaService);
    const link = await prisma.rolePermission.findFirstOrThrow({
      where: { role: { name: 'teacher' }, permission: { key: 'students.read.all' } },
    });
    const call = () => request(server).get('/probe/students-read').set('Cookie', cookies.teacher);

    await call().expect(200);

    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: link.roleId, permissionId: link.permissionId } },
    });
    try {
      await call().expect(403);
    } finally {
      await prisma.rolePermission.create({
        data: { roleId: link.roleId, permissionId: link.permissionId },
      });
    }

    await call().expect(200);
  });
});
