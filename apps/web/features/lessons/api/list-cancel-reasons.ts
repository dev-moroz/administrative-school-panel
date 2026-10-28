import { apiFetch } from "@/lib/api";
import type { CancelReason } from "../model/types";

export function listCancelReasons() {
  return apiFetch<CancelReason[]>("/cancel-reasons");
}
