import type { Payment } from "./types";

export type PaymentGroup = { kind: "today" | "yesterday" | "date"; key: string; payments: Payment[] };

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Days are local to the browser, like every other time on the page; groups keep the order of first appearance.
export function groupPaymentsByDay(payments: Payment[], now: Date): PaymentGroup[] {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups = new Map<string, PaymentGroup>();

  for (const payment of payments) {
    const key = dayKey(new Date(payment.paidAt));
    let group = groups.get(key);
    if (!group) {
      group = { kind: key === today ? "today" : key === yesterday ? "yesterday" : "date", key, payments: [] };
      groups.set(key, group);
    }
    group.payments.push(payment);
  }
  return [...groups.values()];
}
