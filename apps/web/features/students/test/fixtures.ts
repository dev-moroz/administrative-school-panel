import type { Currency, Student, Teacher } from "../model/types";

export function makeStudent(patch: Partial<Student> = {}): Student {
  return {
    id: "s1",
    fullName: "Anna Petrova",
    telegramUsername: "anna_p1",
    englishLevel: "B1",
    comment: "Prefers evenings",
    defaultCurrencyCode: "EUR",
    lessonPrice: "50.00",
    isActive: true,
    teacher: { id: "t1", fullName: "Olga Smirnova" },
    telegramLinked: true,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    ...patch,
  };
}

export const currencies: Currency[] = [
  { code: "EUR", name: "Euro", decimals: 2, isActive: true },
  { code: "GBP", name: "British pound", decimals: 2, isActive: true },
];

export const teachers: Teacher[] = [
  { id: "t1", fullName: "Olga Smirnova" },
  { id: "t2", fullName: "Ivan Petrov" },
];
