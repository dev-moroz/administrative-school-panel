import { apiFetch } from "@/lib/api";
import type { CreateSeriesPayload } from "../model/types";

export function createSeries(payload: CreateSeriesPayload) {
  return apiFetch<{ id: string }>("/lesson-series", { method: "POST", body: JSON.stringify(payload) });
}
