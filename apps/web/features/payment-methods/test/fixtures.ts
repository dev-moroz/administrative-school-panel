import type { PaymentMethod } from "../model/types";

export function makePaymentMethod(patch: Partial<PaymentMethod> = {}): PaymentMethod {
  return { code: "CASH", name: "Cash", icon: "banknote", isActive: true, ...patch };
}

// Stock methods as the seed creates them.
export const paymentMethods: PaymentMethod[] = [
  makePaymentMethod({ code: "CARD", name: "Card", icon: "credit-card" }),
  makePaymentMethod({ code: "CASH", name: "Cash", icon: "banknote" }),
  makePaymentMethod({ code: "TRANSFER", name: "Bank transfer", icon: "landmark" }),
];
