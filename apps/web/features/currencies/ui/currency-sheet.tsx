"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toCreatePayload, type CurrencyFormValues } from "../model/currency-schema";
import type { Currency } from "../model/types";
import { useCreateCurrency } from "../model/use-create-currency";
import { useUpdateCurrency } from "../model/use-update-currency";
import { CurrencyForm } from "./currency-form";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; currency: Currency | null };

const EMPTY: CurrencyFormValues = { code: "", name: "", decimals: "2", isActive: true };

export function CurrencySheet({ open, onOpenChange, currency }: Props) {
  const t = useTranslations("Currencies");
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const create = useCreateCurrency();
  const update = useUpdateCurrency();

  function close() {
    setDirty(false);
    setConfirming(false);
    onOpenChange(false);
  }

  function requestClose() {
    if (dirty) setConfirming(true);
    else close();
  }

  async function submit(values: CurrencyFormValues) {
    if (currency) {
      await update.mutateAsync({ code: currency.code, name: values.name, isActive: values.isActive ?? true });
      toast.success(t("toastSaved"));
    } else {
      await create.mutateAsync(toCreatePayload(values));
      toast.success(t("toastCreated"));
    }
    close();
  }

  const defaultValues: CurrencyFormValues = currency
    ? { code: currency.code, name: currency.name, decimals: String(currency.decimals), isActive: currency.isActive }
    : EMPTY;

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{currency ? t("sheetTitleEdit") : t("sheetTitleCreate")}</SheetTitle>
            <SheetDescription>{currency ? t("sheetDescEdit") : t("sheetDescCreate")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <CurrencyForm
              key={currency?.code ?? "new"}
              mode={currency ? "edit" : "create"}
              defaultValues={defaultValues}
              onSubmit={submit}
              onCancel={requestClose}
              onDirtyChange={setDirty}
            />
          </div>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog open={confirming} onKeep={() => setConfirming(false)} onDiscard={close} />
    </>
  );
}
