import { apiFetch } from "@/lib/api";
import type { Currency } from "../model/types";

export type UpdateCurrencyInput = { code: string; name: string; isActive: boolean };

export function updateCurrency({ code, ...payload }: UpdateCurrencyInput) {
  return apiFetch<Currency>(`/currencies/${code}`, { method: "PATCH", body: JSON.stringify(payload) });
}
