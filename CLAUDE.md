# CLAUDE.md — English School Admin Panel (MVP)

**Session workflow:** read `STATUS.md` first. Update it at the end. Read `PLAN.md` and `docs/DECISIONS.md` only by the relevant section, not in full.
**Do not write into the documents anything Anatoly has not confirmed.**

## Working mode
- Learning project: React/Next.js + NestJS. Anatoly writes the key parts himself; Claude designs, explains, reviews and takes the routine work. No vibe-coding everything.
- Tokens are limited: work in stages, one session per stage, narrow requests, don't re-read unnecessarily.
- Communication language: Russian.

## Product
Admin panel for an English school (one-on-one lessons): students, lessons and calendar, remaining lesson balance, payments in different currencies, freezes and rescheduling, audit.

## Stack
- pnpm monorepo: `apps/api` (NestJS + Prisma + PostgreSQL 16), `apps/web` (Next.js App Router, `output: 'standalone'`, Tailwind, shadcn/ui, next-intl, TanStack Query).
- Auth: email + password, JWT in an httpOnly cookie. **Role and permissions live only in the DB**, not in the token; the guard reads them on every request.
- Calendar: FullCalendar. Email: Mailpit in dev, SMTP in production.
- Dev: Postgres and Mailpit via `docker compose up -d`; api and web run directly, not in Docker. Check the images once after stage 1.

## Key decisions
- Roles in the MVP: `admin` and `student`. Permissions are configurable (role = a set of permissions, like in Strapi); `teacher`/`manager` later, without schema changes.
- Balance is an operations ledger (balance = SUM(delta)); entries are never edited. It may be negative.
- Payments store the original amount and currency, no conversion; a payment and the lesson credit are created in a single transaction.
- No-show: whether to charge is a checkbox on the lesson. A freeze cancels scheduled lessons; the balance is kept.
- Audit from the very start. The i18n scaffold (next-intl) is in place, English only for now; other languages will be added later.

## Security (priority)
Deny by default; data ownership checks; responses only through DTOs; "role × endpoint" tests. Details — `PLAN.md`, section 4.

## Not in the MVP
Notifications, self-registration, teacher cabinet, groups/courses, automatic currency conversion, personal prices.

## Where things live
- `STATUS.md` — current stage, what is done, what is next.
- `PLAN.md` — structure, data model, stages with done criteria, security.
- `docs/DECISIONS.md` — full decision history. `README.md` — how to run.
