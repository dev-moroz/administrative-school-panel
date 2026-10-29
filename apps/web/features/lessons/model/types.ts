export type LessonStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type Lesson = {
  id: string;
  startsAt: string;
  durationMin: number;
  status: LessonStatus;
  charged: boolean;
  cancelledAt: string | null;
  cancelReason: CancelReason | null;
  comment: string | null;
  notes: string | null;
  seriesId: string | null;
  originalDate: string | null;
  manuallyChanged: boolean;
  createdAt: string;
  updatedAt: string;
  teacher: { id: string; fullName: string } | null;
  student: { id: string; fullName: string } | null;
};

export type CancelReason = { code: string; name: string };

export type DateRange = { from: Date; to: Date };
export type TimeRange = { start: Date; end: Date };

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: LessonStatus;
  editable: boolean;
  isSeries: boolean;
  className: string;
};

export type CreateLessonPayload = { studentId: string; startsAt: string; durationMin: number; force?: boolean };
export type UpdateLessonPayload = { startsAt?: string; durationMin?: number; force?: boolean };
export type LessonOverlap = { id: string; startsAt: string; durationMin: number; student: { id: string; fullName: string } | null };
export type SeriesWarning = { code: "SERIES_SLOT_SKIPPED"; date: string; reason: "OVERLAP" };
export type SeriesResult = { id: string; warnings: SeriesWarning[] };
export type StatusPayload = { status: LessonStatus; charged?: boolean; reason?: string; comment?: string };
export type CancelPreview = { suggestedCharged: boolean };
export type CreateSeriesPayload = { studentId: string; weekday: number; startTime: string; durationMin: number; startsOn: string };
export type SplitSeriesPayload = { fromLessonId: string; weekday?: number; startTime?: string; durationMin?: number };
