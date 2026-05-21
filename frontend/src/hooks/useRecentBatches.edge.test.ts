import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentBatches } from "./useRecentBatches";

describe("useRecentBatches — edge cases", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns [] when localStorage has invalid JSON", () => {
    localStorage.setItem("freshtrace.recentBatches", "not-valid-json{");
    const { result } = renderHook(() => useRecentBatches());
    expect(result.current.recent).toEqual([]);
  });

  it("returns [] when localStorage payload is not an array", () => {
    localStorage.setItem("freshtrace.recentBatches", JSON.stringify({ id: "0x1" }));
    const { result } = renderHook(() => useRecentBatches());
    expect(result.current.recent).toEqual([]);
  });

  it("filters out malformed entries (missing fields)", () => {
    const mixed = [
      { id: "0xgood", name: "Mango", viewedAt: 1 },
      { id: "0xbad" }, // missing name + viewedAt
      { name: "Orphan" }, // missing id
      "not-an-object",
    ];
    localStorage.setItem("freshtrace.recentBatches", JSON.stringify(mixed));
    const { result } = renderHook(() => useRecentBatches());
    expect(result.current.recent).toHaveLength(1);
    expect(result.current.recent[0].id).toBe("0xgood");
  });

  it("handles localStorage.setItem throwing (quota exceeded)", () => {
    // Simulate quota exceeded — first call (load) returns null, second (save) throws.
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() => useRecentBatches());
    expect(() => {
      act(() => result.current.addRecent({ id: "0xabc", name: "Mango" }));
    }).not.toThrow();
    // In-memory state still updates even when persist fails
    expect(result.current.recent[0]).toMatchObject({ id: "0xabc", name: "Mango" });

    setItemSpy.mockRestore();
  });

  it("dedupes case-insensitively (mixed-case ID treated as same batch)", () => {
    const { result } = renderHook(() => useRecentBatches());
    act(() => result.current.addRecent({ id: "0xABC", name: "First" }));
    act(() => result.current.addRecent({ id: "0xabc", name: "Second" }));
    expect(result.current.recent).toHaveLength(1);
    expect(result.current.recent[0].name).toBe("Second");
  });
});
