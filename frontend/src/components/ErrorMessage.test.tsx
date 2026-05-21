import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "../i18n/I18nContext";
import ErrorMessage from "./ErrorMessage";

const renderWithI18n = (props: React.ComponentProps<typeof ErrorMessage>) =>
  render(
    <I18nProvider>
      <ErrorMessage {...props} />
    </I18nProvider>
  );

describe("ErrorMessage", () => {
  it("renders nothing when error is null", () => {
    const { container } = renderWithI18n({ error: null });
    expect(container.firstChild).toBeNull();
  });

  it("shows friendly text for known error kinds", () => {
    renderWithI18n({ error: "user denied transaction signature" });
    expect(screen.getByText(/cancelled the transaction/i)).toBeInTheDocument();
  });

  it("shows raw error below friendly message in normal mode", () => {
    renderWithI18n({ error: "user denied transaction signature" });
    expect(screen.getByText(/user denied/i)).toBeInTheDocument();
  });

  it("hides raw error in compact mode", () => {
    renderWithI18n({ error: "user denied transaction signature", compact: true });
    expect(screen.queryByText("user denied transaction signature")).not.toBeInTheDocument();
  });

  it("displays raw text directly for unknown errors", () => {
    renderWithI18n({ error: "some weird internal hardhat error" });
    expect(screen.getByText("some weird internal hardhat error")).toBeInTheDocument();
  });

  it("shows extracted revert reason for validation errors", () => {
    renderWithI18n({ error: `reverted with reason string 'origin required'` });
    // Both the friendly line and the raw line contain the reason. Expected.
    const matches = screen.getAllByText(/origin required/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Validation failed: origin required/)).toBeInTheDocument();
  });
});
