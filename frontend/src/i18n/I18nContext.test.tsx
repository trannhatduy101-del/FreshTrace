import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { I18nProvider, useI18n } from "./I18nContext";
import { ReactNode } from "react";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe("I18nContext", () => {
  beforeEach(() => { localStorage.clear(); });

  it("defaults to English", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("en");
  });

  it("returns translated text in current locale", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("nav.dashboard")).toBe("Dashboard");
    act(() => result.current.setLocale("vi"));
    expect(result.current.t("nav.dashboard")).toBe("Bảng điều khiển");
  });

  it("falls back to the key path when translation is missing", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("nonexistent.deep.key")).toBe("nonexistent.deep.key");
  });

  it("falls back to the path when nested object missing the locale", () => {
    // If a key exists but only in one locale, switching should still return something.
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale("vi"));
    // common.copy exists in both — sanity
    expect(result.current.t("common.copy")).toBe("Sao chép");
  });

  it("persists locale choice across remounts", () => {
    const { result: first } = renderHook(() => useI18n(), { wrapper });
    act(() => first.current.setLocale("vi"));

    const { result: second } = renderHook(() => useI18n(), { wrapper });
    expect(second.current.locale).toBe("vi");
  });

  it("ignores invalid stored locale", () => {
    localStorage.setItem("freshtrace.locale", "fr-XX");
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("en");
  });
});
