import { apiFetch } from "@/lib/api";
import type { LedgerPage } from "../model/types";

export function listLedger(studentId: string, { page, pageSize }: { page: number; pageSize: number }) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<LedgerPage>(`/students/${studentId}/ledger?${params}`);
}
