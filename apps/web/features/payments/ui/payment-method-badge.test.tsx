import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { PaymentMethodBadge } from "./payment-method-badge";

describe("PaymentMethodBadge", () => {
  it("shows the name from the data", () => {
    renderWithProviders(<PaymentMethodBadge method={{ code: "WISE", name: "Wise", icon: "globe" }} />);
    expect(screen.getByText("Wise")).toBeInTheDocument();
  });

  it("draws an icon, hidden from assistive technology", () => {
    const { container } = renderWithProviders(<PaymentMethodBadge method={{ code: "CARD", name: "Card", icon: "credit-card" }} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("draws different icons for different icon names", () => {
    const a = renderWithProviders(<PaymentMethodBadge method={{ code: "A", name: "A", icon: "credit-card" }} />);
    const b = renderWithProviders(<PaymentMethodBadge method={{ code: "B", name: "B", icon: "bitcoin" }} />);
    expect(a.container.querySelector("svg")?.innerHTML).not.toBe(b.container.querySelector("svg")?.innerHTML);
  });

  it("falls back to a generic icon for an unknown icon name instead of crashing", () => {
    const { container } = renderWithProviders(<PaymentMethodBadge method={{ code: "X", name: "Mystery", icon: "not-an-icon" }} />);
    expect(screen.getByText("Mystery")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
