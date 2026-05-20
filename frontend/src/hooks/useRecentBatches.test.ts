import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentBatches } from "./useRecentBatches";

describe("useRecentBatches", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty when localStorage has no entries", () => {
    const { result } = renderHook(() => useRecentBatches());
    expect(result.current.recent).toEqual([]);
  });

  it("adds a new batch to the front of the list", () => {
    const { result } = renderHook(() => useRecentBatches());
    act(() => result.current.addRecent({ id: "0xabc", name: "Mango" }));
    expect(result.current.recent[0]).toMatchObject({ id: "0xabc", name: "Mango" });
  });

  it("deduplicates: re-adding an existing id moves it to the top without duplicating", () => {
    const { result } = renderHook(() => useRecentBatches());
    act(() => result.current.addRecent({ id: "0x1", name: "A" }));
    act(() => result.current.addRecent({ id: "0x2", name: "B" }));
    act(() => result.current.addRecent({ id: "0x1", name: "A-updated" }));
    expect(result.current.recent).toHaveLength(2);
    expect(result.current.recent[0].id).toBe("0x1");
    expect(result.current.recent[0].name).toBe("A-updated");
  });

  it("caps the list at 5 entries (most recent first)", () => {
    const { result } = renderHook(() => useRecentBatches());
    for (let i = 0; i < 8; i++) {
      act(() => result.current.addRecent({ id: `0x${i}`, name: `B${i}` }));
    }
    expect(result.current.recent).toHaveLength(5);
    expect(result.current.recent[0].id).toBe("0x7");
    expect(result.current.recent[4].id).toBe("0x3");
  });

  it("clearRecent empties the list", () => {
    const { result } = renderHook(() => useRecentBatches());
    act(() => result.current.addRecent({ id: "0xabc", name: "Mango" }));
    act(() => result.current.clearRecent());
    expect(result.current.recent).toEqual([]);
  });

  it("persists across hook remounts via localStorage", () => {
    const { result: first } = renderHook(() => useRecentBatches());
    act(() => first.current.addRecent({ id: "0xdef", name: "Lychee" }));

    const { result: second } = renderHook(() => useRecentBatches());
    expect(second.current.recent[0]).toMatchObject({ id: "0xdef", name: "Lychee" });
  });
});
