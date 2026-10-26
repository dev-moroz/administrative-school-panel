"use client";

import { useState } from "react";
import { ArrowLeftRight, Banknote, Bitcoin, CreditCard, type LucideIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/features/students/model/get-initials";
import { groupPaymentsByDay } from "../model/group-payments-by-day";
import type { Payment, PaymentMethod } from "../model/types";
import { PaymentComment } from "./payment-comment";
import { ProofLink } from "./proof-link";

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  CRYPTO: Bitcoin,
};

type Props = { payments: Payment[]; showStudent?: boolean; now?: Date };

export function PaymentsFeed({ payments, showStudent = true, now }: Props) {
  const t = useTranslations("Payments");
  const format = useFormatter();
  const [mountedAt] = useState(() => new Date());
  const groups = groupPaymentsByDay(payments, now ?? mountedAt);

  function groupTitle(kind: "today" | "yesterday" | "date", key: string) {
    if (kind !== "date") return t(kind);
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return `${day} ${format.dateTime(date, { month: "short" })} ${year}`;
  }

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section key={group.key} className="grid gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{groupTitle(group.kind, group.key)}</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {group.payments.map((payment) => {
              const MethodIcon = METHOD_ICONS[payment.method];
              return (
                <li key={payment.id} className="grid gap-3 p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                    <div className="grid min-w-0 content-start gap-3">
                      {showStudent && (
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(payment.student.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate font-medium">{payment.student.fullName}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{t("lessons", { count: payment.lessonsGranted })}</Badge>
                        <Badge variant="outline" className="gap-1">
                          <MethodIcon className="size-3" aria-hidden />
                          {t(`method.${payment.method}`)}
                        </Badge>
                        <ProofLink payment={payment} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2 text-right">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold tabular-nums">{payment.amount}</span>
                        <span className="text-sm text-muted-foreground">{payment.currencyCode}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        <time dateTime={payment.paidAt}>
                          {format.dateTime(new Date(payment.paidAt), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                        </time>
                        {" · "}
                        <span>{t("by", { name: payment.createdBy.name ?? payment.createdBy.email })}</span>
                      </span>
                    </div>
                  </div>
                  {payment.comment && <PaymentComment text={payment.comment} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
