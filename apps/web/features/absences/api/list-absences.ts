import { apiFetch } from "@/lib/api";
import type { Absence, AbsenceOwner } from "../model/types";

export function listAbsences(owner: AbsenceOwner) {
  return apiFetch<Absence[]>(`/absences?${new URLSearchParams(owner)}`);
}
