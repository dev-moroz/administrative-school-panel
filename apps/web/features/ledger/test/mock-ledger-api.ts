import { ApiError } from "@/lib/api";
import type { LedgerEntry } from "../model/types";
import { makeEntry } from "./fixtures";

export type LedgerMock = {
  balance: number;
  entries: LedgerEntry[];
  balanceError?: ApiError;
  ledgerError?: ApiError;
  adjustError?: ApiError;
  lowBalanceThreshold?: number;
};

// Returns undefined for paths that are not ledger endpoints, so callers can chain handlers.
export function handleLedger(mock: LedgerMock, path: string, init?: RequestInit): unknown {
  const url = new URL(path, "http://x");
  const method = init?.method ?? "GET";
  if (url.pathname === "/settings/school" && method === "GET") {
    return { lowBalanceThreshold: mock.lowBalanceThreshold ?? 2 };
  }
  const match = url.pathname.match(/^\/students\/([^/]+)\/(balance|ledger|ledger\/adjustments)$/);
  if (!match) return undefined;

  if (match[2] === "balance" && method === "GET") {
    if (mock.balanceError) throw mock.balanceError;
    return { balance: mock.balance, isDebt: mock.balance < 0 };
  }
  if (match[2] === "ledger" && method === "GET") {
    if (mock.ledgerError) throw mock.ledgerError;
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    const items = mock.entries.slice((page - 1) * pageSize, page * pageSize);
    return { items, total: mock.entries.length, page, pageSize };
  }
  if (match[2] === "ledger/adjustments" && method === "POST") {
    if (mock.adjustError) throw mock.adjustError;
    const body = JSON.parse(String(init?.body)) as { delta: number; comment: string };
    const entry = makeEntry({ id: `new-${mock.entries.length}`, type: "MANUAL_ADJUSTMENT", ...body });
    mock.entries = [entry, ...mock.entries];
    mock.balance += body.delta;
    return entry;
  }
  return undefined;
}
