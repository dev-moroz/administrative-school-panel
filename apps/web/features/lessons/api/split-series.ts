import { apiFetch } from "@/lib/api";
import type { SplitSeriesPayload } from "../model/types";

export function splitSeries(seriesId: string, payload: SplitSeriesPayload) {
  return apiFetch<{ id: string }>(`/lesson-series/${seriesId}/split`, { method: "POST", body: JSON.stringify(payload) });
}
