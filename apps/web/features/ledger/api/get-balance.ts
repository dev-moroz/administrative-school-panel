import { apiFetch } from "@/lib/api";
import type { Balance } from "../model/types";

export function getBalance(studentId: string) {
  return apiFetch<Balance>(`/students/${studentId}/balance`);
}
