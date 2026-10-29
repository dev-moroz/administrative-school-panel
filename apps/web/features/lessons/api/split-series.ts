import { apiFetch } from "@/lib/api";
import type { SeriesResult, SplitSeriesPayload } from "../model/types";

export function splitSeries(seriesId: string, payload: SplitSeriesPayload) {
  return apiFetch<SeriesResult>(`/lesson-series/${seriesId}/split`, { method: "POST", body: JSON.stringify(payload) });
}
