import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { makePaymentMethod } from "../test/fixtures";
import { useActivePaymentMethods, usePaymentMethods } from "./use-payment-methods";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

const LIST = [makePaymentMethod({ code: "CARD" }), makePaymentMethod({ code: "OLD", isActive: false }), makePaymentMethod({ code: "CASH" })];

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe("payment method hooks", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue(LIST);
  });

  it("usePaymentMethods requests /payment-methods and returns every method", async () => {
    const { result } = renderHook(() => usePaymentMethods(true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith("/payment-methods");
    expect(result.current.data?.map((m) => m.code)).toEqual(["CARD", "OLD", "CASH"]);
  });

  it("useActivePaymentMethods returns only active methods", async () => {
    const { result } = renderHook(() => useActivePaymentMethods(true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((m) => m.code)).toEqual(["CARD", "CASH"]);
  });

  it("both hooks share one request and one cache entry", async () => {
    const { result } = renderHook(() => ({ all: usePaymentMethods(true), active: useActivePaymentMethods(true) }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.active.data).toBeDefined());
    expect(result.current.all.data).toHaveLength(3);
    expect(result.current.active.data).toHaveLength(2);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });

  it("does not request anything while disabled", () => {
    renderHook(() => useActivePaymentMethods(false), { wrapper: wrapper() });
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });
});
