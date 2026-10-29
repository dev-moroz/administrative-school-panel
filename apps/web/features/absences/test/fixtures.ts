import type { Absence } from "../model/types";

export function makeAbsence(patch: Partial<Absence> = {}): Absence {
  return {
    id: "a1",
    kind: "STUDENT_FREEZE",
    startsOn: "2026-11-10",
    endsOn: "2026-11-20",
    comment: null,
    createdAt: "2026-10-29T10:00:00.000Z",
    updatedAt: "2026-10-29T10:00:00.000Z",
    student: { id: "s1", fullName: "Anna Petrova" },
    teacher: null,
    ...patch,
  };
}
