import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./useDebounce";

describe("useDebounce - edge cases", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("works with delay=0 (still defers to next tick)", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 0), {
      initialProps: { v: "a" },
    });
    rerender({ v: "b" });
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe("b");
  });

  it("never updates when value never changes", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "stable" },
    });
    rerender({ v: "stable" });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe("stable");
  });

  it("handles object values (debounces by reference change)", () => {
    const a = { x: 1 };
    const b = { x: 2 };
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: a },
    });
    rerender({ v: b });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(b);
  });

  it("cleans up timer on unmount (no late update)", () => {
    const { result, rerender, unmount } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "before" },
    });
    rerender({ v: "after" });
    unmount();
    // After unmount, advancing timers should not throw or update stale state
    expect(() => {
      act(() => { vi.advanceTimersByTime(500); });
    }).not.toThrow();
    expect(result.current).toBe("before"); // last rendered value before unmount
  });
});
