"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { toStatusPayload, type CancelFormValues } from "../model/cancel-schema";
import type { Lesson, StatusPayload } from "../model/types";
import { useChangeLessonStatus } from "../model/use-lessons";
import { CancelForm } from "./cancel-form";
import { DeleteLessonDialog } from "./delete-lesson-dialog";

type Props = { lesson: Lesson; canDelete: boolean; onDone: () => void };

export function LessonStatusActions({ lesson, canDelete, onDone }: Props) {
  const t = useTranslations("Lessons");
  const change = useChangeLessonStatus();
  const [action, setAction] = useState<CancelFormValues["status"] | null>(null);
  const [deleting, setDeleting] = useState(false);

  function send(payload: StatusPayload) {
    change.mutate(
      { id: lesson.id, payload },
      {
        onSuccess: () => {
          toast.success(t("toastStatus"));
          onDone();
        },
      },
    );
  }

  const error = change.error && t(change.error instanceof ApiError && change.error.status === 409 ? "statusConflict" : "statusFailed");

  if (action) {
    return (
      <CancelForm
        lessonId={lesson.id}
        status={action}
        isSubmitting={change.isPending}
        errorMessage={error}
        onSubmit={(values) => send(toStatusPayload(values))}
        onBack={() => {
          change.reset();
          setAction(null);
        }}
      />
    );
  }

  if (lesson.status !== "SCHEDULED") {
    return (
      <div className="grid justify-items-start gap-2">
        {(lesson.status === "CANCELLED" || lesson.status === "NO_SHOW") && (
          <Button variant="outline" disabled={change.isPending} onClick={() => send({ status: "SCHEDULED" })}>
            {t("backToScheduled")}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setAction("CANCELLED")}>
        {t("cancelLesson")}
      </Button>
      <Button variant="outline" onClick={() => setAction("NO_SHOW")}>
        {t("noShow")}
      </Button>
      {canDelete && (
        <>
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            {t("delete")}
          </Button>
          <DeleteLessonDialog
            lessonId={lesson.id}
            open={deleting}
            onOpenChange={setDeleting}
            onDeleted={() => {
              setDeleting(false);
              toast.success(t("toastDeleted"));
              onDone();
            }}
          />
        </>
      )}
    </div>
  );
}
