export type LedgerEntryType = "PURCHASE" | "LESSON_CHARGE" | "LESSON_REVERSAL" | "MANUAL_ADJUSTMENT";

export type LedgerEntry = {
  id: string;
  delta: number;
  type: LedgerEntryType;
  comment: string | null;
  createdAt: string;
  createdBy: { id: string; email: string; name: string | null };
};

export type Balance = { balance: number; isDebt: boolean };

export type LedgerPage = { items: LedgerEntry[]; total: number; page: number; pageSize: number };
