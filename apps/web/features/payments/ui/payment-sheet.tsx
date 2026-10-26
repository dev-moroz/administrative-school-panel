"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api";
import { toPayload, type PaymentFormValues } from "../model/payment-schema";
import { useCreatePayment, useUploadProof } from "../model/use-payments";
import { PaymentForm } from "./payment-form";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function PaymentSheet({ open, onOpenChange }: Props) {
  const t = useTranslations("Payments");
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // After a failed upload the body has its own Close button, so the sheet's cross would be a duplicate.
  const [uploadFailed, setUploadFailed] = useState(false);

  function close() {
    setUploadFailed(false);
    setDirty(false);
    setConfirm(false);
    onOpenChange(false);
  }

  function requestClose() {
    if (dirty) setConfirm(true);
    else close();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent className="sm:max-w-md" showCloseButton={!uploadFailed}>
          <SheetHeader>
            <SheetTitle>{t("sheetTitle")}</SheetTitle>
            <SheetDescription>{t("sheetDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <PaymentSheetBody onDone={close} onCancel={requestClose} onDirtyChange={setDirty} onUploadFailed={() => setUploadFailed(true)} />
          </div>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog open={confirm} onKeep={() => setConfirm(false)} onDiscard={close} />
    </>
  );
}

type BodyProps = {
  onDone: () => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onUploadFailed: () => void;
};

// Mounted only while the sheet is open, so a reopened sheet always starts with an empty form.
function PaymentSheetBody({ onDone, onCancel, onDirtyChange, onUploadFailed }: BodyProps) {
  const t = useTranslations("Payments");
  const create = useCreatePayment();
  const upload = useUploadProof();
  // The payment exists but its file did not upload: only the upload may be repeated.
  const [pending, setPending] = useState<{ paymentId: string; file: File } | null>(null);

  function startUpload(paymentId: string, file: File) {
    upload.mutate(
      { paymentId, file },
      {
        onSuccess: onDone,
        onError: () => {
          onDirtyChange(false);
          onUploadFailed();
          setPending({ paymentId, file });
        },
      },
    );
  }

  function submit(values: PaymentFormValues) {
    create.mutate(toPayload(values), {
      onSuccess: (payment) => {
        toast.success(t("toastSaved"));
        if (values.proofMode === "file" && values.proofFile) startUpload(payment.id, values.proofFile);
        else onDone();
      },
    });
  }

  function saveError(error: unknown) {
    if (!error) return null;
    if (error instanceof ApiError && error.status === 400) return t("saveInvalid");
    if (error instanceof ApiError && error.status === 403) return t("saveForbidden");
    return t("saveFailed");
  }

  if (pending) {
    return (
      <div role="alert" className="grid justify-items-start gap-4">
        <p className="text-sm">{t("uploadFailed")}</p>
        <div className="flex gap-2">
          <Button disabled={upload.isPending} onClick={() => startUpload(pending.paymentId, pending.file)}>
            {t("retryUpload")}
          </Button>
          <Button variant="outline" onClick={onDone}>
            {t("close")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PaymentForm
      isSubmitting={create.isPending || upload.isPending}
      errorMessage={saveError(create.error)}
      onSubmit={submit}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  );
}
