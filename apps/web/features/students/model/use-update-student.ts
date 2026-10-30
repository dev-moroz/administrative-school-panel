"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateStudent, type UpdateStudentPayload } from "../api/update-student";
import { studentKey } from "./use-student";

export function useUpdateStudent(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateStudentPayload) => updateStudent(id, payload),
    onSuccess: (student, payload) => {
      // The response is the fresh card; refetching the detail would only race with it.
      client.setQueryData(studentKey(id), student);
      void client.invalidateQueries({ queryKey: ["students", "list"] });
      // Deactivation deletes future lessons and absences on the server.
      if ("isActive" in payload && payload.isActive === false) {
        void client.invalidateQueries({ queryKey: ["lessons"] });
        void client.invalidateQueries({ queryKey: ["absences"] });
      }
    },
  });
}
