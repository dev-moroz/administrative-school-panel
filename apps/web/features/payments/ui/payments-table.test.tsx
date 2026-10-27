import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { makePayment } from "../test/fixtures";
import { PaymentsTable } from "./payments-table";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

// Cell order: Date, Student, Amount, Lessons, Method, Proof, Comment, Added by.
const CELL = { date: 0, student: 1, amount: 2, lessons: 3, method: 4, proof: 5, comment: 6, author: 7 };

function dataRows() {
  return screen.getAllByRole("row").slice(1);
}

function cellsOf(row: HTMLElement) {
  return within(row).getAllByRole("cell");
}

describe("PaymentsTable", () => {
  it("renders the column headers in order", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment()]} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Date", "Student", "Amount", "Lessons", "Method", "Proof", "Comment", "Added by"]);
  });

  it("renders one row per payment", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ id: "a" }), makePayment({ id: "b" }), makePayment({ id: "c" })]} />);
    expect(dataRows()).toHaveLength(3);
  });

  it("shows date with time, student, amount with currency, lessons, method and author", () => {
    renderWithProviders(
      <PaymentsTable
        payments={[makePayment({ paidAt: at(26, 14, 32), amount: "2400.00", currencyCode: "GBP", method: { code: "TRANSFER", name: "Bank transfer", icon: "landmark" }, lessonsGranted: 8 })]}
      />,
    );
    const cells = cellsOf(dataRows()[0]);
    expect(cells[CELL.date]).toHaveTextContent("26 Oct 2026, 14:32");
    expect(cells[CELL.student]).toHaveTextContent("Anna Petrova");
    expect(cells[CELL.amount]).toHaveTextContent("2400.00");
    expect(cells[CELL.amount]).toHaveTextContent("GBP");
    expect(cells[CELL.lessons]).toHaveTextContent("+8 lessons");
    expect(cells[CELL.method]).toHaveTextContent("Bank transfer");
    expect(cells[CELL.author]).toHaveTextContent("Olga Smirnova");
  });

  it("uses the singular for one lesson", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ lessonsGranted: 1 })]} />);
    expect(screen.getByText("+1 lesson")).toBeInTheDocument();
  });

  it("falls back to the author's email when there is no name", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ createdBy: { id: "u2", email: "teacher@school.test", name: null } })]} />);
    expect(cellsOf(dataRows()[0])[CELL.author]).toHaveTextContent("teacher@school.test");
  });

  it("shows a proof link when the payment has one", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ proofUrl: "https://www.example.com/receipt/1" })]} />);
    const link = within(cellsOf(dataRows()[0])[CELL.proof]).getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.example.com/receipt/1");
  });

  it("leaves the proof cell empty when there is no proof", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ proofUrl: null, proofFile: null })]} />);
    expect(cellsOf(dataRows()[0])[CELL.proof]).toBeEmptyDOMElement();
  });

  it("leaves the comment cell empty, with no placeholder, when there is no comment", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ comment: null })]} />);
    expect(cellsOf(dataRows()[0])[CELL.comment]).toBeEmptyDOMElement();
  });

  it("shows the comment in its cell as a single truncated line", () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ comment: "Paid for October" })]} />);
    const text = within(cellsOf(dataRows()[0])[CELL.comment]).getByText("Paid for October");
    expect(text).toHaveClass("truncate");
  });

  it("shows the full comment in a tooltip on hover", async () => {
    const long = "Paid for October and November in advance, the receipt was sent to the teacher by email. ".repeat(3).trim();
    renderWithProviders(<PaymentsTable payments={[makePayment({ comment: long })]} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.hover(within(cellsOf(dataRows()[0])[CELL.comment]).getByText(long));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(long);
  });

  it("opens the comment tooltip on keyboard focus too", async () => {
    renderWithProviders(<PaymentsTable payments={[makePayment({ comment: "Paid for October" })]} />);
    const text = within(cellsOf(dataRows()[0])[CELL.comment]).getByText("Paid for October");
    expect(text).toHaveAttribute("tabindex", "0");
    text.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Paid for October");
  });
});
