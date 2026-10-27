import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useViewMode } from "./use-view-mode";

const KEY = "students.view";
const VALUES = ["cards", "list"] as const;

describe("useViewMode", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("defaults to the fallback", () => {
    const { result } = renderHook(() => useViewMode(KEY, VALUES, "cards"));
    expect(result.current[0]).toBe("cards");
  });

  it("reads the saved value after mount", () => {
    localStorage.setItem(KEY, "list");
    const { result } = renderHook(() => useViewMode(KEY, VALUES, "cards"));
    expect(result.current[0]).toBe("list");
  });

  it("writes the new value to localStorage on change", () => {
    const { result } = renderHook(() => useViewMode(KEY, VALUES, "cards"));
    act(() => result.current[1]("list"));
    expect(result.current[0]).toBe("list");
    expect(localStorage.getItem(KEY)).toBe("list");
  });

  it("ignores garbage in storage", () => {
    localStorage.setItem(KEY, "grid-of-doom");
    const { result } = renderHook(() => useViewMode(KEY, VALUES, "cards"));
    expect(result.current[0]).toBe("cards");
  });

  it("falls back when reading throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useViewMode(KEY, VALUES, "cards"));
    expect(result.current[0]).toBe("cards");
  });

  it("still switches the view when writing throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useViewMode(KEY, VALUES, "cards"));
    act(() => result.current[1]("list"));
    expect(result.current[0]).toBe("list");
  });

  it("works with other allowed values and another fallback", () => {
    const { result } = renderHook(() => useViewMode("payments.view", ["feed", "table"] as const, "feed"));
    expect(result.current[0]).toBe("feed");
    act(() => result.current[1]("table"));
    expect(result.current[0]).toBe("table");
    expect(localStorage.getItem("payments.view")).toBe("table");
  });

  it("rejects a value that is valid for another view but not allowed here", () => {
    localStorage.setItem("payments.view", "list");
    const { result } = renderHook(() => useViewMode("payments.view", ["feed", "table"] as const, "feed"));
    expect(result.current[0]).toBe("feed");
  });

  it("keeps different storage keys independent", () => {
    const students = renderHook(() => useViewMode("students.view", VALUES, "cards"));
    const payments = renderHook(() => useViewMode("payments.view", ["feed", "table"] as const, "feed"));
    act(() => payments.result.current[1]("table"));
    expect(payments.result.current[0]).toBe("table");
    expect(students.result.current[0]).toBe("cards");
    expect(localStorage.getItem("students.view")).toBeNull();
  });
});
