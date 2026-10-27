import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { makePaymentMethod } from "../test/fixtures";
import { PaymentMethodsTable } from "./payment-methods-table";

// Cell order: Name (icon + name), Code, Status.
const CELL = { name: 0, code: 1, status: 2 };

const dataRows = () => screen.getAllByRole("row").slice(1);
const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell");

describe("PaymentMethodsTable", () => {
  it("renders the column headers in order", () => {
    renderWithProviders(<PaymentMethodsTable methods={[makePaymentMethod()]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Name", "Code", "Status"]);
  });

  it("shows an icon with the name, the code and the status", () => {
    renderWithProviders(<PaymentMethodsTable methods={[makePaymentMethod({ code: "CARD", name: "Card", icon: "credit-card" })]} onSelect={vi.fn()} />);
    const cells = cellsOf(dataRows()[0]);
    expect(cells[CELL.name]).toHaveTextContent("Card");
    expect(cells[CELL.name].querySelector("svg")).not.toBeNull();
    expect(cells[CELL.code]).toHaveTextContent("CARD");
    expect(cells[CELL.status]).toHaveTextContent("Active");
  });

  it("keeps the order it was given (the API sorts by name)", () => {
    const list = [makePaymentMethod({ code: "B", name: "Bravo" }), makePaymentMethod({ code: "A", name: "Zulu" })];
    renderWithProviders(<PaymentMethodsTable methods={list} onSelect={vi.fn()} />);
    expect(dataRows().map((r) => cellsOf(r)[CELL.code].textContent)).toEqual(["B", "A"]);
  });

  it("shows inactive methods too, with the Inactive status and a muted row", () => {
    renderWithProviders(<PaymentMethodsTable methods={[makePaymentMethod({ code: "OLD", isActive: false }), makePaymentMethod({ code: "CASH" })]} onSelect={vi.fn()} />);
    const [inactive, active] = dataRows();
    expect(cellsOf(inactive)[CELL.status]).toHaveTextContent("Inactive");
    expect(inactive).toHaveClass("bg-muted/40");
    expect(active).not.toHaveClass("bg-muted/40");
  });

  it("clicking a row reports that method", async () => {
    const onSelect = vi.fn();
    const card = makePaymentMethod({ code: "CARD", name: "Card", icon: "credit-card" });
    renderWithProviders(<PaymentMethodsTable methods={[makePaymentMethod(), card]} onSelect={onSelect} />);
    await userEvent.click(within(dataRows()[1]).getByText("Card"));
    expect(onSelect).toHaveBeenCalledWith(card);
  });

  it("a row can be opened with the keyboard", async () => {
    const onSelect = vi.fn();
    renderWithProviders(<PaymentMethodsTable methods={[makePaymentMethod()]} onSelect={onSelect} />);
    dataRows()[0].focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
