import { describe, expect, it } from "vitest";
import { adjustSchema, toAdjustPayload } from "./adjust-schema";

const parse = (delta: string, comment = "fix") => adjustSchema.safeParse({ delta, comment });

describe("adjustSchema delta", () => {
  it.each(["+3", "-2", "5", "50", "-50", "+50"])("accepts %s", (delta) => {
    expect(parse(delta).success).toBe(true);
  });

  it.each(["", " ", "0", "+0", "-0", "1.5", "abc", "1e2", "51", "-51", "+", "-"])("rejects %j", (delta) => {
    expect(parse(delta).success).toBe(false);
  });
});

describe("adjustSchema comment", () => {
  it("rejects an empty or whitespace-only comment", () => {
    expect(parse("1", "").success).toBe(false);
    expect(parse("1", "   ").success).toBe(false);
  });

  it("accepts up to 1000 characters and rejects more", () => {
    expect(parse("1", "a".repeat(1000)).success).toBe(true);
    expect(parse("1", "a".repeat(1001)).success).toBe(false);
  });
});

describe("toAdjustPayload", () => {
  it("converts delta to a number and trims the comment", () => {
    expect(toAdjustPayload({ delta: "+3", comment: "  fix " })).toEqual({ delta: 3, comment: "fix" });
    expect(toAdjustPayload({ delta: "-2", comment: "x" })).toEqual({ delta: -2, comment: "x" });
    expect(toAdjustPayload({ delta: " 7 ", comment: "x" })).toEqual({ delta: 7, comment: "x" });
  });
});
