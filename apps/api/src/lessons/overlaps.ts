import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

type Db = Pick<Prisma.TransactionClient, '$queryRaw'>;

export type Overlap = { id: string; startsAt: Date; durationMin: number; student: { id: string; fullName: string } | null };

// Busy lessons of the teacher whose interval intersects [startsAt, startsAt + durationMin); back-to-back is free.
export async function findOverlaps(
  db: Db,
  slot: { teacherId: string; startsAt: Date; durationMin: number; excludeLessonId?: string },
): Promise<Overlap[]> {
  const endsAt = new Date(slot.startsAt.getTime() + slot.durationMin * 60_000);
  const rows = await db.$queryRaw<{ id: string; startsAt: Date; durationMin: number; studentId: string | null; fullName: string | null }[]>`
    SELECT l.id, l.starts_at AS "startsAt", l.duration_min AS "durationMin", s.id AS "studentId", s.full_name AS "fullName"
    FROM lessons l
    LEFT JOIN LATERAL (
      SELECT st.id, st.full_name FROM lesson_participants p JOIN students st ON st.id = p.student_id
      WHERE p.lesson_id = l.id LIMIT 1
    ) s ON true
    WHERE l.teacher_id = ${slot.teacherId}::uuid
      AND l.status <> 'CANCELLED'
      AND l.starts_at < ${endsAt}
      AND l.starts_at + l.duration_min * interval '1 minute' > ${slot.startsAt}
      AND (${slot.excludeLessonId ?? null}::uuid IS NULL OR l.id <> ${slot.excludeLessonId ?? null}::uuid)
    ORDER BY l.starts_at`;
  return rows.map((r) => ({
    id: r.id,
    startsAt: r.startsAt,
    durationMin: r.durationMin,
    student: r.studentId ? { id: r.studentId, fullName: r.fullName! } : null,
  }));
}

export async function assertNoOverlaps(db: Db, slot: Parameters<typeof findOverlaps>[1]) {
  const overlaps = await findOverlaps(db, slot);
  if (overlaps.length) throw new ConflictException({ code: 'LESSON_OVERLAP', message: 'Lesson overlaps other lessons', overlaps });
}
