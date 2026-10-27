"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsKey } from "@/features/payments/model/payments-key";
import { updatePaymentMethod } from "../api/update-payment-method";

export function useUpdatePaymentMethod() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updatePaymentMethod,
    onSuccess: () => {
      // Payments carry the method name and icon, so their lists are refreshed too.
      client.invalidateQueries({ queryKey: ["payment-methods"] });
      client.invalidateQueries({ queryKey: paymentsKey });
    },
  });
}
