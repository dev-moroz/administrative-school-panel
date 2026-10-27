import { z } from "zod";
import type { Currency } from "@/features/currencies/model/types";
import { PAYMENT_METHODS, type CreatePaymentPayload } from "./types";

export const MAX_LESSONS_GRANTED = 100;
export const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_PROOF_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const PROOF_MODES = ["none", "link", "file"] as const;

const MAX_AMOUNT_LENGTH = 40;
const MAX_COMMENT_LENGTH = 1000;
const MAX_LINK_LENGTH = 2000;

const paymentFormSchema = z.object({
  studentId: z.string().min(1),
  amount: z.string(),
  currencyCode: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  lessonsGranted: z.string(),
  paidAt: z.string(),
  comment: z.string().max(MAX_COMMENT_LENGTH),
  proofMode: z.enum(PROOF_MODES),
  proofUrl: z.string(),
  proofFile: z.custom<File | null>(),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const emptyPaymentValues: PaymentFormValues = {
  studentId: "",
  amount: "",
  currencyCode: "",
  method: "" as PaymentFormValues["method"],
  lessonsGranted: "",
  paidAt: "",
  comment: "",
  proofMode: "none",
  proofUrl: "",
  proofFile: null,
};

export function isAmountValid(amount: string, decimals: number) {
  const value = amount.trim();
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  return value.length <= MAX_AMOUNT_LENGTH && pattern.test(value) && /[1-9]/.test(value);
}

function isHttpUrl(value: string) {
  if (value.length > MAX_LINK_LENGTH) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function proofFileProblem(file: File | null): "required" | "type" | "size" | null {
  if (!file) return "required";
  if (!ALLOWED_PROOF_TYPES.includes(file.type) || file.size === 0) return "type";
  if (file.size > MAX_PROOF_FILE_SIZE) return "size";
  return null;
}

export function createPaymentSchema(currencies: Currency[]) {
  return paymentFormSchema.superRefine((values, ctx) => {
    const issue = (path: keyof PaymentFormValues) => ctx.addIssue({ code: "custom", path: [path], message: path });

    const currency = currencies.find((c) => c.code === values.currencyCode);
    if (!currency) issue("currencyCode");
    if (!isAmountValid(values.amount, currency?.decimals ?? 2)) issue("amount");

    const lessons = values.lessonsGranted.trim();
    if (!/^\d+$/.test(lessons) || Number(lessons) < 1 || Number(lessons) > MAX_LESSONS_GRANTED) issue("lessonsGranted");

    if (values.proofMode === "link" && !isHttpUrl(values.proofUrl.trim())) issue("proofUrl");
    if (values.proofMode === "file" && proofFileProblem(values.proofFile)) issue("proofFile");
  });
}

export function toPayload(values: PaymentFormValues): CreatePaymentPayload {
  const payload: CreatePaymentPayload = {
    studentId: values.studentId,
    amount: values.amount.trim(),
    currencyCode: values.currencyCode,
    method: values.method,
    lessonsGranted: Number(values.lessonsGranted.trim()),
  };
  if (values.paidAt) payload.paidAt = new Date(values.paidAt).toISOString();
  const comment = values.comment.trim();
  if (comment) payload.comment = comment;
  if (values.proofMode === "link") payload.proofUrl = values.proofUrl.trim();
  return payload;
}
