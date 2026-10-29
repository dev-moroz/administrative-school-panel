# STATUS.md — bookmark of the open step

Only the step in progress lives here. On commit the entry is cleared and the step is marked done in `PLAN.md`.
History: git log and `docs/archive/STATUS-until-2026-10-28.md` (do not read unless Anatoly asks).

**Current step:** stage 5c (FullCalendar UI).
**Phase:** implementation (frontend committed; open tail below)  <!-- plan | tests | implementation | report -->

## Approved plan
- Backend: lesson DTO gets `seriesId` and `originalDate` (null for one-off lessons); e2e test on `GET /lessons` (and single lesson).
- Frontend `features/lessons/`:
  - api: list (from/to), create, update, change-status, cancel-preview, delete, cancel-reasons, create-series, split-series.
  - model: `use-lessons(range)` keyed by the visible range; mutations invalidate `lessons` and the student balance; `lesson-schema` (zod: student, date, time, duration, notes, "repeat weekly"); `cancel-schema` (reason required for CANCELLED, charged checkbox, comment); `to-calendar-events` (lesson → our `CalendarEvent`, color by status, only SCHEDULED editable).
  - ui: `lesson-sheet` (side sheet like payments; slot click = create with prefilled time, lesson click = view/edit), `lesson-status-actions` (cancel / no-show / back to scheduled; cancel shows `cancel-preview` suggestion), `series-scope-dialog` ("only this" = PATCH, "this and following" = split), `delete-lesson-dialog`.
- Adapter (Anatoly): FullCalendar is imported only in `calendar-view.tsx` with our own interface: `CalendarEvent` type, `onRangeChange({from,to})`, `onSlotSelect({start,end})`, `onEventClick(id)`, `onEventChange({id,start,end,revert})`. Everything else knows only our types; tests mock `calendar-view`.
- Drag & drop and resize in 5c (Anatoly): one-off → PATCH; series lesson → scope dialog first; server error → `revert()` and an error message; only SCHEDULED is draggable.
- Time zone: the browser zone (Anatoly); times go to the server as ISO with offset; series weekday/startTime in the browser zone.
- Working-hours highlighting: not in 5c (Anatoly).
- Only MIT packages: `@fullcalendar/core`, `react`, `daygrid`, `timegrid`, `interaction` (Anatoly). Views: week (default), day, month.
- Tests: pure logic before code (`to-calendar-events`, schemas), api layer (URL/method/body), UI behavior with mocked `calendar-view` (create from slot, cancel requires reason + shows charge suggestion, scope dialog calls the right endpoint, drag error reverts, 409 on delete shown). No FullCalendar in jsdom.

## Notes
- Order: backend tests and code first, then frontend.
- Backend part done and committed (DTO `seriesId`, `originalDate` as YYYY-MM-DD, e2e green).
- Frontend tests approved. Remarks (Anatoly): no wrapper component, the page `app/(admin)/lessons/page.tsx` holds the wiring like payments (test `page.test.tsx`); no notes in the lesson form in the MVP; a lesson's student can't be changed; payload helpers live in `lesson-schema.ts` (like `payment-schema.ts`); UI texts approved as in the tests.
- Permissions: `lessons.read|create|update|delete`, `lesson-series.manage`; cancel-preview returns `{ suggestedCharged }`.
- Review fixes (Anatoly, 2026-10-28): cancel reasons were missing in the local DB, seed re-run; calendar fits the screen height (hours scroll inside, no hour cropping); FullCalendar v7 (`@fullcalendar/react` + `core`), Monarch theme with the green palette, following light/dark theme. Status colors are checked by Anatoly.
- Review fixes (Anatoly, 2026-10-29): no page heading on Lessons; colors: scheduled light green, completed dark green, cancelled and no-show grey, no strike-through.
- **Open tail, next chat (Anatoly):** status-change comment goes into the ledger entry too, format "<reason name>: <comment>" (only the reason when there is no comment); backend e2e test first. Frontend: "Back to scheduled" opens a small form with an optional comment.
