import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { makeCurrency } from "../test/fixtures";
import { useActiveCurrencies, useCurrencies } from "./use-currencies";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

const LIST = [makeCurrency({ code: "EUR" }), makeCurrency({ code: "CHF", isActive: false }), makeCurrency({ code: "GBP" })];

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe("currency hooks", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue(LIST);
  });

  it("useCurrencies returns every currency, inactive ones included", async () => {
    const { result } = renderHook(() => useCurrencies(true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((c) => c.code)).toEqual(["EUR", "CHF", "GBP"]);
  });

  it("useActiveCurrencies returns only active currencies", async () => {
    const { result } = renderHook(() => useActiveCurrencies(true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((c) => c.code)).toEqual(["EUR", "GBP"]);
  });

  it("both hooks share one request and one cache entry", async () => {
    const { result } = renderHook(() => ({ all: useCurrencies(true), active: useActiveCurrencies(true) }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.active.data).toBeDefined());
    expect(result.current.all.data).toHaveLength(3);
    expect(result.current.active.data).toHaveLength(2);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });

  it("does not request anything while disabled", () => {
    renderHook(() => useActiveCurrencies(false), { wrapper: wrapper() });
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });
});
