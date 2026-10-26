export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "CRYPTO"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentProofFile = { originalName: string; mimeType: string; size: number };

export type Payment = {
  id: string;
  amount: string;
  currencyCode: string;
  method: PaymentMethod;
  paidAt: string;
  comment: string | null;
  proofUrl: string | null;
  proofFile: PaymentProofFile | null;
  lessonsGranted: number;
  createdAt: string;
  student: { id: string; fullName: string };
  createdBy: { id: string; email: string; name: string | null };
};

export type PaymentsPage = { items: Payment[]; total: number; page: number; pageSize: number };

export type PaymentListParams = { page: number; pageSize: number; studentId?: string };

export type CreatePaymentPayload = {
  studentId: string;
  amount: string;
  currencyCode: string;
  method: PaymentMethod;
  lessonsGranted: number;
  paidAt?: string;
  comment?: string;
  proofUrl?: string;
};
