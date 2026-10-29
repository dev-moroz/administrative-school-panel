import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import ProfileAbsencesPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

function setup(me: { teacherId: string | null; permissions: string[] }) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const url = new URL(path, "http://x");
    if (url.pathname === "/auth/me") return { id: "u1", email: "t@b.c", role: "teacher", ...me };
    if (url.pathname === "/absences") return [];
    throw new Error(`unexpected ${path}`);
  });
  renderWithProviders(<ProfileAbsencesPage />);
}

const absenceCalls = () => vi.mocked(apiFetch).mock.calls.map(([p]) => new URL(String(p), "http://x")).filter((u) => u.pathname === "/absences");

describe("/profile/absences page", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("shows the teacher's own absences with a page title and the create button", async () => {
    setup({ teacherId: "t1", permissions: ["absences.manage"] });
    expect(await screen.findByRole("heading", { level: 1, name: "Absences" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Add absence" })).toBeInTheDocument();
    expect(await screen.findByText("No absences")).toBeInTheDocument();
    expect(absenceCalls()[0].searchParams.get("teacherId")).toBe("t1");
  });

  it("loads nothing without a teacher record", async () => {
    setup({ teacherId: null, permissions: ["absences.manage"] });
    await vi.waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Add absence" })).not.toBeInTheDocument();
    expect(absenceCalls()).toHaveLength(0);
  });
});
