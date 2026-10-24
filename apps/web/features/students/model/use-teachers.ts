"use client";

import { useQuery } from "@tanstack/react-query";
import { listTeachers } from "../api/list-teachers";

export function useTeachers(enabled: boolean) {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: listTeachers,
    enabled,
    staleTime: 2 * 60_000,
  });
}
