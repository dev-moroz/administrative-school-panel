"use client";

import { useQuery } from "@tanstack/react-query";
import { listCurrencies } from "../api/list-currencies";

export function useCurrencies(enabled: boolean) {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: listCurrencies,
    enabled,
    staleTime: 2 * 60_000,
  });
}

// Same request and cache entry as useCurrencies; for pickers, which must not offer deactivated currencies.
export function useActiveCurrencies(enabled: boolean) {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: listCurrencies,
    enabled,
    staleTime: 2 * 60_000,
    select: (currencies) => currencies.filter((c) => c.isActive),
  });
}
