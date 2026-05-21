import { describe, it, expect } from "vitest";
import { classifyError, friendlyError } from "./errorMessages";

describe("classifyError", () => {
  it("detects user rejection", () => {
    expect(classifyError(new Error("user denied transaction signature")).kind).toBe("userRejected");
    expect(classifyError(new Error("MetaMask Tx Signature: User rejected")).kind).toBe("userRejected");
  });

  it("detects insufficient funds", () => {
    expect(classifyError(new Error("insufficient funds for gas * price + value")).kind)
      .toBe("insufficientFunds");
  });

  it("detects Polygon gas tip too low", () => {
    expect(classifyError(new Error("gas tip cap below minimum")).kind).toBe("gasTipTooLow");
    expect(classifyError(new Error("max priority fee per gas is less than block base fee")).kind)
      .toBe("gasTipTooLow");
  });

  it("detects contract BatchNotFound custom error", () => {
    expect(classifyError(new Error("execution reverted: BatchNotFound(0xabc...)")).kind)
      .toBe("batchNotFound");
  });

  it("detects AnomalyDetected", () => {
    expect(classifyError(new Error("AnomalyDetected(0xabc, 1, 3)")).kind).toBe("anomalyDetected");
  });

  it("detects BatchAlreadyExists", () => {
    expect(classifyError(new Error("BatchAlreadyExists(0xabc)")).kind).toBe("batchAlreadyExists");
  });

  it("detects flag already resolved", () => {
    expect(classifyError(new Error("execution reverted: Flag already resolved")).kind)
      .toBe("alreadyResolved");
  });

  it("detects network errors", () => {
    expect(classifyError(new Error("failed to fetch")).kind).toBe("networkError");
    expect(classifyError(new TypeError("Network error")).kind).toBe("networkError");
  });

  it("extracts validation revert reasons", () => {
    const e = new Error(`reverted with reason string 'productName required'`);
    const c = classifyError(e);
    expect(c.kind).toBe("validationFailed");
    expect(c.args).toBe("productName required");
  });

  it("falls back to unknown for unmatched errors", () => {
    expect(classifyError(new Error("random gibberish")).kind).toBe("unknown");
  });

  it("handles non-Error inputs gracefully", () => {
    expect(classifyError("just a string").kind).toBe("unknown");
    expect(classifyError(null).kind).toBe("unknown");
    expect(classifyError(undefined).kind).toBe("unknown");
  });
});

describe("friendlyError", () => {
  const fakeT = (key: string) => `[t:${key}]`;

  it("returns translated message for known kinds", () => {
    const { message } = friendlyError(new Error("user denied"), fakeT);
    expect(message).toBe("[t:errors.userRejected]");
  });

  it("prepends translation prefix to validation revert reason", () => {
    const { message } = friendlyError(
      new Error(`reverted with reason string 'quantity must be > 0'`),
      fakeT
    );
    expect(message).toBe("[t:errors.validationFailed]: quantity must be > 0");
  });

  it("returns raw message for unknown errors (no translation lookup)", () => {
    const { message, raw } = friendlyError(new Error("weird ABI v6 bug"), fakeT);
    expect(message).toBe("weird ABI v6 bug");
    expect(raw).toBe("weird ABI v6 bug");
  });
});
