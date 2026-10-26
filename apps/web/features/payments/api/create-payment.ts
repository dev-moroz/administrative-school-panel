import { apiFetch } from "@/lib/api";
import type { CreatePaymentPayload, Payment } from "../model/types";

export function createPayment(payload: CreatePaymentPayload) {
  return apiFetch<Payment>("/payments", { method: "POST", body: JSON.stringify(payload) });
}
