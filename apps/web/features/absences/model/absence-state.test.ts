import { describe, expect, it } from "vitest";
import { absenceRules, absenceState } from "./absence-state";

const TODAY = "2026-11-10";
const period = (startsOn: string, endsOn: string) => ({ startsOn, endsOn });

describe("absenceState", () => {
  it("is future when it starts after today", () => {
    expect(absenceState(period("2026-11-11", "2026-11-20"), TODAY)).toBe("future");
  });

  it("is ongoing from its first day to its last day inclusive", () => {
    expect(absenceState(period("2026-11-10", "2026-11-20"), TODAY)).toBe("ongoing");
    expect(absenceState(period("2026-11-01", "2026-11-10"), TODAY)).toBe("ongoing");
  });

  it("is past after its last day", () => {
    expect(absenceState(period("2026-11-01", "2026-11-09"), TODAY)).toBe("past");
  });
});

describe("absenceRules", () => {
  it("future: start and end editable, can be deleted, nothing before today", () => {
    expect(absenceRules("future", TODAY)).toEqual({ canEditStart: true, canEditEnd: true, canDelete: true, minStart: TODAY, minEnd: TODAY });
  });

  it("ongoing: only the end, not before today, cannot be deleted", () => {
    expect(absenceRules("ongoing", TODAY)).toEqual({ canEditStart: false, canEditEnd: true, canDelete: false, minStart: null, minEnd: TODAY });
  });

  it("past: read-only", () => {
    expect(absenceRules("past", TODAY)).toEqual({ canEditStart: false, canEditEnd: false, canDelete: false, minStart: null, minEnd: null });
  });
});
