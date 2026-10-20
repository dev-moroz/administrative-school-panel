# STATUS.md

Update at the end of every session (briefly).

**Current stage:** stage 0 is complete together with the web/api preparation (2026-10-20); next is stage 1, authentication and permissions.

## Done
- Planning is complete (`docs/DECISIONS.md`).
- Created: `pnpm-workspace.yaml`, root `package.json` (with `pnpm dev`), `docker-compose.yml`, `.env.example`, `env/*.env.example`, `.gitignore`, `README.md`.
- 2026-10-20: stage 0 passed — `apps/web` and `apps/api` are created, `pnpm dev` starts the infrastructure, api and web (confirmed by Anatoly).
- 2026-10-20: preparation finished and verified by Anatoly — web: `output: 'standalone'`, rewrites `/api/*` → Nest (prefix stripped), shadcn/ui (radix-nova, tweakcn theme), next-intl (locale in a cookie, no URL prefixes); api: `@nestjs/config`, Prisma 7 (`prisma.config.ts`, client in `src/generated/prisma`, `PrismaService` via `@prisma/adapter-pg`), template Observe removed.
- 2026-10-20: Anatoly's decision — the interface is English only for now, RU and the language switcher are postponed (the next-intl scaffold is kept).
- 2026-10-20: pnpm 12.14.0 confirmed by Anatoly; `packageManager` added to the root `package.json`.
- 2026-10-20: Mailpit pinned to `axllent/mailpit:v1.31.6` (the version Anatoly was running).
- 2026-10-17: fixes after the external audit — separate `.env` files, Docker ports bound to 127.0.0.1, `RefreshToken` in the schema, backups in stage 8, `ValidationPipe`+`helmet` in stage 1, contradictions in the documents fixed.

## Next
1. Stage 1 — authentication and permissions (`PLAN.md`, stage 1). The Prisma schema is still empty (only generator/datasource).

## Known issues / notes
- 2026-10-20: `apps/web` is created, `pnpm dev` starts. The Turbopack error "Could not find next/package.json" was caused by nested `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`.git`/`node_modules` from create-next-app in `apps/web` — removed (they were in `_to_delete/`, which can be erased), `pnpm install` from the root.
- Open questions: scheduling time zone (start of stage 5), protection against double charging (stage 3).
