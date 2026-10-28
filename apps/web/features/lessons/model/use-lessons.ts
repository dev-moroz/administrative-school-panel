"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changeLessonStatus } from "../api/change-lesson-status";
import { createLesson } from "../api/create-lesson";
import { createSeries } from "../api/create-series";
import { deleteLesson } from "../api/delete-lesson";
import { getCancelPreview } from "../api/get-cancel-preview";
import { listCancelReasons } from "../api/list-cancel-reasons";
import { listLessons } from "../api/list-lessons";
import { splitSeries } from "../api/split-series";
import { updateLesson } from "../api/update-lesson";
import type { DateRange, SplitSeriesPayload, StatusPayload, UpdateLessonPayload } from "./types";

export const lessonsKey = ["lessons"] as const;

export function useLessons(range: DateRange | null) {
  return useQuery({
    queryKey: [...lessonsKey, range?.from.toISOString(), range?.to.toISOString()],
    queryFn: () => listLessons(range!),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}

export function useCancelReasons() {
  return useQuery({ queryKey: ["cancel-reasons"], queryFn: listCancelReasons, staleTime: Infinity });
}

export function useCancelPreview(lessonId: string, enabled: boolean) {
  return useQuery({ queryKey: [...lessonsKey, lessonId, "cancel-preview"], queryFn: () => getCancelPreview(lessonId), enabled, gcTime: 0 });
}

// Any lesson change may touch a balance (charges, deleted or regenerated lessons), so all balances are refetched.
function useLessonMutation<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: lessonsKey });
      void client.invalidateQueries({ queryKey: ["ledger"] });
    },
  });
}

export const useCreateLesson = () => useLessonMutation(createLesson);
export const useCreateSeries = () => useLessonMutation(createSeries);
export const useUpdateLesson = () => useLessonMutation(({ id, payload }: { id: string; payload: UpdateLessonPayload }) => updateLesson(id, payload));
export const useChangeLessonStatus = () => useLessonMutation(({ id, payload }: { id: string; payload: StatusPayload }) => changeLessonStatus(id, payload));
export const useDeleteLesson = () => useLessonMutation(deleteLesson);
export const useSplitSeries = () =>
  useLessonMutation(({ seriesId, payload }: { seriesId: string; payload: SplitSeriesPayload }) => splitSeries(seriesId, payload));
