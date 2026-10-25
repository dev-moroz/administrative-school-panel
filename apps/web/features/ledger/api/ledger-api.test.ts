import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { adjustBalance } from "./adjust-balance";
import { getBalance } from "./get-balance";
import { listLedger } from "./list-ledger";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const first = () => vi.mocked(apiFetch).mock.calls[0];

describe("ledger api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({});
  });

  it("getBalance requests /students/:id/balance", async () => {
    await getBalance("s1");
    expect(first()[0]).toBe("/students/s1/balance");
  });

  it("listLedger sends page and pageSize", async () => {
    await listLedger("s1", { page: 2, pageSize: 10 });
    const url = new URL(first()[0] as string, "http://x");
    expect(url.pathname).toBe("/students/s1/ledger");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("10");
  });

  it("adjustBalance POSTs { delta, comment } as JSON", async () => {
    await adjustBalance("s1", { delta: -2, comment: "fix" });
    const [path, init] = first();
    expect(path).toBe("/students/s1/ledger/adjustments");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ delta: -2, comment: "fix" });
  });

  it("returns the API response as is", async () => {
    const data = { balance: 3, isDebt: false };
    vi.mocked(apiFetch).mockResolvedValue(data);
    await expect(getBalance("s1")).resolves.toEqual(data);
  });
});
