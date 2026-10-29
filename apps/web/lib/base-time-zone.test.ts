import { describe, expect, it } from "vitest";
import { toBaseParts } from "./base-time-zone";

// November 2026: Belgrade is UTC+1, Moscow is UTC+3 (no DST).
describe("toBaseParts", () => {
  it("shifts only the hours when Moscow is the same day", () => {
    expect(toBaseParts(new Date("2026-11-03T13:00:00Z"))).toEqual({ date: "2026-11-03", time: "16:00", weekday: 2 });
    expect(toBaseParts(new Date("2026-11-02T07:00:00Z"))).toEqual({ date: "2026-11-02", time: "10:00", weekday: 1 });
  });

  it("moves to the next day and weekday past Moscow midnight", () => {
    expect(toBaseParts(new Date("2026-11-08T22:30:00Z"))).toEqual({ date: "2026-11-09", time: "01:30", weekday: 1 });
  });

  it("returns Sunday as 7", () => {
    expect(toBaseParts(new Date("2026-11-08T09:00:00Z")).weekday).toBe(7);
  });
});
