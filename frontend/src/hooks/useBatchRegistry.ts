import { useCallback, useState } from "react";
import { Contract } from "ethers";
import { usePinata } from "./usePinata";
import { TX_OVERRIDES } from "../config/chains";
import { QuantityUnit } from "../types";
import { useTransaction } from "./useTransaction";

// Register a new batch end to end: optional Pinata upload, then on-chain tx,
// then parse the BatchRegistered event to surface the new batchId to the UI.
export function useBatchRegistry(contract: Contract | null) {
  const { uploadFile } = usePinata();
  const tx = useTransaction("Registration failed");
  const [batchId, setBatchId] = useState<string | null>(null);

  const register = useCallback(
    async (
      productName: string,
      origin: string,
      harvestDate: number, // unix seconds
      quantity: number,    // amount in the selected unit
      unit: QuantityUnit,  // GRAMS or KILOGRAMS
      ocop: boolean,
      file?: File | null
    ) => {
      if (!contract) return;

      // Upload the photo first so a Pinata failure doesn't waste a tx.
      const cid = file ? await uploadFile(file) : "";

      await tx.submit(
        () => contract.registerBatch(productName, origin, harvestDate, quantity, unit, ocop, cid, TX_OVERRIDES),
        (receipt) => {
          // Extract batchId from the BatchRegistered event in the receipt.
          for (const log of receipt.logs) {
            try {
              const parsed = contract.interface.parseLog(log);
              if (parsed && parsed.name === "BatchRegistered") {
                setBatchId(parsed.args.batchId as string);
                break;
              }
            } catch {
              // Not our event, skip
            }
          }
        }
      );
    },
    [contract, uploadFile, tx]
  );

  const reset = useCallback(() => {
    tx.reset();
    setBatchId(null);
  }, [tx]);

  return {
    register,
    reset,
    loading: tx.loading,
    success: tx.success,
    error: tx.error,
    txHash: tx.txHash,
    batchId,
  };
}
