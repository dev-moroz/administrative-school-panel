# DECISIONS.md — all accepted decisions (detailed)

> Read as needed, not in full every session. A short summary is in `CLAUDE.md`.

> The final plan, repository structure and data model draft are in `PLAN.md`. Current status: all questions are closed, stage 0 (scaffolding) is next. Anatoly will pick and paste the tweakcn theme himself.

Status at the time of restoration: at that point there was only discussion and planning. Now (2026-10-17) the stage 0 scaffolding is created — the current state is in `STATUS.md`.

## Goal and way of working

- Learning project: practice **React/Next.js** (forms, validation, server data/cache, tables and filters, state, authentication, routing) and **NestJS** (the backend was always secondary for the author — he wants to understand it thoroughly). His experience is Vue/Nuxt; a stack different from Vue is exactly what is needed.
- Goal of the practice: to be able to recall how it went in practice at a React interview.
- **Way of working:** not vibe-coding. Anatoly writes the key parts himself; Claude designs, breaks work into tasks, explains, reviews and takes the routine and the hard parts. Don't write everything for him — explain why.
- Communication language: Russian.

## What the product is

An admin panel for an English school (one-on-one lessons). The admin configures everything; students see their remaining lessons and schedule.

## Accepted decisions

**Stack** (proposed in Codex, Anatoly agreed): a monorepo on pnpm workspaces.
- Frontend: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. **Decided 2026-10-17:** Next runs as a Node server in `output: 'standalone'` mode (light Docker image), not a static export. Rendering: pages are static by default (SSG shells), data is fetched on the client (TanStack Query); no SSR without need, pages don't call `cookies()`/`headers()`. The Next server is needed for middleware (redirecting unauthenticated users) and rewrites `/api` → Nest.
- Backend: NestJS + TypeScript, a separate REST API
- DB: PostgreSQL + Prisma
- Authentication: email + password, JWT (access/refresh)
- i18n: **changed 2026-10-20** — the next-intl scaffold (locale in a cookie, no URL prefixes) is kept, but English only for now; RU and the language switcher are postponed. Anatoly has the AI do the translations.
- UI: friendly (not strict), a ready-made Tailwind base. **The skin is not chosen yet** (see "Remaining").

**Development without Docker:** the apps (Nest, Next) run directly (fast hot reload). Postgres and Mailpit are started with `docker compose up -d` (`docker-compose.yml` in the root). The apps themselves don't run in Docker during development. Postgres version in dev = version in production.

**Deployment:** local development → packaging in Docker (a trial image build once after stage 1, so surprises don't pile up; mind the server architecture) → the cheapest server (≈1 core, 2 GB). The system must be light. Deployment after the MVP.

**Roles and access**
- Two roles in the MVP: `admin` (can do everything; also the manager and the teacher) and `student`. A `manager` role is possible but unimportant for now.
- `teacher` — for the future, must be heavily restricted; **postponed**, not in the MVP.
- Roles and permissions are **configurable, as in the Strapi admin** (role = a set of permissions), so a new role or permission can be added without rework. Don't hardcode checks by role name — check permissions.
- The admin creates an account in the interface, enters the email, and the **login and password are sent to that email** (simple automation, no self-registration).
- Student cabinet: one read-only page — remaining lessons and the time of upcoming lessons.

**Lessons and balance**
- One-on-one lessons only; group lessons later.
- Lesson: date/time, teacher, student, duration, status `scheduled | completed | cancelled | no-show`.
- Payment → N lessons added to the student's account (manually). They can top up without waiting for the previous package to end.
- `completed` → charge 1; `cancelled` → don't charge.
- `no-show` → charge or not — **chosen by the teacher/admin with a checkbox** on the specific lesson.
- Rescheduling a lesson: the old one is cancelled, a new one is created/moved.
- **Freeze:** during a freeze, scheduled lessons are cancelled and the balance is kept.
- Manual balance adjustment — with a mandatory comment (for example, "compensation for a cancellation").
- Price: a fixed price per lesson. Package cost = number of lessons. Personal prices — in the future.

**Payments**
- Store the original amount and currency (EUR, USD, crypto, etc.), no automatic conversion. Conversion and exchange rates — later.
- Fields: student, amount, currency, date, method (cash/card/transfer/crypto), comment, proof (screenshot or link — both options), who entered the record.
- A payment and the lesson credit are **separate records** (`Payment` and `LedgerEntry`), but they are created by one form and one transaction: the admin immediately specifies the number of lessons to credit.
- The payment history must show all currencies.
- Proof is free-form at the start: a screenshot or a link, or just an admin note "funds received, +N lessons". Screenshots are preferably uploaded to the app (local storage in dev).

**The balance may go negative** (a lesson was held before payment) — this is a normal case, shown as debt.

**Role security is a priority:** deny by default, data ownership checks, responses only through DTOs, "role × endpoint" tests (details — `PLAN.md`, section 4).

**Tokens:** httpOnly cookie. The JWT contains only the user identifier; **role and permissions are not put into the token — they are always read from the DB** (the single source of truth) on every protected request. Nest gives the frontend the permissions (for example `/auth/me`) only for hiding buttons; the real check is done by the guard on the backend.

**Audit:** built in from the start (not as a second stage) — at least for lessons, balance and payments: who changed what, when and why.

**Student fields (confirmed):** full name, contacts, English level, manager comment, start date, time zone, Telegram/WhatsApp.

**Password recovery (decided 2026-10-21):** "forgot password" is a planned capability: the user requests it, a confirmation code arrives by email, the user enters it and sets a new password. The schema provides for it from the start (`PasswordResetToken` model: hashed code, expiry, used-at, attempt counter), and `User.mustChangePassword` (default `false`; `true` only for accounts created with a temporary password). The endpoint and the UI are not required in the first versions, they are added later without schema changes.

**Not in the MVP:** notifications, self-registration, teacher cabinet, groups/courses, automatic currency conversion, personal prices.

## Architectural foundations (Codex's recommendation, accepted in essence)

Don't build "for growth", but lay down:
- separate `User`, `Student`, `Teacher` — one user can have all powers for now, roles won't need to be reworked later;
- a lesson is a separate entity, not a counter;
- **the balance is not a number but an operations ledger** (credited +8, lesson held −1, manual adjustment +1); the balance is computed from the ledger; this is also the basis of the audit;
- lesson participants are a separate relation (one student now, groups later without breaking changes);
- a payment and the lesson credit are separate records, created in one transaction.

Calendar (**in the MVP**, decided 2026-10-17): the only library mentioned in the dialogue is FullCalendar (there is no separate dialogue with a different recommendation: Anatoly's "ChatGPT" is this very Codex dialogue). The first version — viewing and creating/editing a lesson on click, without drag&drop, recurring schedules or time zone conflicts (these are much harder).

## Done

- Discussion of requirements and stack, answers to two rounds of questions. Nothing else.
- The session broke off because the Codex limit ran out (resets 14 November 2026). Codex's last attempt — searching for ready-made Tailwind/shadcn admin templates — gave no result. The dialogue text sent by Anatoly matches the session file.

## Remaining

0. ~~`teacher` role~~ — closed: postponed, only admin + student in the MVP, permissions configurable.
1. Choose the visual base: pick 2–3 options (shadcn/ui blocks — dashboard/sidebar, Tailwind templates), show Anatoly, he chooses the "skin".
2. Draw up the final development plan: monorepo and Nest module structure, data model (Prisma schema), API, Next.js pages, stages and the React + Nest learning route.
3. ~~Calendar and emails~~ — closed 2026-10-17: calendar on **FullCalendar**; emails with login/password — **Mailpit** in dev, plain SMTP in production.
4. Initialize the monorepo (pnpm workspaces), docker-compose with PostgreSQL, base Next.js and NestJS.
5. Implement in stages: auth + roles → students → packages/balance ledger → lessons (+freeze, rescheduling) → payments with proofs → dashboard, search, filters → student page → i18n → audit log.
6. Later: Docker packaging and deployment to a weak server, extended schedule/calendar, teacher cabinet, groups and courses, exchange rates.

## Open questions

- The final plan and Prisma schema are drawn up **after all questions are closed** (Anatoly's decision).
- ~~Linking a payment to the credit~~ — closed: when entering a payment the admin immediately specifies the number of lessons to credit (one form, one ledger entry); a separate link in the UI — later.
- The "skin" choice remains (shadcn blocks + theme), then the final plan and Prisma schema.
- **Scheduling time zone** — open, decide at the start of stage 5 (school's or student's; storage in UTC either way).
- **Protection against double lesson charging** — open, stage 3 (account for rollback; see `PLAN.md`, section 5).
- Decided 2026-10-17 after the external audit: separate `.env` files for each app (the root one only for Docker Compose), Docker ports only on 127.0.0.1, `RefreshToken` in the schema, backups in stage 8.
