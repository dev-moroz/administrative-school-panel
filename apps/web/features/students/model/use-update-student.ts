"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateStudent } from "../api/update-student";
import type { toPayload } from "./student-schema";
import { studentKey } from "./use-student";

export function useUpdateStudent(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) => updateStudent(id, payload),
    onSuccess: (student) => {
      // The response is the fresh card; refetching the detail would only race with it.
      client.setQueryData(studentKey(id), student);
      void client.invalidateQueries({ queryKey: ["students", "list"] });
    },
  });
}
