import { apiFetch } from "@/lib/api";
import type { Absence, AbsenceResult, CreateAbsencePayload } from "../model/types";

export function createAbsence(payload: CreateAbsencePayload) {
  return apiFetch<Absence & AbsenceResult>("/absences", { method: "POST", body: JSON.stringify(payload) });
}
