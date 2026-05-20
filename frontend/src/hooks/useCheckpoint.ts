import { useCallback, useState } from "react";
import { Contract } from "ethers";
import { ActionType } from "../types";
import { usePinata } from "./usePinata";
import { TX_OVERRIDES } from "../config/chains";
import { useTransaction } from "./useTransaction";

interface AnomalyInfo {
  attempted: ActionType;
  last: ActionType;
}

// Log a checkpoint with optional photo. Performs a UX-only pre-check to fail
// fast on out-of-order actions; the contract remains the authoritative source.
export function useCheckpoint(contract: Contract | null) {
  const { uploadFile } = usePinata();
  const tx = useTransaction("Checkpoint failed");
  const [anomaly, setAnomaly] = useState<AnomalyInfo | null>(null);

  const logCheckpoint = useCallback(
    async (
      batchId: string,
      actionType: ActionType,
      location: string,
      file?: File | null
    ) => {
      if (!contract) return;
      setAnomaly(null);

      // 1. Client-side anomaly pre-check against the LAST main-flow checkpoint.
      //    Saves gas on obviously bad submissions; mirrors contract logic.
      try {
        const [, rawCheckpoints] = await contract.getHistory(batchId);
        if (rawCheckpoints.length > 0) {
          // Walk backwards skipping add-ons (addonLabel non-empty)
          for (let i = rawCheckpoints.length - 1; i >= 0; i--) {
            const cp = rawCheckpoints[i];
            const isAddon = cp.addonLabel && cp.addonLabel.length > 0;
            if (!isAddon) {
              const lastAction = Number(cp.action) as ActionType;
              if (actionType <= lastAction) {
                setAnomaly({ attempted: actionType, last: lastAction });
                await tx.submit(async () => {
                  throw new Error(
                    `Anomaly: cannot log ${ActionType[actionType]} after ${ActionType[lastAction]}`
                  );
                });
                return;
              }
              break;
            }
          }
        }
      } catch {
        // If pre-check fails, fall through to the actual transaction.
      }

      // 2. Upload evidence photo if provided.
      const cid = file ? await uploadFile(file) : "";

      // 3. Submit checkpoint transaction via the generic submitter.
      await tx.submit(() =>
        contract.logCheckpoint(batchId, actionType, location, cid, TX_OVERRIDES)
      );
    },
    [contract, uploadFile, tx]
  );

  const reset = useCallback(() => {
    tx.reset();
    setAnomaly(null);
  }, [tx]);

  return { logCheckpoint, reset, loading: tx.loading, success: tx.success, error: tx.error, txHash: tx.txHash, anomaly };
}
