import { apiFetch } from "@/lib/api";
import type { toCreatePayload } from "../model/currency-schema";
import type { Currency } from "../model/types";

export function createCurrency(payload: ReturnType<typeof toCreatePayload>) {
  return apiFetch<Currency>("/currencies", { method: "POST", body: JSON.stringify(payload) });
}
