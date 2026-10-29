import { describe, expect, it } from "vitest";
import { absenceSchema, toAbsencePayload, type AbsenceFormValues } from "./absence-schema";

const TODAY = "2026-11-10";
const valid: AbsenceFormValues = { startsOn: "2026-11-12", endsOn: "2026-11-20", comment: "" };

const errorPaths = (patch: Partial<AbsenceFormValues>, limits: { minStart: string | null; minEnd: string } = { minStart: TODAY, minEnd: TODAY }) => {
  const result = absenceSchema(limits).safeParse({ ...valid, ...patch });
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("absenceSchema", () => {
  it("accepts a valid period", () => {
    expect(errorPaths({})).toEqual([]);
  });

  it("requires both dates", () => {
    expect(errorPaths({ startsOn: "" })).toContain("startsOn");
    expect(errorPaths({ endsOn: "" })).toContain("endsOn");
  });

  it("allows a one-day period, rejects an end before the start", () => {
    expect(errorPaths({ endsOn: "2026-11-12" })).toEqual([]);
    expect(errorPaths({ endsOn: "2026-11-11" })).toContain("endsOn");
  });

  it("does not let the start be before today; today is fine", () => {
    expect(errorPaths({ startsOn: TODAY })).toEqual([]);
    expect(errorPaths({ startsOn: "2026-11-09" })).toContain("startsOn");
  });

  it("ignores a locked start (ongoing) but keeps the end not before today", () => {
    const ongoing = { minStart: null, minEnd: TODAY };
    expect(errorPaths({ startsOn: "2026-11-01", endsOn: TODAY }, ongoing)).toEqual([]);
    expect(errorPaths({ startsOn: "2026-11-01", endsOn: "2026-11-09" }, ongoing)).toContain("endsOn");
  });

  it("limits the comment to 1000 characters", () => {
    expect(errorPaths({ comment: "a".repeat(1000) })).toEqual([]);
    expect(errorPaths({ comment: "a".repeat(1001) })).toContain("comment");
  });
});

describe("toAbsencePayload", () => {
  it("trims the comment and drops an empty one", () => {
    expect(toAbsencePayload({ ...valid, comment: "  Sick leave " })).toEqual({ startsOn: "2026-11-12", endsOn: "2026-11-20", comment: "Sick leave" });
    expect(toAbsencePayload({ ...valid, comment: " " })).toEqual({ startsOn: "2026-11-12", endsOn: "2026-11-20" });
  });
});
