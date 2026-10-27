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
    localStorage.clear();
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

  describe("view mode", () => {
    it("shows the table by default", async () => {
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Table")).toHaveAttribute("data-state", "on");
    });

    it("lists the Table toggle before the Feed toggle", async () => {
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["Table", "Feed"]);
    });

    it("switches to the feed, keeps the data and remembers the view", async () => {
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      await userEvent.click(screen.getByLabelText("Feed"));
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.getByText("Payer 1")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
      expect(localStorage.getItem("payments.view")).toBe("feed");
    });

    it("switches back to the table", async () => {
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      await userEvent.click(screen.getByLabelText("Feed"));
      await userEvent.click(screen.getByLabelText("Table"));
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });

    it("restores the saved feed view on load", async () => {
      localStorage.setItem("payments.view", "feed");
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      await waitFor(() => expect(screen.queryByRole("table")).not.toBeInTheDocument());
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    });

    it("falls back to the table when the saved value is not a payments view", async () => {
      localStorage.setItem("payments.view", "cards");
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("does not touch the students view setting", async () => {
      localStorage.setItem("students.view", "list");
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      await userEvent.click(screen.getByLabelText("Feed"));
      expect(localStorage.getItem("students.view")).toBe("list");
    });

    it("keeps the page and the student filter, and does not refetch, when the view changes", async () => {
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      await userEvent.click(screen.getByRole("combobox", { name: "Filter by student" }));
      await userEvent.click(await screen.findByRole("option", { name: "Max Kozlov" }));
      await waitFor(() => expect(lastCall().searchParams.get("studentId")).toBe("s2"));
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Payer 2");

      const calls = paymentCalls().length;
      await userEvent.click(screen.getByLabelText("Feed"));
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
      expect(screen.getByText("Payer 2")).toBeInTheDocument();
      expect(paymentCalls().length).toBe(calls);
      expect(lastCall().searchParams.get("studentId")).toBe("s2");
    });

    it("shows the pagination under the table", async () => {
      mockApi();
      renderWithProviders(<PaymentsPage />);
      await screen.findByText("Payer 1");
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    });

    it("shows the empty state instead of a table when there are no payments", async () => {
      mockApi({ empty: true });
      renderWithProviders(<PaymentsPage />);
      expect(await screen.findByText("No payments yet")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows the error with Retry instead of a table", async () => {
      mockApi({ listError: new ApiError(500) });
      renderWithProviders(<PaymentsPage />);
      expect(await screen.findByText("Could not load payments")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });
});
