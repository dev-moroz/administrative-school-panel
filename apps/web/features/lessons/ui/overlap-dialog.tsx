"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
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
import type { LessonOverlap } from "../model/types";

type Pending = { overlaps: LessonOverlap[]; onConfirm: () => void; onCancel?: () => void };

// Holds one "save anyway?" question; the caller passes what confirm and cancel do.
export function useOverlapConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialog: OverlapDialogProps = {
    overlaps: pending?.overlaps ?? [],
    open: pending !== null,
    onConfirm: () => {
      pending?.onConfirm();
      setPending(null);
    },
    onCancel: () => {
      pending?.onCancel?.();
      setPending(null);
    },
  };
  return { ask: setPending, dialog };
}

type OverlapDialogProps = { open: boolean; overlaps: LessonOverlap[]; onConfirm: () => void; onCancel: () => void };

export function OverlapDialog({ open, overlaps, onConfirm, onCancel }: OverlapDialogProps) {
  const t = useTranslations("Lessons");
  const format = useFormatter();

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("overlapTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("overlapDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="grid gap-1 text-sm">
          {overlaps.map((o) => (
            <li key={o.id}>
              {o.student?.fullName ?? "—"} · {format.dateTime(new Date(o.startsAt), { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {t("durationShort", { value: o.durationMin })}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          {/* A plain button: closing the dialog means "cancel". */}
          <Button onClick={onConfirm}>{t("saveAnyway")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
