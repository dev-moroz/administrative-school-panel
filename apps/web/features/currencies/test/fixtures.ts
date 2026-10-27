import type { Currency } from "../model/types";

export function makeCurrency(patch: Partial<Currency> = {}): Currency {
  return { code: "EUR", name: "Euro", decimals: 2, isActive: true, ...patch };
}
