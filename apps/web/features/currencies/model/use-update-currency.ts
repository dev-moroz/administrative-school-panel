"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCurrency } from "../api/update-currency";

export function useUpdateCurrency() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateCurrency,
    onSuccess: () => client.invalidateQueries({ queryKey: ["currencies"] }),
  });
}
