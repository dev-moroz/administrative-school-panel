# BACKLOG.md — open tails and ideas (not approved)

Nothing here is planned. An item moves to `PLAN.md` only after Anatoly approves it. One line per item; `[stage N]` = where it belongs.

## Waiting for Anatoly's OK (small fixes)
- `apps/web/vitest.config.ts` → `vitest.config.mts` (Vite `configLoader: 'native'` warning, ESM in a CommonJS package).
- `messages/en.json`: the `Home` strings are unused (landing page is `/students`).
- `components/ui/dropdown-menu.tsx` is unused (kept for future menus); hand-written, can be replaced with `shadcn add dropdown-menu`.
- `features/payments/ui/payments-compact-list.tsx` mixes local `getDate()` with `format.dateTime` (time zone mismatch).
- Admin layout: sidebar toggle and header are commented out (TODO in `app/(admin)/layout.tsx`); rework the page template and bring the toggle back for mobile. Ctrl/Cmd+B still collapses the sidebar.
- Two tabs refreshing at the same moment can trigger refresh reuse detection (fix with `navigator.locks`).
- `apps/api/src/ledger/ledger.mapper.spec.ts`: two type-only `tsc` errors since `createdBy` became nullable (stage 5a); tests pass.
- Replace string permission keys with constants (`permissions.ts`, `as const`, `PermissionKey`) used by the seed and `@RequirePermission` (Anatoly, 2026-10-22: last, when time allows).

## Notes for future stages
- [stage 6] Generator conflicts (skipped busy slots) must go to notifications; until then only the log and audit.
- [stage 6] A conflict notification appears once; later runs show only new conflicts.
- [stage 5] FullCalendar needs dark theme styling.
- [stage 5] Decide the double-charge protection (`PLAN.md`, section 5).
- [stage 8] Telegram avatar for students (cards, rows, panel) — frozen by Anatoly (2026-10-25).
- [stage 8] Incoming payments through the bot — see `docs/DECISIONS.md`, "Incoming payments through the Telegram bot" and "notes for stage 7" (old numbering, now stage 8).
- [stage 8 / 10] Monitoring (app up, backup succeeded, Telegram delivered) — discuss in a separate chat before stages 8 and 10.
- [stage 10] Production volume for `UPLOADS_DIR`.
- [Users module] Remove the temporary teacher seed (`TEACHER_*`), see `docs/DECISIONS.md`, "Teacher seed is temporary".
- [Users module] Deactivating a user must revoke all their refresh tokens.
- [Users module] `User.mustChangePassword` is in `PLAN.md` but not in the schema; add when the admin creates users with temporary passwords.
- [after MVP] Money remainder added to the next payment's calculation.

## Ideas (idea only)
- Where the teacher sets her vacation (her profile or a separate Settings section) and who else may — grill later.
- Calendar toggle "show cancelled lessons" (cancelled stay visible for now).
- Dashboard on `/` (today's lessons, week/month summary) instead of the `/students` redirect, after stage 5.
- Roles section in Settings.
- Settings (school): contacts and payment details, bot message templates, low-balance N, default time zone → DECISIONS: "Settings concept".
- Teacher profile: working hours (calendar highlight, confirm outside) and days off → DECISIONS: "Settings concept".
- Several colour schemes via `[data-theme]` blocks; theme toggle label may become icon-only.
- Unify the two local `Field` components (`payment-form.tsx`, `student-form.tsx`).
- Use `ListPage` for Lessons.
- "Add new" in the currency dropdown of the student form.
- Teacher access to currencies admin (by permission).
- Hint when the teacher list is empty in the admin student form — frozen (Anatoly, 2026-10-25).
- A better list layout to replace the payments feed.
