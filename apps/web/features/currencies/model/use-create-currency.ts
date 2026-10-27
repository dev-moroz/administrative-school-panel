"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCurrency } from "../api/create-currency";

export function useCreateCurrency() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createCurrency,
    // The student and payment forms read the same list, so one invalidation refreshes all of them.
    onSuccess: () => client.invalidateQueries({ queryKey: ["currencies"] }),
  });
}
