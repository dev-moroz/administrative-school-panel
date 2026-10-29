"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useMe } from "@/features/auth";
import { rangeToFormValues, rangeToUpdatePayload, toSplitPayload, toUpdatePayload, type LessonFormValues } from "@/features/lessons/model/lesson-schema";
import { getOverlaps } from "@/features/lessons/model/overlap";
import { toCalendarEvents } from "@/features/lessons/model/to-calendar-events";
import type { DateRange, Lesson, TimeRange } from "@/features/lessons/model/types";
import { useLessons, useSplitSeries, useUpdateLesson } from "@/features/lessons/model/use-lessons";
import { useSeriesWarnings } from "@/features/lessons/model/use-series-warnings";
import { CalendarView, type CalendarViewProps } from "@/features/lessons/ui/calendar-view";
import { LessonSheet, type LessonSheetState } from "@/features/lessons/ui/lesson-sheet";
import { OverlapDialog, useOverlapConfirm } from "@/features/lessons/ui/overlap-dialog";
import { SeriesScopeDialog, type SeriesScope } from "@/features/lessons/ui/series-scope-dialog";

// A change to a series lesson waits here until the user picks its scope.
type ScopeRequest = { lesson: Lesson } & ({ kind: "edit"; values: LessonFormValues } | { kind: "drag"; range: TimeRange; revert: () => void });

export default function LessonsPage() {
  const t = useTranslations("Lessons");
  const { data: me } = useMe();
  const can = (permission: string) => me?.permissions.includes(permission) ?? false;
  const permissions = { canUpdate: can("lessons.update"), canDelete: can("lessons.delete"), canManageSeries: can("lesson-series.manage") };

  const [range, setRange] = useState<DateRange | null>(null);
  const lessons = useLessons(range);
  const canMove = permissions.canUpdate;
  const events = useMemo(
    () => toCalendarEvents(lessons.data ?? []).map((e) => ({ ...e, editable: e.editable && canMove })),
    [lessons.data, canMove],
  );
  const [sheet, setSheet] = useState<LessonSheetState | null>(null);
  const [scope, setScope] = useState<ScopeRequest | null>(null);
  const update = useUpdateLesson();
  const split = useSplitSeries();
  const overlap = useOverlapConfirm();
  const warnSkipped = useSeriesWarnings();

  const findLesson = (id: string) => lessons.data?.find((l) => l.id === id);

  const onEventChange: CalendarViewProps["onEventChange"] = ({ id, start, end, revert }) => {
    const lesson = findLesson(id);
    if (!lesson) return revert();
    if (lesson.seriesId) return setScope({ lesson, kind: "drag", range: { start, end }, revert });
    const payload = rangeToUpdatePayload({ start, end });
    const failed = () => {
      revert();
      toast.error(t("moveFailed"));
    };
    update.mutate(
      { id, payload },
      {
        onError: (error) => {
          const overlaps = getOverlaps(error);
          if (!overlaps) return failed();
          overlap.ask({
            overlaps,
            onConfirm: () => update.mutate({ id, payload: { ...payload, force: true } }, { onError: failed }),
            onCancel: revert,
          });
        },
      },
    );
  };

  function chooseScope(choice: SeriesScope) {
    if (!scope) return;
    const current = scope;
    const { lesson } = current;
    const values = current.kind === "edit" ? current.values : rangeToFormValues(current.range);
    const revert = () => current.kind === "drag" && current.revert();
    const onSuccess = () => {
      setScope(null);
      if (current.kind === "edit") {
        toast.success(t("toastSaved"));
        setSheet(null);
      }
    };
    const onError = () => {
      setScope(null);
      revert();
      toast.error(t(current.kind === "drag" ? "moveFailed" : "saveFailed"));
    };
    if (choice === "this") {
      const payload = current.kind === "edit" ? toUpdatePayload(values) : rangeToUpdatePayload(current.range);
      update.mutate(
        { id: lesson.id, payload },
        {
          onSuccess,
          onError: (error) => {
            const overlaps = getOverlaps(error);
            if (!overlaps) return onError();
            setScope(null);
            overlap.ask({
              overlaps,
              onConfirm: () => update.mutate({ id: lesson.id, payload: { ...payload, force: true } }, { onSuccess, onError }),
              onCancel: revert,
            });
          },
        },
      );
    } else {
      split.mutate(
        { seriesId: lesson.seriesId!, payload: toSplitPayload(lesson.id, values) },
        {
          onSuccess: (result) => {
            onSuccess();
            warnSkipped(result);
          },
          onError,
        },
      );
    }
  }

  function cancelScope() {
    if (scope?.kind === "drag") scope.revert();
    setScope(null);
  }

  return (
    // Fills the screen height so the hours scroll inside the calendar.
    <div className="flex h-[calc(100svh-2rem)] min-h-[480px] flex-col gap-4">
      <div className="min-h-0 flex-1">
        <CalendarView
          events={events}
          selectable={can("lessons.create")}
          onRangeChange={setRange}
          onSlotSelect={(slot) => setSheet({ kind: "create", values: rangeToFormValues(slot) })}
          onEventClick={(id) => {
            const lesson = findLesson(id);
            if (lesson) setSheet({ kind: "lesson", lesson });
          }}
          onEventChange={onEventChange}
        />
      </div>
      <LessonSheet
        state={sheet}
        permissions={permissions}
        onClose={() => setSheet(null)}
        onSeriesEdit={(lesson, values) => setScope({ lesson, kind: "edit", values })}
      />
      <SeriesScopeDialog
        open={scope !== null}
        canSplit={permissions.canManageSeries}
        isPending={update.isPending || split.isPending}
        onChoose={chooseScope}
        onCancel={cancelScope}
      />
      <OverlapDialog {...overlap.dialog} />
    </div>
  );
}
