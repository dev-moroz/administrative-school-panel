import { z } from "zod";

export const MAX_ADJUSTMENT = 50;
export const MAX_COMMENT_LENGTH = 1000;

const delta = z
  .string()
  .trim()
  .regex(/^[+-]?\d+$/)
  .refine((value) => {
    const n = Math.abs(Number(value));
    return n >= 1 && n <= MAX_ADJUSTMENT;
  });

export const adjustSchema = z.object({
  delta,
  comment: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});

export type AdjustFormValues = z.infer<typeof adjustSchema>;

export function toAdjustPayload(values: AdjustFormValues) {
  return { delta: Number(values.delta.trim()), comment: values.comment.trim() };
}
