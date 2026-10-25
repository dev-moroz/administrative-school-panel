import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiFetch } from "@/lib/api";
import { handleLedger, type LedgerMock } from "@/features/ledger/test/mock-ledger-api";
import { renderWithProviders } from "@/test/render";
import { currencies, makeStudent, teachers } from "../test/fixtures";
import { StudentSheet, type SheetTarget } from "./student-sheet";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BASE = ["students.read.all", "students.create", "students.update", "currencies.read"];
const WITH_BALANCE = [...BASE, "balance.read", "balance.adjust"];

let ledger: LedgerMock;

function setup(target: SheetTarget, permissions = WITH_BALANCE) {
  ledger = { balance: 5, entries: [] };
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, "http://x");
    if (url.pathname === "/auth/me") return { id: "u1", email: "a@b.c", role: "admin", permissions };
    if (url.pathname === "/currencies") return currencies;
    if (url.pathname === "/teachers") return teachers;
    if (url.pathname === "/students/s1" && (init?.method ?? "GET") === "GET") return makeStudent();
    const result = handleLedger(ledger, path, init);
    if (result === undefined) throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    return result;
  });
  const onTargetChange = vi.fn();
  renderWithProviders(<StudentSheet target={target} onTargetChange={onTargetChange} />);
  return { onTargetChange };
}

const VIEW: SheetTarget = { kind: "view", id: "s1" };

const ledgerCalls = () =>
  vi.mocked(apiFetch).mock.calls.filter(([p]) => /\/students\/[^/]+\/(balance|ledger)/.test(String(p)));

async function typeIntoAdjustment() {
  await userEvent.click(await screen.findByRole("button", { name: "Adjust balance" }));
  await userEvent.type(screen.getByLabelText("Change"), "2");
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("StudentSheet balance section", () => {
  it("shows Balance in view mode with balance.read", async () => {
    setup(VIEW);
    expect(await screen.findByRole("heading", { name: "Balance" })).toBeInTheDocument();
    expect(await screen.findByText("Lessons left")).toBeInTheDocument();
  });

  it("does not show Balance or call the ledger without balance.read", async () => {
    setup(VIEW, BASE);
    await screen.findByText("Anna Petrova");
    expect(screen.queryByRole("heading", { name: "Balance" })).not.toBeInTheDocument();
    expect(ledgerCalls()).toHaveLength(0);
  });

  it("does not show Balance in create mode", async () => {
    setup({ kind: "create" });
    await screen.findByLabelText("Full name");
    expect(screen.queryByRole("heading", { name: "Balance" })).not.toBeInTheDocument();
    expect(ledgerCalls()).toHaveLength(0);
  });

  it("does not show Balance in edit mode", async () => {
    setup(VIEW);
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByLabelText("Full name");
    expect(screen.queryByRole("heading", { name: "Balance" })).not.toBeInTheDocument();
  });
});

describe("StudentSheet discard dialog with the adjustment form", () => {
  it("closes at once when the adjustment form is open but untouched", async () => {
    const { onTargetChange } = setup(VIEW);
    await userEvent.click(await screen.findByRole("button", { name: "Adjust balance" }));
    await userEvent.keyboard("{Escape}");
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "closed" });
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });

  it("asks before closing with a typed adjustment; Keep editing keeps the value", async () => {
    const { onTargetChange } = setup(VIEW);
    await typeIntoAdjustment();
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(onTargetChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Change")).toHaveValue("2");
  });

  it("closes the panel after Discard", async () => {
    const { onTargetChange } = setup(VIEW);
    await typeIntoAdjustment();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "closed" });
  });

  it("asks before switching to Edit with a typed adjustment, and Discard opens the profile form", async () => {
    setup(VIEW);
    await typeIntoAdjustment();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
  });

  it("switches to Edit without a dialog when the adjustment form is clean", async () => {
    setup(VIEW);
    await userEvent.click(await screen.findByRole("button", { name: "Adjust balance" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });
});
