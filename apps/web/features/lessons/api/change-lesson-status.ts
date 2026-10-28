import { apiFetch } from "@/lib/api";
import type { Lesson, StatusPayload } from "../model/types";

export function changeLessonStatus(id: string, payload: StatusPayload) {
  return apiFetch<Lesson>(`/lessons/${id}/status`, { method: "POST", body: JSON.stringify(payload) });
}
