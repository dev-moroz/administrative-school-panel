"use client";

import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/get-me";

export const meQueryKey = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: getMe });
}
