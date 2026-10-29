import { apiFetch } from "@/lib/api";
import type { AbsenceResult } from "../model/types";

export function deleteAbsence(id: string) {
  return apiFetch<AbsenceResult>(`/absences/${id}`, { method: "DELETE" });
}
