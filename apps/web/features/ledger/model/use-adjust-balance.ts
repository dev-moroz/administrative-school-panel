"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsListKey } from "@/features/students/model/use-students";
import { adjustBalance } from "../api/adjust-balance";
import type { toAdjustPayload } from "./adjust-schema";
import { ledgerKey } from "./use-balance";

export function useAdjustBalance(studentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReturnType<typeof toAdjustPayload>) => adjustBalance(studentId, payload),
    // The server computes the balance, so refetch instead of patching the cache by hand.
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ledgerKey(studentId) });
      void client.invalidateQueries({ queryKey: studentsListKey });
    },
  });
}
