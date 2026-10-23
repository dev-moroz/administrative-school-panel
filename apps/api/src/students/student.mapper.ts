import type { Prisma } from '../generated/prisma/client.js';

export const STUDENT_INCLUDE = {
  teachers: {
    orderBy: { createdAt: 'asc' },
    include: { teacher: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.StudentInclude;

export type StudentWithTeacher = Prisma.StudentGetPayload<{ include: typeof STUDENT_INCLUDE }>;

// The only shape students leave the API in: no userId, no raw telegramChatId.
export function toStudentDto(student: StudentWithTeacher) {
  return {
    id: student.id,
    fullName: student.fullName,
    telegramUsername: student.telegramUsername,
    englishLevel: student.englishLevel,
    comment: student.comment,
    defaultCurrencyCode: student.defaultCurrencyCode,
    lessonPrice: student.lessonPrice?.toString() ?? null,
    isActive: student.isActive,
    teacher: student.teachers[0]?.teacher ?? null,
    telegramLinked: student.telegramChatId !== null,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export const STUDENT_LIST_SELECT = {
  id: true,
  fullName: true,
  telegramUsername: true,
} satisfies Prisma.StudentSelect;

// The list needs just enough to recognise a student; the full card is GET /students/:id.
export type StudentListItem = Prisma.StudentGetPayload<{ select: typeof STUDENT_LIST_SELECT }>;
