import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import type { Absence } from "../model/types";
import { makeAbsence } from "../test/fixtures";
import { AbsenceList } from "./absence-list";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// Moscow today is 2026-11-10.
const NOW = new Date("2026-11-10T09:00:00.000Z");

type Warning = { code: string; lessonId: string; reason: string };
type Opts = { absences?: Absence[]; postError?: ApiError; warnings?: Warning[] };

function mockApi({ absences = [], postError, warnings = [] }: Opts = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, "http://x");
    const method = init?.method ?? "GET";
    if (url.pathname === "/absences" && method === "GET") return absences;
    if (url.pathname === "/absences" && method === "POST") {
      if (postError) throw postError;
      return makeAbsence({ id: "a-new" });
    }
    if (url.pathname.startsWith("/absences/") && method === "PATCH") return { ...absences[0], warnings };
    if (url.pathname.startsWith("/absences/") && method === "DELETE") return { warnings };
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const writes = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => ["POST", "PATCH", "DELETE"].includes((init as RequestInit | undefined)?.method ?? "GET"))
    .map(([path, init]) => ({ path: path as string, method: (init as RequestInit).method, body: init?.body ? JSON.parse(String(init.body)) : undefined }));

function setup(opts: Opts = {}, owner: { studentId: string } | { teacherId: string } = { studentId: "s1" }) {
  mockApi(opts);
  const user = userEvent.setup();
  renderWithProviders(<AbsenceList owner={owner} />);
  return { user };
}

describe("AbsenceList", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(apiFetch).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.warning).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("loads the owner's absences and shows the comment and state", async () => {
    setup({
      absences: [
        makeAbsence({ id: "a1", startsOn: "2026-11-15", endsOn: "2026-11-20", comment: "Trip" }),
        makeAbsence({ id: "a2", startsOn: "2026-11-05", endsOn: "2026-11-12", comment: "Sick leave" }),
      ],
    });
    expect(await screen.findByText("Trip")).toBeInTheDocument();
    expect(screen.getByText("Sick leave")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Ongoing")).toBeInTheDocument();
    const call = new URL(vi.mocked(apiFetch).mock.calls[0][0] as string, "http://x");
    expect(call.searchParams.get("studentId")).toBe("s1");
  });

  it("shows an empty state", async () => {
    setup();
    expect(await screen.findByText("No absences")).toBeInTheDocument();
  });

  it("creates a student freeze with a trimmed comment", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Add absence" }));
    await user.type(screen.getByLabelText("From"), "2026-11-12");
    await user.type(screen.getByLabelText("To"), "2026-11-14");
    await user.type(screen.getByLabelText("Comment"), " Holiday ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      path: "/absences",
      method: "POST",
      body: { kind: "STUDENT_FREEZE", studentId: "s1", startsOn: "2026-11-12", endsOn: "2026-11-14", comment: "Holiday" },
    });
  });

  it("creates a teacher vacation for a teacher owner", async () => {
    const { user } = setup({}, { teacherId: "t1" });
    await user.click(await screen.findByRole("button", { name: "Add absence" }));
    await user.type(screen.getByLabelText("From"), "2026-11-12");
    await user.type(screen.getByLabelText("To"), "2026-11-12");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].body).toEqual({ kind: "TEACHER_VACATION", teacherId: "t1", startsOn: "2026-11-12", endsOn: "2026-11-12" });
  });

  it("does not send a period that starts before today", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Add absence" }));
    await user.type(screen.getByLabelText("From"), "2026-11-09");
    await user.type(screen.getByLabelText("To"), "2026-11-12");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Cannot start before today")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it("explains ABSENCE_OVERLAP from the server", async () => {
    const { user } = setup({ postError: new ApiError(409, undefined, { code: "ABSENCE_OVERLAP", absence: makeAbsence() }) });
    await user.click(await screen.findByRole("button", { name: "Add absence" }));
    await user.type(screen.getByLabelText("From"), "2026-11-12");
    await user.type(screen.getByLabelText("To"), "2026-11-14");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This period overlaps another absence");
  });

  it("an ongoing absence: start locked, no delete, end can be shortened", async () => {
    const { user } = setup({ absences: [makeAbsence({ startsOn: "2026-11-05", endsOn: "2026-11-20" })] });
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("From")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("To"));
    await user.type(screen.getByLabelText("To"), "2026-11-10");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({ path: "/absences/a1", method: "PATCH", body: { endsOn: "2026-11-10" } });
  });

  it("a past absence has no actions", async () => {
    setup({ absences: [makeAbsence({ startsOn: "2026-11-01", endsOn: "2026-11-05", comment: "Old" })] });
    expect(await screen.findByText("Past")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("deletes a future absence after confirmation and warns about lessons not restored", async () => {
    const { user } = setup({
      absences: [makeAbsence({ startsOn: "2026-11-15", endsOn: "2026-11-20" })],
      warnings: [
        { code: "ABSENCE_LESSON_NOT_RESTORED", lessonId: "l1", reason: "OVERLAP" },
        { code: "ABSENCE_LESSON_NOT_RESTORED", lessonId: "l2", reason: "MANUAL" },
      ],
    });
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(writes()).toEqual([{ path: "/absences/a1", method: "DELETE", body: undefined }]));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("2 lessons were not restored", expect.anything()));
  });

  it("closing the delete confirmation sends nothing", async () => {
    const { user } = setup({ absences: [makeAbsence({ startsOn: "2026-11-15", endsOn: "2026-11-20" })] });
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(writes()).toHaveLength(0);
  });
});
