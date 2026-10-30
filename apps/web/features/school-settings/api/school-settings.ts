import { apiFetch } from "@/lib/api";
import type { SchoolSettings } from "../model/types";

export function getSchoolSettings() {
  return apiFetch<SchoolSettings>("/settings/school");
}

export function updateSchoolSettings(payload: SchoolSettings) {
  return apiFetch<SchoolSettings>("/settings/school", { method: "PATCH", body: JSON.stringify(payload) });
}
