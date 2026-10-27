import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { renderWithProviders } from "@/test/render";
import { ThemeToggle } from "./theme-toggle";

function renderToggle() {
  return renderWithProviders(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

function mockSystemDark(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  mockSystemDark(false);
});

function getSwitch() {
  return screen.getByRole("switch", { name: "Theme" });
}

describe("ThemeToggle", () => {
  it("renders a switch named Theme", () => {
    renderToggle();
    expect(getSwitch()).toBeInTheDocument();
  });

  it("has no menu and no System option", () => {
    renderToggle();
    expect(screen.queryByRole("button", { name: "Theme" })).not.toBeInTheDocument();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
  });

  it("is off in the light theme", () => {
    renderToggle();
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("is on when the saved theme is dark", () => {
    localStorage.setItem("theme", "dark");
    renderToggle();
    expect(document.documentElement).toHaveClass("dark");
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("is on when the saved theme is system and the OS is dark", () => {
    mockSystemDark(true);
    localStorage.setItem("theme", "system");
    renderToggle();
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("follows the OS preference when nothing is saved", () => {
    mockSystemDark(true);
    renderToggle();
    expect(document.documentElement).toHaveClass("dark");
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("turning it on adds the dark class and saves dark", async () => {
    renderToggle();
    await userEvent.setup().click(getSwitch());
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("turning it off removes the dark class and saves light", async () => {
    localStorage.setItem("theme", "dark");
    renderToggle();
    await userEvent.setup().click(getSwitch());
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("turning it off from system+dark OS saves an explicit light", async () => {
    mockSystemDark(true);
    localStorage.setItem("theme", "system");
    renderToggle();
    await userEvent.setup().click(getSwitch());
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
