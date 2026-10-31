# STATUS.md — bookmark of the open step

Only the step in progress lives here. On commit the entry is cleared and the step is marked done in `PLAN.md`.
History: git log and `docs/archive/STATUS-until-2026-10-28.md` (do not read unless Anatoly asks).

No step is open. Next: Settings B — cancel reasons admin (`PLAN.md`). Agreed scope: `CancelReasonsService`, `POST /cancel-reasons`, `PATCH /cancel-reasons/:code`, permissions `cancel-reasons.create/update` (admin), admin sees inactive ones, system codes (`STUDENT_FREEZE`, etc.) cannot be deactivated (409); page like `/settings/payment-methods` plus a nav item.
