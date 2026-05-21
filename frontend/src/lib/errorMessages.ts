// Parse raw ethers / RPC / contract errors into short, user-friendly strings.
// Returns a key into the translations.errors namespace so the caller can
// localise via t(). Falls back to the raw message when we can't classify it.

export type ErrorKind =
  | "userRejected"        // user clicked Reject in MetaMask
  | "insufficientFunds"   // wallet has no gas
  | "gasTipTooLow"        // Polygon Amoy 25 gwei minimum
  | "batchNotFound"       // contract custom error
  | "anomalyDetected"     // forward-only ordering violation
  | "batchAlreadyExists"  // duplicate batchId
  | "alreadyResolved"     // flag already resolved
  | "noWallet"            // MetaMask not installed / not connected
  | "wrongNetwork"        // chainId mismatch
  | "networkError"        // RPC unreachable
  | "validationFailed"    // contract require() string surfaced
  | "unknown";

export interface ClassifiedError {
  kind: ErrorKind;
  /** Original message for debugging — shown in the small grey text. */
  raw: string;
  /** Optional structured args extracted from custom errors. */
  args?: string;
}

/**
 * Classify an unknown error caught from a contract call or RPC request.
 */
export function classifyError(err: unknown): ClassifiedError {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  // MetaMask / wallet-level rejections
  if (lower.includes("user denied") || lower.includes("user rejected") || lower.includes("acted_rejected")) {
    return { kind: "userRejected", raw };
  }
  if (lower.includes("insufficient funds")) {
    return { kind: "insufficientFunds", raw };
  }

  // Polygon-specific gas tip floor
  if (lower.includes("gas tip cap") || lower.includes("max priority fee") || lower.includes("tip cap below")) {
    return { kind: "gasTipTooLow", raw };
  }

  // Network / RPC connection issues
  if (lower.includes("failed to fetch") || lower.includes("network error") ||
      lower.includes("could not reach") || lower.includes("connection")) {
    return { kind: "networkError", raw };
  }

  // Wallet not present
  if (lower.includes("metamask") && (lower.includes("not installed") || lower.includes("not found"))) {
    return { kind: "noWallet", raw };
  }
  if (lower.includes("wrong network") || lower.includes("chain mismatch")) {
    return { kind: "wrongNetwork", raw };
  }

  // Contract custom errors
  if (raw.includes("BatchNotFound")) {
    return { kind: "batchNotFound", raw };
  }
  if (raw.includes("AnomalyDetected")) {
    return { kind: "anomalyDetected", raw };
  }
  if (raw.includes("BatchAlreadyExists")) {
    return { kind: "batchAlreadyExists", raw };
  }

  // Contract require() strings
  if (raw.includes("Flag already resolved")) {
    return { kind: "alreadyResolved", raw };
  }
  // Any other revert reason from a require() — extract the quoted string if present.
  const reasonMatch = raw.match(/reverted with reason string '([^']+)'/) ||
                       raw.match(/reverted: (.+)/);
  if (reasonMatch) {
    return { kind: "validationFailed", raw, args: reasonMatch[1] };
  }

  return { kind: "unknown", raw };
}

/**
 * One-call helper: classify the error and look up the translated text.
 * Uses the t() function from the I18n context.
 */
export function friendlyError(err: unknown, t: (k: string) => string): { message: string; raw: string } {
  const c = classifyError(err);
  // For validationFailed we want to show the actual revert reason,
  // not a generic translation — the reason string itself is descriptive.
  if (c.kind === "validationFailed" && c.args) {
    return { message: `${t("errors.validationFailed")}: ${c.args}`, raw: c.raw };
  }
  if (c.kind === "unknown") {
    // No translation — return the raw text so dev/user can see what happened.
    return { message: c.raw, raw: c.raw };
  }
  return { message: t(`errors.${c.kind}`), raw: c.raw };
}
