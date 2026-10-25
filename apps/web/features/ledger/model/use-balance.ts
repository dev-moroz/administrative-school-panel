"use client";

import { useQuery } from "@tanstack/react-query";
import { getBalance } from "../api/get-balance";

export const ledgerKey = (studentId: string) => ["ledger", studentId] as const;

export function useBalance(studentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...ledgerKey(studentId), "balance"],
    queryFn: () => getBalance(studentId),
    enabled,
  });
}
