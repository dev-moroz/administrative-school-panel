"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth";
import { ApiError } from "@/lib/api";
import { toAdjustPayload, type AdjustFormValues } from "../model/adjust-schema";
import { useAdjustBalance } from "../model/use-adjust-balance";
import { useBalance } from "../model/use-balance";
import { useLedger } from "../model/use-ledger";
import { AdjustBalanceForm } from "./adjust-balance-form";
import { LedgerHistory } from "./ledger-history";

type Props = { studentId: string; onDirtyChange?: (dirty: boolean) => void };

export function StudentBalance({ studentId, onDirtyChange }: Props) {
  const t = useTranslations("Ledger");
  const { data: me } = useMe();
  const canRead = !!me?.permissions.includes("balance.read");
  const canAdjust = !!me?.permissions.includes("balance.adjust");

  const balance = useBalance(studentId, canRead);
  const ledger = useLedger(studentId, canRead);
  const adjust = useAdjustBalance(studentId);

  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const handleDirty = useCallback(
    (dirty: boolean) => {
      setFormDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange],
  );

  function closeForm() {
    adjust.reset();
    setFormOpen(false);
    setConfirmCancel(false);
    handleDirty(false);
  }

  function requestCancel() {
    if (formDirty) setConfirmCancel(true);
    else closeForm();
  }

  function submit(values: AdjustFormValues) {
    adjust.mutate(toAdjustPayload(values), {
      onSuccess: () => {
        toast.success(t("toastAdjusted"));
        closeForm();
      },
    });
  }

  function saveError(error: unknown) {
    if (!error) return null;
    if (error instanceof ApiError && error.status === 400) return t("saveInvalid");
    if (error instanceof ApiError && error.status === 403) return t("saveForbidden");
    if (error instanceof ApiError && error.status === 404) return t("studentNotFound");
    return t("saveFailed");
  }

  if (me && !canRead) return null;

  const items = ledger.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="grid gap-5 border-t pt-8">
      <h3 className="text-sm font-medium text-muted-foreground">{t("title")}</h3>

      {balance.isError ? (
        <div role="alert" className="grid justify-items-start gap-2">
          <p className="text-sm text-muted-foreground">{t("loadBalanceError")}</p>
          <Button variant="outline" size="sm" onClick={() => balance.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : balance.data ? (
        <div className="flex items-center gap-3">
          <span className={balance.data.isDebt ? "text-4xl font-semibold text-destructive" : "text-4xl font-semibold"}>
            {balance.data.balance}
          </span>
          <span className="text-muted-foreground">{t("lessonsLeft")}</span>
          {balance.data.isDebt && <Badge variant="destructive">{t("debt")}</Badge>}
          {canAdjust && !formOpen && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setFormOpen(true)}>
              {t("adjust")}
            </Button>
          )}
        </div>
      ) : (
        <Skeleton aria-label={t("loadingBalance")} className="h-10 w-1/2" />
      )}

      {canAdjust && formOpen && (
        <AdjustBalanceForm
          balance={balance.data?.balance}
          isSubmitting={adjust.isPending}
          errorMessage={saveError(adjust.error)}
          onSubmit={submit}
          onCancel={requestCancel}
          onDirtyChange={handleDirty}
        />
      )}

      <h4 className="text-sm font-medium text-muted-foreground">{t("history")}</h4>
      <LedgerHistory
        items={items}
        isPending={ledger.isPending}
        isError={ledger.isError}
        hasMore={!!ledger.hasNextPage}
        isFetchingMore={ledger.isFetchingNextPage}
        onShowMore={() => ledger.fetchNextPage()}
        onRetry={() => ledger.refetch()}
      />

      <DiscardChangesDialog open={confirmCancel} onKeep={() => setConfirmCancel(false)} onDiscard={closeForm} />
    </section>
  );
}
