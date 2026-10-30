import { apiFetch } from "@/lib/api";
import type { DateRange, Lesson } from "../model/types";

export function listLessons({ from, to }: DateRange) {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return apiFetch<Lesson[]>(`/lessons?${params}`);
}

export function listUpcomingLessons(studentId: string, limit: number) {
  const params = new URLSearchParams({ from: new Date().toISOString(), studentId, limit: String(limit) });
  return apiFetch<Lesson[]>(`/lessons?${params}`);
}
