import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import type { Lesson } from "@/features/lessons/model/types";
import { cancelReasons, makeLesson } from "@/features/lessons/test/fixtures";
import type { CalendarViewProps } from "@/features/lessons/ui/calendar-view";
import LessonsPage from "./page";

// FullCalendar does not run in jsdom: the fake exposes the adapter props and renders events as buttons.
let view: CalendarViewProps;
vi.mock("@/features/lessons/ui/calendar-view", () => ({
  CalendarView: (props: CalendarViewProps) => {
    view = props;
    return (
      <div data-testid="calendar">
        {props.events.map((e) => (
          <button key={e.id} type="button" onClick={() => props.onEventClick(e.id)}>
            {e.title}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// patchError/postError are thrown only while the request has no force: true.
type Warning = { code: string; date: string; reason: string };
type Opts = { lessons?: Lesson[]; suggestedCharged?: boolean; patchError?: ApiError; postError?: ApiError; deleteError?: ApiError; statusError?: ApiError; seriesWarnings?: Warning[] };

const forced = (init?: RequestInit) => Boolean(init?.body && JSON.parse(String(init.body)).force);

function mockApi({ lessons = [], suggestedCharged = false, patchError, postError, deleteError, statusError, seriesWarnings = [] }: Opts = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, "http://x");
    const method = init?.method ?? "GET";
    if (url.pathname === "/auth/me") {
      return {
        id: "u1",
        email: "a@b.c",
        role: "teacher",
        permissions: ["lessons.read", "lessons.create", "lessons.update", "lessons.delete", "lesson-series.manage", "students.read"],
      };
    }
    if (url.pathname === "/students" && method === "GET") {
      return { items: [{ id: "s1", fullName: "Anna Petrova", telegramUsername: null, isActive: true }], total: 1, page: 1, pageSize: 100 };
    }
    if (url.pathname === "/lessons" && method === "GET") return lessons;
    if (url.pathname === "/lessons" && method === "POST") {
      if (postError && !forced(init)) throw postError;
      return makeLesson({ id: "l-new" });
    }
    if (url.pathname === "/lesson-series" && method === "POST") return { id: "sr-new", warnings: seriesWarnings };
    if (url.pathname === "/cancel-reasons") return cancelReasons;
    const lessonMatch = url.pathname.match(/^\/lessons\/([^/]+)(\/status|\/cancel-preview)?$/);
    if (lessonMatch) {
      const lesson = lessons.find((l) => l.id === lessonMatch[1]) ?? makeLesson({ id: lessonMatch[1] });
      if (lessonMatch[2] === "/cancel-preview") return { suggestedCharged };
      if (lessonMatch[2] === "/status") {
        if (statusError && !forced(init)) throw statusError;
        return { ...lesson, status: JSON.parse(String(init?.body)).status };
      }
      if (method === "PATCH") {
        if (patchError && !forced(init)) throw patchError;
        return lesson;
      }
      if (method === "DELETE") {
        if (deleteError) throw deleteError;
        return undefined;
      }
      return lesson;
    }
    if (url.pathname.match(/^\/lesson-series\/[^/]+\/split$/)) return { id: "sr-split", warnings: seriesWarnings };
    if (url.pathname.match(/^\/students\/[^/]+\/balance$/)) return { balance: 5, isDebt: false };
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const writes = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => ["POST", "PATCH", "DELETE"].includes((init as RequestInit | undefined)?.method ?? "GET"))
    .map(([path, init]) => ({ path: path as string, method: (init as RequestInit).method, body: init?.body ? JSON.parse(String(init.body)) : undefined }));

const range = { from: new Date(2026, 10, 2), to: new Date(2026, 10, 9) };

async function setup(opts: Opts = {}) {
  mockApi(opts);
  const user = userEvent.setup();
  renderWithProviders(<LessonsPage />);
  await waitFor(() => expect(view).toBeDefined());
  act(() => view.onRangeChange(range));
  if (opts.lessons?.length) await within(screen.getByTestId("calendar")).findAllByRole("button");
  return { user };
}

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, label: string, option: string | RegExp) {
  await user.click(await screen.findByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function openLesson(user: User, title = "Anna Petrova") {
  await user.click(await within(screen.getByTestId("calendar")).findByRole("button", { name: title }));
}

const overlapError = () =>
  new ApiError(409, undefined, {
    code: "LESSON_OVERLAP",
    overlaps: [{ id: "l9", startsAt: new Date(2026, 10, 4, 9, 30).toISOString(), durationMin: 60, student: { id: "s2", fullName: "Boris Ivanov" } }],
  });

const seriesLesson = () => makeLesson({ id: "l1", seriesId: "sr1", originalDate: "2026-11-03" });

describe("LessonsPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.warning).mockReset();
  });

  it("loads lessons for the visible range and shows them as events", async () => {
    await setup({ lessons: [makeLesson()] });
    expect(await within(screen.getByTestId("calendar")).findByRole("button", { name: "Anna Petrova" })).toBeInTheDocument();
    const call = vi.mocked(apiFetch).mock.calls.map(([p]) => new URL(p as string, "http://x")).find((u) => u.pathname === "/lessons")!;
    expect(call.searchParams.get("from")).toBe(range.from.toISOString());
    expect(call.searchParams.get("to")).toBe(range.to.toISOString());
  });

  describe("create from a slot", () => {
    it("prefills date, time and duration from the selected slot", async () => {
      await setup();
      act(() => view.onSlotSelect({ start: new Date(2026, 10, 3, 14, 0), end: new Date(2026, 10, 3, 14, 45) }));
      expect(await screen.findByLabelText("Date")).toHaveValue("2026-11-03");
      expect(screen.getByLabelText("Time")).toHaveValue("14:00");
      expect(screen.getByLabelText("Duration (min)")).toHaveValue("45");
    });

    it("saves a one-off lesson with POST /lessons", async () => {
      const { user } = await setup();
      act(() => view.onSlotSelect({ start: new Date(2026, 10, 3, 14, 0), end: new Date(2026, 10, 3, 15, 0) }));
      await pick(user, "Student", "Anna Petrova");
      await user.click(screen.getByRole("button", { name: "Save lesson" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toEqual({
        path: "/lessons",
        method: "POST",
        body: { studentId: "s1", startsAt: new Date(2026, 10, 3, 14, 0).toISOString(), durationMin: 60 },
      });
    });

    it("with 'Repeat weekly' creates a series instead", async () => {
      const { user } = await setup();
      act(() => view.onSlotSelect({ start: new Date(2026, 10, 3, 14, 0), end: new Date(2026, 10, 3, 15, 0) }));
      await pick(user, "Student", "Anna Petrova");
      await user.click(screen.getByRole("switch", { name: "Repeat weekly" }));
      await user.click(screen.getByRole("button", { name: "Save lesson" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      // Browser is in Belgrade (vitest.config.ts); series slots go to the server in Moscow time (+2h).
      expect(writes()[0]).toMatchObject({ path: "/lesson-series", method: "POST", body: { studentId: "s1", weekday: 2, startTime: "16:00" } });
    });
  });

  describe("edit", () => {
    it("a one-off lesson is saved with PATCH", async () => {
      const { user } = await setup({ lessons: [makeLesson()] });
      await openLesson(user);
      const duration = await screen.findByLabelText("Duration (min)");
      await user.clear(duration);
      await user.type(duration, "45");
      await user.click(screen.getByRole("button", { name: "Save lesson" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toMatchObject({ path: "/lessons/l1", method: "PATCH", body: { durationMin: 45 } });
    });

    it("a series lesson asks for the scope; 'Only this lesson' PATCHes the lesson", async () => {
      const { user } = await setup({ lessons: [seriesLesson()] });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Save lesson" }));
      await user.click(await screen.findByRole("button", { name: "Only this lesson" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toMatchObject({ path: "/lessons/l1", method: "PATCH" });
    });

    it("'This and following' splits the series from this lesson", async () => {
      const { user } = await setup({ lessons: [seriesLesson()] });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Save lesson" }));
      await user.click(await screen.findByRole("button", { name: "This and following" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      // Browser is in Belgrade (vitest.config.ts); series slots go to the server in Moscow time (+2h).
      expect(writes()[0]).toMatchObject({ path: "/lesson-series/sr1/split", method: "POST", body: { fromLessonId: "l1", startTime: "12:00" } });
    });
  });

  describe("status", () => {
    it("shows 'Changed manually' only for a lesson changed by hand", async () => {
      const { user } = await setup({
        lessons: [makeLesson(), makeLesson({ id: "l2", manuallyChanged: true, student: { id: "s2", fullName: "Boris Ivanov" } })],
      });
      await openLesson(user);
      await screen.findByText("Scheduled");
      expect(screen.queryByText("Changed manually")).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
      await openLesson(user, "Boris Ivanov");
      expect(await screen.findByText("Changed manually")).toBeInTheDocument();
    });

    it("cancel requires a reason", async () => {
      const { user } = await setup({ lessons: [makeLesson()] });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Cancel lesson" }));
      await user.click(await screen.findByRole("button", { name: "Confirm cancellation" }));
      expect(await screen.findByText("Choose a reason")).toBeInTheDocument();
      expect(writes()).toHaveLength(0);
    });

    it("cancel prechecks 'Charge the lesson' from the server suggestion and sends the final choice", async () => {
      const { user } = await setup({ lessons: [makeLesson()], suggestedCharged: true });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Cancel lesson" }));
      const charge = await screen.findByRole("switch", { name: "Charge the lesson" });
      await waitFor(() => expect(charge).toBeChecked());
      expect(screen.getByText("Late cancellation: the rules suggest charging this lesson")).toBeInTheDocument();
      await pick(user, "Reason", "Illness");
      await user.click(charge);
      await user.click(screen.getByRole("button", { name: "Confirm cancellation" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toEqual({ path: "/lessons/l1/status", method: "POST", body: { status: "CANCELLED", reason: "ILLNESS", charged: false } });
    });

    it("no-show is charged by default", async () => {
      const { user } = await setup({ lessons: [makeLesson()] });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "No-show" }));
      expect(await screen.findByRole("switch", { name: "Charge the lesson" })).toBeChecked();
      await user.click(screen.getByRole("button", { name: "Confirm no-show" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toEqual({ path: "/lessons/l1/status", method: "POST", body: { status: "NO_SHOW", charged: true } });
    });

    it("a cancelled lesson can go back to scheduled", async () => {
      const { user } = await setup({ lessons: [makeLesson({ status: "CANCELLED", cancelReason: cancelReasons[0] })] });
      await openLesson(user);
      expect(screen.queryByRole("button", { name: "Cancel lesson" })).not.toBeInTheDocument();
      await user.click(await screen.findByRole("button", { name: "Back to scheduled" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toMatchObject({ path: "/lessons/l1/status", method: "POST", body: { status: "SCHEDULED" } });
    });
  });

  describe("back to scheduled conflict", () => {
    const cancelled = () => makeLesson({ status: "CANCELLED", cancelReason: { code: "STUDENT_FREEZE", name: "Student freeze" } });
    const restoreError = (patch: { absence?: unknown; overlaps?: unknown[] }) =>
      new ApiError(409, undefined, { code: "LESSON_RESTORE_CONFLICT", absence: null, overlaps: [], ...patch });
    const freeze = {
      id: "a1",
      kind: "STUDENT_FREEZE",
      startsOn: "2026-11-01T00:00:00.000Z",
      endsOn: "2026-11-10T00:00:00.000Z",
      student: { id: "s1", fullName: "Anna Petrova" },
      teacher: null,
    };

    it("names the absence and restores with force after confirmation", async () => {
      const { user } = await setup({ lessons: [cancelled()], statusError: restoreError({ absence: freeze }) });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Back to scheduled" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Student freeze · Anna Petrova");
      expect(dialog).toHaveTextContent("2026-11-01 – 2026-11-10");
      await user.click(within(dialog).getByRole("button", { name: "Restore anyway" }));
      await waitFor(() => expect(writes()).toHaveLength(2));
      expect(writes()[1]).toEqual({ path: "/lessons/l1/status", method: "POST", body: { status: "SCHEDULED", force: true } });
    });

    it("lists overlapping lessons when the time is busy", async () => {
      const { user } = await setup({
        lessons: [cancelled()],
        statusError: restoreError({
          overlaps: [{ id: "l9", startsAt: new Date(2026, 10, 3, 10, 30).toISOString(), durationMin: 60, student: { id: "s2", fullName: "Boris Ivanov" } }],
        }),
      });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Back to scheduled" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Boris Ivanov");
      expect(dialog).not.toHaveTextContent("Student freeze");
    });

    it("cancelling the dialog keeps the lesson cancelled", async () => {
      const { user } = await setup({ lessons: [cancelled()], statusError: restoreError({ absence: freeze }) });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Back to scheduled" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(writes()).toHaveLength(1);
    });
  });

  describe("drag and resize", () => {
    const moved = { start: new Date(2026, 10, 4, 9, 0), end: new Date(2026, 10, 4, 10, 30) };

    it("a one-off lesson is PATCHed with the new start and duration", async () => {
      await setup({ lessons: [makeLesson()] });
      const revert = vi.fn();
      act(() => view.onEventChange({ id: "l1", ...moved, revert }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toEqual({ path: "/lessons/l1", method: "PATCH", body: { startsAt: moved.start.toISOString(), durationMin: 90 } });
      expect(revert).not.toHaveBeenCalled();
    });

    it("a server error reverts the event and shows an error", async () => {
      await setup({ lessons: [makeLesson()], patchError: new ApiError(409) });
      const revert = vi.fn();
      act(() => view.onEventChange({ id: "l1", ...moved, revert }));
      await waitFor(() => expect(revert).toHaveBeenCalled());
      expect(toast.error).toHaveBeenCalled();
    });

    it("a series lesson asks for the scope first; closing the dialog reverts", async () => {
      const { user } = await setup({ lessons: [seriesLesson()] });
      const revert = vi.fn();
      act(() => view.onEventChange({ id: "l1", ...moved, revert }));
      expect(await screen.findByRole("button", { name: "This and following" })).toBeInTheDocument();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(revert).toHaveBeenCalled());
      expect(writes()).toHaveLength(0);
    });

    it("a series lesson moved with 'This and following' splits with the new weekday and time", async () => {
      const { user } = await setup({ lessons: [seriesLesson()] });
      act(() => view.onEventChange({ id: "l1", ...moved, revert: vi.fn() }));
      await user.click(await screen.findByRole("button", { name: "This and following" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toEqual({
        path: "/lesson-series/sr1/split",
        method: "POST",
        // Browser is in Belgrade (vitest.config.ts); series slots go to the server in Moscow time (+2h).
        body: { fromLessonId: "l1", weekday: 3, startTime: "11:00", durationMin: 90 },
      });
    });
  });

  describe("overlap warning", () => {
    const moved = { start: new Date(2026, 10, 4, 9, 0), end: new Date(2026, 10, 4, 10, 30) };

    it("a drag onto a busy time asks; 'Save anyway' repeats the PATCH with force", async () => {
      const { user } = await setup({ lessons: [makeLesson()], patchError: overlapError() });
      const revert = vi.fn();
      act(() => view.onEventChange({ id: "l1", ...moved, revert }));
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText(/Boris Ivanov/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Save anyway" }));
      await waitFor(() => expect(writes()).toHaveLength(2));
      expect(writes()[1]).toEqual({
        path: "/lessons/l1",
        method: "PATCH",
        body: { startsAt: moved.start.toISOString(), durationMin: 90, force: true },
      });
      expect(revert).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("declining the warning reverts the drag and saves nothing more", async () => {
      const { user } = await setup({ lessons: [makeLesson()], patchError: overlapError() });
      const revert = vi.fn();
      act(() => view.onEventChange({ id: "l1", ...moved, revert }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(revert).toHaveBeenCalled());
      expect(writes()).toHaveLength(1);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("'Only this lesson' on a series lesson goes through the same warning", async () => {
      const { user } = await setup({ lessons: [seriesLesson()], patchError: overlapError() });
      act(() => view.onEventChange({ id: "l1", ...moved, revert: vi.fn() }));
      await user.click(await screen.findByRole("button", { name: "Only this lesson" }));
      await user.click(await screen.findByRole("button", { name: "Save anyway" }));
      await waitFor(() => expect(writes()).toHaveLength(2));
      expect(writes()[1]).toMatchObject({ path: "/lessons/l1", method: "PATCH", body: { force: true } });
    });

    it("creating a lesson on a busy time asks; 'Save anyway' repeats the POST with force", async () => {
      const { user } = await setup({ postError: overlapError() });
      act(() => view.onSlotSelect({ start: new Date(2026, 10, 3, 14, 0), end: new Date(2026, 10, 3, 15, 0) }));
      await pick(user, "Student", "Anna Petrova");
      await user.click(screen.getByRole("button", { name: "Save lesson" }));
      await user.click(await screen.findByRole("button", { name: "Save anyway" }));
      await waitFor(() => expect(writes()).toHaveLength(2));
      expect(writes()[1]).toMatchObject({ path: "/lessons", method: "POST", body: { studentId: "s1", force: true } });
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it("editing a lesson in the sheet onto a busy time asks before saving", async () => {
      const { user } = await setup({ lessons: [makeLesson()], patchError: overlapError() });
      await openLesson(user);
      const duration = await screen.findByLabelText("Duration (min)");
      await user.clear(duration);
      await user.type(duration, "90");
      await user.click(screen.getByRole("button", { name: "Save lesson" }));
      await user.click(await screen.findByRole("button", { name: "Save anyway" }));
      await waitFor(() => expect(writes()).toHaveLength(2));
      expect(writes()[1]).toMatchObject({ path: "/lessons/l1", method: "PATCH", body: { durationMin: 90, force: true } });
    });
  });

  describe("skipped series slots", () => {
    const skipped = [
      { code: "SERIES_SLOT_SKIPPED", date: "2026-11-10", reason: "OVERLAP" },
      { code: "SERIES_SLOT_SKIPPED", date: "2026-11-24", reason: "OVERLAP" },
    ];

    async function createWeekly(user: User) {
      act(() => view.onSlotSelect({ start: new Date(2026, 10, 3, 14, 0), end: new Date(2026, 10, 3, 15, 0) }));
      await pick(user, "Student", "Anna Petrova");
      await user.click(screen.getByRole("switch", { name: "Repeat weekly" }));
      await user.click(screen.getByRole("button", { name: "Save lesson" }));
    }

    it("creating a series warns about the skipped dates, translated on the client", async () => {
      const { user } = await setup({ seriesWarnings: skipped });
      await createWeekly(user);
      await waitFor(() => expect(toast.warning).toHaveBeenCalledTimes(1));
      const text = String(vi.mocked(toast.warning).mock.calls[0][0]);
      expect(text).toContain("Nov 10");
      expect(text).toContain("Nov 24");
      expect(text).not.toContain("SERIES_SLOT_SKIPPED");
      expect(toast.success).toHaveBeenCalled();
    });

    it("no warning when nothing was skipped", async () => {
      const { user } = await setup();
      await createWeekly(user);
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it("'This and following' warns about the dates its new series skipped", async () => {
      const { user } = await setup({ lessons: [seriesLesson()], seriesWarnings: skipped.slice(0, 1) });
      act(() => view.onEventChange({ id: "l1", start: new Date(2026, 10, 4, 9, 0), end: new Date(2026, 10, 4, 10, 0), revert: vi.fn() }));
      await user.click(await screen.findByRole("button", { name: "This and following" }));
      await waitFor(() => expect(toast.warning).toHaveBeenCalledTimes(1));
      expect(String(vi.mocked(toast.warning).mock.calls[0][0])).toContain("Nov 10");
    });
  });

  describe("delete", () => {
    it("asks for confirmation and DELETEs the lesson", async () => {
      const { user } = await setup({ lessons: [makeLesson()] });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Delete" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0]).toMatchObject({ path: "/lessons/l1", method: "DELETE" });
    });

    it("shows why a lesson cannot be deleted on 409", async () => {
      const { user } = await setup({ lessons: [makeLesson()], deleteError: new ApiError(409) });
      await openLesson(user);
      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
      expect(await screen.findByText("This lesson can't be deleted: it already affected the balance. Cancel it instead.")).toBeInTheDocument();
    });
  });
});
