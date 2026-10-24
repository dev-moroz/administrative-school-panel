import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { listStudents } from "./list-students";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const query = () => new URL(vi.mocked(apiFetch).mock.calls[0][0] as string, "http://x");

describe("listStudents", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
  });

  it("requests /students with page and pageSize only by default", async () => {
    await listStudents({ page: 1, pageSize: 12 });
    const url = query();
    expect(url.pathname).toBe("/students");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("12");
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.has("isActive")).toBe(false);
  });

  it("adds a trimmed q only when it is not empty", async () => {
    await listStudents({ q: "  ann ", page: 2, pageSize: 12 });
    expect(query().searchParams.get("q")).toBe("ann");
    expect(query().searchParams.get("page")).toBe("2");

    vi.mocked(apiFetch).mockClear();
    await listStudents({ q: "   ", page: 1, pageSize: 12 });
    expect(query().searchParams.has("q")).toBe(false);
  });

  it("maps isActive true/false to the query", async () => {
    await listStudents({ isActive: false, page: 1, pageSize: 12 });
    expect(query().searchParams.get("isActive")).toBe("false");
  });

  it("returns the API response as is", async () => {
    const data = { items: [{ id: "s1", fullName: "A", telegramUsername: null }], total: 1, page: 1, pageSize: 12 };
    vi.mocked(apiFetch).mockResolvedValue(data);
    await expect(listStudents({ page: 1, pageSize: 12 })).resolves.toEqual(data);
  });
});
