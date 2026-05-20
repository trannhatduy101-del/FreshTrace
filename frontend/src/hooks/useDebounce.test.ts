import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));
    expect(result.current).toBe("hello");
  });

  it("does not update before the delay elapses", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "first" },
    });
    rerender({ v: "second" });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("first");
  });

  it("updates to the latest value after the delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "first" },
    });
    rerender({ v: "second" });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe("second");
  });

  it("collapses rapid updates to the final value (debouncing)", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "a" },
    });
    rerender({ v: "ab" });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ v: "abc" });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ v: "abcd" });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe("abcd");
  });
});
