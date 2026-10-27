"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPaymentMethod } from "../api/create-payment-method";

export function useCreatePaymentMethod() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createPaymentMethod,
    onSuccess: () => client.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
}
