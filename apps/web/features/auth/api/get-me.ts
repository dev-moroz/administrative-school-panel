import { apiFetch } from "@/lib/api";
import type { Me } from "../model/types";

export function getMe() {
  return apiFetch<Me>("/auth/me");
}
