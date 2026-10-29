import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SectionNav } from "./section-nav";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

const SECTIONS = [
  { key: "one", href: "/area/one", label: "One" },
  { key: "two", href: "/area/two", label: "Two" },
];

describe("SectionNav", () => {
  beforeEach(() => usePathname.mockReset().mockReturnValue("/area/one"));

  it("shows a link for each section in the given order", () => {
    render(<SectionNav sections={SECTIONS} />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["One", "Two"]);
    expect(screen.getByRole("link", { name: "Two" })).toHaveAttribute("href", "/area/two");
  });

  it("marks the open section and its subpaths as current", () => {
    usePathname.mockReturnValue("/area/two/details");
    render(<SectionNav sections={SECTIONS} />);
    expect(screen.getByRole("link", { name: "Two" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "One" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing on the area root", () => {
    usePathname.mockReturnValue("/area");
    render(<SectionNav sections={SECTIONS} />);
    expect(screen.getByRole("link", { name: "One" })).not.toHaveAttribute("aria-current");
  });
});
