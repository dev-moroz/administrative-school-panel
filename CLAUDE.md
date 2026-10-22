# CLAUDE.md — English School Admin Panel (MVP)

**Session workflow:** read `STATUS.md` first. Update it at the end. Read `PLAN.md` and `docs/DECISIONS.md` only by the relevant section, not in full.
**Do not write into the documents anything Anatoly has not confirmed.**

## Working mode
- Learning project: React/Next.js + NestJS. Anatoly writes the key parts himself; Claude designs, explains, reviews and takes the routine work. No vibe-coding everything.
- Tokens are limited: work in stages, one session per stage, narrow requests, don't re-read unnecessarily.
- Communication language: Russian.
- **Code comments: keep them to a minimum, and write them in English only.**

## Product
Admin panel for an English school (one-on-one lessons): students, lessons and calendar, remaining lesson balance, payments in different currencies, freezes and rescheduling, audit. The teacher runs the daily work on the site (teacher account; the admin account is Anatoly's); students get their balance and reminders in a Telegram bot. The main pain being solved: manual counting of paid/held/rescheduled lessons and manual reminders that a package is ending.

## Stack
- pnpm monorepo: `apps/api` (NestJS + Prisma + PostgreSQL 16), `apps/web` (Next.js App Router, `output: 'standalone'`, Tailwind, shadcn/ui, next-intl, TanStack Query).
- Auth: email + password, JWT in an httpOnly cookie. **Role and permissions live only in the DB**, not in the token; the guard reads them on every request.
- Calendar: FullCalendar. Email: Mailpit in dev, SMTP in production.
- Dev: Postgres and Mailpit via `docker compose up -d`; api and web run directly, not in Docker. Check the images once after stage 1.

## Key decisions
- Roles in the MVP: `admin` (Anatoly's account: settings, currencies, roles, everything), `teacher` (the teacher's daily account) and `student` (no web login for now, the bot replaces it). **High priority, part of stage 1:** the `teacher` role (split — `docs/DECISIONS.md`, "Roles and access"). Permissions are configurable (role = a set of permissions, like in Strapi); `manager` later, without schema changes.
- Balance is an operations ledger (balance = SUM(delta)); entries are never edited. It may be negative.
- Payments store the original amount and currency, no conversion; a payment and the lesson credit are created in a single transaction.
- No-show: whether to charge is a checkbox on the lesson. A freeze cancels scheduled lessons; the balance is kept.
- Audit from the very start. The i18n scaffold (next-intl) is in place, English only for now; other languages will be added later.

- Package = a fixed number of lessons (usually 8), the price varies; no expiry yet (maybe later). Currencies: an extendable list (initially EUR, USDT, USDC); each student has a default currency and a lesson price in the profile, and the payment currency can be changed per payment. Payment amount ÷ lesson price suggests the number of lessons; the remainder is kept as money next to the lessons. The payment method is recorded.
- Lessons: recurring (from a template) and one-off.
- Cancellation rules (in the teacher's time zone): morning before 12:00, daytime from 12:00, evening from 17:00. Cancelling a morning lesson on the same day, or a daytime/evening lesson less than an hour before, means the lesson is charged. The checkbox on the lesson has the final say.
- The teacher's time zone is the base (schedule and cancellation rules), changeable in settings. The student's zone is for display only. Daylight saving time is not tracked separately.
- Telegram: a bot for students (balance, a reminder when N lessons are left) and notifications to the teacher. The student web cabinet is postponed. Details — `docs/DECISIONS.md`.

## Security (priority)
Deny by default; data ownership checks; responses only through DTOs; "role × endpoint" tests. Details — `PLAN.md`, section 4.

## Not in the MVP
Reminders about the lessons themselves, self-registration, student web cabinet, teacher cabinet, groups/courses, automatic currency conversion, package expiry, price history.

## Where things live
- `STATUS.md` — current stage, what is done, what is next.
- `PLAN.md` — structure, data model, stages with done criteria, security.
- `docs/DECISIONS.md` — full decision history. `README.md` — how to run.
