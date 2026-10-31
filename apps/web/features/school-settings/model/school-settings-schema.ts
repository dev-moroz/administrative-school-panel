import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const schoolSettingsSchema = z
  .object({
    lowBalanceThreshold: z
      .string()
      .trim()
      .regex(/^\d{1,3}$/)
      .refine((value) => Number(value) <= 100),
    dayStartsAt: time,
    eveningStartsAt: time,
    lateWindowMin: z
      .string()
      .trim()
      .regex(/^\d{1,4}$/)
      .refine((value) => Number(value) <= 1440),
  })
  .refine((v) => v.eveningStartsAt > v.dayStartsAt, { path: ["eveningStartsAt"], message: "order" });

export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;
