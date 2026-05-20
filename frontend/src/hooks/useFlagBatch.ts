import { useCallback } from "react";
import { Contract } from "ethers";
import { TX_OVERRIDES } from "../config/chains";
import { useTransaction } from "./useTransaction";

export function useFlagBatch(contract: Contract | null) {
  const tx = useTransaction("Flag submission failed");

  const flagBatch = useCallback(
    async (batchId: string, reason: string) => {
      if (!contract) return;
      await tx.submit(() => contract.flagBatch(batchId, reason, TX_OVERRIDES));
    },
    [contract, tx]
  );

  return { flagBatch, reset: tx.reset, loading: tx.loading, success: tx.success, error: tx.error, txHash: tx.txHash };
}
