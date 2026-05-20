import { describe, it, expect } from "vitest";
import { isValidBatchId } from "./batchId";

describe("isValidBatchId", () => {
  it("accepts a canonical 66-char bytes32 hex", () => {
    expect(isValidBatchId("0x" + "a".repeat(64))).toBe(true);
  });

  it("accepts mixed-case hex", () => {
    expect(isValidBatchId("0xAbCdEf" + "0".repeat(58))).toBe(true);
  });

  it("rejects empty / null / undefined", () => {
    expect(isValidBatchId("")).toBe(false);
    expect(isValidBatchId(undefined)).toBe(false);
    expect(isValidBatchId(null)).toBe(false);
  });

  it("rejects missing 0x prefix", () => {
    expect(isValidBatchId("a".repeat(64))).toBe(false);
  });

  it("rejects too short", () => {
    expect(isValidBatchId("0x" + "a".repeat(63))).toBe(false);
  });

  it("rejects too long", () => {
    expect(isValidBatchId("0x" + "a".repeat(65))).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidBatchId("0x" + "g".repeat(64))).toBe(false);
    expect(isValidBatchId("0x" + "z".repeat(64))).toBe(false);
  });

  it("rejects whitespace-padded values", () => {
    expect(isValidBatchId(" 0x" + "a".repeat(64))).toBe(false);
    expect(isValidBatchId("0x" + "a".repeat(64) + " ")).toBe(false);
  });
});
