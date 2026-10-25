import type { Prisma } from '../generated/prisma/client.js';

export const LEDGER_ENTRY_SELECT = {
  id: true,
  delta: true,
  type: true,
  comment: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true } },
} satisfies Prisma.LedgerEntrySelect;
