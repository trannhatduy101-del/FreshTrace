import { useCallback, useState } from "react";
import { Contract } from "ethers";
import { ActionType } from "../types";
import { usePinata } from "./usePinata";
import { TX_OVERRIDES } from "../config/chains";

interface CheckpointState {
  loading: boolean;
  success: boolean;
  error: string | null;
  txHash: string | null;
  anomaly: { attempted: ActionType; last: ActionType } | null;
}

const INITIAL: CheckpointState = {
  loading: false,
  success: false,
  error: null,
  txHash: null,
  anomaly: null,
};

// Log a checkpoint with optional photo. Performs a UX-only pre-check to fail
// fast on out-of-order actions; the contract remains the authoritative source.
export function useCheckpoint(contract: Contract | null) {
  const { uploadFile } = usePinata();
  const [state, setState] = useState<CheckpointState>(INITIAL);

  const logCheckpoint = useCallback(
    async (
      batchId: string,
      actionType: ActionType,
      location: string,
      file?: File | null
    ) => {
      if (!contract) {
        setState({ ...INITIAL, error: "Wallet not connected" });
        return;
      }

      setState({ ...INITIAL, loading: true });

      try {
        // 1. Client-side anomaly pre-check — saves gas on obvious errors
        const [, rawCheckpoints] = await contract.getHistory(batchId);
        if (rawCheckpoints.length > 0) {
          const lastAction = Number(
            rawCheckpoints[rawCheckpoints.length - 1].action
          ) as ActionType;
          if (actionType <= lastAction) {
            setState({
              ...INITIAL,
              error: `Anomaly: cannot log ${ActionType[actionType]} after ${ActionType[lastAction]}`,
              anomaly: { attempted: actionType, last: lastAction },
            });
            return;
          }
        }

        // 2. Upload evidence photo if provided
        let cid = "";
        if (file) {
          cid = await uploadFile(file);
        }

        // 3. Submit logCheckpoint transaction
        const tx = await contract.logCheckpoint(
          batchId,
          actionType,
          location,
          cid,
          TX_OVERRIDES
        );
        const receipt = await tx.wait();

        setState({
          loading: false,
          success: true,
          error: null,
          txHash: receipt.hash,
          anomaly: null,
        });
      } catch (e) {
        // Detect contract-side AnomalyDetected revert via error string match
        const msg =
          e instanceof Error
            ? e.message
            : "Checkpoint failed — see console for details";
        const isAnomaly = msg.includes("AnomalyDetected");
        setState({
          ...INITIAL,
          error: msg,
          anomaly: isAnomaly ? { attempted: actionType, last: -1 as any } : null,
        });
      }
    },
    [contract, uploadFile]
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { logCheckpoint, reset, ...state };
}
