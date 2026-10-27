"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Currency } from "../model/types";

type Props = { currencies: Currency[]; onSelect: (currency: Currency) => void };

export function CurrenciesTable({ currencies, onSelect }: Props) {
  const t = useTranslations("Currencies");
  const sorted = [...currencies].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colCode")}</TableHead>
            <TableHead>{t("colName")}</TableHead>
            <TableHead>{t("colDecimals")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((currency) => (
            <TableRow
              key={currency.code}
              tabIndex={0}
              onClick={() => onSelect(currency)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(currency);
                }
              }}
              className={`cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${currency.isActive ? "" : "bg-muted/40"}`}
            >
              <TableCell className={`font-medium ${currency.isActive ? "" : "text-muted-foreground"}`}>{currency.code}</TableCell>
              <TableCell className={currency.isActive ? "" : "text-muted-foreground"}>{currency.name}</TableCell>
              <TableCell className="tabular-nums">{currency.decimals}</TableCell>
              <TableCell>
                <Badge variant={currency.isActive ? "success" : "warning"}>
                  {currency.isActive ? t("statusActive") : t("statusInactive")}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
