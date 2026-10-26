"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Payment } from "../model/types";

// The short form for the student panel: lessons added, amount, who took the payment and when.
export function PaymentsCompactList({ payments }: { payments: Payment[] }) {
  const t = useTranslations("Payments");
  const format = useFormatter();

  function when(iso: string) {
    const date = new Date(iso);
    const day = `${date.getDate()} ${format.dateTime(date, { month: "short" })} ${date.getFullYear()}`;
    return `${day}, ${format.dateTime(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {payments.map((payment) => (
        <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">{t("lessons", { count: payment.lessonsGranted })}</span>
            <span className="text-xs text-muted-foreground">
              <time dateTime={payment.paidAt}>{when(payment.paidAt)}</time>
              {" · "}
              <span>{t("by", { name: payment.createdBy.name ?? payment.createdBy.email })}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5">
            <span className="font-semibold tabular-nums">{payment.amount}</span>
            <span className="text-sm text-muted-foreground">{payment.currencyCode}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
