"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { RestoreConflict } from "../model/types";
import { OverlapList } from "./overlap-dialog";

type Props = { conflict: RestoreConflict | null; isPending: boolean; onConfirm: () => void; onCancel: () => void };

export function RestoreConflictDialog({ conflict, isPending, onConfirm, onCancel }: Props) {
  const t = useTranslations("Lessons");
  const absence = conflict?.absence;

  return (
    <AlertDialog open={conflict !== null} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("restoreTitle")}</AlertDialogTitle>
        </AlertDialogHeader>
        {absence && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">{t("restoreAbsence")}</p>
            <p>
              {t(`absenceKind.${absence.kind}`)} · {absence.student?.fullName ?? absence.teacher?.fullName}
            </p>
            <p>
              {absence.startsOn.slice(0, 10)} – {absence.endsOn.slice(0, 10)}
            </p>
          </div>
        )}
        {!!conflict?.overlaps.length && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">{t("restoreOverlaps")}</p>
            <OverlapList overlaps={conflict.overlaps} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          {/* A plain button: closing the dialog means "cancel". */}
          <Button disabled={isPending} onClick={onConfirm}>
            {t("restoreAnyway")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
