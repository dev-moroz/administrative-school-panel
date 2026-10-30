"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSchoolSettings, updateSchoolSettings } from "../api/school-settings";

const KEY = ["school-settings"];

export function useSchoolSettings() {
  return useQuery({ queryKey: KEY, queryFn: getSchoolSettings, staleTime: 2 * 60_000 });
}

export function useUpdateSchoolSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateSchoolSettings,
    onSuccess: (settings) => client.setQueryData(KEY, settings),
  });
}
