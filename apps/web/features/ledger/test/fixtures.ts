import type { LedgerEntry } from "../model/types";

export function makeEntry(patch: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "e1",
    delta: 8,
    type: "PURCHASE",
    comment: null,
    createdAt: "2026-10-25T14:10:00.000Z",
    createdBy: { id: "u1", email: "admin@school.test", name: "Olga Smirnova" },
    ...patch,
  };
}
