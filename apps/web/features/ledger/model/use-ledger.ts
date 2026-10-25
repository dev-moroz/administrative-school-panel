"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { listLedger } from "../api/list-ledger";
import { ledgerKey } from "./use-balance";

export const LEDGER_PAGE_SIZE = 10;

export function useLedger(studentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...ledgerKey(studentId), "entries"],
    queryFn: ({ pageParam }) => listLedger(studentId, { page: pageParam, pageSize: LEDGER_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled,
  });
}
