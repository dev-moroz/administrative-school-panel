import { apiFetch } from "@/lib/api";
import type { StudentListParams, StudentListResponse } from "../model/types";

export function listStudents({ q, page, pageSize, isActive }: StudentListParams) {
  const params = new URLSearchParams();
  const term = q?.trim();
  if (term) params.set("q", term);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (isActive !== undefined) params.set("isActive", String(isActive));
  return apiFetch<StudentListResponse>(`/students?${params}`);
}
