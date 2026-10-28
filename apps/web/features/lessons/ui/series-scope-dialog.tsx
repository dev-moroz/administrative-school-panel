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

export type SeriesScope = "this" | "following";

type Props = {
  open: boolean;
  canSplit: boolean;
  isPending: boolean;
  onChoose: (scope: SeriesScope) => void;
  onCancel: () => void;
};

export function SeriesScopeDialog({ open, canSplit, isPending, onChoose, onCancel }: Props) {
  const t = useTranslations("Lessons");

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("scopeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("scopeDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          {/* Plain buttons: closing the dialog means "cancel", so the choice must not close it by itself. */}
          <Button variant="outline" disabled={isPending} onClick={() => onChoose("this")}>
            {t("scopeOnlyThis")}
          </Button>
          {canSplit && (
            <Button disabled={isPending} onClick={() => onChoose("following")}>
              {t("scopeFollowing")}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
