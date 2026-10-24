import { z } from "zod";

export const ENGLISH_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

const MAX_LESSON_PRICE = 9_999_999_999.99;

const optionalUsername = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^[A-Za-z0-9_]{5,32}$/)]));

const price = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= MAX_LESSON_PRICE));

export const studentSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  telegramUsername: optionalUsername,
  englishLevel: z.union([z.literal(""), z.enum(ENGLISH_LEVELS)]),
  comment: z.string().max(2000),
  defaultCurrencyCode: z.string().max(10),
  lessonPrice: price,
  isActive: z.boolean(),
  teacherId: z.string().optional(),
});

export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

export type StudentFormValues = z.infer<typeof studentSchema>;

export function toPayload(values: StudentFormValues, mode: "create" | "edit") {
  const empty = mode === "edit" ? null : undefined;
  const text = (value: string) => (value === "" ? empty : value);

  const payload = {
    fullName: values.fullName,
    telegramUsername: text(values.telegramUsername),
    englishLevel: text(values.englishLevel),
    comment: text(values.comment),
    defaultCurrencyCode: text(values.defaultCurrencyCode),
    lessonPrice: values.lessonPrice === "" ? empty : Number(values.lessonPrice),
  };
  if (mode === "edit") return { ...payload, isActive: values.isActive };
  return values.teacherId ? { ...payload, teacherId: values.teacherId } : payload;
}
