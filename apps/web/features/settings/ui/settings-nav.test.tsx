import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SettingsNav } from "./settings-nav";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

describe("SettingsNav", () => {
  beforeEach(() => usePathname.mockReset().mockReturnValue("/settings/currencies"));

  it("shows a link for each permitted section and no title", () => {
    renderWithProviders(<SettingsNav permissions={["currencies.update"]} />);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Currencies" })).toHaveAttribute("href", "/settings/currencies");
  });

  it("shows no section links without permissions", () => {
    renderWithProviders(<SettingsNav permissions={["students.read.all"]} />);
    expect(screen.queryByRole("link", { name: "Currencies" })).not.toBeInTheDocument();
  });

  it("marks the current section with aria-current", () => {
    renderWithProviders(<SettingsNav permissions={["currencies.update"]} />);
    expect(screen.getByRole("link", { name: "Currencies" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark a section when another path is open", () => {
    usePathname.mockReturnValue("/settings");
    renderWithProviders(<SettingsNav permissions={["currencies.update"]} />);
    expect(screen.getByRole("link", { name: "Currencies" })).not.toHaveAttribute("aria-current");
  });
});
