"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth";
import { useStudentPayments } from "../model/use-payments";
import { PaymentsEmpty, PaymentsError, PaymentsSkeleton } from "./payments-states";
import { PaymentsCompactList } from "./payments-compact-list";

export function StudentPayments({ studentId }: { studentId: string }) {
  const t = useTranslations("Payments");
  const { data: me } = useMe();
  const canRead = !!me?.permissions.includes("payments.read");
  const query = useStudentPayments(studentId, canRead);

  if (!canRead) return null;

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  function body() {
    if (query.isError) return <PaymentsError onRetry={() => query.refetch()} />;
    if (query.isPending) return <PaymentsSkeleton />;
    if (items.length === 0) return <PaymentsEmpty />;
    return (
      <>
        <PaymentsCompactList payments={items} />
        {query.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-center"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {t("showMore")}
          </Button>
        )}
      </>
    );
  }

  return (
    <section className="grid gap-3">{body()}</section>
  );
}
