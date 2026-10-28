import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { changeLessonStatus } from "./change-lesson-status";
import { createLesson } from "./create-lesson";
import { createSeries } from "./create-series";
import { deleteLesson } from "./delete-lesson";
import { getCancelPreview } from "./get-cancel-preview";
import { listCancelReasons } from "./list-cancel-reasons";
import { listLessons } from "./list-lessons";
import { splitSeries } from "./split-series";
import { updateLesson } from "./update-lesson";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const first = () => vi.mocked(apiFetch).mock.calls[0];
const method = () => first()[1]?.method ?? "GET";
const body = () => JSON.parse(String(first()[1]?.body));

describe("lessons api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({});
  });

  it("listLessons sends from and to as ISO strings", async () => {
    const from = new Date(2026, 10, 2);
    const to = new Date(2026, 10, 9);
    await listLessons({ from, to });
    const url = new URL(first()[0] as string, "http://x");
    expect(url.pathname).toBe("/lessons");
    expect(url.searchParams.get("from")).toBe(from.toISOString());
    expect(url.searchParams.get("to")).toBe(to.toISOString());
    expect(method()).toBe("GET");
  });

  it("createLesson POSTs /lessons", async () => {
    const payload = { studentId: "s1", startsAt: "2026-11-03T10:00:00.000Z", durationMin: 60 };
    await createLesson(payload);
    expect(first()[0]).toBe("/lessons");
    expect(method()).toBe("POST");
    expect(body()).toEqual(payload);
  });

  it("updateLesson PATCHes /lessons/:id", async () => {
    await updateLesson("l1", { durationMin: 45 });
    expect(first()[0]).toBe("/lessons/l1");
    expect(method()).toBe("PATCH");
    expect(body()).toEqual({ durationMin: 45 });
  });

  it("changeLessonStatus POSTs /lessons/:id/status", async () => {
    await changeLessonStatus("l1", { status: "CANCELLED", reason: "ILLNESS", charged: false });
    expect(first()[0]).toBe("/lessons/l1/status");
    expect(method()).toBe("POST");
    expect(body()).toEqual({ status: "CANCELLED", reason: "ILLNESS", charged: false });
  });

  it("getCancelPreview GETs /lessons/:id/cancel-preview", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ suggestedCharged: true });
    await expect(getCancelPreview("l1")).resolves.toEqual({ suggestedCharged: true });
    expect(first()[0]).toBe("/lessons/l1/cancel-preview");
    expect(method()).toBe("GET");
  });

  it("deleteLesson DELETEs /lessons/:id", async () => {
    await deleteLesson("l1");
    expect(first()[0]).toBe("/lessons/l1");
    expect(method()).toBe("DELETE");
  });

  it("listCancelReasons GETs /cancel-reasons", async () => {
    await listCancelReasons();
    expect(first()[0]).toBe("/cancel-reasons");
    expect(method()).toBe("GET");
  });

  it("createSeries POSTs /lesson-series", async () => {
    const payload = { studentId: "s1", weekday: 2, startTime: "10:00", durationMin: 60, startsOn: "2026-11-03" };
    await createSeries(payload);
    expect(first()[0]).toBe("/lesson-series");
    expect(method()).toBe("POST");
    expect(body()).toEqual(payload);
  });

  it("splitSeries POSTs /lesson-series/:id/split", async () => {
    await splitSeries("sr1", { fromLessonId: "l1", startTime: "11:00" });
    expect(first()[0]).toBe("/lesson-series/sr1/split");
    expect(method()).toBe("POST");
    expect(body()).toEqual({ fromLessonId: "l1", startTime: "11:00" });
  });
});
