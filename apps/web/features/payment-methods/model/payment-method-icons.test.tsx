import { describe, expect, it } from "vitest";
import { PAYMENT_METHOD_ICON_COMPONENTS, PAYMENT_METHOD_ICONS } from "./payment-method-icons";

// Keep in sync with apps/api/src/payment-methods/payment-method-icons.ts.
const EXPECTED = [
  "banknote", "credit-card", "landmark", "bitcoin", "wallet", "smartphone", "hand-coins", "circle-dollar-sign",
  "coins", "dollar-sign", "euro", "pound-sterling", "russian-ruble", "badge-dollar-sign", "piggy-bank",
  "arrow-left-right", "send", "globe", "qr-code", "nfc", "smartphone-nfc", "mail",
  "receipt", "store", "building-2", "handshake", "wallet-cards", "gift",
];

describe("PAYMENT_METHOD_ICONS", () => {
  it("lists the 28 agreed icon names, without duplicates", () => {
    expect([...PAYMENT_METHOD_ICONS].sort()).toEqual([...EXPECTED].sort());
    expect(new Set(PAYMENT_METHOD_ICONS).size).toBe(28);
  });

  it("has a component for every name in the list", () => {
    for (const name of PAYMENT_METHOD_ICONS) expect(PAYMENT_METHOD_ICON_COMPONENTS[name], name).toBeDefined();
  });

  it("has no component without a name in the list", () => {
    expect(Object.keys(PAYMENT_METHOD_ICON_COMPONENTS).sort()).toEqual([...PAYMENT_METHOD_ICONS].sort());
  });
});
