"use client";

import { ArrowLeftRight, Banknote, Bitcoin, CreditCard, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { PaymentMethod } from "../model/types";

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  CRYPTO: Bitcoin,
};

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const t = useTranslations("Payments");
  const Icon = METHOD_ICONS[method];

  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="size-3" aria-hidden />
      {t(`method.${method}`)}
    </Badge>
  );
}
