import { apiFetch } from "@/lib/api";
import type { DateRange, Lesson } from "../model/types";

export function listLessons({ from, to }: DateRange) {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return apiFetch<Lesson[]>(`/lessons?${params}`);
}
