// The method as the API returns it inside a payment; the list of methods lives in features/payment-methods.
export type PaymentMethodRef = { code: string; name: string; icon: string };

export type PaymentProofFile = { originalName: string; mimeType: string; size: number };

export type Payment = {
  id: string;
  amount: string;
  currencyCode: string;
  method: PaymentMethodRef;
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
  method: string;
  lessonsGranted: number;
  paidAt?: string;
  comment?: string;
  proofUrl?: string;
};
