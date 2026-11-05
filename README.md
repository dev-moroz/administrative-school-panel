# English School Admin Panel

Context and decisions — `CLAUDE.md`, plan — `PLAN.md`.

## First run (stage 0)

All commands run from the project root.

1. Check pnpm: `pnpm -v`. If it is missing — `corepack enable` (or `npm i -g pnpm`).
2. Root variables (read only by Docker Compose): `cp .env.example .env`
3. Start Postgres and Mailpit: `docker compose up -d`
   - Postgres: `localhost:5432`, Mailpit (emails): http://localhost:8025
4. Create the apps (once):
   - Frontend: `pnpm create next-app@latest apps/web` — answers: TypeScript — yes, ESLint — yes, Tailwind — yes, `src/` — yes, App Router — yes, import alias — default.
   - Backend: `cd apps && pnpm dlx @nestjs/cli new api --package-manager pnpm --skip-git --strict && cd ..`
5. Nest port: in `apps/api/src/main.ts` replace `app.listen(process.env.PORT ?? 3000)` with `app.listen(process.env.PORT ?? 4000)` (3000 is taken by Next).
6. App variables (each app has its own `.env`): `cp env/api.env.example apps/api/.env && cp env/web.env.example apps/web/.env`.
   Before stage 1, replace `JWT_ACCESS_SECRET` in `apps/api/.env` with a long random string (`openssl rand -base64 48`).
7. Install dependencies from the root: `pnpm install`
8. Start everything with one command: `pnpm dev` (starts Docker and both apps). Or separately: `pnpm dev:api` (http://localhost:4000) and `pnpm dev:web` (http://localhost:3000).

After steps 1–8, tell Claude: he will add `output: 'standalone'`, rewrites `/api` → Nest, shadcn/ui, next-intl and Prisma.

## Stopping
`docker compose down` (data is kept in the `pgdata` volume; `docker compose down -v` also deletes the data).

## Production with Docker
The whole stack (Postgres, migrations + seed, api, web) runs in Docker; no Mailpit/SMTP.
1. `cp .env.example .env` and fill in the production block (strong `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `ADMIN_*`, `WEB_ORIGIN`).
2. `docker compose -f docker-compose.prod.yml up --build -d`
3. The site listens on `127.0.0.1:3000`; Postgres and the api are not published.

The one-shot `migrate` service applies migrations and the idempotent seed before the api starts.
Payment proofs are kept in the `uploads` volume.

## Demo with Docker
`docker compose -f docker-compose.prod.yml -f docker-compose.demo.yml up --build -d`

Same stack with fictional data. **Every deploy and every night at 04:00 Moscow time the database and uploads are wiped and recreated**, so never point it at real data. `TEACHER_*` is required: it is the public demo account, prefilled on the login page, so keep `ADMIN_PASSWORD` strong and secret.
