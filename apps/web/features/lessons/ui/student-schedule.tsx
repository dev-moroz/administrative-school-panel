"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_COLORS } from "../model/status-colors";
import { useUpcomingLessons } from "../model/use-lessons";

export function StudentSchedule({ studentId }: { studentId: string }) {
  const t = useTranslations("Lessons");
  const format = useFormatter();
  const { resolvedTheme } = useTheme();
  const lessons = useUpcomingLessons(studentId);

  if (lessons.isError) {
    return (
      <div role="alert" className="grid justify-items-start gap-2">
        <p className="text-sm text-muted-foreground">{t("scheduleLoadError")}</p>
        <Button variant="outline" size="sm" onClick={() => lessons.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (lessons.isPending) return <Skeleton aria-busy="true" className="h-14 w-full" />;
  if (lessons.data.length === 0) {
    return (
      <div className="grid place-items-center py-8">
        <p className="text-sm text-muted-foreground">{t("scheduleEmpty")}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3" data-color-scheme={resolvedTheme === "dark" ? "dark" : "light"}>
      {lessons.data.map((lesson) => {
        const colors = STATUS_COLORS[lesson.status];
        const cancelInfo = [lesson.cancelReason?.name, lesson.comment].filter(Boolean).join(" · ");
        return (
          <li key={lesson.id} className="grid gap-1 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{format.dateTime(new Date(lesson.startsAt), { dateStyle: "medium", timeStyle: "short" })}</span>
              <Badge style={{ backgroundColor: colors.color, color: colors.contrastColor }}>{t(`status.${lesson.status}`)}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              <span>{t("durationShort", { value: lesson.durationMin })}</span>
              {lesson.teacher && <span>{lesson.teacher.fullName}</span>}
            </div>
            {lesson.status === "CANCELLED" && cancelInfo && <p className="text-sm text-muted-foreground">{cancelInfo}</p>}
          </li>
        );
      })}
    </ul>
  );
}
