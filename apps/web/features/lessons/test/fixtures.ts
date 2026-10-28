import type { Lesson } from "../model/types";

export function makeLesson(patch: Partial<Lesson> = {}): Lesson {
  return {
    id: "l1",
    startsAt: new Date(2026, 10, 3, 10, 0).toISOString(),
    durationMin: 60,
    status: "SCHEDULED",
    charged: false,
    cancelledAt: null,
    cancelReason: null,
    comment: null,
    notes: null,
    seriesId: null,
    originalDate: null,
    createdAt: "2026-10-28T10:00:00.000Z",
    updatedAt: "2026-10-28T10:00:00.000Z",
    teacher: { id: "t1", fullName: "Olga Smirnova" },
    student: { id: "s1", fullName: "Anna Petrova" },
    ...patch,
  };
}

export const cancelReasons = [
  { code: "ILLNESS", name: "Illness" },
  { code: "TRAVEL", name: "Travel" },
];
