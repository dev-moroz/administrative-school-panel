import type { Prisma } from '../generated/prisma/client.js';
import { toYmd } from '../lesson-series/lesson-series.mapper.js';

export const ABSENCE_SELECT = {
  id: true,
  kind: true,
  startsOn: true,
  endsOn: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  student: { select: { id: true, fullName: true } },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.AbsenceSelect;

type AbsenceRow = Prisma.AbsenceGetPayload<{ select: typeof ABSENCE_SELECT }>;

export function toAbsenceDto(row: AbsenceRow) {
  return { ...row, startsOn: toYmd(row.startsOn), endsOn: toYmd(row.endsOn) };
}
