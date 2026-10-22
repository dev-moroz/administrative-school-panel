import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { apiRoot, TEST_DB_NAME, TEST_ENV } from './env.js';

export default async function setup() {
  const adminUrl = new URL(TEST_ENV.DATABASE_URL);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
    if (!found.rowCount) await client.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await client.end();
  }

  const opts = { cwd: apiRoot, env: { ...process.env, ...TEST_ENV }, stdio: 'inherit' as const };
  execFileSync(`${apiRoot}node_modules/.bin/prisma`, ['migrate', 'deploy'], opts);
  execFileSync(`${apiRoot}node_modules/.bin/tsx`, ['prisma/seed.ts'], opts);
}
