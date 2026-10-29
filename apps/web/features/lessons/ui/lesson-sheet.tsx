"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api";
import { lessonToFormValues, toCreatePayload, toSeriesPayload, toUpdatePayload, type LessonFormValues } from "../model/lesson-schema";
import type { Lesson } from "../model/types";
import { useCreateLesson, useCreateSeries, useUpdateLesson } from "../model/use-lessons";
import { LessonForm } from "./lesson-form";
import { LessonStatusActions } from "./lesson-status-actions";

export type LessonSheetState = { kind: "create"; values: LessonFormValues } | { kind: "lesson"; lesson: Lesson };

export type LessonPermissions = { canUpdate: boolean; canDelete: boolean; canManageSeries: boolean };

type Props = {
  state: LessonSheetState | null;
  permissions: LessonPermissions;
  onClose: () => void;
  // A series lesson needs the scope dialog, which the page owns.
  onSeriesEdit: (lesson: Lesson, values: LessonFormValues) => void;
};

export function LessonSheet({ state, permissions, onClose, onSeriesEdit }: Props) {
  const t = useTranslations("Lessons");
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);

  function close() {
    setDirty(false);
    setConfirm(false);
    onClose();
  }

  function requestClose() {
    if (dirty) setConfirm(true);
    else close();
  }

  const lesson = state?.kind === "lesson" ? state.lesson : null;

  return (
    <>
      <Sheet open={state !== null} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t(lesson ? "lesson" : "newLesson")}</SheetTitle>
            <SheetDescription>{lesson ? t(`status.${lesson.status}`) : t("newLessonDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {state && (
              <LessonSheetBody
                key={state.kind === "lesson" ? state.lesson.id : "new"}
                state={state}
                permissions={permissions}
                onDone={close}
                onCancel={requestClose}
                onDirtyChange={setDirty}
                onSeriesEdit={onSeriesEdit}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog open={confirm} onKeep={() => setConfirm(false)} onDiscard={close} />
    </>
  );
}

type BodyProps = {
  state: LessonSheetState;
  permissions: LessonPermissions;
  onDone: () => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSeriesEdit: (lesson: Lesson, values: LessonFormValues) => void;
};

function LessonSheetBody({ state, permissions, onDone, onCancel, onDirtyChange, onSeriesEdit }: BodyProps) {
  const t = useTranslations("Lessons");
  const createLesson = useCreateLesson();
  const createSeries = useCreateSeries();
  const update = useUpdateLesson();
  const saved = () => {
    toast.success(t("toastSaved"));
    onDone();
  };

  const error = createLesson.error ?? createSeries.error ?? update.error;
  const errorMessage = error && t(error instanceof ApiError && error.status === 409 ? "saveConflict" : "saveFailed");
  const isSubmitting = createLesson.isPending || createSeries.isPending || update.isPending;

  if (state.kind === "create") {
    return (
      <LessonForm
        defaultValues={state.values}
        canRepeat={permissions.canManageSeries}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onCancel={onCancel}
        onDirtyChange={onDirtyChange}
        onSubmit={(values) =>
          values.repeatWeekly
            ? createSeries.mutate(toSeriesPayload(values), { onSuccess: saved })
            : createLesson.mutate(toCreatePayload(values), { onSuccess: saved })
        }
      />
    );
  }

  const { lesson } = state;
  if (lesson.status !== "SCHEDULED" || !permissions.canUpdate) {
    return (
      <div className="grid gap-4">
        <LessonSummary lesson={lesson} />
        {permissions.canUpdate && <LessonStatusActions lesson={lesson} canDelete={false} onDone={onDone} />}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <LessonForm
        defaultValues={lessonToFormValues(lesson)}
        existingStudent={lesson.student}
        canRepeat={false}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onCancel={onCancel}
        onDirtyChange={onDirtyChange}
        onSubmit={(values) =>
          lesson.seriesId ? onSeriesEdit(lesson, values) : update.mutate({ id: lesson.id, payload: toUpdatePayload(values) }, { onSuccess: saved })
        }
      />
      <Separator />
      <LessonStatusActions lesson={lesson} canDelete={permissions.canDelete} onDone={onDone} />
    </div>
  );
}

function LessonSummary({ lesson }: { lesson: Lesson }) {
  const t = useTranslations("Lessons");
  const format = useFormatter();
  const start = new Date(lesson.startsAt);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t("fieldStudent")}</dt>
      <dd>{lesson.student?.fullName ?? "—"}</dd>
      <dt className="text-muted-foreground">{t("fieldDate")}</dt>
      <dd>
        {format.dateTime(start, { dateStyle: "medium", timeStyle: "short" })} · {t("durationShort", { value: lesson.durationMin })}
      </dd>
      <dt className="text-muted-foreground">{t("fieldCharged")}</dt>
      <dd>{t(lesson.charged ? "charged" : "notCharged")}</dd>
      {lesson.cancelReason && (
        <>
          <dt className="text-muted-foreground">{t("fieldReason")}</dt>
          <dd>{lesson.cancelReason.name}</dd>
        </>
      )}
      {lesson.comment && (
        <>
          <div role="separator" className="col-span-2 my-1 border-t" />
          <dt className="text-muted-foreground">{t("fieldComment")}</dt>
          <dd className="whitespace-pre-wrap">{lesson.comment}</dd>
        </>
      )}
    </dl>
  );
}
