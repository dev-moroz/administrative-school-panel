import type { LessonStatus } from "./types";
import "@fullcalendar/react/themes/monarch/palettes/green.css";

// Monarch palette variables, shared by the calendar and the student schedule; the dark set needs data-color-scheme="dark" on a parent.
export const STATUS_COLORS: Record<LessonStatus, { color: string; contrastColor: string }> = {
  SCHEDULED: { color: "var(--fc-monarch-secondary)", contrastColor: "var(--fc-monarch-secondary-foreground)" },
  COMPLETED: { color: "var(--fc-monarch-primary)", contrastColor: "var(--fc-monarch-primary-foreground)" },
  CANCELLED: { color: "var(--fc-monarch-strong)", contrastColor: "var(--fc-monarch-muted-foreground)" },
  NO_SHOW: { color: "var(--fc-monarch-strong)", contrastColor: "var(--fc-monarch-muted-foreground)" },
};
