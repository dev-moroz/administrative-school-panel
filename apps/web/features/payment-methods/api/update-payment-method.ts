import { apiFetch } from "@/lib/api";
import type { PaymentMethod } from "../model/types";

export type UpdatePaymentMethodInput = { code: string; name: string; icon: string; isActive: boolean };

export function updatePaymentMethod({ code, ...payload }: UpdatePaymentMethodInput) {
  return apiFetch<PaymentMethod>(`/payment-methods/${code}`, { method: "PATCH", body: JSON.stringify(payload) });
}
