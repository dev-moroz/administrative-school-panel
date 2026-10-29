export type AbsenceKind = "STUDENT_FREEZE" | "TEACHER_VACATION";

export type Absence = {
  id: string;
  kind: AbsenceKind;
  startsOn: string;
  endsOn: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  student: { id: string; fullName: string } | null;
  teacher: { id: string; fullName: string } | null;
};

export type AbsenceOwner = { studentId: string } | { teacherId: string };
export type AbsenceWarning = { code: "ABSENCE_LESSON_NOT_RESTORED"; lessonId: string; reason: "OVERLAP" | "ABSENCE" | "MANUAL" };
export type AbsenceResult = { warnings?: AbsenceWarning[] };

export type AbsencePeriodPayload = { startsOn?: string; endsOn?: string; comment?: string };
export type CreateAbsencePayload = AbsenceOwner & { kind: AbsenceKind; startsOn: string; endsOn: string; comment?: string };
