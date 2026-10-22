# STATUS.md

Update at the end of every session (briefly).

**Current stage:** stage 1, authentication and permissions, in progress (2026-10-21): auth schema migrated (incl. password recovery model), seed done; next is the auth module (login).

## Done
- 2026-10-21: auth substep 1 (foundation): `main.ts` has `helmet`, `cookie-parser`, global `ValidationPipe`; `JWT_ACCESS_TTL`/`JWT_REFRESH_TTL_DAYS` added to env. Anatoly confirmed: access 15m, refresh 14d with rotation; CSRF via `SameSite=Lax` + `Origin` check on mutations; `@nestjs/throttler` on login (5/min per IP) in substep 4. Packages must be installed by Anatoly (see Next).
- 2026-10-21: `teacher` role added to the seed (`apps/api/prisma/seed.ts`), confirmed by Anatoly. Permission keys are grouped by domain (`STUDENTS`, `LESSONS`, `PAYMENTS`, `BALANCE`, `CURRENCIES`, `AUDIT`, `SYSTEM`); `admin` gets all, `teacher` gets students (no delete, no `read.own`), lessons (incl. series, freezes, schedule rules), payments, balance, `currencies.read`, `audit.read.business`. Admin only: `students.delete`, `currencies.create/update`, `audit.read.system`, `SYSTEM` group. Decided: no permission for the user's own profile, it goes through `/me/...` endpoints with the id taken from the session.
- 2026-10-21: stage 1, seed done and verified by Anatoly (`apps/api/prisma/seed.ts`, run via `pnpm prisma db seed`): 7 permissions, roles `admin` (all permissions) and `student` (`students.read.own`), role–permission links, first admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` (argon2 hash). Idempotent: a second run creates no duplicates and does not reset the admin password.
- 2026-10-21: migration `auth_schema` applied (User, Role, Permission, RolePermission, RefreshToken).
- 2026-10-21: password recovery provided for in the schema (confirmed by Anatoly): `User.mustChangePassword` (default false) and the `PasswordResetToken` model; recorded in `docs/DECISIONS.md`. Endpoint and UI later. Migration `password_reset` applied and checked in Prisma Studio by Anatoly.
- Planning is complete (`docs/DECISIONS.md`).
- Created: `pnpm-workspace.yaml`, root `package.json` (with `pnpm dev`), `docker-compose.yml`, `.env.example`, `env/*.env.example`, `.gitignore`, `README.md`.
- 2026-10-20: stage 0 passed — `apps/web` and `apps/api` are created, `pnpm dev` starts the infrastructure, api and web (confirmed by Anatoly).
- 2026-10-20: preparation finished and verified by Anatoly — web: `output: 'standalone'`, rewrites `/api/*` → Nest (prefix stripped), shadcn/ui (radix-nova, tweakcn theme), next-intl (locale in a cookie, no URL prefixes); api: `@nestjs/config`, Prisma 7 (`prisma.config.ts`, client in `src/generated/prisma`, `PrismaService` via `@prisma/adapter-pg`), template Observe removed.
- 2026-10-20: Anatoly's decision — the interface is English only for now, RU and the language switcher are postponed (the next-intl scaffold is kept).
- 2026-10-20: pnpm 12.14.0 confirmed by Anatoly; `packageManager` added to the root `package.json`.
- 2026-10-20: Mailpit pinned to `axllent/mailpit:v1.31.6` (the version Anatoly was running).
- 2026-10-17: fixes after the external audit — separate `.env` files, Docker ports bound to 127.0.0.1, `RefreshToken` in the schema, backups in stage 9, `ValidationPipe`+`helmet` in stage 1, contradictions in the documents fixed.

- 2026-10-21: the teacher's requirements clarified (details — `docs/DECISIONS.md`, "Teacher's requirements"). `PLAN.md` updated: recurring lessons, cancellation rules, Telegram bot and notifications (new stage 7), audit is stage 8, packaging is stage 9; the student web cabinet is postponed. Then confirmed: currencies are an extendable table, the lesson price is in the student profile, the money remainder is kept next to the lessons.

- 2026-10-21: after discussion Anatoly kept the auth and permissions plan as is (teacher role with permissions stays). Confirmed: no student web login in the MVP; students are linked to the Telegram bot by a one-time invite link from the teacher (details — `docs/DECISIONS.md`, "Telegram and notifications"; `TelegramInvite` added to the `PLAN.md` data model; the model is not in the schema yet, it comes in stage 7).

## Next
- Anatoly: `cd apps/api && pnpm add @nestjs/jwt helmet cookie-parser class-validator class-transformer && pnpm add -D @types/cookie-parser`, then check that `pnpm dev` starts.
- Auth substep 2 (Anatoly writes): AuthModule, `POST /auth/login|refresh|logout`, LoginDto, httpOnly cookies, refresh hash in `RefreshToken`.
0. `teacher` role, remaining parts: the teacher user (create later, via the admin UI or a test setup, not needed in the seed) and the "role × endpoint" tests for it (after the guard exists). Permission keys for later stages are added to the seed as the modules appear.
1. Stage 1, remaining: auth module (login, JWT in an httpOnly cookie, guard reading role/permissions from the DB on every request), `ValidationPipe` + `helmet`, "role × endpoint" tests (`PLAN.md`, stage 1).

## Known issues / notes
- 2026-10-20: `apps/web` is created, `pnpm dev` starts. The Turbopack error "Could not find next/package.json" was caused by nested `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`.git`/`node_modules` from create-next-app in `apps/web` — removed (they were in `_to_delete/`, which can be erased), `pnpm install` from the root.
- To discuss in a separate chat: monitoring (app availability, backups, Telegram delivery), not in the plan yet (`PLAN.md`, section 5).
- Open questions: protection against double charging (stage 3); the "To confirm" list in `PLAN.md`, section 5 (threshold N, linking a student to the bot, whether students need a web login, payment methods, recurring lessons when the teacher changes her time zone).
- 2026-10-21: after any change to `schema.prisma`, run `pnpm prisma generate` (`migrate dev` does it itself); a stale client gives `Cannot read properties of undefined` on `prisma.<model>`.
- `PLAN.md` lists `User.mustChangePassword`, but it is not in the schema yet; add it by migration when the admin starts creating students with temporary passwords.
