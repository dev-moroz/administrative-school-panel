import { describe, expect, it } from "vitest";
import { makePayment } from "../test/fixtures";
import { groupPaymentsByDay } from "./group-payments-by-day";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
const now = new Date(2026, 9, 26, 18, 0);

describe("groupPaymentsByDay", () => {
  it("returns no groups for no payments", () => {
    expect(groupPaymentsByDay([], now)).toEqual([]);
  });

  it("groups by local day, keeps the input order, labels today and yesterday", () => {
    const payments = [
      makePayment({ id: "a", paidAt: at(26, 15) }),
      makePayment({ id: "b", paidAt: at(26, 9) }),
      makePayment({ id: "c", paidAt: at(25, 20) }),
      makePayment({ id: "d", paidAt: at(24, 11) }),
    ];
    const groups = groupPaymentsByDay(payments, now);
    expect(groups.map((g) => [g.kind, g.key, g.payments.map((p) => p.id)])).toEqual([
      ["today", "2026-10-26", ["a", "b"]],
      ["yesterday", "2026-10-25", ["c"]],
      ["date", "2026-10-24", ["d"]],
    ]);
  });

  it("splits at local midnight", () => {
    const payments = [
      makePayment({ id: "late", paidAt: at(25, 23, 59) }),
      makePayment({ id: "early", paidAt: at(26, 0, 1) }),
    ];
    const groups = groupPaymentsByDay(payments, now);
    expect(groups.map((g) => [g.kind, g.payments.map((p) => p.id)])).toEqual([
      ["yesterday", ["late"]],
      ["today", ["early"]],
    ]);
  });

  it("does not merge the same day number of different months", () => {
    const payments = [
      makePayment({ id: "a", paidAt: new Date(2026, 9, 5, 10).toISOString() }),
      makePayment({ id: "b", paidAt: new Date(2026, 8, 5, 10).toISOString() }),
    ];
    expect(groupPaymentsByDay(payments, now)).toHaveLength(2);
  });
});
