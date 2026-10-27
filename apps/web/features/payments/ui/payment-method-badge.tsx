"use client";

import { Badge } from "@/components/ui/badge";
import { PaymentMethodIcon } from "@/features/payment-methods/ui/payment-method-icon";
import type { PaymentMethodRef } from "../model/types";

export function PaymentMethodBadge({ method }: { method: PaymentMethodRef }) {
  return (
    <Badge variant="outline" className="gap-1">
      <PaymentMethodIcon name={method.icon} className="size-3" />
      {method.name}
    </Badge>
  );
}
