import { apiFetch } from "@/lib/api";
import type { Teacher } from "../model/types";

export function listTeachers() {
  return apiFetch<Teacher[]>("/teachers");
}
