import { apiFetch } from "@/lib/api";
import type { CreateLessonPayload, Lesson } from "../model/types";

export function createLesson(payload: CreateLessonPayload) {
  return apiFetch<Lesson>("/lessons", { method: "POST", body: JSON.stringify(payload) });
}
