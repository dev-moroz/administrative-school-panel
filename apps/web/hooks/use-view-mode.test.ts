import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useViewMode } from "./use-view-mode";

const KEY = "students.view";

describe("useViewMode", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("defaults to cards", () => {
    const { result } = renderHook(() => useViewMode(KEY));
    expect(result.current[0]).toBe("cards");
  });

  it("reads the saved value after mount", () => {
    localStorage.setItem(KEY, "list");
    const { result } = renderHook(() => useViewMode(KEY));
    expect(result.current[0]).toBe("list");
  });

  it("writes the new value to localStorage on change", () => {
    const { result } = renderHook(() => useViewMode(KEY));
    act(() => result.current[1]("list"));
    expect(result.current[0]).toBe("list");
    expect(localStorage.getItem(KEY)).toBe("list");
  });

  it("ignores garbage in storage", () => {
    localStorage.setItem(KEY, "grid-of-doom");
    const { result } = renderHook(() => useViewMode(KEY));
    expect(result.current[0]).toBe("cards");
  });

  it("falls back to cards when reading throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useViewMode(KEY));
    expect(result.current[0]).toBe("cards");
  });

  it("still switches the view when writing throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useViewMode(KEY));
    act(() => result.current[1]("list"));
    expect(result.current[0]).toBe("list");
  });
});
