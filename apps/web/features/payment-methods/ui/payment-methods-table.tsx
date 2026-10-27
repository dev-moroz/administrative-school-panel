"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaymentMethod } from "../model/types";
import { PaymentMethodIcon } from "./payment-method-icon";

type Props = { methods: PaymentMethod[]; onSelect: (method: PaymentMethod) => void };

// Rows keep the order of the list: the API sorts by name.
export function PaymentMethodsTable({ methods, onSelect }: Props) {
  const t = useTranslations("PaymentMethods");

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colName")}</TableHead>
            <TableHead>{t("colCode")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {methods.map((method) => (
            <TableRow
              key={method.code}
              tabIndex={0}
              onClick={() => onSelect(method)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(method);
                }
              }}
              className={`cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${method.isActive ? "" : "bg-muted/40"}`}
            >
              <TableCell className={`font-medium ${method.isActive ? "" : "text-muted-foreground"}`}>
                <span className="flex items-center gap-2">
                  <PaymentMethodIcon name={method.icon} />
                  {method.name}
                </span>
              </TableCell>
              <TableCell className={method.isActive ? "" : "text-muted-foreground"}>{method.code}</TableCell>
              <TableCell>
                <Badge variant={method.isActive ? "success" : "warning"}>
                  {method.isActive ? t("statusActive") : t("statusInactive")}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
