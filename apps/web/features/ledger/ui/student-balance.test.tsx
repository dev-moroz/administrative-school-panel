import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import { makeEntry } from "../test/fixtures";
import { handleLedger, type LedgerMock } from "../test/mock-ledger-api";
import { StudentBalance } from "./student-balance";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const READ = ["balance.read"];
const ADMIN = ["balance.read", "balance.adjust"];

let mock: LedgerMock;
let permissions: string[];

function setup(perms = ADMIN, patch: Partial<LedgerMock> = {}) {
  permissions = perms;
  mock = { balance: 5, entries: [], ...patch };
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    if (new URL(path, "http://x").pathname === "/auth/me")
      return { id: "u1", email: "a@b.c", role: "admin", permissions };
    const result = handleLedger(mock, path, init);
    if (result === undefined) throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    return result;
  });
  const onDirtyChange = vi.fn();
  renderWithProviders(<StudentBalance studentId="s1" onDirtyChange={onDirtyChange} />);
  return { onDirtyChange };
}

const calls = (method: string, suffix: string) =>
  vi.mocked(apiFetch).mock.calls.filter(([p, i]) => String(p).endsWith(suffix) && (i?.method ?? "GET") === method);

const entries = (n: number) =>
  Array.from({ length: n }, (_, i) => makeEntry({ id: `e${i}`, delta: i + 1, comment: `note ${i}` }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("balance value", () => {
  it("shows a skeleton while loading", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Balance" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading balance")).toBeInTheDocument();
  });

  it("shows a positive balance without the Debt mark", async () => {
    setup();
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByText("Lessons left")).toBeInTheDocument();
    expect(screen.queryByText("Debt")).not.toBeInTheDocument();
  });

  it("shows zero as a normal balance", async () => {
    setup(ADMIN, { balance: 0 });
    expect(await screen.findByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Debt")).not.toBeInTheDocument();
  });

  it("marks a negative balance as Debt", async () => {
    setup(ADMIN, { balance: -3 });
    expect(await screen.findByText("-3")).toBeInTheDocument();
    expect(screen.getByText("Debt")).toBeInTheDocument();
  });

  it("shows an error with Retry that reloads the balance", async () => {
    setup(ADMIN, { balanceError: new ApiError(500) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load balance");
    mock.balanceError = undefined;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("5")).toBeInTheDocument();
  });
});

describe("history", () => {
  it("shows an empty state", async () => {
    setup();
    expect(await screen.findByText("No entries yet")).toBeInTheDocument();
  });

  it("shows type, signed delta, comment and author name", async () => {
    setup(ADMIN, {
      entries: [
        makeEntry({ id: "a", delta: 1, type: "MANUAL_ADJUSTMENT", comment: "Cancelled by school" }),
        makeEntry({ id: "b", delta: -1, type: "LESSON_CHARGE" }),
        makeEntry({ id: "c", delta: 8, type: "PURCHASE" }),
        makeEntry({ id: "d", delta: 1, type: "LESSON_REVERSAL" }),
      ],
    });
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText("Manual adjustment")).toBeInTheDocument();
    expect(within(items[0]).getByText("+1")).toBeInTheDocument();
    expect(within(items[0]).getByText("Cancelled by school")).toBeInTheDocument();
    expect(within(items[0]).getByText("Olga Smirnova")).toBeInTheDocument();
    expect(within(items[1]).getByText("Lesson charged")).toBeInTheDocument();
    expect(within(items[1]).getByText("-1")).toBeInTheDocument();
    expect(within(items[2]).getByText("Purchase")).toBeInTheDocument();
    expect(within(items[2]).getByText("+8")).toBeInTheDocument();
    expect(within(items[3]).getByText("Lesson reversed")).toBeInTheDocument();
  });

  it("falls back to the email when the author has no name", async () => {
    setup(ADMIN, {
      entries: [makeEntry({ createdBy: { id: "u2", email: "teacher@school.test", name: null } })],
    });
    expect(await screen.findByText("teacher@school.test")).toBeInTheDocument();
  });

  it("renders the date as a <time> element with the ISO value", async () => {
    setup(ADMIN, { entries: [makeEntry({ createdAt: "2026-10-25T14:10:00.000Z" })] });
    const item = (await screen.findAllByRole("listitem"))[0];
    expect(item.querySelector("time")).toHaveAttribute("datetime", "2026-10-25T14:10:00.000Z");
  });

  it("loads 10 entries first and the rest on Show more, then hides the button", async () => {
    setup(ADMIN, { entries: entries(12) });
    expect(await screen.findAllByRole("listitem")).toHaveLength(10);
    expect(new URL(String(calls("GET", "pageSize=10").at(0)?.[0] ?? "/x?"), "http://x").searchParams.get("page")).toBe("1");

    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(12));
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("has no Show more when everything fits on one page", async () => {
    setup(ADMIN, { entries: entries(10) });
    expect(await screen.findAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("shows a history error with Retry", async () => {
    setup(ADMIN, { ledgerError: new ApiError(500) });
    expect(await screen.findByText("Could not load history")).toBeInTheDocument();
    mock.ledgerError = undefined;
    mock.entries = entries(1);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
  });
});

describe("permissions", () => {
  it("renders nothing and sends no ledger requests without balance.read", async () => {
    setup([]);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Balance" })).not.toBeInTheDocument());
    expect(calls("GET", "/balance")).toHaveLength(0);
    expect(calls("GET", "pageSize=10")).toHaveLength(0);
  });

  it("balance.read alone shows balance and history but no Adjust button", async () => {
    setup(READ, { entries: entries(1) });
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Adjust balance" })).not.toBeInTheDocument();
  });

  it("balance.adjust shows the Adjust button", async () => {
    setup();
    expect(await screen.findByRole("button", { name: "Adjust balance" })).toBeInTheDocument();
  });
});

describe("adjustment form", () => {
  async function openForm() {
    await userEvent.click(await screen.findByRole("button", { name: "Adjust balance" }));
    return { change: screen.getByLabelText("Change"), comment: screen.getByLabelText("Comment") };
  }

  it("is closed by default and opens on the button", async () => {
    setup();
    await screen.findByText("5");
    expect(screen.queryByLabelText("Change")).not.toBeInTheDocument();
    await openForm();
    expect(screen.getByLabelText("Change")).toBeInTheDocument();
  });

  it("shows the balance after the change while the delta is valid", async () => {
    setup();
    await screen.findByText("5");
    const { change } = await openForm();
    expect(screen.queryByText(/Balance after/)).not.toBeInTheDocument();

    await userEvent.type(change, "-2");
    expect(screen.getByText("Balance after: 3")).toBeInTheDocument();

    await userEvent.clear(change);
    await userEvent.type(change, "+3");
    expect(screen.getByText("Balance after: 8")).toBeInTheDocument();

    await userEvent.clear(change);
    await userEvent.type(change, "-7");
    expect(screen.getByText("Balance after: -2")).toBeInTheDocument();
  });

  it.each(["abc", "0", "51"])("hides the hint for an invalid delta %j", async (value) => {
    setup();
    await screen.findByText("5");
    const { change } = await openForm();
    await userEvent.type(change, value);
    expect(screen.queryByText(/Balance after/)).not.toBeInTheDocument();
  });

  it("does not send an invalid form and marks the fields", async () => {
    setup();
    await screen.findByText("5");
    const { change, comment } = await openForm();
    await userEvent.type(change, "0");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    expect(change).toHaveAttribute("aria-invalid", "true");
    expect(comment).toHaveAttribute("aria-invalid", "true");
    expect(calls("POST", "/ledger/adjustments")).toHaveLength(0);
  });

  it("sends { delta, comment }, shows a toast, closes the form and refreshes balance and history", async () => {
    const { onDirtyChange } = setup();
    await screen.findByText("5");
    const { change, comment } = await openForm();
    await userEvent.type(change, "+3");
    await userEvent.type(comment, "  Missed lesson, our fault ");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Balance adjusted"));
    const [[, init]] = calls("POST", "/ledger/adjustments");
    expect(JSON.parse(String(init?.body))).toEqual({ delta: 3, comment: "Missed lesson, our fault" });

    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(screen.queryByLabelText("Change")).not.toBeInTheDocument();
    expect(await screen.findByText("Missed lesson, our fault")).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("reports dirty state while typing", async () => {
    const { onDirtyChange } = setup();
    await screen.findByText("5");
    const { change } = await openForm();
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);

    await userEvent.type(change, "1");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("Cancel on an untouched form closes it without a dialog", async () => {
    setup();
    await screen.findByText("5");
    await openForm();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Change")).not.toBeInTheDocument();
  });

  it("Cancel on a typed form asks first; Keep editing leaves the form and its values as they were", async () => {
    const { onDirtyChange } = setup();
    await screen.findByText("5");
    const { change, comment } = await openForm();
    await userEvent.type(change, "2");
    await userEvent.type(comment, "note");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Change")).toHaveValue("2");
    expect(screen.getByLabelText("Comment")).toHaveValue("note");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("Cancel on a typed form: Discard closes it, clears the values and reports clean", async () => {
    const { onDirtyChange } = setup();
    await screen.findByText("5");
    const { change } = await openForm();
    await userEvent.type(change, "2");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));

    expect(screen.queryByLabelText("Change")).not.toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(calls("POST", "/ledger/adjustments")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Adjust balance" }));
    expect(screen.getByLabelText("Change")).toHaveValue("");
  });

  it.each([
    [400, "Invalid adjustment"],
    [403, "You are not allowed to adjust the balance"],
    [404, "Student not found"],
    [500, "Could not save the adjustment"],
  ])("shows a message for a %i response and keeps the form", async (status, message) => {
    setup(ADMIN, { adjustError: new ApiError(status) });
    await screen.findByText("5");
    const { change, comment } = await openForm();
    await userEvent.type(change, "1");
    await userEvent.type(comment, "x");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Change")).toHaveValue("1");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
