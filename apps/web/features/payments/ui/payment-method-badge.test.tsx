import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { PaymentMethodBadge } from "./payment-method-badge";

describe("PaymentMethodBadge", () => {
  it.each([
    ["CASH", "Cash"],
    ["CARD", "Card"],
    ["TRANSFER", "Transfer"],
    ["CRYPTO", "Crypto"],
  ] as const)("labels method %s as %s", (method, label) => {
    renderWithProviders(<PaymentMethodBadge method={method} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
