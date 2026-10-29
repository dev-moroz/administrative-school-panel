"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAbsence } from "../api/create-absence";
import { deleteAbsence } from "../api/delete-absence";
import { listAbsences } from "../api/list-absences";
import { updateAbsence } from "../api/update-absence";
import type { AbsenceOwner, AbsencePeriodPayload } from "./types";

export const absencesKey = ["absences"] as const;

export function useAbsences(owner: AbsenceOwner) {
  return useQuery({ queryKey: [...absencesKey, owner], queryFn: () => listAbsences(owner) });
}

// An absence cancels or restores lessons, so the calendar is refetched too.
function useAbsenceMutation<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: absencesKey });
      void client.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
}

export const useCreateAbsence = () => useAbsenceMutation(createAbsence);
export const useUpdateAbsence = () => useAbsenceMutation(({ id, payload }: { id: string; payload: AbsencePeriodPayload }) => updateAbsence(id, payload));
export const useDeleteAbsence = () => useAbsenceMutation(deleteAbsence);
