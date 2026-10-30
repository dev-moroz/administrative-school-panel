import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { BalanceBadge } from "../model/get-balance-badge";

export function BalanceStatusBadge({ badge }: { badge: BalanceBadge }) {
  const t = useTranslations("Ledger");
  if (badge === "debt") return <Badge variant="destructive">{t("debt")}</Badge>;
  if (badge === "low") return <Badge variant="warning">{t("lowBalance")}</Badge>;
  return null;
}
