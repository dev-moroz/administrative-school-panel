import { apiFetch } from "@/lib/api";
import type { Student } from "../model/types";
import type { toPayload } from "../model/student-schema";

export function updateStudent(id: string, payload: ReturnType<typeof toPayload>) {
  return apiFetch<Student>(`/students/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
