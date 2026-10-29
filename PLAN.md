# PLAN.md — MVP development plan

Context and accepted decisions are in `CLAUDE.md`. Here: structure, data model, stages.
Working mode: every stage follows "Development workflow" in `CLAUDE.md` (plan → tests → implementation → report → commit). Claude writes the code; Anatoly approves the plan and the tests and reviews the result. If Anatoly wants to write a part by hand, he says so; Claude may also flag parts worth going through together.

## 1. Repository structure

```
english-school-admin/
  apps/
    api/          # NestJS
    web/          # Next.js (App Router)
  docker-compose.yml     # postgres + mailpit (dev)
  pnpm-workspace.yaml
  CLAUDE.md, PLAN.md
```

Nest modules (one per domain area): `auth`, `users`, `roles` (roles and permissions), `students`, `lessons`, `freezes`, `ledger` (balance), `payments`, `files` (payment proofs), `audit`, `mail`, `schedule` (recurring lessons), `telegram` (bot and notifications), `settings`.

## 2. Data model (Prisma draft, pending approval)

- **User**: email (unique), passwordHash, locale (default en; other languages later), isActive, mustChangePassword, roleId.
- **RefreshToken**: userId, tokenHash (a hash, not the token itself), expiresAt, revokedAt?, createdAt. Revoked on password/role change.
- **Role** / **Permission** / **RolePermission**: role = a set of permissions such as `students.read`, `payments.create`. Access is checked by permission, not by role name. System roles: `admin`, `teacher`, `student` (`manager` — later, without schema changes). The split is in `docs/DECISIONS.md`, "Roles and access".
- **Student**: teachers (many-to-many through `StudentTeacher`; in the MVP every student is linked to the only teacher, no filtering by it yet), userId (unique; optional while students have no web login, see open questions), full name, telegramUsername, telegramChatId (set when the student starts the bot), English level, manager comment, defaultCurrency (references `Currency`), lessonPrice (Decimal, in the default currency; price history is not stored). Student time zone is dropped for now (2026-10-23): the teacher should not have to ask for it; can be added later by a migration.
- **Teacher**: userId, full name, timeZone (the base for the schedule and the cancellation rules, changeable), telegramChatId. One record in the MVP, linked to the teacher's user (role `teacher`); the admin has no `Teacher` record. No UI.
- **StudentTeacher**: studentId, teacherId, createdAt; unique (studentId, teacherId). Links students to teachers (many-to-many). Created together with the student, linked to the only teacher in the MVP. Which teacher conducts a particular lesson is not decided yet (see open questions).
- **Lesson**: teacherId, startsAt, durationMin, status (`SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`), cancelledAt?, charged (the "charge" checkbox: for a no-show and for a late cancellation; the system suggests the value by the cancellation rules, the admin has the final say), seriesId?, rescheduledFromId, cancelReason, notes.
- **LessonSeries**: teacherId, studentId, weekday, localStartTime (in the teacher's time zone), durationMin, startsOn, endsOn?. Generates the recurring lessons; one-off (floating) lessons are created without a series.
- **LessonParticipant**: lessonId + studentId (unique). One student now; groups later without migrating relations.
- **Freeze**: studentId, startsAt, endsAt, reason, createdById. On creation, the scheduled lessons in the period are moved to `CANCELLED`.
- **LedgerEntry** (balance ledger): studentId, delta (±int), type (`PURCHASE | LESSON_CHARGE | LESSON_REVERSAL | MANUAL_ADJUSTMENT`), lessonId?, paymentId?, comment (required for a manual adjustment), createdById, createdAt. **Balance = SUM(delta)**; entries are never edited or deleted — only compensated.
- **Payment**: studentId, amount (Decimal), currency (code, references `Currency`; defaults to the student's currency, can be changed for a single payment), paidAt, method (`CASH | CARD | TRANSFER | CRYPTO`), comment, proofUrl?, proofFileId?, lessonsGranted (int, 1..100), createdById. `remainder` (Decimal: the part of the amount not converted to lessons) is after the MVP (Anatoly, 2026-10-26), not in the schema; `amount` is `Decimal(28,8)`, shown by the currency's `decimals`. On creation, `LedgerEntry(PURCHASE, +lessonsGranted)` is written in the same transaction.
- **AuditLog**: actorId, entity, entityId, action, before (Json), after (Json), reason?, createdAt. Written for lessons, the balance ledger and payments.
- **Setting**: key-value; cancellation rules (morning ends at 12:00, evening starts at 17:00, late window 1 hour), the low-balance threshold N (global or per student: open question). The lesson price lives in the student's profile; a payment keeps amount, currency, number of lessons credited and the remainder, so old payments do not change when the price changes.
- **Currency**: code (unique), name, decimals, isActive. A table, not an enum, so the admin can add a currency without a migration (initially EUR, USDT, USDC). A currency used in payments can be deactivated but not deleted.
- **TelegramInvite**: studentId, tokenHash (a hash, not the token itself), expiresAt, usedAt?, createdAt. One-time; a new invite for the same student invalidates the old one.
- **Notification**: studentId?, type (`LOW_BALANCE`), channel (`TELEGRAM`), sentAt, balanceAtSend. So the same reminder is not sent twice.

Principles: money is `Decimal`, not float; every balance and payment change happens in a transaction together with its audit record; time is stored in UTC; the teacher's time zone is the base for the schedule and the cancellation rules (changeable in settings); the student's time zone only affects how time is displayed.

## 3. Stages

*Working order: backend and frontend parts of a stage alternate (a backend part, then its UI), not all backend first.*
*Status marks: **done (date)** / **next** / **todo**. Done steps are not re-read; details are in git log and `docs/DECISIONS.md`. Ideas and tails: `BACKLOG.md`.*

**Stage 0 — scaffolding** — **done (2026-10-20)**: pnpm monorepo, `docker-compose.yml` (PostgreSQL 16 + Mailpit) for development, README with run commands, `nest new`, Next.js (`output: 'standalone'`) + Tailwind + shadcn/ui + next-intl, Prisma, `.env.example`, linters. The tweakcn theme — you paste the CSS variables yourself.
*Done when:* both apps start (web :3000, api :4000), Postgres and Mailpit run in Docker.

**Stage 1 — authentication and permissions** — **done (2026-10-23)**: Prisma schema User/Role/Permission; Nest: login, JWT access + refresh, permission guard; Next: login page, protected routes (Next middleware: redirect without a session; rewrites `/api` → Nest), token storage (httpOnly cookie), no language switcher (English only for now); global `ValidationPipe({ whitelist: true })` and `helmet`; `RefreshToken` model in the schema. *React/Nest: routing, forms, validation (react-hook-form + zod), guards, DTOs, pipes.*
**High priority, part of stage 1 — the `teacher` role** (Anatoly does it in a separate chat; the split is in `docs/DECISIONS.md`, "Roles and access"): add the role and its permissions to the seed, a teacher user, and extend the "role × endpoint" tests with it.
*Done when:* login/logout via httpOnly cookie works; the permission guard reads from the DB; the "role × endpoint" e2e auth tests pass; the interface is in English via next-intl; the `teacher` role exists in the seed and is covered by the tests.
- Beyond the plan, done: throttling and strict `OriginGuard` (2026-10-22/23) → DECISIONS: "Sessions and refresh"; admin shell, `SessionGuard`, refresh on 401 (2026-10-22) → DECISIONS: "Frontend structure".

**Docker check** — **done (2026-10-26)** **(moved to after stage 3, Anatoly, 2026-10-25; a quick check only, the full packaging stays in stage 10)**: trial build of the api and web images, run in containers, check env/architecture.
*Done when:* the api and web images build and start, login works in the containers.

**Stage 2 — students** — **done (2026-10-25)**: student CRUD (create, edit, deactivate), server-side search and pagination, `Currency`/`Teacher`/`Student`/`StudentTeacher` in the schema. Students have no `User` and no web login; no emails in this stage (decided 2026-10-23). *Tables, filters, search, pagination, server state (TanStack Query), optimistic updates.*
*Done when:* the teacher creates and edits a student (name, Telegram nickname, English level, comment, default currency, lesson price); the list has search and pagination; the card shows the Telegram status "not invited". The invite link, `TelegramInvite` and the bot handshake are in stage 8. Mailpit stays in `docker-compose.yml` but is unused until the Users module and password reset.
- Beyond the plan, done: inactive students marked in the list (2026-10-25) → DECISIONS: "Entity UI".

**Stage 3 — balance ledger** — **done (2026-10-25, backend and frontend)**: `ledger` module, balance calculation, manual adjustment with a comment. *Prisma transactions, service layer, unit tests.*
*Done when:* balance = SUM(delta); a manual adjustment requires a comment; a negative balance is shown as debt; the service unit tests pass.
- → DECISIONS: "Balance ledger", "Balance UI".

**Stage 4 — payments** — **done (2026-10-27)** (split 2026-10-26: 4a payments API with a proof link, done; 4b proof file upload and protected download, backend; 4c frontend; currencies admin is a separate step and lives in Settings (`/settings/currencies`); the money remainder is after the MVP): payment form (amount, currency, method, proof — file or link, number of lessons credited), history with multiple currencies. The number of lessons is suggested as floor(amount ÷ the student's lesson price) when the payment currency equals the price currency; the remainder is shown next to the lessons (for example 6 lessons + 10 EUR). In another currency the number of lessons is entered by hand. The admin manages the list of currencies. *Complex forms, file upload (multer), Decimal.* **Carry-over from stage 3:** the migration adds `LedgerEntry.paymentId` (FK to `Payment`, `Restrict`) and the `PURCHASE` entry is written with it in the payment transaction.
*Done when:* a payment is created in one transaction together with PURCHASE; the history shows different currencies; the proof is available only to authorized users.
- 4a payments API — done (2026-10-26) → DECISIONS: "Payments".
- 4b proof files, backend — done (2026-10-26) → DECISIONS: "Payment proof files".
- 4c payments frontend (form, feed, Payments page, student panel section) — done (2026-10-26).
- Settings shell (`/settings`, second side panel) — done (2026-10-27).
- Currencies admin (A backend, B frontend) — done (2026-10-27).
- Payment methods admin: enum → table, icons (A, B) — done (2026-10-27).
- Student default payment method (A, B) — done (2026-10-27) → DECISIONS: "Student default payment method".
- Beyond the plan, done (UI): dark theme and theme switch (2026-10-26/27); shadcn replacement: tabs, pagination, `ListPage`, payments table view (2026-10-27); sidebar width and landing on `/students`.

**Stage 5 — lessons and calendar** — **next**: Lesson CRUD, recurring schedules (`LessonSeries`) plus one-off lessons, the cancellation rules in the teacher's time zone, FullCalendar (view, create/edit on click), statuses and their effect on the balance (completed −1, no-show and late cancellation by the "charge" checkbox prefilled by the rules, other cancellations 0), rescheduling, freeze. *Complex state, integrating a third-party library, business rules on the backend.* **Carry-over from stage 3:** the migration adds `LedgerEntry.lessonId` (FK to `Lesson`, `Restrict`); decide the double-charge protection here (`PLAN.md`, section 5, rollback and `FOR UPDATE`); `LedgerService.addEntry` already takes a `tx`.
*Done when:* lessons are created and edited in the calendar; statuses change the balance correctly; recurring lessons are generated from a series; the checkbox is prefilled by the cancellation rules; rescheduling and freeze work.
- Split 2026-10-28 → DECISIONS: "Lessons and schedule (stage 5 design)".
- 5a lessons, statuses, automatic charge on lesson end, balance and double-charge protection — done (2026-10-28) → DECISIONS: "Lessons API (stage 5a)".
- 5b series and the generator, student deactivation with future lessons — done (2026-10-28) → DECISIONS: "Lesson series (stage 5b)".
- 5c FullCalendar UI — done (2026-10-29).
- Split of 5d–5k 2026-10-29 → DECISIONS: "Absences, overlaps and manual changes (stage 5d design)".
- 5d base time zone Moscow (series, generator, forms) — done (2026-10-29) → DECISIONS: "Base time zone: Moscow".
- 5e `manuallyChanged` flag on lessons (backfill for existing data; series use it instead of comparing the time) — done (2026-10-29) → DECISIONS: "Manual changes flag (stage 5e)".
- 5f overlap check: warning on manual create/move, the generator skips a busy slot once (`SeriesSkip`) — done (2026-10-29) → DECISIONS: "Overlap check (stage 5f)".
- 5g absences API: student freeze and teacher vacation, edit and restore rules — next.
- 5h absences UI and "Back to schedule" with confirmation — todo.
- 5i student deactivation confirmation dialog — todo.
- 5j remaining lessons on the students list tile — todo → DECISIONS: "Student card: balance and Schedule tab".
- 5k "Schedule" tab in the student card (next 6 lessons) — todo → same section.
- Settings: cancellation rules storage (school-wide thresholds, evaluated in the teacher's zone → DECISIONS: "Settings concept") and cancel reasons admin (`/settings/cancel-reasons`) — todo (after 5c, Anatoly, 2026-10-28).

**Stage 6 — notifications** — **todo** (added 2026-10-29, design session later): in-app notifications for the teacher and the admin (generator conflicts and other system events). Details are decided in its own design session.

**Stage 7 — dashboard and reports** — **todo**: key figures for the admin, including students with few lessons left; a per-student report for a chosen period (lessons held, missed, cancelled and charged, payments, balance at the start and end), visible to the teacher for her students. The student web page is postponed (the bot replaces it in stage 8).
*Done when:* the admin has a dashboard with figures and a "negative balance" list and a "few lessons left" list; the period report for a student shows the counts and the list of lesson dates.

**Stage 8 — Telegram bot and notifications** — **todo**: a bot for students (remaining lessons; upcoming lessons: to confirm) and notifications to the teacher. When a lesson is charged and the balance drops to the threshold N, a message goes to the student and to the teacher; one message per threshold crossing (`Notification`). Linking is decided (`docs/DECISIONS.md`, "Linking a student to the bot"): a closed bot, the teacher generates a one-time invite link, the student presses Start, `telegramChatId` and `telegramUsername` are saved; unlinked chats are ignored. Rescheduling through the bot is not in the MVP. *Webhooks/long polling, an external API, idempotency.*
*Done when:* a student can get their balance in the bot; when the remaining lessons reach N, the student and the teacher get one message; a repeated charge does not duplicate it.

**Stage 9 — audit** — **todo**: interceptor/service that records the audit, change history view.
*Done when:* balance, payment and lesson changes are written to AuditLog and visible in the view.

**Stage 10 — packaging** — **todo**: Dockerfiles for api and web (web — standalone build), nginx only for HTTPS and proxying to web, prod `docker-compose`, a light image for 1 core / 2 GB, VPS deployment, reverse proxy + HTTPS, daily `pg_dump` in cron with rotation.
*Done when:* the images build; the prod compose starts on the server over HTTPS; the backup is created on schedule and restores correctly (verified).


## 4. Role separation security (mandatory rules)

1. **Deny by default.** A global guard: an endpoint without an explicit `@RequirePermission(...)` or `@Public()` mark is unavailable. Forgetting protection is impossible.
2. **Ownership check (object-level).** A permission is not enough: a student with the "see own" permission gets data only for their own `studentId`, taken from the session, not from the URL/body. Admin endpoints (`/students/:id/...`) and student endpoints (`/me/...`) are separate.
3. **Responses through DTOs.** Only explicitly listed fields go out; `passwordHash`, the manager's internal comments and other people's data never reach a student response.
4. **Payment proofs** (screenshots) are served only through an authorized endpoint with an ownership check, not as public static files.
5. **Passwords:** argon2 (or bcrypt), a temporary password from the email with a mandatory change (`mustChangePassword`), login attempt rate limit.
6. **Cookies:** httpOnly, `Secure`, `SameSite`, CSRF protection; refresh tokens are stored in the DB (can be revoked on password/role change).
7. **Next middleware is not a security boundary**, only a convenience (redirects). The real check is on the backend.
8. **Authorization tests:** an e2e "role × endpoint" matrix (admin, student, anonymous, student A against student B's data). A failing test blocks the stage. Expected results come from the documents (this section and `docs/DECISIONS.md`, "Roles and access"), not from the implementation.
9. **Audit:** role/permission changes, payments and manual balance adjustments are written to `AuditLog`.
10. **Secrets and logs:** `.env` stays out of git; no passwords, tokens or personal data in logs.

## 5. Open questions for the stages

- ~~Token storage~~ — decided: httpOnly cookie (not localStorage). Implemented in stage 1 (`Secure`, `SameSite` flags, CSRF protection for mutations).
- ~~Negative balance~~ — decided: **allowed** (the lesson was held, payment not yet made). Balance = SUM(delta) may be < 0, shown in the UI as debt/in red, and the dashboard has a "negative balance" list. There is no ban on charging.
- ~~Where to store permissions~~ — decided: only in the DB, not in the JWT; the guard reads them on every request, an in-memory cache only if needed.
- Permissions: checked by permission (`payments.create`, etc.), "own" vs "other's" — via an access scope (`students.read.own` / `students.read.all`). Details — in stage 1.
- Rolling back a lesson status (completed → cancelled) writes `LESSON_REVERSAL`. The "one charge per lesson" rule is enforced in code for now. **Discuss in stage 3:** race protection (double click/retry). A simple `UNIQUE(lessonId) WHERE type='LESSON_CHARGE'` does not work: after a rollback the lesson can be charged again. Options — an index that accounts for the rollback (for example `reversedAt`) or locking the lesson row in the transaction (`SELECT … FOR UPDATE`).
- Proof file storage: a local folder in dev; in production a Docker volume (cloud later).
- ~~Scheduling time zone~~ — decided 2026-10-21: the teacher's time zone is the base (schedule and cancellation rules), changeable in settings; the student's zone is for display only; daylight saving time is not tracked separately. Open: what happens to existing recurring lessons if the teacher changes the zone.
- **To discuss (separate chat):** monitoring is not in the plan yet: whether the app is up, whether the daily backup succeeded, whether Telegram notifications are delivered (a failed reminder must not pass silently). Decide before stage 8 and stage 10.
- **To confirm:** the low-balance threshold N (global or per student); ~~how a student is linked to a Telegram chat~~ (decided 2026-10-21, invite link with a token); ~~whether students need a web login~~ (decided 2026-10-21: no in the MVP, so stage 2 account creation with email passwords is postponed and `Student.userId` stays empty); the list of payment methods; whether the bot also shows upcoming lessons.
- Money remainder: it should be added to the next payment's calculation (confirmed 2026-10-21), but this is a side case and is done after the MVP; in the MVP the remainder is only shown. Open: what happens to it if the student's currency changes.
