import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import LanguageToggle from "./LanguageToggle";

const renderWithI18n = () =>
  render(
    <I18nProvider>
      <LanguageToggle />
    </I18nProvider>
  );

describe("LanguageToggle", () => {
  beforeEach(() => { localStorage.clear(); });

  it("renders both EN and VI buttons", () => {
    renderWithI18n();
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("VI")).toBeInTheDocument();
  });

  it("EN is active by default", () => {
    renderWithI18n();
    const en = screen.getByText("EN");
    expect(en).toHaveClass("bg-green-600");
  });

  it("clicking VI switches the active state", () => {
    renderWithI18n();
    fireEvent.click(screen.getByText("VI"));
    expect(screen.getByText("VI")).toHaveClass("bg-green-600");
    expect(screen.getByText("EN")).not.toHaveClass("bg-green-600");
  });

  it("persists choice in localStorage", () => {
    renderWithI18n();
    fireEvent.click(screen.getByText("VI"));
    expect(localStorage.getItem("freshtrace.locale")).toBe("vi");
  });
});
