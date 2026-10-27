"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListPage } from "@/components/list-page";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth";
import { useCurrencies } from "@/features/currencies/model/use-currencies";
import type { Currency } from "@/features/currencies/model/types";
import { CurrenciesTable } from "@/features/currencies/ui/currencies-table";
import { CurrencySheet } from "@/features/currencies/ui/currency-sheet";

type SheetTarget = { open: false } | { open: true; currency: Currency | null };

export default function CurrenciesSettingsPage() {
  const t = useTranslations("Currencies");
  const { data: me } = useMe();
  const currencies = useCurrencies(true);
  const [sheet, setSheet] = useState<SheetTarget>({ open: false });

  function content() {
    if (currencies.isError) {
      return (
        <PageMessage role="alert">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" size="sm" onClick={() => currencies.refetch()}>
            {t("retry")}
          </Button>
        </PageMessage>
      );
    }
    if (currencies.isPending) {
      return (
        <div aria-busy="true" className="grid flex-1 content-start gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    if (currencies.data.length === 0) {
      return (
        <PageMessage>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </PageMessage>
      );
    }
    return (
      <div className="flex-1">
        <CurrenciesTable currencies={currencies.data} onSelect={(currency) => setSheet({ open: true, currency })} />
      </div>
    );
  }

  const canCreate = me?.permissions.includes("currencies.create") ?? false;

  return (
    <>
      <ListPage
        title={t("title")}
        toolbar={
          canCreate ? (
            <div className="flex justify-end">
              <Button onClick={() => setSheet({ open: true, currency: null })}>{t("newCurrency")}</Button>
            </div>
          ) : undefined
        }
      >
        {content()}
      </ListPage>
      <CurrencySheet
        open={sheet.open}
        currency={sheet.open ? sheet.currency : null}
        onOpenChange={(open) => !open && setSheet({ open: false })}
      />
    </>
  );
}
