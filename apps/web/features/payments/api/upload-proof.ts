import { apiFetch } from "@/lib/api";

export function uploadProof(paymentId: string, file: File) {
  const body = new FormData();
  body.set("file", file);
  return apiFetch<unknown>(`/payments/${paymentId}/proof`, { method: "POST", body });
}
