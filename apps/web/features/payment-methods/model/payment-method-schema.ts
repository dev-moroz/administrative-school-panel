import { z } from "zod";
import { PAYMENT_METHOD_ICONS } from "./payment-method-icons";

export const paymentMethodSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,20}$/),
  name: z.string().trim().min(1).max(50),
  icon: z.string().refine((value) => PAYMENT_METHOD_ICONS.includes(value)),
  isActive: z.boolean().optional(),
});

export type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;

export function toCreatePayload(values: PaymentMethodFormValues) {
  return { code: values.code, name: values.name, icon: values.icon };
}
