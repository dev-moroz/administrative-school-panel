import { apiFetch } from "@/lib/api";
import type { toCreatePayload } from "../model/payment-method-schema";
import type { PaymentMethod } from "../model/types";

export function createPaymentMethod(payload: ReturnType<typeof toCreatePayload>) {
  return apiFetch<PaymentMethod>("/payment-methods", { method: "POST", body: JSON.stringify(payload) });
}
