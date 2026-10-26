import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, apiFetch } from "@/lib/api";
import { makePayment } from "@/features/payments/test/fixtures";
import { renderWithProviders } from "@/test/render";
import PaymentsPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

const PAGE_SIZE = 20;
const TOTAL = 45;

function mockApi({ permissions = ["payments.read", "payments.create"], empty = false, listError }: { permissions?: string[]; empty?: boolean; listError?: ApiError } = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const url = new URL(path, "http://x");
    if (url.pathname === "/auth/me") return { id: "u1", email: "a@b.c", role: "admin", permissions };
    if (url.pathname === "/students") {
      return {
        items: [
          { id: "s1", fullName: "Anna Petrova", telegramUsername: null, isActive: true },
          { id: "s2", fullName: "Max Kozlov", telegramUsername: null, isActive: true },
        ],
        total: 2,
        page: 1,
        pageSize: 100,
      };
    }
    if (url.pathname === "/payments") {
      if (listError) throw listError;
      const page = Number(url.searchParams.get("page"));
      if (empty) return { items: [], total: 0, page, pageSize: PAGE_SIZE };
      return { items: [makePayment({ id: `p${page}`, student: { id: "s1", fullName: `Payer ${page}` } })], total: TOTAL, page, pageSize: PAGE_SIZE };
    }
    throw new Error(`unexpected ${path}`);
  });
}

const paymentCalls = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.map(([p]) => new URL(p as string, "http://x"))
    .filter((u) => u.pathname === "/payments");
const lastCall = () => paymentCalls().at(-1)!;

describe("PaymentsPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("loads the first page with pageSize 20 and shows the feed", async () => {
    mockApi();
    renderWithProviders(<PaymentsPage />);
    expect(await screen.findByText("Payer 1")).toBeInTheDocument();
    expect(lastCall().searchParams.get("page")).toBe("1");
    expect(lastCall().searchParams.get("pageSize")).toBe("20");
    expect(lastCall().searchParams.has("studentId")).toBe(false);
  });

  it("paginates: Page 1 of 3, Previous disabled, Next loads page 2", async () => {
    mockApi();
    renderWithProviders(<PaymentsPage />);
    await screen.findByText("Payer 1");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Payer 2")).toBeInTheDocument();
  });

  it("filters by student and resets to page 1; 'All students' removes the filter", async () => {
    mockApi();
    renderWithProviders(<PaymentsPage />);
    await screen.findByText("Payer 1");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Payer 2");

    await userEvent.click(screen.getByRole("combobox", { name: "Filter by student" }));
    await userEvent.click(await screen.findByRole("option", { name: "Max Kozlov" }));
    await waitFor(() => expect(lastCall().searchParams.get("studentId")).toBe("s2"));
    expect(lastCall().searchParams.get("page")).toBe("1");

    await userEvent.click(screen.getByRole("combobox", { name: "Filter by student" }));
    await userEvent.click(await screen.findByRole("option", { name: "All students" }));
    await waitFor(() => expect(lastCall().searchParams.has("studentId")).toBe(false));
  });

  it("shows an empty state and hides the pagination", async () => {
    mockApi({ empty: true });
    renderWithProviders(<PaymentsPage />);
    expect(await screen.findByText("No payments yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("shows an error with Retry", async () => {
    mockApi({ listError: new ApiError(500) });
    renderWithProviders(<PaymentsPage />);
    expect(await screen.findByText("Could not load payments")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("'New payment' opens the payment sheet", async () => {
    mockApi();
    renderWithProviders(<PaymentsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "New payment" }));
    expect(await screen.findByRole("button", { name: "Save payment" })).toBeInTheDocument();
  });

  it("hides 'New payment' without payments.create", async () => {
    mockApi({ permissions: ["payments.read"] });
    renderWithProviders(<PaymentsPage />);
    await screen.findByText("Payer 1");
    expect(screen.queryByRole("button", { name: "New payment" })).not.toBeInTheDocument();
  });
});
