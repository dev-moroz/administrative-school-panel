import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiFetch } from "@/lib/api";
import { handleLedger, type LedgerMock } from "@/features/ledger/test/mock-ledger-api";
import { makePayment } from "@/features/payments/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { StudentSections } from "./student-sections";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const BOTH = ["balance.read", "balance.adjust", "payments.read"];

function setup(permissions = BOTH) {
  const ledger: LedgerMock = { balance: 5, entries: [] };
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, "http://x");
    if (url.pathname === "/auth/me") return { id: "u1", email: "a@b.c", role: "admin", permissions };
    if (url.pathname === "/absences") return [];
    if (url.pathname === "/lessons") return [];
    if (url.pathname === "/payments") return { items: [makePayment()], total: 1, page: 1, pageSize: 10 };
    const result = handleLedger(ledger, path, init);
    if (result === undefined) throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    return result;
  });
  const onDirtyChange = vi.fn();
  renderWithProviders(<StudentSections studentId="s1" onDirtyChange={onDirtyChange} />);
}

const paymentCalls = () => vi.mocked(apiFetch).mock.calls.filter(([p]) => String(p).startsWith("/payments"));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("StudentSections", () => {
  it("offers Balance and Payments tabs, Balance is selected and visible first", async () => {
    setup();
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
    const balance = await screen.findByRole("tab", { name: "Balance" });
    expect(balance).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "false");
    expect(await screen.findByText("Lessons left")).toBeVisible();
  });

  it("switches to the payment history and hides the balance", async () => {
    setup();
    await userEvent.click(await screen.findByRole("tab", { name: "Payments" }));
    expect(await screen.findByText("400.00")).toBeVisible();
    expect(screen.getByText("Lessons left")).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Payments" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the selected tab selected when it is clicked again", async () => {
    setup();
    const balance = await screen.findByRole("tab", { name: "Balance" });
    await userEvent.click(balance);
    expect(balance).toHaveAttribute("aria-selected", "true");
  });

  it("does not request payments until the Payments tab is opened", async () => {
    setup();
    expect(await screen.findByText("Lessons left")).toBeVisible();
    expect(paymentCalls()).toHaveLength(0);
    await userEvent.click(screen.getByRole("tab", { name: "Payments" }));
    expect(await screen.findByText("400.00")).toBeVisible();
    expect(paymentCalls().length).toBeGreaterThan(0);
  });

  it("keeps an unsaved balance adjustment while the other tab is open", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Adjust balance" }));
    await userEvent.type(screen.getByLabelText("Change"), "2");
    await userEvent.click(screen.getByRole("tab", { name: "Payments" }));
    await userEvent.click(screen.getByRole("tab", { name: "Balance" }));
    expect(screen.getByLabelText("Change")).toHaveValue("2");
  });

  it("offers only the sections the user may read", async () => {
    setup(["payments.read"]);
    const payments = await screen.findByRole("tab", { name: "Payments" });
    expect(payments).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Balance" })).not.toBeInTheDocument();
    expect(await screen.findByText("400.00")).toBeVisible();
  });

  it("offers the Absences tab with absences.manage and loads the student's absences", async () => {
    setup([...BOTH, "absences.manage"]);
    await userEvent.click(await screen.findByRole("tab", { name: "Absences" }));
    expect(await screen.findByRole("button", { name: "Add absence" })).toBeVisible();
    const call = vi.mocked(apiFetch).mock.calls.map(([p]) => new URL(String(p), "http://x")).find((u) => u.pathname === "/absences")!;
    expect(call.searchParams.get("studentId")).toBe("s1");
  });

  it("hides the Absences tab without absences.manage", async () => {
    setup();
    await screen.findByRole("tab", { name: "Balance" });
    expect(screen.queryByRole("tab", { name: "Absences" })).not.toBeInTheDocument();
  });

  it("offers the Schedule tab after Balance with lessons.read and loads the student's lessons", async () => {
    setup([...BOTH, "lessons.read"]);
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Balance", "Schedule", "Payments"]);
    await userEvent.click(screen.getByRole("tab", { name: "Schedule" }));
    expect(await screen.findByText("No upcoming lessons")).toBeVisible();
    const call = vi.mocked(apiFetch).mock.calls.map(([p]) => new URL(String(p), "http://x")).find((u) => u.pathname === "/lessons")!;
    expect(call.searchParams.get("studentId")).toBe("s1");
  });

  it("hides the Schedule tab without lessons.read", async () => {
    setup();
    await screen.findByRole("tab", { name: "Balance" });
    expect(screen.queryByRole("tab", { name: "Schedule" })).not.toBeInTheDocument();
  });

  it("renders nothing without balance.read and payments.read", async () => {
    setup(["students.read.all"]);
    await vi.waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled());
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
