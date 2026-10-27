import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { createPayment } from "./create-payment";
import { listPayments } from "./list-payments";
import { uploadProof } from "./upload-proof";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const first = () => vi.mocked(apiFetch).mock.calls[0];

describe("payments api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({});
  });

  it("listPayments sends page and pageSize", async () => {
    await listPayments({ page: 2, pageSize: 20 });
    const url = new URL(first()[0] as string, "http://x");
    expect(url.pathname).toBe("/payments");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("20");
    expect(url.searchParams.has("studentId")).toBe(false);
  });

  it("listPayments adds studentId when given", async () => {
    await listPayments({ page: 1, pageSize: 10, studentId: "s1" });
    expect(new URL(first()[0] as string, "http://x").searchParams.get("studentId")).toBe("s1");
  });

  it("createPayment POSTs the payload as JSON", async () => {
    const payload = { studentId: "s1", amount: "400", currencyCode: "EUR", method: "CASH", lessonsGranted: 8 };
    await createPayment(payload);
    const [path, init] = first();
    expect(path).toBe("/payments");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });

  it("uploadProof POSTs the file as multipart field 'file' without setting headers itself", async () => {
    const file = new File(["%PDF"], "receipt.pdf", { type: "application/pdf" });
    await uploadProof("p1", file);
    const [path, init] = first();
    expect(path).toBe("/payments/p1/proof");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(((init?.body as FormData).get("file") as File).name).toBe("receipt.pdf");
    expect(init?.headers).toBeUndefined();
  });

  it("returns the API response as is", async () => {
    const data = { items: [], total: 0, page: 1, pageSize: 20 };
    vi.mocked(apiFetch).mockResolvedValue(data);
    await expect(listPayments({ page: 1, pageSize: 20 })).resolves.toEqual(data);
  });
});
