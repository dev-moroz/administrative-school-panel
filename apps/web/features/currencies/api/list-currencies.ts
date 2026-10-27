import { apiFetch } from "@/lib/api";
import type { Currency } from "../model/types";

export function listCurrencies() {
  return apiFetch<Currency[]>("/currencies");
}
