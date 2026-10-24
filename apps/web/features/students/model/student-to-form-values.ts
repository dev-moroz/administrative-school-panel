import type { StudentFormValues } from "./student-schema";
import type { Student } from "./types";

export const emptyFormValues: StudentFormValues = {
  fullName: "",
  telegramUsername: "",
  englishLevel: "",
  comment: "",
  defaultCurrencyCode: "",
  lessonPrice: "",
  isActive: true,
  teacherId: "",
};

export function studentToFormValues(student: Student): StudentFormValues {
  return {
    fullName: student.fullName,
    telegramUsername: student.telegramUsername ?? "",
    englishLevel: student.englishLevel ?? "",
    comment: student.comment ?? "",
    defaultCurrencyCode: student.defaultCurrencyCode ?? "",
    lessonPrice: student.lessonPrice ?? "",
    isActive: student.isActive,
    teacherId: student.teacher?.id ?? "",
  };
}
