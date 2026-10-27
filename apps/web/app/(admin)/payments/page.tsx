"use client";

import { useState } from "react";
import { LayoutList, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPage } from "@/components/list-page";
import { ViewToggle } from "@/components/view-toggle";
import { useMe } from "@/features/auth";
import { usePayments } from "@/features/payments/model/use-payments";
import { PaymentSheet } from "@/features/payments/ui/payment-sheet";
import { PaymentsFeed } from "@/features/payments/ui/payments-feed";
import { PaymentsTable } from "@/features/payments/ui/payments-table";
import { PaymentsEmpty, PaymentsError, PaymentsSkeleton } from "@/features/payments/ui/payments-states";
import { useStudents } from "@/features/students/model/use-students";
import { useViewMode } from "@/hooks/use-view-mode";

const PAGE_SIZE = 20;
const ALL = "__all__";
const PAYMENT_VIEWS = ["table", "feed"] as const;

export default function PaymentsPage() {
  const t = useTranslations("Payments");
  const { data: me } = useMe();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [studentId, setStudentId] = useState<string>(ALL);
  const [view, setView] = useViewMode("payments.view", PAYMENT_VIEWS, "table");

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
    return (
      <div className="flex-1">
        {view === "table" ? <PaymentsTable payments={payments.data.items} /> : <PaymentsFeed payments={payments.data.items} />}
      </div>
    );
  }

  return (
    <>
      <ListPage
        title={t("title")}
        toolbar={
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
            <div className="ml-auto flex items-center gap-3">
              <ViewToggle
                value={view}
                onChange={setView}
                options={[
                  { value: "table", label: t("viewTable"), icon: Table2 },
                  { value: "feed", label: t("viewFeed"), icon: LayoutList },
                ]}
              />
              {me?.permissions.includes("payments.create") && (
                <Button onClick={() => setSheetOpen(true)}>
                  {t("newPayment")}
                </Button>
              )}
            </div>
          </div>
        }
        pagination={{ page, totalPages, onPageChange: (next) => setPageState({ page: next, filterKey: studentId }) }}
      >
        {content()}
      </ListPage>
      <PaymentSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
