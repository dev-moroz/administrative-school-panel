import type { Prisma } from '../generated/prisma/client.js';

export const LESSON_SELECT = {
  id: true,
  startsAt: true,
  durationMin: true,
  status: true,
  charged: true,
  cancelledAt: true,
  cancelReason: { select: { code: true, name: true } },
  comment: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, fullName: true } },
  participants: { select: { student: { select: { id: true, fullName: true } } } },
} satisfies Prisma.LessonSelect;

type LessonRow = Prisma.LessonGetPayload<{ select: typeof LESSON_SELECT }>;

export function toLessonDto(row: LessonRow) {
  const { participants, ...rest } = row;
  return { ...rest, student: participants[0]?.student ?? null };
}
