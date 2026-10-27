"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListPage } from "@/components/list-page";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth";
import { usePaymentMethods } from "@/features/payment-methods/model/use-payment-methods";
import type { PaymentMethod } from "@/features/payment-methods/model/types";
import { PaymentMethodsTable } from "@/features/payment-methods/ui/payment-methods-table";
import { PaymentMethodSheet } from "@/features/payment-methods/ui/payment-method-sheet";

type SheetTarget = { open: false } | { open: true; method: PaymentMethod | null };

export default function PaymentMethodsSettingsPage() {
  const t = useTranslations("PaymentMethods");
  const { data: me } = useMe();
  const methods = usePaymentMethods(true);
  const [sheet, setSheet] = useState<SheetTarget>({ open: false });

  function content() {
    if (methods.isError) {
      return (
        <PageMessage role="alert">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" size="sm" onClick={() => methods.refetch()}>
            {t("retry")}
          </Button>
        </PageMessage>
      );
    }
    if (methods.isPending) {
      return (
        <div aria-busy="true" className="grid flex-1 content-start gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    if (methods.data.length === 0) {
      return (
        <PageMessage>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </PageMessage>
      );
    }
    return (
      <div className="flex-1">
        <PaymentMethodsTable methods={methods.data} onSelect={(method) => setSheet({ open: true, method })} />
      </div>
    );
  }

  const canCreate = me?.permissions.includes("payment-methods.create") ?? false;

  return (
    <>
      <ListPage
        title={t("title")}
        toolbar={
          canCreate ? (
            <div className="flex justify-end">
              <Button onClick={() => setSheet({ open: true, method: null })}>{t("newMethod")}</Button>
            </div>
          ) : undefined
        }
      >
        {content()}
      </ListPage>
      <PaymentMethodSheet
        open={sheet.open}
        method={sheet.open ? sheet.method : null}
        onOpenChange={(open) => !open && setSheet({ open: false })}
      />
    </>
  );
}
