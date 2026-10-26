import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { makePayment } from "../test/fixtures";
import { PaymentsFeed } from "./payments-feed";

const now = new Date(2026, 9, 26, 18, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

describe("PaymentsFeed", () => {
  it("groups payments under Today, Yesterday and a date heading", () => {
    renderWithProviders(
      <PaymentsFeed
        now={now}
        payments={[makePayment({ id: "a", paidAt: at(26, 14) }), makePayment({ id: "b", paidAt: at(25, 10) }), makePayment({ id: "c", paidAt: at(24, 10) })]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yesterday" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "24 Oct 2026" })).toBeInTheDocument();
  });

  it("shows student, lessons, amount with currency, method, comment, time and author", () => {
    renderWithProviders(
      <PaymentsFeed
        now={now}
        payments={[makePayment({ comment: "Paid for October", amount: "2400.00", currencyCode: "GBP", method: "TRANSFER", lessonsGranted: 8 })]}
      />,
    );
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Anna Petrova")).toBeInTheDocument();
    expect(within(row).getByText("+8 lessons")).toBeInTheDocument();
    expect(within(row).getByText("2400.00")).toBeInTheDocument();
    expect(within(row).getByText("GBP")).toBeInTheDocument();
    expect(within(row).getByText("Transfer")).toBeInTheDocument();
    expect(within(row).getByText("Paid for October")).toBeInTheDocument();
    expect(within(row).getByText(/14:32/)).toBeInTheDocument();
    expect(within(row).getByText(/Olga Smirnova/)).toBeInTheDocument();
  });

  it("uses the singular for one lesson", () => {
    renderWithProviders(<PaymentsFeed now={now} payments={[makePayment({ lessonsGranted: 1 })]} />);
    expect(screen.getByText("+1 lesson")).toBeInTheDocument();
  });

  it.each([
    ["CASH", "Cash"],
    ["CARD", "Card"],
    ["TRANSFER", "Transfer"],
    ["CRYPTO", "Crypto"],
  ] as const)("labels method %s as %s", (method, label) => {
    renderWithProviders(<PaymentsFeed now={now} payments={[makePayment({ method })]} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows a short comment in full, without a toggle", () => {
    renderWithProviders(<PaymentsFeed now={now} payments={[makePayment({ comment: "Paid for October" })]} />);
    expect(screen.queryByRole("button", { name: "Read more" })).not.toBeInTheDocument();
  });

  it("collapses a long comment behind 'Read more' and expands it", async () => {
    renderWithProviders(<PaymentsFeed now={now} payments={[makePayment({ comment: "word ".repeat(60).trim() })]} />);
    const toggle = screen.getByRole("button", { name: "Read more" });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Read less" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Read less" }));
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
  });

  it("collapses a comment with many line breaks", () => {
    renderWithProviders(<PaymentsFeed now={now} payments={[makePayment({ comment: "a\nb\nc\nd\ne" })]} />);
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
  });

  it("hides the student name when showStudent is false", () => {
    renderWithProviders(<PaymentsFeed now={now} showStudent={false} payments={[makePayment()]} />);
    expect(screen.queryByText("Anna Petrova")).not.toBeInTheDocument();
  });

  it("renders a proof link for a payment with a file", () => {
    renderWithProviders(
      <PaymentsFeed now={now} payments={[makePayment({ proofFile: { originalName: "r.pdf", mimeType: "application/pdf", size: 10 } })]} />,
    );
    expect(screen.getByRole("link", { name: /open file/i })).toBeInTheDocument();
  });
});
