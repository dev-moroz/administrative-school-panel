import { apiFetch } from "@/lib/api";
import type { Absence, AbsencePeriodPayload, AbsenceResult } from "../model/types";

export function updateAbsence(id: string, payload: AbsencePeriodPayload) {
  return apiFetch<Absence & AbsenceResult>(`/absences/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
