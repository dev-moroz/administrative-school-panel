import type { EnglishLevel } from "./student-schema";

export type StudentListItem = {
  id: string;
  fullName: string;
  telegramUsername: string | null;
  isActive: boolean;
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

export type Currency = { code: string; name: string; decimals: number; isActive: boolean };

export type Student = {
  id: string;
  fullName: string;
  telegramUsername: string | null;
  englishLevel: EnglishLevel | null;
  comment: string | null;
  defaultCurrencyCode: string | null;
  lessonPrice: string | null;
  isActive: boolean;
  teacher: Teacher | null;
  telegramLinked: boolean;
  createdAt: string;
  updatedAt: string;
};
