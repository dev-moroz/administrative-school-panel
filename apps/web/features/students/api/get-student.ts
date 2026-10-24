import { apiFetch } from "@/lib/api";
import type { Student } from "../model/types";

export function getStudent(id: string) {
  return apiFetch<Student>(`/students/${id}`);
}
