import { config } from 'dotenv';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const apiRoot = fileURLToPath(new URL('..', import.meta.url));

config({ path: `${apiRoot}.env`, quiet: true });

// The tests wipe and rewrite data, so they never touch the dev database: "<name>_test" next to it.
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://school:school@localhost:5432/school');
const devName = url.pathname.slice(1);
export const TEST_DB_NAME = devName.endsWith('_test') ? devName : `${devName}_test`;
url.pathname = `/${TEST_DB_NAME}`;

export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: url.toString(),
  JWT_ACCESS_SECRET: 'e2e-access-secret-not-for-production',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL_DAYS: '14',
  WEB_ORIGIN: 'http://localhost:3000',
  THROTTLE_DISABLED: 'true',
  UPLOADS_DIR: join(tmpdir(), 'school-e2e-uploads'),
  ADMIN_EMAIL: 'admin@e2e.test',
  ADMIN_PASSWORD: 'e2e-admin-password',

  TEACHER_EMAIL: 'seed-teacher@e2e.test',
  TEACHER_PASSWORD: 'e2e-teacher-password',
  TEACHER_NAME: 'E2E Seed Teacher',
};
