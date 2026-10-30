import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import type { Lesson } from "../model/types";
import { makeLesson } from "../test/fixtures";
import { StudentSchedule } from "./student-schedule";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

function setup(lessons: Lesson[]) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const url = new URL(path, "http://x");
    if (url.pathname === "/lessons") return lessons;
    throw new Error(`unexpected GET ${path}`);
  });
  renderWithProviders(<StudentSchedule studentId="s1" />);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("StudentSchedule", () => {
  it("requests the next 6 lessons of the student", async () => {
    setup([]);
    await screen.findByText("No upcoming lessons");
    const url = new URL(String(vi.mocked(apiFetch).mock.calls[0][0]), "http://x");
    expect(url.searchParams.get("studentId")).toBe("s1");
    expect(url.searchParams.get("limit")).toBe("6");
  });

  it("shows a row per lesson with duration, teacher and status, in the API order", async () => {
    setup([
      makeLesson({ id: "l1", durationMin: 60 }),
      makeLesson({ id: "l2", durationMin: 45, startsAt: new Date(2026, 10, 5, 10, 0).toISOString(), teacher: { id: "t2", fullName: "Ivan Orlov" } }),
    ]);
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("60 min")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Olga Smirnova")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Scheduled")).toBeInTheDocument();
    expect(within(rows[1]).getByText("45 min")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Ivan Orlov")).toBeInTheDocument();
  });

  it("shows the reason and the comment of a cancelled lesson", async () => {
    setup([
      makeLesson({
        status: "CANCELLED",
        cancelledAt: "2026-10-30T10:00:00.000Z",
        cancelReason: { code: "STUDENT_ILL", name: "Student is ill" },
        comment: "flu",
      }),
    ]);
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Cancelled")).toBeInTheDocument();
    expect(within(row).getByText(/Student is ill/)).toBeInTheDocument();
    expect(within(row).getByText(/flu/)).toBeInTheDocument();
  });

  it("has no actions (read-only)", async () => {
    setup([makeLesson()]);
    await screen.findByRole("listitem");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    setup([]);
    expect(await screen.findByText("No upcoming lessons")).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
