"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ledgerKey } from "@/features/ledger/model/use-balance";
import { createPayment } from "../api/create-payment";
import { listPayments } from "../api/list-payments";
import { uploadProof } from "../api/upload-proof";
import { paymentsKey } from "./payments-key";
import type { PaymentListParams } from "./types";

export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: [...paymentsKey, "list", params],
    queryFn: () => listPayments(params),
    placeholderData: keepPreviousData,
  });
}

export const STUDENT_PAYMENTS_PAGE_SIZE = 10;

export function useStudentPayments(studentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...paymentsKey, "student", studentId],
    queryFn: ({ pageParam }) => listPayments({ studentId, page: pageParam, pageSize: STUDENT_PAYMENTS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled,
  });
}

export function useCreatePayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createPayment,
    // A payment changes the history and, through the PURCHASE entry, the student's balance.
    onSuccess: (_payment, payload) => {
      void client.invalidateQueries({ queryKey: paymentsKey });
      void client.invalidateQueries({ queryKey: ledgerKey(payload.studentId) });
    },
  });
}

export function useUploadProof() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, file }: { paymentId: string; file: File }) => uploadProof(paymentId, file),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: paymentsKey });
    },
  });
}
