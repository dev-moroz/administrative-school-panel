"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Payment } from "../model/types";
import { PaymentMethodBadge } from "./payment-method-badge";
import { ProofLink } from "./proof-link";

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  const t = useTranslations("Payments");
  const format = useFormatter();

  function when(iso: string) {
    const date = new Date(iso);
    const day = `${date.getDate()} ${format.dateTime(date, { month: "short" })} ${date.getFullYear()}`;
    return `${day}, ${format.dateTime(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  }

  return (
    <TooltipProvider>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colDate")}</TableHead>
              <TableHead>{t("colStudent")}</TableHead>
              <TableHead className="text-right">{t("colAmount")}</TableHead>
              <TableHead>{t("colLessons")}</TableHead>
              <TableHead>{t("colMethod")}</TableHead>
              <TableHead>{t("colProof")}</TableHead>
              <TableHead>{t("colComment")}</TableHead>
              <TableHead>{t("colAddedBy")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id} className="hover:bg-muted even:bg-muted/50 even:hover:bg-muted dark:even:bg-muted/70 dark:even:hover:bg-muted">
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <time dateTime={payment.paidAt}>{when(payment.paidAt)}</time>
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">{payment.student.fullName}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <span className="font-semibold tabular-nums">{payment.amount}</span>{" "}
                  <span className="text-muted-foreground">{payment.currencyCode}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{t("lessons", { count: payment.lessonsGranted })}</Badge>
                </TableCell>
                <TableCell>
                  <PaymentMethodBadge method={payment.method} />
                </TableCell>
                <TableCell>
                  <ProofLink payment={payment} />
                </TableCell>
                <TableCell>
                  {payment.comment ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="block max-w-64 truncate text-muted-foreground">
                          {payment.comment}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="whitespace-pre-wrap break-words">{payment.comment}</TooltipContent>
                    </Tooltip>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {payment.createdBy.name ?? payment.createdBy.email}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
