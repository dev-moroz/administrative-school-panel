"use client";

import { useQuery } from "@tanstack/react-query";
import { listPaymentMethods } from "../api/list-payment-methods";

export function usePaymentMethods(enabled: boolean) {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: listPaymentMethods,
    enabled,
    staleTime: 2 * 60_000,
  });
}

// Same request and cache entry as usePaymentMethods; for pickers, which must not offer deactivated methods.
export function useActivePaymentMethods(enabled: boolean) {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: listPaymentMethods,
    enabled,
    staleTime: 2 * 60_000,
    select: (methods) => methods.filter((m) => m.isActive),
  });
}
