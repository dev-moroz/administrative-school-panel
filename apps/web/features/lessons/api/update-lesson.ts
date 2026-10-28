import { apiFetch } from "@/lib/api";
import type { Lesson, UpdateLessonPayload } from "../model/types";

export function updateLesson(id: string, payload: UpdateLessonPayload) {
  return apiFetch<Lesson>(`/lessons/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
