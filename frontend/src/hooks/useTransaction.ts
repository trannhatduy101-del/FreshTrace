import { useCallback, useState } from "react";
import { ContractTransactionResponse } from "ethers";

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

/**
 * Generic transaction submitter. Eliminates the loading/try/catch/setState
 * boilerplate that was previously duplicated across useCheckpoint, useFlagBatch,
 * useAddonCheckpoint, useResolveFlag, and useBatchRegistry.
 *
 * Usage:
 *   const { submit, reset, ...state } = useTransaction();
 *   await submit(() => contract.flagBatch(id, reason, TX_OVERRIDES));
 *
 * The submit function:
 *   - sets loading=true before the tx is dispatched
 *   - awaits both tx + receipt
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
        const receipt = await tx.wait();
        if (!receipt) throw new Error("No receipt returned");
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
