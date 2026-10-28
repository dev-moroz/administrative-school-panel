import { apiFetch } from "@/lib/api";
import type { CancelPreview } from "../model/types";

export function getCancelPreview(id: string) {
  return apiFetch<CancelPreview>(`/lessons/${id}/cancel-preview`);
}
