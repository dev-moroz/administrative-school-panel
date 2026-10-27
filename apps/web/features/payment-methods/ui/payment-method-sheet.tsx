"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toCreatePayload, type PaymentMethodFormValues } from "../model/payment-method-schema";
import type { PaymentMethod } from "../model/types";
import { useCreatePaymentMethod } from "../model/use-create-payment-method";
import { useUpdatePaymentMethod } from "../model/use-update-payment-method";
import { PaymentMethodForm } from "./payment-method-form";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; method: PaymentMethod | null };

const EMPTY: PaymentMethodFormValues = { code: "", name: "", icon: "", isActive: true };

export function PaymentMethodSheet({ open, onOpenChange, method }: Props) {
  const t = useTranslations("PaymentMethods");
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();

  function close() {
    setDirty(false);
    setConfirming(false);
    onOpenChange(false);
  }

  function requestClose() {
    if (dirty) setConfirming(true);
    else close();
  }

  async function submit(values: PaymentMethodFormValues) {
    if (method) {
      await update.mutateAsync({ code: method.code, name: values.name, icon: values.icon, isActive: values.isActive ?? true });
      toast.success(t("toastSaved"));
    } else {
      await create.mutateAsync(toCreatePayload(values));
      toast.success(t("toastCreated"));
    }
    close();
  }

  const defaultValues: PaymentMethodFormValues = method
    ? { code: method.code, name: method.name, icon: method.icon, isActive: method.isActive }
    : EMPTY;

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{method ? t("sheetTitleEdit") : t("sheetTitleCreate")}</SheetTitle>
            <SheetDescription>{method ? t("sheetDescEdit") : t("sheetDescCreate")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <PaymentMethodForm
              key={method?.code ?? "new"}
              mode={method ? "edit" : "create"}
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
