"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/features/auth";
import { usePayments } from "@/features/payments/model/use-payments";
import { PaymentSheet } from "@/features/payments/ui/payment-sheet";
import { PaymentsFeed } from "@/features/payments/ui/payments-feed";
import { PaymentsEmpty, PaymentsError, PaymentsSkeleton } from "@/features/payments/ui/payments-states";
import { useStudents } from "@/features/students/model/use-students";
import { StudentsPagination } from "@/features/students/ui/students-pagination";

const PAGE_SIZE = 20;
const ALL = "__all__";

export default function PaymentsPage() {
  const t = useTranslations("Payments");
  const { data: me } = useMe();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [studentId, setStudentId] = useState<string>(ALL);

  // The page belongs to the filter it was chosen under; a new filter falls back to page 1.
  const [pageState, setPageState] = useState({ page: 1, filterKey: studentId });
  const page = pageState.filterKey === studentId ? pageState.page : 1;

  const students = useStudents({ page: 1, pageSize: 100, isActive: true });
  const payments = usePayments({ page, pageSize: PAGE_SIZE, studentId: studentId === ALL ? undefined : studentId });
  const totalPages = Math.max(1, Math.ceil((payments.data?.total ?? 0) / PAGE_SIZE));

  function content() {
    if (payments.isError) return <PaymentsError centered onRetry={() => payments.refetch()} />;
    if (payments.isPending) return <div className="flex-1"><PaymentsSkeleton /></div>;
    if (payments.data.items.length === 0) return <PaymentsEmpty centered />;
    return <div className="flex-1"><PaymentsFeed payments={payments.data.items} /></div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger aria-label={t("filterLabel")} className="w-64">
            <SelectValue>
              {studentId === ALL ? t("allStudents") : students.data?.items.find((s) => s.id === studentId)?.fullName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStudents")}</SelectItem>
            {students.data?.items.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {me?.permissions.includes("payments.create") && (
          <Button onClick={() => setSheetOpen(true)}>
            {t("newPayment")}
          </Button>
        )}
      </div>
      {content()}
      {!!payments.data?.total && (
        <StudentsPagination
          page={page}
          totalPages={totalPages}
          onPageChange={(next) => setPageState({ page: next, filterKey: studentId })}
        />
      )}
      <PaymentSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
