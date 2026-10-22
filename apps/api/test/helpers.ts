import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';
import { ProbeController } from './probe.controller.js';

export const PASSWORD = 'e2e-user-password';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ProbeController],
  }).compile();

  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

export async function ensureUser(app: INestApplication, email: string, roleName: string) {
  const prisma = app.get(PrismaService);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await argon2.hash(PASSWORD);
  await prisma.user.upsert({
    where: { email },
    update: { roleId: role.id, passwordHash, isActive: true },
    create: { email, passwordHash, roleId: role.id },
  });
}

// Returns a ready-to-send Cookie header value.
export async function loginAs(app: INestApplication, email: string, password = PASSWORD) {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  const setCookie = res.headers['set-cookie'] as unknown as string[];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}
