import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import { makePayment } from "../test/fixtures";
import { StudentPayments } from "./student-payments";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

const PAGE_SIZE = 10;

function mockApi({ permissions = ["payments.read"], total = 12, listError }: { permissions?: string[]; total?: number; listError?: ApiError } = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const url = new URL(path, "http://x");
    if (url.pathname === "/auth/me") return { id: "u1", email: "a@b.c", role: "teacher", permissions };
    if (url.pathname === "/payments") {
      if (listError) throw listError;
      const page = Number(url.searchParams.get("page"));
      const count = Math.max(0, Math.min(PAGE_SIZE, total - (page - 1) * PAGE_SIZE));
      const items = Array.from({ length: count }, (_, i) => makePayment({ id: `p${page}-${i}`, amount: `${page}0${i}.00`, comment: "Hidden note" }));
      return { items, total, page, pageSize: PAGE_SIZE };
    }
    throw new Error(`unexpected ${path}`);
  });
}

const paymentUrls = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.map(([p]) => new URL(p as string, "http://x"))
    .filter((u) => u.pathname === "/payments");

describe("StudentPayments", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("loads the student's payments and hides the student name", async () => {
    mockApi();
    renderWithProviders(<StudentPayments studentId="s1" />);
    expect(await screen.findByText("100.00")).toBeInTheDocument();
    expect(paymentUrls()[0].searchParams.get("studentId")).toBe("s1");
    expect(paymentUrls()[0].searchParams.get("pageSize")).toBe("10");
    expect(screen.queryByText("Anna Petrova")).not.toBeInTheDocument();
  });

  it("shows lessons, amount, currency and who took the payment, nothing more", async () => {
    mockApi({ total: 1 });
    renderWithProviders(<StudentPayments studentId="s1" />);
    expect(await screen.findByText("+8 lessons")).toBeInTheDocument();
    expect(screen.getByText("100.00")).toBeInTheDocument();
    expect(screen.getByText("EUR")).toBeInTheDocument();
    expect(screen.getByText(/Olga Smirnova/)).toBeInTheDocument();
    expect(screen.queryByText("Hidden note")).not.toBeInTheDocument();
    expect(screen.queryByText("Bank transfer")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no 'Add payment' button", async () => {
    mockApi({ permissions: ["payments.read", "payments.create"] });
    renderWithProviders(<StudentPayments studentId="s1" />);
    await screen.findByText("100.00");
    expect(screen.queryByRole("button", { name: /add payment|new payment/i })).not.toBeInTheDocument();
  });

  it("renders nothing and makes no payments request without payments.read", async () => {
    mockApi({ permissions: ["students.read"] });
    const { container } = renderWithProviders(<StudentPayments studentId="s1" />);
    await vi.waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(paymentUrls()).toHaveLength(0);
  });

  it("'Show more' loads the next page", async () => {
    mockApi({ total: 12 });
    renderWithProviders(<StudentPayments studentId="s1" />);
    await screen.findByText("100.00");
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("200.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockApi({ total: 0 });
    renderWithProviders(<StudentPayments studentId="s1" />);
    expect(await screen.findByText("No payments yet")).toBeInTheDocument();
  });

  it("shows an error with Retry", async () => {
    mockApi({ listError: new ApiError(500) });
    renderWithProviders(<StudentPayments studentId="s1" />);
    expect(await screen.findByText("Could not load payments")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
