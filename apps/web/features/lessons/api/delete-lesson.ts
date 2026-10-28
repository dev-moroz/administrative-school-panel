import { apiFetch } from "@/lib/api";

export function deleteLesson(id: string) {
  return apiFetch<void>(`/lessons/${id}`, { method: "DELETE" });
}
