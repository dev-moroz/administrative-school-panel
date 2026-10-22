import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, ensureUser, PASSWORD, TEST_ORIGIN } from './helpers.js';

const EMAIL = 'security@e2e.test';

describe('security (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = 'false';
    app = await createTestApp();
    await ensureUser(app, EMAIL, 'teacher');
  });

  afterAll(async () => {
    await app.close();
  });

  it('login is limited to 5 per minute, the 6th gets 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', TEST_ORIGIN)
        .send({ email: EMAIL, password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  describe('Origin check', () => {
    it('rejects a mutation with a foreign Origin', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Origin', 'https://evil.example')
        .expect(403);
    });

    it('rejects a mutation without Origin', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(403);
    });

    it('allows a mutation from the web origin', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Origin', TEST_ORIGIN)
        .expect(200);
    });

    it('does not check safe methods', async () => {
      await request(app.getHttpServer())
        .get('/probe/public')
        .set('Origin', 'https://evil.example')
        .expect(200);
    });
  });
});

describe('session limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = 'true';
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await ensureUser(app, 'sessions@e2e.test', 'teacher');
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps at most 5 live refresh tokens and revokes the oldest', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'sessions@e2e.test' } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    for (let i = 0; i < 7; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', TEST_ORIGIN)
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
    }

    const live = await prisma.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(live).toHaveLength(5);
  });
});
