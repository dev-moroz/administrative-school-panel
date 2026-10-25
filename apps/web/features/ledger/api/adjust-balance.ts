import { apiFetch } from "@/lib/api";
import type { LedgerEntry } from "../model/types";

export function adjustBalance(studentId: string, payload: { delta: number; comment: string }) {
  return apiFetch<LedgerEntry>(`/students/${studentId}/ledger/adjustments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
