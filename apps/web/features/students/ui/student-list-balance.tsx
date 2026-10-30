import { useTranslations } from "next-intl";
import { getBalanceBadge } from "@/features/ledger/model/get-balance-badge";
import { BalanceStatusBadge } from "@/features/ledger/ui/balance-status-badge";
import type { StudentListItem } from "../model/types";

type Props = { student: StudentListItem; threshold: number | undefined };

export function StudentListBalance({ student, threshold }: Props) {
  const t = useTranslations("Students");
  if (student.balance === undefined) return null;
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="font-medium">{student.balance}</span>
      <span className="text-muted-foreground">{t("lessonsLeft")}</span>
      <BalanceStatusBadge badge={getBalanceBadge(student.balance, threshold, student.isActive)} />
    </span>
  );
}
