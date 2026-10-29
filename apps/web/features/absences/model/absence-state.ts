import { toBaseParts } from "@/lib/base-time-zone";

export type AbsenceState = "future" | "ongoing" | "past";

export const todayInBase = () => toBaseParts(new Date()).date;

export function absenceState(period: { startsOn: string; endsOn: string }, today: string): AbsenceState {
  if (period.startsOn > today) return "future";
  return period.endsOn < today ? "past" : "ongoing";
}

// Mirrors the API edit rules (stage 5g): a started absence keeps its start and cannot be deleted.
export function absenceRules(state: AbsenceState, today: string) {
  if (state === "future") return { canEditStart: true, canEditEnd: true, canDelete: true, minStart: today, minEnd: today };
  if (state === "ongoing") return { canEditStart: false, canEditEnd: true, canDelete: false, minStart: null, minEnd: today };
  return { canEditStart: false, canEditEnd: false, canDelete: false, minStart: null, minEnd: null };
}
