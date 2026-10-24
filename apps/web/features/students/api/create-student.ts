import { apiFetch } from "@/lib/api";
import type { Student } from "../model/types";
import type { toPayload } from "../model/student-schema";

export function createStudent(payload: ReturnType<typeof toPayload>) {
  return apiFetch<Student>("/students", { method: "POST", body: JSON.stringify(payload) });
}
