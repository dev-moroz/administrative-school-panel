import { describe, expect, it } from "vitest";
import { getBalanceBadge } from "./get-balance-badge";

describe("getBalanceBadge", () => {
  it.each([
    ["negative", -1, 2, true, "debt"],
    ["zero", 0, 2, true, "low"],
    ["equal to the threshold", 2, 2, true, "low"],
    ["above the threshold", 3, 2, true, null],
    ["zero with threshold 0", 0, 0, true, "low"],
    ["one with threshold 0", 1, 0, true, null],
    ["inactive in debt", -2, 2, false, "debt"],
    ["inactive with one lesson", 1, 2, false, null],
    ["threshold not loaded, positive", 1, undefined, true, null],
    ["threshold not loaded, negative", -1, undefined, true, "debt"],
  ] as const)("%s → %s", (_label, balance, threshold, isActive, expected) => {
    expect(getBalanceBadge(balance, threshold, isActive)).toBe(expected);
  });
});
