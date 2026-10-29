"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AbsenceResult } from "../model/types";
import { useDeleteAbsence } from "../model/use-absences";

type Props = { absenceId: string | null; onOpenChange: (open: boolean) => void; onDeleted: (result: AbsenceResult) => void };

export function DeleteAbsenceDialog({ absenceId, onOpenChange, onDeleted }: Props) {
  const t = useTranslations("Absences");
  const remove = useDeleteAbsence();

  return (
    <AlertDialog
      open={absenceId !== null}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        {remove.error && (
          <p role="alert" className="text-sm text-destructive">
            {t("deleteFailed")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          {/* A plain button: the dialog stays open to show an error. */}
          <Button variant="destructive" disabled={remove.isPending} onClick={() => absenceId && remove.mutate(absenceId, { onSuccess: onDeleted })}>
            {t("delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
