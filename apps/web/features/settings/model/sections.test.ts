import { describe, expect, it } from "vitest";
import {
  SETTINGS_SECTIONS,
  getAvailableSections,
  resolveSettingsAccess,
  type SettingsSection,
} from "./sections";

const sections: SettingsSection[] = [
  { key: "a", href: "/settings/a", permission: "a.manage" },
  { key: "b", href: "/settings/b", permission: "b.manage" },
] as unknown as SettingsSection[];

describe("SETTINGS_SECTIONS", () => {
  it("registers Currencies behind currencies.update", () => {
    expect(SETTINGS_SECTIONS).toContainEqual(
      expect.objectContaining({ href: "/settings/currencies", permission: "currencies.update" }),
    );
  });
});

describe("getAvailableSections", () => {
  it("returns Currencies for a user with currencies.update", () => {
    const result = getAvailableSections(["currencies.update"]);
    expect(result.map((s) => s.href)).toEqual(["/settings/currencies"]);
  });

  it("returns nothing without a matching permission", () => {
    expect(getAvailableSections([])).toEqual([]);
    expect(getAvailableSections(["currencies.read", "students.read.all"])).toEqual([]);
  });

  it("keeps registry order and only the permitted sections", () => {
    expect(getAvailableSections(["b.manage"], sections).map((s) => s.key)).toEqual(["b"]);
    expect(getAvailableSections(["b.manage", "a.manage"], sections).map((s) => s.key)).toEqual(["a", "b"]);
  });
});

describe("resolveSettingsAccess", () => {
  it("redirects to /students when the user has no sections at all", () => {
    expect(resolveSettingsAccess("/settings", [], sections)).toEqual({ type: "redirect", to: "/students" });
    expect(resolveSettingsAccess("/settings/a", [], sections)).toEqual({ type: "redirect", to: "/students" });
  });

  it("redirects to /settings when the section exists but is not permitted", () => {
    expect(resolveSettingsAccess("/settings/b", ["a.manage"], sections)).toEqual({
      type: "redirect",
      to: "/settings",
    });
  });

  it("allows a permitted section and the /settings root", () => {
    expect(resolveSettingsAccess("/settings/a", ["a.manage"], sections)).toEqual({ type: "allow" });
    expect(resolveSettingsAccess("/settings", ["a.manage"], sections)).toEqual({ type: "allow" });
  });

  it("allows nested paths of a permitted section", () => {
    expect(resolveSettingsAccess("/settings/a/extra", ["a.manage"], sections)).toEqual({ type: "allow" });
  });

  it("does not treat a path that only shares a prefix as the section", () => {
    expect(resolveSettingsAccess("/settings/ab", ["a.manage"], sections)).toEqual({ type: "allow" });
  });
});
