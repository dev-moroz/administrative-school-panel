# English School Admin Panel

[![CI](https://github.com/dev-moroz/administrative-school-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/dev-moroz/administrative-school-panel/actions/workflows/ci.yml)

An admin panel for a small English school that teaches one-on-one: students, the lesson schedule, the remaining lesson balance and payments in different currencies.

**Live demo: coming soon.**

## The problem
The teacher counted paid, held and rescheduled lessons by hand and reminded students manually that a package was ending.
The panel keeps every lesson and payment in one place and computes the balance itself.

## Features
- Students with a default currency, lesson price and payment method.
- Calendar (FullCalendar): recurring series from a template and one-off lessons; overlap checks; manual changes are kept when a series is regenerated.
- Lesson balance as an operations ledger; it may go negative.
- Payments in the original currency (EUR, USDT, USDC, extendable) with an uploaded proof; the amount suggests the number of lessons, the remainder stays as money.
- Cancellation rules by time slot, no-show charging, student freezes and teacher absences.
- Roles with configurable permissions (`admin`, `teacher`) and an audit log.
- Planned: a Telegram bot for students (balance, "package ending" reminders).

## Stack
- **Monorepo:** pnpm workspaces.
- **API:** NestJS, Prisma, PostgreSQL 16.
- **Web:** Next.js App Router (standalone build), TanStack Query, Tailwind, shadcn/ui, next-intl, FullCalendar.
- **Tests:** Vitest (unit and e2e against a real database).
- **Ops:** Docker Compose for production and the demo, GitHub Actions CI.

## Key architecture decisions
Full history with the reasoning is in [`docs/DECISIONS.md`](docs/DECISIONS.md).
- **Balance is a ledger.** Balance = `SUM(delta)`; entries are never edited, only compensated. A payment and its lesson credit are written in one transaction.
- **Permissions live in the database, not in the token.** A role is a set of permissions; the guard reads them on every request. Deny by default, ownership checks, responses only through DTOs, "role × endpoint" tests.
- **One origin.** The browser talks only to Next, which proxies `/api` to Nest: no CORS. JWT access and refresh tokens are httpOnly cookies with an origin check on writes.
- **One base time zone.** Lessons, series and the generator use `Europe/Moscow`; the teacher's zone is used only for cancellation rules; the UI shows and accepts times in the viewer's zone.
- **No currency conversion.** Payments keep the original amount and currency.
- **Audit from day one.** Every change records who, what and when.
- **Login throttling by the real client IP** (`CF-Connecting-IP` behind Cloudflare), so visitors don't share one limit.

## Built with AI
I act as the manager; Claude Code writes the code. Every step goes through the same loop:
1. A design session: decisions are recorded in `docs/DECISIONS.md`, the stage split in `PLAN.md`.
2. A plan, approved before any code.
3. Tests first (TDD), approved as the spec.
4. The implementation until the approved tests pass; tests are never changed to fit the code.
5. Review, then one commit per logical change.

The rules Claude follows are in [`CLAUDE.md`](CLAUDE.md); the commit history shows the whole process, step by step.

## Run locally
Requires Node.js, pnpm and Docker.
```sh
cp .env.example .env
cp env/api.env.example apps/api/.env
cp env/web.env.example apps/web/.env
pnpm install
pnpm dev          # Postgres in Docker, api on :4000, web on :3000
```
Stop with `docker compose down` (`-v` also deletes the data).

Tests:
```sh
pnpm --filter api test        # API unit
pnpm --filter api test:e2e    # API e2e
pnpm --filter web test        # web
```

## Deploy
Production and demo Docker Compose stacks: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## License
All rights reserved. The code is published for viewing only.

Author: Anatoly Morozov.
