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

async function pick(name: "Light" | "Dark" | "System") {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Theme" }));
  await user.click(await screen.findByRole("menuitem", { name }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  mockSystemDark(false);
});

describe("ThemeToggle", () => {
  it("renders a button named Theme", () => {
    renderToggle();
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
  });

  it("opens a menu with Light, Dark and System", async () => {
    renderToggle();
    await userEvent.setup().click(screen.getByRole("button", { name: "Theme" }));
    expect(await screen.findByRole("menuitem", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "System" })).toBeInTheDocument();
  });

  it("Dark adds the dark class to <html> and saves the choice", async () => {
    renderToggle();
    await pick("Dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("Light removes the dark class and saves the choice", async () => {
    localStorage.setItem("theme", "dark");
    renderToggle();
    expect(document.documentElement).toHaveClass("dark");
    await pick("Light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("System follows the OS preference (dark)", async () => {
    mockSystemDark(true);
    localStorage.setItem("theme", "light");
    renderToggle();
    expect(document.documentElement).not.toHaveClass("dark");
    await pick("System");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("system");
  });

  it("System follows the OS preference (light)", async () => {
    localStorage.setItem("theme", "dark");
    renderToggle();
    await pick("System");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("system");
  });

  it("applies the saved theme on first render", () => {
    localStorage.setItem("theme", "dark");
    renderToggle();
    expect(document.documentElement).toHaveClass("dark");
  });
});
