import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { getOverlaps } from "./overlap";

const overlaps = [{ id: "l9", startsAt: "2026-11-04T08:00:00.000Z", durationMin: 60, student: { id: "s2", fullName: "Boris Ivanov" } }];

describe("getOverlaps", () => {
  it("returns the overlaps of a 409 LESSON_OVERLAP error", () => {
    expect(getOverlaps(new ApiError(409, undefined, { code: "LESSON_OVERLAP", overlaps }))).toEqual(overlaps);
  });

  it.each([
    ["another 409", new ApiError(409, undefined, { message: "Only a scheduled lesson can be moved" })],
    ["a 409 without a body", new ApiError(409)],
    ["another status", new ApiError(400, undefined, { code: "LESSON_OVERLAP", overlaps })],
    ["a non-API error", new Error("network")],
    ["nothing", null],
  ])("returns null for %s", (_name, error) => {
    expect(getOverlaps(error)).toBeNull();
  });
});
