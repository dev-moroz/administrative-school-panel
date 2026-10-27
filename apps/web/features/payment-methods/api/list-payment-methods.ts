import { apiFetch } from "@/lib/api";
import type { PaymentMethod } from "../model/types";

export function listPaymentMethods() {
  return apiFetch<PaymentMethod[]>("/payment-methods");
}
