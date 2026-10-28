# CLAUDE.md — English School Admin Panel (MVP)

**Session workflow:** read `STATUS.md` first (a bookmark of the open step only). If a step is open, continue from its phase and its approved plan. If none is open, take the step marked **next** in `PLAN.md`; skip steps marked done. Read `docs/DECISIONS.md` and `BACKLOG.md` only by the relevant section. Never read `docs/archive/` unless Anatoly asks.
**Do not write into the documents anything Anatoly has not confirmed.**

## Working mode
- Learning project: React/Next.js + NestJS. Anatoly is the manager, Claude writes the code; the procedure is in "Development workflow" below.
- Tokens are limited: work in stages, one session per stage, narrow requests, don't re-read unnecessarily.
- Communication language: Russian.
- **Code comments: keep them to a minimum, and write them in English only.**

## Development workflow (applies to every task)
Anatoly acts as the manager: he approves the plan and the tests, reviews the result and confirms. Claude writes the code. Goal: no wasted steps or rework, save context and tokens.
1. **Plan (no code).** Describe what will be done: modules/components/files and what each is responsible for, logic and data flow, what the tests will cover. Then **stop and wait for an explicit OK**. On remarks, update the plan and wait again. Task size does not skip this step.
2. **Tests first (TDD).** After the plan is approved, write only the tests as a spec. **Do not run them** (there is no code yet, they would fail by definition). Show which scenarios are covered and how they map to the plan, then **stop and wait for an OK on the tests**. Do not start the implementation until then.
   - After the plan is approved, and again after the tests are approved, write the step, its phase and the full approved plan (with Anatoly's remarks) into `STATUS.md`, so a new chat can continue without re-approval.
   - Backend (NestJS) and frontend business logic (hooks, utils, forms): tests strictly before code.
   - Purely visual React components: a behavior test (render states, clicks) is written together with the component, no style tests. The plan is still approved first.
3. **Implementation.** Write the code until the approved tests pass. Never change the tests to fit the code; if a test looks wrong, stop and discuss. Stay inside the approved plan; if a deviation is needed, stop and agree first.
4. **Report.** Only now run the tests and send a short report: test result, what was implemented, which files changed, what to check by eye. Anatoly reviews and may ask questions; fixes are made by Claude.
5. **Commit.** Once tests pass and Anatoly has confirmed, commit without being reminded, then **stop**. After a step is confirmed and committed, do NOT start the next step in the same session: no planning, no reading files for it, no proposing its plan. Anatoly continues in a new chat (the next step starts there with a plan). One commit per logical change. In the same commit: clear `STATUS.md`, mark the step done in `PLAN.md` (one line, with a `→ DECISIONS` link if needed), put confirmed decisions into `docs/DECISIONS.md` and open tails or unapproved ideas into `BACKLOG.md` (one line each). `git push` only on explicit request. Stage only the files (or hunks) Claude changed in the current session; other modified files stay uncommitted for Anatoly to commit later.
- Commit identity (do not search for it each time, do not change git config): `git -c user.name="Anatoly Morozov" -c user.email="dev_moroz@mail.ru" commit -F <file>`. End every commit message with one trailer line: `Co-Authored-By: Claude <model> <noreply@anthropic.com>` (take the model name from the attribution notice of the current session). Do NOT add a `Claude-Session` line or any session URL: the repository is public.
- Claude writes all the code by default. If Anatoly wants to write a part by hand, he says so while the plan is discussed; Claude may also flag non-trivial parts to go through together.
- Anatoly wants to understand React: briefly explain non-obvious things (hooks, server components, etc.) in the plan or after the implementation.
- Cheap change tracking: `STATUS.md` first, then `git log --oneline -n 10` and `git diff --stat`; don't re-read files that were just written or already reviewed.

### Test commands (run from the repo root)
- API (Vitest): `pnpm --filter api test:e2e` (e2e), `pnpm --filter api test` (unit).
- Web (Vitest): `pnpm --filter web test`.

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

## UI consistency
Keep the UI consistent across the whole system. Before building a UI element, look at existing components and pages that already do the same thing and reuse them or repeat their style (e.g. "create" buttons have no icon). Do not introduce a new variant without agreeing first.

## Not in the MVP
Reminders about the lessons themselves, self-registration, student web cabinet, filtering data by teacher (a teacher sees only her own students; the student–teacher link itself is already in the schema), groups/courses, automatic currency conversion, package expiry, price history.

## Where things live
- `STATUS.md` — bookmark of the step in progress (phase and approved plan); empty when no step is open.
- `BACKLOG.md` — open tails and unapproved ideas; an item moves to `PLAN.md` only after Anatoly approves it.
- `docs/archive/` — old history (e.g. `STATUS-until-2026-10-28.md`); not read by default.
- `PLAN.md` — structure, data model, stages with status marks (done / next / todo) and done criteria, security. Only what and in what order, no details.
- `docs/DECISIONS.md` — full decision history. `README.md` — how to run.
