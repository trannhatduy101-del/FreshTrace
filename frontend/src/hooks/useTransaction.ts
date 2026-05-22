import { useCallback, useState } from "react";
import { ContractTransactionResponse, JsonRpcProvider } from "ethers";
import { POLYGON_AMOY_RPC_URL } from "../config/chains";

/**
 * Shared transaction state shape used by every write-hook in the dApp.
 * Centralised here so the dozen submit hooks don't each redefine it.
 */
export interface TxState {
  loading: boolean;
  success: boolean;
  error: string | null;
  txHash: string | null;
}

export const INITIAL_TX_STATE: TxState = {
  loading: false,
  success: false,
  error: null,
  txHash: null,
};

// Dedicated read provider for receipt polling. We deliberately do NOT use
// MetaMask's wallet provider for this because Amoy's default MetaMask RPC
// rate-limits eth_getTransactionReceipt aggressively and trips a 429 mid-wait.
// PublicNode is happy to take the polling traffic.
let readProvider: JsonRpcProvider | null = null;
function getReadProvider(): JsonRpcProvider {
  if (!readProvider) {
    readProvider = new JsonRpcProvider(POLYGON_AMOY_RPC_URL);
    readProvider.pollingInterval = 6000;
  }
  return readProvider;
}

// Wait for a tx receipt with retry-on-429. PublicNode occasionally returns
// 429 under load; we back off and try again rather than fail the whole tx.
async function waitForReceipt(txHash: string, maxAttempts = 5) {
  const provider = getReadProvider();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const receipt = await provider.waitForTransaction(txHash, 1, 60_000);
      if (receipt) return receipt;
      throw new Error("Receipt not found within 60s");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRateLimit =
        msg.includes("rate limited") || msg.includes("429") || msg.includes("coalesce");
      if (isRateLimit && attempt < maxAttempts) {
        // Exponential backoff: 3s, 6s, 9s, 12s
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Receipt polling exhausted retries");
}

/**
 * Generic transaction submitter. Removes the loading/try/catch/setState
 * boilerplate that was previously duplicated across useCheckpoint, useFlagBatch,
 * useAddonCheckpoint, useResolveFlag, and useBatchRegistry.
 *
 * Usage:
 *   const { submit, reset, ...state } = useTransaction();
 *   await submit(() => contract.flagBatch(id, reason, TX_OVERRIDES));
 *
 * The submit function:
 *   - sets loading=true before the tx is dispatched
 *   - awaits tx broadcast via MetaMask, then polls for receipt via our own
 *     read RPC (avoids MetaMask's rate-limited default)
 *   - retries receipt polling on 429 with exponential backoff
 *   - stores the receipt hash on success
 *   - captures Error.message on failure (with a fallback string)
 *   - returns the receipt so callers can chain further work (event parsing, etc.)
 */
export function useTransaction(fallbackErrorMsg = "Transaction failed") {
  const [state, setState] = useState<TxState>(INITIAL_TX_STATE);

  const submit = useCallback(
    async (
      txFactory: () => Promise<ContractTransactionResponse>,
      onSuccess?: (receipt: any) => void | Promise<void>
    ) => {
      setState({ ...INITIAL_TX_STATE, loading: true });
      try {
        const tx = await txFactory();
        const receipt = await waitForReceipt(tx.hash);
        setState({ loading: false, success: true, error: null, txHash: receipt.hash });
        if (onSuccess) await onSuccess(receipt);
        return receipt;
      } catch (e) {
        const msg = e instanceof Error ? e.message : fallbackErrorMsg;
        setState({ ...INITIAL_TX_STATE, error: msg });
        return null;
      }
    },
    [fallbackErrorMsg]
  );

  const reset = useCallback(() => setState(INITIAL_TX_STATE), []);

  return { submit, reset, ...state };
}
