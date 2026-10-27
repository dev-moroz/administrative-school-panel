import { describe, expect, it } from "vitest";
import { currencySchema, toCreatePayload } from "./currency-schema";

const valid = { code: "EUR", name: "Euro", decimals: "2" };
const parse = (patch: Partial<typeof valid> = {}) => currencySchema.safeParse({ ...valid, ...patch });

describe("currencySchema", () => {
  it("accepts a valid currency", () => {
    expect(parse().success).toBe(true);
  });

  it("uppercases and trims the code", () => {
    const result = parse({ code: " usdt " });
    expect(result.success && result.data.code).toBe("USDT");
  });

  it.each(["A", "ABCDEFGHIJK", "EU R", "EU-R", "ЕВРО", ""])("rejects the code %j", (code) => {
    expect(parse({ code }).success).toBe(false);
  });

  it.each(["AB", "ABCDEFGHIJ", "T1", "USDC"])("accepts the code %j", (code) => {
    expect(parse({ code }).success).toBe(true);
  });

  it("requires a name of 1 to 50 characters after trimming", () => {
    expect(parse({ name: "   " }).success).toBe(false);
    expect(parse({ name: "x".repeat(50) }).success).toBe(true);
    expect(parse({ name: "x".repeat(51) }).success).toBe(false);
  });

  it.each(["0", "2", "8"])("accepts decimals %s", (decimals) => {
    expect(parse({ decimals }).success).toBe(true);
  });

  it.each(["", "-1", "9", "1.5", "abc"])("rejects decimals %j", (decimals) => {
    expect(parse({ decimals }).success).toBe(false);
  });
});

describe("toCreatePayload", () => {
  it("sends decimals as a number", () => {
    expect(toCreatePayload({ code: "USDT", name: "Tether", decimals: "6" })).toEqual({ code: "USDT", name: "Tether", decimals: 6 });
  });
});
