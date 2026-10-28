import { z } from "zod";
import type { CreateLessonPayload, CreateSeriesPayload, Lesson, SplitSeriesPayload, TimeRange, UpdateLessonPayload } from "./types";

export const MIN_DURATION_MIN = 15;
export const MAX_DURATION_MIN = 240;

const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const lessonSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(YMD),
  time: z.string().regex(HHMM),
  durationMin: z
    .string()
    .regex(/^\d+$/)
    .refine((v) => Number(v) >= MIN_DURATION_MIN && Number(v) <= MAX_DURATION_MIN),
  repeatWeekly: z.boolean(),
});

export type LessonFormValues = z.infer<typeof lessonSchema>;

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const minutesBetween = ({ start, end }: TimeRange) => Math.round((end.getTime() - start.getTime()) / 60_000);

// Form values are in the browser time zone; the server gets an instant.
const localStart = (v: LessonFormValues) => new Date(`${v.date}T${v.time}`);
// ISO weekday: 1 = Monday ... 7 = Sunday.
const weekday = (v: LessonFormValues) => localStart(v).getDay() || 7;

export function toCreatePayload(v: LessonFormValues): CreateLessonPayload {
  return { studentId: v.studentId, startsAt: localStart(v).toISOString(), durationMin: Number(v.durationMin) };
}

export function toSeriesPayload(v: LessonFormValues): CreateSeriesPayload {
  return { studentId: v.studentId, weekday: weekday(v), startTime: v.time, durationMin: Number(v.durationMin), startsOn: v.date };
}

export function toUpdatePayload(v: LessonFormValues): UpdateLessonPayload {
  return { startsAt: localStart(v).toISOString(), durationMin: Number(v.durationMin) };
}

export function toSplitPayload(fromLessonId: string, v: LessonFormValues): SplitSeriesPayload {
  return { fromLessonId, weekday: weekday(v), startTime: v.time, durationMin: Number(v.durationMin) };
}

export function rangeToUpdatePayload(range: TimeRange): UpdateLessonPayload {
  return { startsAt: range.start.toISOString(), durationMin: minutesBetween(range) };
}

export function rangeToFormValues(range: TimeRange): LessonFormValues {
  return { studentId: "", date: toYmd(range.start), time: toHhmm(range.start), durationMin: String(minutesBetween(range)), repeatWeekly: false };
}

export function lessonToFormValues(lesson: Lesson): LessonFormValues {
  const start = new Date(lesson.startsAt);
  return { studentId: lesson.student?.id ?? "", date: toYmd(start), time: toHhmm(start), durationMin: String(lesson.durationMin), repeatWeekly: false };
}
