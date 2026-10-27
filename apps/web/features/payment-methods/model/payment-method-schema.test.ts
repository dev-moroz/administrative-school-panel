import { describe, expect, it } from "vitest";
import { PAYMENT_METHOD_ICONS } from "./payment-method-icons";
import { paymentMethodSchema, toCreatePayload } from "./payment-method-schema";

const valid = { code: "WISE", name: "Wise", icon: "globe" };
const parse = (patch: Record<string, unknown> = {}) => paymentMethodSchema.safeParse({ ...valid, ...patch });

describe("paymentMethodSchema", () => {
  it("accepts a valid method", () => {
    expect(parse().success).toBe(true);
  });

  it("uppercases and trims the code", () => {
    const result = parse({ code: " pay_pal " });
    expect(result.success && result.data.code).toBe("PAY_PAL");
  });

  it.each(["A", "A".repeat(21), "WI SE", "WI-SE", "ВАЙЗ", ""])("rejects the code %j", (code) => {
    expect(parse({ code }).success).toBe(false);
  });

  it.each(["AB", "A".repeat(20), "PAY_PAL", "P2P"])("accepts the code %j", (code) => {
    expect(parse({ code }).success).toBe(true);
  });

  it("requires a name of 1 to 50 characters after trimming", () => {
    expect(parse({ name: "   " }).success).toBe(false);
    expect(parse({ name: "x".repeat(50) }).success).toBe(true);
    expect(parse({ name: "x".repeat(51) }).success).toBe(false);
  });

  it("requires an icon from the list", () => {
    expect(parse({ icon: "" }).success).toBe(false);
    expect(parse({ icon: "rocket" }).success).toBe(false);
    expect(parse({ icon: undefined }).success).toBe(false);
  });

  it("accepts every icon from the list", () => {
    for (const icon of PAYMENT_METHOD_ICONS) expect(parse({ icon }).success).toBe(true);
  });

  it("isActive is optional", () => {
    expect(parse({ isActive: false }).success).toBe(true);
  });
});

describe("toCreatePayload", () => {
  it("sends code, name and icon only", () => {
    expect(toCreatePayload({ code: "WISE", name: "Wise", icon: "globe", isActive: true })).toEqual({ code: "WISE", name: "Wise", icon: "globe" });
  });
});
