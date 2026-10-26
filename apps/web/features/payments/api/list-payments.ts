import { apiFetch } from "@/lib/api";
import type { PaymentListParams, PaymentsPage } from "../model/types";

export function listPayments({ page, pageSize, studentId }: PaymentListParams) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (studentId) params.set("studentId", studentId);
  return apiFetch<PaymentsPage>(`/payments?${params}`);
}
