import { apiFetch } from "@/lib/api";

export function logout() {
  return apiFetch<{ ok: true }>("/auth/logout", { method: "POST" });
}
