import { describe, expect, it } from "vitest";
import { getProfileSections } from "./sections";

describe("getProfileSections", () => {
  it("offers Absences to a teacher with absences.manage", () => {
    expect(getProfileSections({ teacherId: "t1", permissions: ["absences.manage"] })).toEqual([
      { key: "absences", href: "/profile/absences" },
    ]);
  });

  it("offers nothing without a teacher record", () => {
    expect(getProfileSections({ teacherId: null, permissions: ["absences.manage"] })).toEqual([]);
  });

  it("offers nothing without absences.manage", () => {
    expect(getProfileSections({ teacherId: "t1", permissions: [] })).toEqual([]);
  });
});
