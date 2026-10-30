import { z } from "zod";

export const schoolSettingsSchema = z.object({
  lowBalanceThreshold: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/)
    .refine((value) => Number(value) <= 100),
});

export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;
