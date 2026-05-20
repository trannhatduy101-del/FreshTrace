import { useCallback } from "react";
import { Contract } from "ethers";
import { TX_OVERRIDES } from "../config/chains";
import { usePinata } from "./usePinata";
import { useTransaction } from "./useTransaction";

export function useAddonCheckpoint(contract: Contract | null) {
  const { uploadFile } = usePinata();
  const tx = useTransaction("Add-on failed");

  const logAddon = useCallback(
    async (batchId: string, addonLabel: string, location: string, file?: File | null) => {
      if (!contract) return;
      if (!addonLabel.trim()) {
        // Surface validation error through the same state object the UI listens to.
        await tx.submit(async () => {
          throw new Error("Process name required");
        });
        return;
      }
      const cid = file ? await uploadFile(file) : "";
      await tx.submit(() =>
        contract.logAddon(batchId, addonLabel.trim(), location, cid, TX_OVERRIDES)
      );
    },
    [contract, uploadFile, tx]
  );

  return { logAddon, reset: tx.reset, loading: tx.loading, success: tx.success, error: tx.error, txHash: tx.txHash };
}
