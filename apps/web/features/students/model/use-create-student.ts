"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStudent } from "../api/create-student";
import { studentKey } from "./use-student";

export function useCreateStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createStudent,
    onSuccess: (student) => {
      client.setQueryData(studentKey(student.id), student);
      void client.invalidateQueries({ queryKey: ["students", "list"] });
    },
  });
}
