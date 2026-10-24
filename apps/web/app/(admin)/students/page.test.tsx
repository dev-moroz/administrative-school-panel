import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import StudentsPage from "./page";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const PAGE_SIZE = 12;
const TOTAL = 25;

function me(permissions: string[]) {
  return { id: "u1", email: "a@b.c", role: "admin", permissions };
}

function listResponse(page: number, items = [{ id: `s${page}`, fullName: `Student ${page}`, telegramUsername: `nick_${page}` }]) {
  return { items, total: TOTAL, page, pageSize: PAGE_SIZE };
}

function mockApi(permissions = ["students.read", "students.create"]) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const url = new URL(path, "http://x");
    if (url.pathname === "/auth/me") return me(permissions);
    if (url.pathname === "/students") return listResponse(Number(url.searchParams.get("page")));
    throw new Error(`unexpected ${path}`);
  });
}

function studentCalls() {
  return vi
    .mocked(apiFetch)
    .mock.calls.map(([path]) => new URL(path as string, "http://x"))
    .filter((u) => u.pathname === "/students");
}

const lastCall = () => studentCalls().at(-1)!;

describe("StudentsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiFetch).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("loads the first page of active students with pageSize 12", async () => {
    mockApi();
    renderWithProviders(<StudentsPage />);
    expect(await screen.findByText("Student 1")).toBeInTheDocument();
    expect(lastCall().searchParams.get("page")).toBe("1");
    expect(lastCall().searchParams.get("pageSize")).toBe("12");
    expect(lastCall().searchParams.get("isActive")).toBe("true");
  });

  it("shows 'Page 1 of 3' and disables Previous on the first page", async () => {
    mockApi();
    renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("Next goes to the following page and is disabled on the last one", async () => {
    mockApi();
    renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    const next = screen.getByRole("button", { name: "Next" });
    await userEvent.click(next);
    expect(await screen.findByText("Student 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Student 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("sends the search to the API only after a 300 ms pause, with page reset to 1", async () => {
    mockApi();
    renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Student 2");

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const before = studentCalls().length;
    await user.type(screen.getByRole("searchbox"), "ann");
    expect(studentCalls().length).toBe(before);

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(lastCall().searchParams.get("q")).toBe("ann"));
    expect(lastCall().searchParams.get("page")).toBe("1");
  });

  it("changing the status filter requests isActive=false and resets the page", async () => {
    mockApi();
    renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Student 2");

    await userEvent.click(screen.getByRole("radio", { name: "Inactive" }));
    await waitFor(() => expect(lastCall().searchParams.get("isActive")).toBe("false"));
    expect(lastCall().searchParams.get("page")).toBe("1");
  });

  it("'All' status sends no isActive parameter", async () => {
    mockApi();
    renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await waitFor(() => expect(lastCall().searchParams.has("isActive")).toBe(false));
  });

  it("switching to list view keeps the data and remembers the view", async () => {
    mockApi();
    const { container } = renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    expect(container.querySelector("[data-view='cards']")).not.toBeNull();

    await userEvent.click(screen.getByLabelText("List"));
    expect(container.querySelector("[data-view='list']")).not.toBeNull();
    expect(screen.getByText("Student 1")).toBeInTheDocument();
    expect(localStorage.getItem("students.view")).toBe("list");
  });

  it("restores the saved list view on load", async () => {
    localStorage.setItem("students.view", "list");
    mockApi();
    const { container } = renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    await waitFor(() => expect(container.querySelector("[data-view='list']")).not.toBeNull());
  });

  it("shows 'New student' only with students.create", async () => {
    mockApi(["students.read", "students.create"]);
    const first = renderWithProviders(<StudentsPage />);
    expect(await screen.findByRole("button", { name: "New student" })).toBeInTheDocument();
    first.unmount();

    mockApi(["students.read"]);
    renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    expect(screen.queryByRole("button", { name: "New student" })).not.toBeInTheDocument();
  });

  it("shows the empty message and no pagination when there are no students", async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      const url = new URL(path, "http://x");
      if (url.pathname === "/auth/me") return me(["students.read"]);
      return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
    });
    renderWithProviders(<StudentsPage />);
    expect(await screen.findByText("No students found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
  });

  it("shows an error and recovers on Retry", async () => {
    let fail = true;
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      const url = new URL(path, "http://x");
      if (url.pathname === "/auth/me") return me(["students.read"]);
      if (fail) throw new Error("boom");
      return listResponse(1);
    });
    renderWithProviders(<StudentsPage />);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Failed to load students")).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Student 1")).toBeInTheDocument();
  });
});

describe("StudentsPage side panel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiFetch).mockReset();
  });

  function mockWithStudent() {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      const url = new URL(path, "http://x");
      if (url.pathname === "/auth/me")
        return me(["students.read.all", "students.create", "students.update", "students.assign-teacher", "currencies.read"]);
      if (url.pathname === "/students") return listResponse(1);
      if (url.pathname === "/students/s1")
        return {
          id: "s1", fullName: "Student 1", telegramUsername: "nick_1", englishLevel: "B1", comment: null,
          defaultCurrencyCode: null, lessonPrice: null, isActive: true, teacher: null, telegramLinked: false,
          createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z",
        };
      if (url.pathname === "/currencies") return [];
      if (url.pathname === "/teachers") return [];
      throw new Error(`unexpected ${path}`);
    });
  }

  it("clicking a student opens the panel in read-only view mode", async () => {
    mockWithStudent();
    renderWithProviders(<StudentsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Student 1/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("'New student' opens the panel with an empty form", async () => {
    mockWithStudent();
    renderWithProviders(<StudentsPage />);
    await screen.findByText("Student 1");
    await userEvent.click(screen.getByRole("button", { name: "New student" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByLabelText("Full name")).toHaveValue("");
  });

  it("closing the panel hides it", async () => {
    mockWithStudent();
    renderWithProviders(<StudentsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Student 1/ }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
