import type { Prisma } from '../generated/prisma/client.js';
import { BASE_TIME_ZONE } from '../common/base-time-zone.js';
import { fromYmd } from '../lesson-series/lesson-series.mapper.js';
import { localDate } from '../lesson-series/series-slots.js';
import { ABSENCE_SELECT, toAbsenceDto } from './absences.mapper.js';

type Db = Pick<Prisma.TransactionClient, 'absence'>;

// An absence of the lesson's teacher or one of its students that covers the lesson's Moscow date.
export async function findCoveringAbsence(
  db: Db,
  lesson: { startsAt: Date; teacherId: string; studentIds: string[] },
  excludeAbsenceId?: string,
) {
  const date = fromYmd(localDate(lesson.startsAt, BASE_TIME_ZONE));
  const row = await db.absence.findFirst({
    where: {
      OR: [{ teacherId: lesson.teacherId }, { studentId: { in: lesson.studentIds } }],
      startsOn: { lte: date },
      endsOn: { gte: date },
      ...(excludeAbsenceId && { id: { not: excludeAbsenceId } }),
    },
    select: ABSENCE_SELECT,
    orderBy: { startsOn: 'asc' },
  });
  return row && toAbsenceDto(row);
}
