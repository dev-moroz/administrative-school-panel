import type { CalendarEvent, Lesson, LessonStatus } from "./types";

// Colors are set in calendar-view.tsx; the class is for status-specific styles.
const STATUS_CLASS: Record<LessonStatus, string> = {
  SCHEDULED: "lesson-scheduled",
  COMPLETED: "lesson-completed",
  CANCELLED: "lesson-cancelled",
  NO_SHOW: "lesson-no-show",
};

export function toCalendarEvents(lessons: Lesson[]): CalendarEvent[] {
  return lessons.map((lesson) => {
    const start = new Date(lesson.startsAt);
    return {
      id: lesson.id,
      title: lesson.student?.fullName ?? "—",
      start,
      end: new Date(start.getTime() + lesson.durationMin * 60_000),
      status: lesson.status,
      editable: lesson.status === "SCHEDULED",
      isSeries: lesson.seriesId !== null,
      className: STATUS_CLASS[lesson.status],
    };
  });
}
