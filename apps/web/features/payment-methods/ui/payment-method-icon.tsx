import { cn } from "@/lib/utils";
import { FALLBACK_PAYMENT_METHOD_ICON, PAYMENT_METHOD_ICON_COMPONENTS } from "../model/payment-method-icons";

// An unknown name (for example an icon added on the API side first) draws a generic icon instead of crashing.
export function PaymentMethodIcon({ name, className }: { name: string; className?: string }) {
  const Icon = PAYMENT_METHOD_ICON_COMPONENTS[name] ?? FALLBACK_PAYMENT_METHOD_ICON;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}
