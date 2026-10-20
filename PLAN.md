# PLAN.md — MVP development plan

Context and accepted decisions are in `CLAUDE.md`. Here: structure, data model, stages.
Legend: **[You]** — you write it yourself (key practice), **[Me]** — I do it (routine/scaffolding), **[Together]** — you write, I review.

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

Nest modules (one per domain area): `auth`, `users`, `roles` (roles and permissions), `students`, `lessons`, `freezes`, `ledger` (balance), `payments`, `files` (payment proofs), `audit`, `mail`, `settings`.

## 2. Data model (Prisma draft, pending approval)

- **User**: email (unique), passwordHash, locale (default en; other languages later), isActive, mustChangePassword, roleId.
- **RefreshToken**: userId, tokenHash (a hash, not the token itself), expiresAt, revokedAt?, createdAt. Revoked on password/role change.
- **Role** / **Permission** / **RolePermission**: role = a set of permissions such as `students.read`, `payments.create`. Access is checked by permission, not by role name. System roles: `admin`, `student` (`manager`, `teacher` — later, without schema changes).
- **Student**: userId (unique), full name, phone, telegram, whatsapp, English level, manager comment, start date, time zone.
- **Teacher**: userId, full name. One record in the MVP (the admin's), no UI.
- **Lesson**: teacherId, startsAt, durationMin, status (`SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`), chargeOnNoShow (the "charge" checkbox), rescheduledFromId, cancelReason, notes.
- **LessonParticipant**: lessonId + studentId (unique). One student now; groups later without migrating relations.
- **Freeze**: studentId, startsAt, endsAt, reason, createdById. On creation, the scheduled lessons in the period are moved to `CANCELLED`.
- **LedgerEntry** (balance ledger): studentId, delta (±int), type (`PURCHASE | LESSON_CHARGE | LESSON_REVERSAL | MANUAL_ADJUSTMENT`), lessonId?, paymentId?, comment (required for a manual adjustment), createdById, createdAt. **Balance = SUM(delta)**; entries are never edited or deleted — only compensated.
- **Payment**: studentId, amount (Decimal), currency (code: EUR/USD/BTC…), paidAt, method (`CASH | CARD | TRANSFER | CRYPTO`), comment, proofUrl?, proofFileId?, lessonsGranted (int), createdById. On creation, `LedgerEntry(PURCHASE, +lessonsGranted)` is written in the same transaction.
- **AuditLog**: actorId, entity, entityId, action, before (Json), after (Json), reason?, createdAt. Written for lessons, the balance ledger and payments.
- **Setting**: key-value; price of one lesson (amount + currency).

Principles: money is `Decimal`, not float; every balance and payment change happens in a transaction together with its audit record; time is stored in UTC and shown to the student in their time zone; the time zone the admin plans in is decided at the start of stage 5.

## 3. Stages

**Stage 0 — scaffolding [Me]**: pnpm monorepo, `docker-compose.yml` (PostgreSQL 16 + Mailpit) for development, README with run commands, `nest new`, Next.js (`output: 'standalone'`) + Tailwind + shadcn/ui + next-intl, Prisma, `.env.example`, linters. The tweakcn theme — you paste the CSS variables yourself.
*Done when:* both apps start (web :3000, api :4000), Postgres and Mailpit run in Docker.

**Stage 1 — authentication and permissions [Together]**: Prisma schema User/Role/Permission; Nest: login, JWT access + refresh, permission guard; Next: login page, protected routes (Next middleware: redirect without a session; rewrites `/api` → Nest), token storage (httpOnly cookie), no language switcher (English only for now); global `ValidationPipe({ whitelist: true })` and `helmet`; `RefreshToken` model in the schema. *React/Nest: routing, forms, validation (react-hook-form + zod), guards, DTOs, pipes.*
*Done when:* login/logout via httpOnly cookie works; the permission guard reads from the DB; the "role × endpoint" e2e auth tests pass; the interface is in English via next-intl.

**Docker check (after stage 1) [Together]**: trial build of the api and web images, run in containers, check env/architecture.
*Done when:* the api and web images build and start, login works in the containers.

**Stage 2 — students and account creation [Together]**: student CRUD, user creation with the login/password sent by email (password generated on the server, Mailpit in dev). *Tables, filters, search, pagination, server state (TanStack Query), optimistic updates.*
*Done when:* the admin creates a student; an email with login and password arrives in Mailpit; the first login requires a password change; the list has search and pagination.

**Stage 3 — balance ledger [You]**: `ledger` module, balance calculation, manual adjustment with a comment. *Prisma transactions, service layer, unit tests.*
*Done when:* balance = SUM(delta); a manual adjustment requires a comment; a negative balance is shown as debt; the service unit tests pass.

**Stage 4 — payments [Together]**: payment form (amount, currency, method, proof — file or link, number of lessons credited), history with multiple currencies. *Complex forms, file upload (multer), Decimal.*
*Done when:* a payment is created in one transaction together with PURCHASE; the history shows different currencies; the proof is available only to authorized users.

**Stage 5 — lessons and calendar [Together]**: *First decide the scheduling time zone (see "Open questions").* Lesson CRUD, FullCalendar (view, create/edit on click), statuses and their effect on the balance (completed −1, no-show by checkbox, cancelled 0), rescheduling, freeze. *Complex state, integrating a third-party library, business rules on the backend.*
*Done when:* lessons are created and edited in the calendar; statuses change the balance correctly; rescheduling and freeze work.

**Stage 6 — dashboard and student page [Together]**: key figures for the admin; for the student, one page "remaining lessons + upcoming lessons".
*Done when:* the admin has a dashboard with figures and a "negative balance" list; the student sees only their own balance and upcoming lessons.

**Stage 7 — audit [Together]**: interceptor/service that records the audit, change history view.
*Done when:* balance, payment and lesson changes are written to AuditLog and visible in the view.

**Stage 8 — packaging [Me + you]**: Dockerfiles for api and web (web — standalone build), nginx only for HTTPS and proxying to web, prod `docker-compose`, a light image for 1 core / 2 GB, VPS deployment, reverse proxy + HTTPS, daily `pg_dump` in cron with rotation.
*Done when:* the images build; the prod compose starts on the server over HTTPS; the backup is created on schedule and restores correctly (verified).


## 4. Role separation security (mandatory rules)

1. **Deny by default.** A global guard: an endpoint without an explicit `@RequirePermission(...)` or `@Public()` mark is unavailable. Forgetting protection is impossible.
2. **Ownership check (object-level).** A permission is not enough: a student with the "see own" permission gets data only for their own `studentId`, taken from the session, not from the URL/body. Admin endpoints (`/students/:id/...`) and student endpoints (`/me/...`) are separate.
3. **Responses through DTOs.** Only explicitly listed fields go out; `passwordHash`, the manager's internal comments and other people's data never reach a student response.
4. **Payment proofs** (screenshots) are served only through an authorized endpoint with an ownership check, not as public static files.
5. **Passwords:** argon2 (or bcrypt), a temporary password from the email with a mandatory change (`mustChangePassword`), login attempt rate limit.
6. **Cookies:** httpOnly, `Secure`, `SameSite`, CSRF protection; refresh tokens are stored in the DB (can be revoked on password/role change).
7. **Next middleware is not a security boundary**, only a convenience (redirects). The real check is on the backend.
8. **Authorization tests:** an e2e "role × endpoint" matrix (admin, student, anonymous, student A against student B's data). A failing test blocks the stage.
9. **Audit:** role/permission changes, payments and manual balance adjustments are written to `AuditLog`.
10. **Secrets and logs:** `.env` stays out of git; no passwords, tokens or personal data in logs.

## 5. Open questions for the stages

- ~~Token storage~~ — decided: httpOnly cookie (not localStorage). Implemented in stage 1 (`Secure`, `SameSite` flags, CSRF protection for mutations).
- ~~Negative balance~~ — decided: **allowed** (the lesson was held, payment not yet made). Balance = SUM(delta) may be < 0, shown in the UI as debt/in red, and the dashboard has a "negative balance" list. There is no ban on charging.
- ~~Where to store permissions~~ — decided: only in the DB, not in the JWT; the guard reads them on every request, an in-memory cache only if needed.
- Permissions: checked by permission (`payments.create`, etc.), "own" vs "other's" — via an access scope (`students.read.own` / `students.read.all`). Details — in stage 1.
- Rolling back a lesson status (completed → cancelled) writes `LESSON_REVERSAL`. The "one charge per lesson" rule is enforced in code for now. **Discuss in stage 3:** race protection (double click/retry). A simple `UNIQUE(lessonId) WHERE type='LESSON_CHARGE'` does not work: after a rollback the lesson can be charged again. Options — an index that accounts for the rollback (for example `reversedAt`) or locking the lesson row in the transaction (`SELECT … FOR UPDATE`).
- Proof file storage: a local folder in dev; in production a Docker volume (cloud later).
- **Scheduling time zone** (open, decide at the start of stage 5): which time zone the admin plans lessons and sees the calendar in — the school's (a `Setting`) or the student's. The student sees it in their own. Does not affect the architecture (storage in UTC).
