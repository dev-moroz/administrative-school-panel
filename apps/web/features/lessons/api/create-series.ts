import { apiFetch } from "@/lib/api";
import type { SeriesResult, CreateSeriesPayload } from "../model/types";

export function createSeries(payload: CreateSeriesPayload) {
  return apiFetch<SeriesResult>("/lesson-series", { method: "POST", body: JSON.stringify(payload) });
}
