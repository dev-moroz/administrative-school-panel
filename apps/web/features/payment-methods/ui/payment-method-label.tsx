import { PaymentMethodIcon } from "./payment-method-icon";

export function MethodLabel({ method }: { method: { name: string; icon: string } }) {
  return (
    <span className="flex items-center gap-2">
      <PaymentMethodIcon name={method.icon} />
      {method.name}
    </span>
  );
}
