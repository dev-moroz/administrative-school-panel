import type { Prisma } from '../generated/prisma/client.js';
import { authorName } from '../ledger/ledger.mapper.js';

export const PAYMENT_SELECT = {
  id: true,
  amount: true,
  currencyCode: true,
  currency: { select: { decimals: true } },
  method: true,
  paidAt: true,
  comment: true,
  proofUrl: true,
  proofFile: { select: { originalName: true, mimeType: true, size: true } },
  lessonsGranted: true,
  createdAt: true,
  student: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

export function toPaymentDto(row: PaymentRow) {
  const { currency, createdBy, amount, ...rest } = row;
  return {
    ...rest,
    amount: amount.toFixed(currency.decimals),
    createdBy: { id: createdBy.id, email: createdBy.email, name: authorName(createdBy) },
  };
}
