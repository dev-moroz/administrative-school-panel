import type { Prisma } from '../generated/prisma/client.js';

export const LEDGER_ENTRY_SELECT = {
  id: true,
  delta: true,
  type: true,
  comment: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.LedgerEntrySelect;

type LedgerEntryRow = Prisma.LedgerEntryGetPayload<{ select: typeof LEDGER_ENTRY_SELECT }>;

export function authorName(user: { firstName: string | null; lastName: string | null }): string | null {
  const parts = [user.firstName, user.lastName].map((part) => part?.trim()).filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

export function toLedgerEntryDto(row: LedgerEntryRow) {
  const { createdBy, ...rest } = row;
  return { ...rest, createdBy: { id: createdBy.id, email: createdBy.email, name: authorName(createdBy) } };
}
