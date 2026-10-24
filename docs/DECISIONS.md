# DECISIONS.md — all accepted decisions (detailed)

> Read as needed, not in full every session. A short summary is in `CLAUDE.md`.

> The final plan, repository structure and data model draft are in `PLAN.md`. Current status: all questions are closed, stage 0 (scaffolding) is next. Anatoly will pick and paste the tweakcn theme himself.

Status at the time of restoration: at that point there was only discussion and planning. Now (2026-10-17) the stage 0 scaffolding is created — the current state is in `STATUS.md`.

## Goal and way of working

- Learning project: practice **React/Next.js** (forms, validation, server data/cache, tables and filters, state, authentication, routing) and **NestJS** (the backend was always secondary for the author — he wants to understand it thoroughly). His experience is Vue/Nuxt; a stack different from Vue is exactly what is needed.
- Goal of the practice: to be able to recall how it went in practice at a React interview.
- **Way of working (changed 2026-10-23, Anatoly):** Anatoly is the manager: Claude writes the code, Anatoly approves the plan and the tests, reviews the result and confirms. The procedure (plan → tests → implementation → report → commit) is in `CLAUDE.md`, "Development workflow". Claude explains non-obvious React/Nest parts so the learning goal is kept.
- Communication language: Russian.

## What the product is

An admin panel for an English school (one-on-one lessons). The admin (the teacher herself) runs everything on the site; students get their remaining-lesson count and reminders in a Telegram bot (a student web cabinet is postponed, 2026-10-21).

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
- **Three roles in the MVP (decided 2026-10-21, HIGH PRIORITY, part of stage 1):** `admin`, `teacher`, `student`. A `manager` role is possible later.
  - `admin` is Anatoly's account in production: can do everything, including the teacher's actions (he keeps improving the system and helps the teacher). The admin has no `Teacher` record.
  - `teacher` is the teacher's own account for daily work. She has a `Teacher` record (time zone, Telegram chat). A separate account protects the settings from accidental changes.
  - `student` has no web login in the first version (the Telegram bot replaces it), but the role stays in the system.
  - Planned split (exact permission keys are defined when writing the seed):
    - teacher: students (including lesson price and default currency), lessons, calendar, recurring series, freezes, payments, manual balance adjustments, cancellation rules, the low-balance threshold N, her own profile (time zone, Telegram), adding a new currency (tentative, Anatoly is not sure; easy to change by permission).
    - admin only: users, roles and permissions, editing and deactivating currencies, system settings, the full audit log. Decided 2026-10-21: the teacher sees the change history (audit) of her own students' lessons, payments and balance; the system-wide audit log (users, roles, settings) stays admin-only.
  - Access stays permission-based, never by role name; the "role × endpoint" tests get the new role.
  - **Student–teacher link (decided 2026-10-22):** many-to-many through the `StudentTeacher` table from the start (Anatoly's choice, mainly for practice and modular growth; a single `Student.teacherId` was considered and would also have been enough). In the MVP every student is linked to the only teacher, automatically on creation. Lessons and payments reach the teacher through the student. Filtering by teacher (a teacher sees only her own students) is not in the MVP; student reads go through the service layer with the current user passed in, so the filter can be added in one place. Open: which teacher conducts a given lesson when a student has several (affects cancellation rules, time zone, notifications); decided when a second teacher appears.
  - Decided 2026-10-22: the teacher never deletes students; she marks them inactive through an ordinary update. `students.delete` is admin-only.
  - Decided 2026-10-22, HTTP statuses of the guard: 401 — no session, invalid or expired token, or the user is inactive; 403 — the user is signed in but lacks the required permission, or the endpoint has no access mark (deny by default). The "role × endpoint" tests are derived from this document and `PLAN.md`, section 4, never from the code; if code and document disagree, the document is right until Anatoly changes it.
  - Anatoly implements this himself in a separate chat.
- Roles and permissions are **configurable, as in the Strapi admin** (role = a set of permissions), so a new role or permission can be added without rework. Don't hardcode checks by role name — check permissions.
- The admin creates an account in the interface, enters the email, and the **login and password are sent to that email** (simple automation, no self-registration).
- Student cabinet: **postponed 2026-10-21** — the first version uses a Telegram bot for students instead of a web page.

**Lessons and balance**
- One-on-one lessons only; group lessons later.
- Lesson: date/time, teacher, student, duration, status `scheduled | completed | cancelled | no-show`.
- Payment → N lessons added to the student's account (manually). They can top up without waiting for the previous package to end.
- `completed` → charge 1; `cancelled` → don't charge.
- `no-show` → charge or not — **chosen by the teacher/admin with a checkbox** on the specific lesson.
- **Cancellation rules (2026-10-21, in the teacher's time zone):** morning lessons are before 12:00, daytime from 12:00, evening from 17:00. Cancelling a morning lesson on the same day, or a daytime/evening lesson less than an hour before it, means the lesson is charged. The teacher sometimes forgives a late cancellation (rare or first-time cases), so the checkbox decides; the system prefills it by the rules (to confirm).
- Rescheduling a lesson: the old one is cancelled, a new one is created/moved.
- **Freeze:** during a freeze, scheduled lessons are cancelled and the balance is kept.
- Manual balance adjustment — with a mandatory comment (for example, "compensation for a cancellation").
- Package (updated 2026-10-21): a fixed number of lessons (usually 8), the price varies. No expiry yet, it may be added later. The lesson price is stored in the student's profile; entering a payment amount suggests lessons = amount ÷ price (rounded down), and the rest is kept as a money remainder shown next to the lessons (for example 6 lessons + 10 EUR). Price history is not needed for now. Confirmed by Anatoly 2026-10-21.

**Payments**
- Store the original amount and currency (EUR, USDT, USDC; updated 2026-10-21), no automatic conversion. The payment method must be recorded. Currencies are an extendable list (a table, not a fixed set); each student has a default currency in the profile, and the currency can be changed for a single payment (confirmed 2026-10-21). Conversion and exchange rates — later.
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

**Telegram and notifications (decided 2026-10-21):** the main reminder is "the package is about to end": when the remaining lessons reach N, a message goes to the student and to the teacher in Telegram. Reminders about the lessons themselves are not needed. The bot also lets a student see their remaining lessons.

**Linking a student to the bot (decided 2026-10-21, Anatoly confirmed):** students have no web login in the MVP (the role `student` stays, `Student.userId` stays empty). The bot is closed: the teacher creates the student on the site, the system generates a one-time invite link `t.me/<bot>?start=<token>` and shows it to her (she sends it to the student). The student presses Start; the bot finds the token, saves `telegramChatId` (in a private chat it equals the Telegram user id) and `telegramUsername` in the student's card, invalidates the token and sends a welcome message. The card shows the status ("not invited" / "waiting for Start" / "linked"). The bot cannot message a person by nickname before they press Start (Telegram restriction), so the link is by token, not by nickname. The nickname is only a hint for the teacher and may change; the link is by `telegramChatId`. The bot ignores any chat that is not linked. No session, cookie or password for the student. Rescheduling through the bot is not in the MVP: at most a "request to reschedule" notification to the teacher, who changes the lesson on the site (later, to discuss).

**Time zones (decided 2026-10-21):** the teacher's time zone is the base for the schedule and the cancellation rules, and it can be changed in settings. The student's zone only affects how time is displayed. Daylight saving time is not tracked separately.

**Not in the MVP:** reminders about lessons, self-registration, student web cabinet, filtering data by teacher (a teacher sees only her own students; the student–teacher link itself is already in the schema), groups/courses, automatic currency conversion, package expiry, price history.

## Teacher's requirements (2026-10-21)

Context: one teacher, no tracking system. She keeps records in a spreadsheet: payments come to her sole proprietorship in various ways, she divides the amount by the lesson price to get the number of lessons, and tells each student in Telegram "paid until such date". Every few days she copies the dates of held lessons into the spreadsheet (personal control; the system should replace it, so no export is planned).
- The biggest time sink: reconciling paid lessons with missed and rescheduled ones, and issuing a new package. This is the core of the product.
- The most wanted automation: a reminder that the package is ending.
- Only the teacher uses the admin. Students would like to see their remaining lessons.
- Most lessons are recurring, some are floating. Some students live in other time zones.
- Interface language: English is enough.
- A period report per student is important (2026-10-21): lessons held, missed, cancelled and charged, payments, balance. It replaces her manual counting and date copying. Planned for stage 6; decided 2026-10-21: the report is for the teacher only, on screen. Sending it to students or exporting it is optional and possible later; students get only the low-balance reminder in Telegram.

## Architectural foundations (Codex's recommendation, accepted in essence)

Don't build "for growth", but lay down:
- separate `User`, `Student`, `Teacher` — one user can have all powers for now, roles won't need to be reworked later;
- a lesson is a separate entity, not a counter;
- **the balance is not a number but an operations ledger** (credited +8, lesson held −1, manual adjustment +1); the balance is computed from the ledger; this is also the basis of the audit;
- lesson participants are a separate relation (one student now, groups later without breaking changes);
- a payment and the lesson credit are separate records, created in one transaction.

Calendar (**in the MVP**, decided 2026-10-17): the only library mentioned in the dialogue is FullCalendar (there is no separate dialogue with a different recommendation: Anatoly's "ChatGPT" is this very Codex dialogue). The first version — viewing and creating/editing a lesson on click, without drag&drop. **Updated 2026-10-21:** recurring lessons are now in scope (most lessons repeat weekly, some are one-off).

## Frontend structure (2026-10-22)
- Full FSD is not used: it clashes with the Next App Router (`app/`, `pages/`) and is too heavy for a solo MVP.
- Light feature-based layout instead: `features/<name>/{ui,model,api}` with a public `index.ts`; `app/` stays thin and only composes pages; shared code in `components/ui` and `lib`. Can grow into FSD later (`entities`, `shared`) if needed.

## Sessions and refresh (2026-10-22)
- Refresh happens on the client: `apiFetch` calls `/auth/refresh` on a 401 (single flight, one retry, auth endpoints excluded). The refresh cookie path is `/api/auth`, so pages (and `proxy.ts`) never see it.
- `proxy.ts` only redirects `/login` to `/` when `access_token` exists. It does not gate pages: an expired access cookie with a live refresh cookie must not send the user to `/login`.
- `SessionGuard` wraps the whole admin layout and shows only a loader until `GET /auth/me` succeeds; nothing of the shell or the page is shown to a visitor without a session. On a failed refresh it calls logout and goes to `/login`.
- The refresh window is sliding: every refresh issues a new token valid for `JWT_REFRESH_TTL_DAYS`. A user is logged out only after that long without activity.
- Without `refresh_token` the session ends when the access token expires; there is no way to re-issue a refresh token except login.
- Limit of live sessions: at most 5 per user (rows with `revokedAt = null` and not expired). A login over the limit revokes the oldest ones. Implemented in auth substep 4. Cleanup of old revoked/expired rows is still to be decided.
- Known gap: two tabs refreshing at the same moment can trigger reuse detection (possible fix: `navigator.locks`).

## Done

- Discussion of requirements and stack, answers to two rounds of questions. Nothing else.
- The session broke off because the Codex limit ran out (resets 14 November 2026). Codex's last attempt — searching for ready-made Tailwind/shadcn admin templates — gave no result. The dialogue text sent by Anatoly matches the session file.

## Remaining

0. **`teacher` role — HIGH PRIORITY, part of stage 1** (decided 2026-10-21; see "Roles and access").
1. Choose the visual base: pick 2–3 options (shadcn/ui blocks — dashboard/sidebar, Tailwind templates), show Anatoly, he chooses the "skin".
2. Draw up the final development plan: monorepo and Nest module structure, data model (Prisma schema), API, Next.js pages, stages and the React + Nest learning route.
3. ~~Calendar and emails~~ — closed 2026-10-17: calendar on **FullCalendar**; emails with login/password — **Mailpit** in dev, plain SMTP in production.
4. Initialize the monorepo (pnpm workspaces), docker-compose with PostgreSQL, base Next.js and NestJS.
5. Implement in stages: auth + roles → students → packages/balance ledger → lessons (+freeze, rescheduling) → payments with proofs → dashboard, search, filters → Telegram bot and notifications → audit log.
6. Later: Docker packaging and deployment to a weak server, extended schedule/calendar, filtering data by teacher, groups and courses, exchange rates.

## Open questions

- The final plan and Prisma schema are drawn up **after all questions are closed** (Anatoly's decision).
- ~~Linking a payment to the credit~~ — closed: when entering a payment the admin immediately specifies the number of lessons to credit (one form, one ledger entry); a separate link in the UI — later.
- The "skin" choice remains (shadcn blocks + theme), then the final plan and Prisma schema.
- ~~Scheduling time zone~~ — decided 2026-10-21 (see "Time zones"). Open: what happens to existing recurring lessons if the teacher changes her zone.
- Open questions from 2026-10-21 are listed in `PLAN.md`, section 5 ("To confirm").
- **Protection against double lesson charging** — open, stage 3 (account for rollback; see `PLAN.md`, section 5).
- Decided 2026-10-17 after the external audit: separate `.env` files for each app (the root one only for Docker Compose), Docker ports only on 127.0.0.1, `RefreshToken` in the schema, backups in stage 9.
- **Stage 2 scope (decided 2026-10-23, Anatoly):** students have no `User`, no web login, no password and no email; the stage is only student CRUD, search and pagination. The Telegram invite and handshake are stage 7 (`telegramChatId` is saved on Start). Mailpit and `User.mustChangePassword` are unused until the Users module and password reset. `Student.timeZone` is dropped for now so the teacher does not have to collect it; the teacher's zone stays the only base.
- **Student fields trimmed (decided 2026-10-23, Anatoly):** `whatsapp` and `phone` are dropped (contact is Telegram only); `startDate` is not entered by hand, it is derived from the first lesson or series once the schedule exists. Idea for stage 4 (not decided): when creating a lesson in the calendar, a "repeat weekly" checkbox creates a `LessonSeries` instead of a one-off lesson, with the option to edit dates by hand.
- **Teacher seed is temporary (decided 2026-10-23, Anatoly):** `TEACHER_EMAIL`, `TEACHER_PASSWORD`, `TEACHER_NAME` in `.env` make the seed create the first teacher (`User` with role `teacher` plus `Teacher`); it is skipped when they are empty and never overwrites an existing password. It exists only until the Users module can create teachers from the admin UI. **DEPRECATED once the Users module exists:** remove the teacher block from `apps/api/prisma/seed.ts`, the `TEACHER_*` lines from `env/api.env.example` and `test/env.ts`, and the seed-teacher scenarios in `test/schema.e2e-spec.ts` (tests then create teachers through the helpers).
- **Currency deactivation rule (decided 2026-10-23, Anatoly):** a currency used by at least one student (and later by payments) cannot be deactivated or deleted. The API refuses, and the UI shows a message such as "this currency is in use, it cannot be deactivated". Implemented in the currencies module, not in the schema.

## Known MVP limitations
Deliberate simplifications of the MVP (confirmed by Anatoly, 2026-10-23, stage 2 step 2, students API). Each one is expected and fine for now; grep this heading when something looks "missing".
- **A teacher sees all students.** There is no filtering by teacher yet (`students.read.all` returns everyone). The student–teacher link is already in the schema. A test in `test/students.e2e-spec.ts` pins this behavior and must be changed deliberately when the filter comes.
- **A student cannot be created without a teacher.** The teacher creates students for herself (teacher from the session). The admin has no `Teacher` record, so he must pass `teacherId` (400 otherwise). Unassigned students can come after the MVP.
- **The teacher of a student cannot be changed after creation** (one teacher in the MVP). No endpoint exists. When it comes: replace the link in one transaction, guarded by `students.assign-teacher`, and record it in the audit (the link row is deleted, so the history of "who taught before" is otherwise lost; a possible `endedAt` instead of deleting needs a migration).
- **Choosing the teacher at creation is the permission `students.assign-teacher`** (admin only). A teacher sending `teacherId` gets 403 (not silently ignored).
- **`telegramChatId` is not editable through the API.** It is set by the bot on Start (stage 7). The chat id is stable; `telegramUsername` is only a label and can change. Open for stage 7: unlink/relink a student, refresh the nickname from bot updates.
- **A currency cannot be created from the student form.** Only an existing active currency can be chosen. Idea for the currencies module and the UI: "add new" in the dropdown that calls `POST /currencies` first (needs a decision on who has `currencies.create`; today the admin only).
- **Deleting a student: only without history.** `DELETE /students/:id` (admin only, `students.delete`) is a real delete and is allowed only while the student has no lessons, payments or balance entries. There are no such tables yet, so it always succeeds today. When they appear, their foreign keys to the student are `Restrict` and the API answers 409 "has history, deactivate instead" (add the test then). Normal retirement of a student is `isActive = false` through `PATCH`.
- **The list returns compact items:** `id`, `fullName`, `telegramUsername` (decided 2026-10-23, Anatoly). No price, comment, level, currency, teacher or `isActive` there; the full card is `GET /students/:id`. Filtering by teacher later is a `where` on `student_teachers` (indexed) and does not depend on the selected columns; a teacher column is one more line in the list `select`.
- **Telegram avatar is after the MVP.** Idea (Anatoly): when the student presses Start, the bot saves the profile photo together with the nickname and name, and the students list shows it so the teacher recognises a student at a glance. Telegram file links contain the bot token and expire, so the photo has to be downloaded and stored by us and served from our own URL. Needs a new field/storage; planned with the bot (stage 7) or later.
- **Currencies list depends on permissions (2026-10-24).** `GET /currencies` returns all currencies (with `isActive`) to a user with `currencies.update` and only active ones to everyone else; there is no query parameter, the server decides. The check is on the permission, not the role name, so a future `manager` role works without changes.
- **`GET /teachers` is admin only (2026-10-24).** It needs `students.assign-teacher` (the list exists to pick a teacher for a new student) and returns `id` and `fullName` only. `Teacher` has no `isActive`, so inactive teachers are not filtered; add the field and a filter when there are many teachers.
