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
    if (url.pathname === "/payments") return { items: [makePayment()], total: 1, page: 1, pageSize: 10 };
    const result = handleLedger(ledger, path, init);
    if (result === undefined) throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    return result;
  });
  const onDirtyChange = vi.fn();
  renderWithProviders(<StudentSections studentId="s1" onDirtyChange={onDirtyChange} />);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("StudentSections", () => {
  it("offers Balance and Payments, Balance is selected and visible first", async () => {
    setup();
    const balance = await screen.findByRole("radio", { name: "Balance" });
    expect(balance).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Payments" })).toHaveAttribute("aria-checked", "false");
    expect(await screen.findByText("Lessons left")).toBeVisible();
  });

  it("switches to the payment history and hides the balance", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Payments" }));
    expect(await screen.findByText("400.00")).toBeVisible();
    expect(screen.getByText("Lessons left")).not.toBeVisible();
    expect(screen.getByRole("radio", { name: "Payments" })).toHaveAttribute("aria-checked", "true");
  });

  it("cannot be switched off by clicking the selected item again", async () => {
    setup();
    const balance = await screen.findByRole("radio", { name: "Balance" });
    await userEvent.click(balance);
    expect(balance).toHaveAttribute("aria-checked", "true");
  });

  it("keeps an unsaved balance adjustment while the other section is open", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Adjust balance" }));
    await userEvent.type(screen.getByLabelText("Change"), "2");
    await userEvent.click(screen.getByRole("radio", { name: "Payments" }));
    await userEvent.click(screen.getByRole("radio", { name: "Balance" }));
    expect(screen.getByLabelText("Change")).toHaveValue("2");
  });

  it("offers only the sections the user may read", async () => {
    setup(["payments.read"]);
    const payments = await screen.findByRole("radio", { name: "Payments" });
    expect(payments).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("radio", { name: "Balance" })).not.toBeInTheDocument();
    expect(await screen.findByText("400.00")).toBeVisible();
  });

  it("renders nothing without balance.read and payments.read", async () => {
    setup(["students.read.all"]);
    await vi.waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled());
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
