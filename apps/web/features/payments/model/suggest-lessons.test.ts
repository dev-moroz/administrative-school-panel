import { describe, expect, it } from "vitest";
import { suggestLessons } from "./suggest-lessons";

const base = { amount: "400", price: "50.00", paymentCurrency: "EUR", priceCurrency: "EUR", decimals: 2 };

describe("suggestLessons", () => {
  it("returns floor(amount / price)", () => {
    expect(suggestLessons(base)).toBe(8);
    expect(suggestLessons({ ...base, amount: "449.99" })).toBe(8);
    expect(suggestLessons({ ...base, amount: "2400.50" })).toBe(48);
  });

  it("does not suffer from float errors", () => {
    expect(suggestLessons({ ...base, amount: "0.30", price: "0.10" })).toBe(3);
    expect(suggestLessons({ ...base, amount: "1.10", price: "0.10" })).toBe(11);
  });

  it("works with zero-decimal currencies", () => {
    expect(suggestLessons({ amount: "4000", price: "500", paymentCurrency: "JPY", priceCurrency: "JPY", decimals: 0 })).toBe(8);
  });

  it("returns null when the amount does not cover one lesson", () => {
    expect(suggestLessons({ ...base, amount: "49.99" })).toBeNull();
  });

  it("returns null when the payment currency differs from the price currency", () => {
    expect(suggestLessons({ ...base, paymentCurrency: "GBP" })).toBeNull();
  });

  it.each([
    ["no price", { price: null }],
    ["no price currency", { priceCurrency: null }],
    ["zero price", { price: "0.00" }],
    ["empty amount", { amount: "" }],
    ["non-numeric amount", { amount: "abc" }],
    ["negative amount", { amount: "-100" }],
    ["more decimals than the currency allows", { amount: "10.555" }],
  ])("returns null for %s", (_name, patch) => {
    expect(suggestLessons({ ...base, ...patch })).toBeNull();
  });

  it("returns null above the 100-lesson limit", () => {
    expect(suggestLessons({ ...base, amount: "5000" })).toBe(100);
    expect(suggestLessons({ ...base, amount: "5050" })).toBeNull();
  });
});
