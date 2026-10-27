import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { makeCurrency } from "../test/fixtures";
import { CurrenciesTable } from "./currencies-table";

// Cell order: Code, Name, Decimals, Status.
const CELL = { code: 0, name: 1, decimals: 2, status: 3 };

const dataRows = () => screen.getAllByRole("row").slice(1);
const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell");

describe("CurrenciesTable", () => {
  it("renders the column headers in order", () => {
    renderWithProviders(<CurrenciesTable currencies={[makeCurrency()]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Code", "Name", "Decimals", "Status"]);
  });

  it("shows code, name, decimals and status", () => {
    renderWithProviders(<CurrenciesTable currencies={[makeCurrency({ code: "USDT", name: "Tether", decimals: 6 })]} onSelect={vi.fn()} />);
    const cells = cellsOf(dataRows()[0]);
    expect(cells[CELL.code]).toHaveTextContent("USDT");
    expect(cells[CELL.name]).toHaveTextContent("Tether");
    expect(cells[CELL.decimals]).toHaveTextContent("6");
    expect(cells[CELL.status]).toHaveTextContent("Active");
  });

  it("sorts rows by code, whatever order the list came in", () => {
    const list = [makeCurrency({ code: "GBP" }), makeCurrency({ code: "CHF" }), makeCurrency({ code: "EUR" })];
    renderWithProviders(<CurrenciesTable currencies={list} onSelect={vi.fn()} />);
    expect(dataRows().map((r) => cellsOf(r)[CELL.code].textContent)).toEqual(["CHF", "EUR", "GBP"]);
  });

  it("shows inactive currencies too, with the Inactive status and a muted row", () => {
    renderWithProviders(<CurrenciesTable currencies={[makeCurrency({ code: "CHF", isActive: false }), makeCurrency({ code: "EUR" })]} onSelect={vi.fn()} />);
    const [inactive, active] = dataRows();
    expect(cellsOf(inactive)[CELL.status]).toHaveTextContent("Inactive");
    expect(inactive).toHaveClass("bg-muted/40");
    expect(active).not.toHaveClass("bg-muted/40");
  });

  it("clicking a row reports that currency", async () => {
    const onSelect = vi.fn();
    const eur = makeCurrency({ code: "EUR" });
    renderWithProviders(<CurrenciesTable currencies={[makeCurrency({ code: "CHF" }), eur]} onSelect={onSelect} />);
    await userEvent.click(within(dataRows()[1]).getByText("Euro"));
    expect(onSelect).toHaveBeenCalledWith(eur);
  });

  it("a row can be opened with the keyboard", async () => {
    const onSelect = vi.fn();
    renderWithProviders(<CurrenciesTable currencies={[makeCurrency()]} onSelect={onSelect} />);
    dataRows()[0].focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
