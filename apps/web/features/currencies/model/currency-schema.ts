import { z } from "zod";

export const currencySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/),
  name: z.string().trim().min(1).max(50),
  decimals: z.string().trim().regex(/^[0-8]$/),
  isActive: z.boolean().optional(),
});

export type CurrencyFormValues = z.infer<typeof currencySchema>;

export function toCreatePayload(values: Pick<CurrencyFormValues, "code" | "name" | "decimals">) {
  return { code: values.code, name: values.name, decimals: Number(values.decimals) };
}
