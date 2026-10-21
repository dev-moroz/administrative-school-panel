# STATUS.md

Update at the end of every session (briefly).

**Current stage:** stage 1, authentication and permissions, in progress (2026-10-21): auth schema migrated (incl. password recovery model), seed done; next is the auth module (login).

## Done
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
- 2026-10-17: fixes after the external audit — separate `.env` files, Docker ports bound to 127.0.0.1, `RefreshToken` in the schema, backups in stage 8, `ValidationPipe`+`helmet` in stage 1, contradictions in the documents fixed.

## Next
1. Stage 1, remaining: auth module (login, JWT in an httpOnly cookie, guard reading role/permissions from the DB on every request), `ValidationPipe` + `helmet`, "role × endpoint" tests (`PLAN.md`, stage 1).

## Known issues / notes
- 2026-10-20: `apps/web` is created, `pnpm dev` starts. The Turbopack error "Could not find next/package.json" was caused by nested `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`.git`/`node_modules` from create-next-app in `apps/web` — removed (they were in `_to_delete/`, which can be erased), `pnpm install` from the root.
- Open questions: scheduling time zone (start of stage 5), protection against double charging (stage 3).
- 2026-10-21: after any change to `schema.prisma`, run `pnpm prisma generate` (`migrate dev` does it itself); a stale client gives `Cannot read properties of undefined` on `prisma.<model>`.
- `PLAN.md` lists `User.mustChangePassword`, but it is not in the schema yet; add it by migration when the admin starts creating students with temporary passwords.
