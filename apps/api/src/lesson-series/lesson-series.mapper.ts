import type { Prisma } from '../generated/prisma/client.js';

export const SERIES_SELECT = {
  id: true,
  weekday: true,
  startTime: true,
  durationMin: true,
  startsOn: true,
  endsOn: true,
  createdAt: true,
  updatedAt: true,
  student: { select: { id: true, fullName: true } },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.LessonSeriesSelect;

type SeriesRow = Prisma.LessonSeriesGetPayload<{ select: typeof SERIES_SELECT }>;

export const toYmd = (date: Date) => date.toISOString().slice(0, 10);
export const fromYmd = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export function toSeriesDto(row: SeriesRow) {
  return { ...row, startsOn: toYmd(row.startsOn), endsOn: row.endsOn && toYmd(row.endsOn) };
}
