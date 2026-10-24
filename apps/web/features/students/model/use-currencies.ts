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
