"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listStudents } from "../api/list-students";
import type { StudentListParams } from "./types";

export const studentsListKey = ["students", "list"];

export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: [...studentsListKey, params],
    queryFn: () => listStudents(params),
    placeholderData: keepPreviousData,
  });
}
