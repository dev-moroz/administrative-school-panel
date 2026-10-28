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
import { ApiError } from "@/lib/api";
import { useDeleteLesson } from "../model/use-lessons";

type Props = { lessonId: string; open: boolean; onOpenChange: (open: boolean) => void; onDeleted: () => void };

export function DeleteLessonDialog({ lessonId, open, onOpenChange, onDeleted }: Props) {
  const t = useTranslations("Lessons");
  const remove = useDeleteLesson();

  const error = remove.error && t(remove.error instanceof ApiError && remove.error.status === 409 ? "deleteConflict" : "deleteFailed");

  return (
    <AlertDialog
      open={open}
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
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          {/* A plain button: the dialog stays open to show a 409. */}
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(lessonId, { onSuccess: onDeleted })}>
            {t("delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
