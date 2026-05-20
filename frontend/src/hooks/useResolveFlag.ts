import { useCallback } from "react";
import { Contract } from "ethers";
import { TX_OVERRIDES } from "../config/chains";
import { useTransaction } from "./useTransaction";

export function useResolveFlag(contract: Contract | null) {
  const tx = useTransaction("Resolve failed");

  const resolveFlag = useCallback(
    async (batchId: string, flagIndex: number) => {
      if (!contract) return;
      await tx.submit(() => contract.resolveFlag(batchId, flagIndex, TX_OVERRIDES));
    },
    [contract, tx]
  );

  return { resolveFlag, reset: tx.reset, loading: tx.loading, success: tx.success, error: tx.error, txHash: tx.txHash };
}
