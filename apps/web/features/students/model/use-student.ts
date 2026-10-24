"use client";

import { useQuery } from "@tanstack/react-query";
import { getStudent } from "../api/get-student";

export const studentKey = (id: string) => ["students", "detail", id] as const;

export function useStudent(id: string | null) {
  return useQuery({
    queryKey: studentKey(id ?? ""),
    queryFn: () => getStudent(id as string),
    enabled: id !== null,
  });
}
