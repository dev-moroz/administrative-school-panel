import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { createAbsence } from "./create-absence";
import { deleteAbsence } from "./delete-absence";
import { listAbsences } from "./list-absences";
import { updateAbsence } from "./update-absence";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const first = () => vi.mocked(apiFetch).mock.calls[0];
const method = () => first()[1]?.method ?? "GET";
const body = () => JSON.parse(String(first()[1]?.body));

describe("absences api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({});
  });

  it("listAbsences filters by student", async () => {
    await listAbsences({ studentId: "s1" });
    const url = new URL(first()[0] as string, "http://x");
    expect(url.pathname).toBe("/absences");
    expect(url.searchParams.get("studentId")).toBe("s1");
    expect(url.searchParams.has("teacherId")).toBe(false);
    expect(method()).toBe("GET");
  });

  it("listAbsences filters by teacher", async () => {
    await listAbsences({ teacherId: "t1" });
    const url = new URL(first()[0] as string, "http://x");
    expect(url.searchParams.get("teacherId")).toBe("t1");
    expect(url.searchParams.has("studentId")).toBe(false);
  });

  it("createAbsence POSTs /absences", async () => {
    const payload = { kind: "TEACHER_VACATION" as const, teacherId: "t1", startsOn: "2026-11-10", endsOn: "2026-11-20", comment: "Sick leave" };
    await createAbsence(payload);
    expect(first()[0]).toBe("/absences");
    expect(method()).toBe("POST");
    expect(body()).toEqual(payload);
  });

  it("updateAbsence PATCHes /absences/:id", async () => {
    await updateAbsence("a1", { endsOn: "2026-11-15" });
    expect(first()[0]).toBe("/absences/a1");
    expect(method()).toBe("PATCH");
    expect(body()).toEqual({ endsOn: "2026-11-15" });
  });

  it("deleteAbsence DELETEs /absences/:id and returns the warnings", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ warnings: [] });
    await expect(deleteAbsence("a1")).resolves.toEqual({ warnings: [] });
    expect(first()[0]).toBe("/absences/a1");
    expect(method()).toBe("DELETE");
  });
});
