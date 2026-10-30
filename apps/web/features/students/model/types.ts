import type { EnglishLevel } from "./student-schema";

export type StudentListItem = {
  id: string;
  fullName: string;
  telegramUsername: string | null;
  isActive: boolean;
  // Absent without the balance.read permission.
  balance?: number;
};

export type StudentListResponse = {
  items: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type StudentListParams = {
  q?: string;
  page: number;
  pageSize: number;
  isActive?: boolean;
};

export type Teacher = { id: string; fullName: string };

export type Student = {
  id: string;
  fullName: string;
  telegramUsername: string | null;
  englishLevel: EnglishLevel | null;
  comment: string | null;
  defaultCurrencyCode: string | null;
  defaultPaymentMethodCode: string | null;
  lessonPrice: string | null;
  isActive: boolean;
  teacher: Teacher | null;
  telegramLinked: boolean;
  createdAt: string;
  updatedAt: string;
};
