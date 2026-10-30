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

export type FutureLessons = { futureLessons: number; keptLessons: number };

type Props = { counts: FutureLessons | null; isPending: boolean; onConfirm: () => void; onCancel: () => void };

export function DeactivateStudentDialog({ counts, isPending, onConfirm, onCancel }: Props) {
  const t = useTranslations("Students");

  return (
    <AlertDialog open={counts !== null} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deactivateTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deactivateLessons", { count: counts?.futureLessons ?? 0 })}</AlertDialogDescription>
        </AlertDialogHeader>
        {!!counts?.keptLessons && <p className="text-sm">{t("deactivateKept", { count: counts.keptLessons })}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("deactivateCancel")}</AlertDialogCancel>
          {/* A plain button: closing the dialog means "cancel". */}
          <Button disabled={isPending} onClick={onConfirm}>
            {t("deactivateConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
