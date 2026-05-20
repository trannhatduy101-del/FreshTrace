import { useCallback, useState } from "react";
import { Contract } from "ethers";
import { TX_OVERRIDES } from "../config/chains";

interface FlagState {
  loading: boolean;
  success: boolean;
  error: string | null;
  txHash: string | null;
}

const INITIAL: FlagState = { loading: false, success: false, error: null, txHash: null };

export function useFlagBatch(contract: Contract | null) {
  const [state, setState] = useState<FlagState>(INITIAL);

  const flagBatch = useCallback(
    async (batchId: string, reason: string) => {
      if (!contract) {
        setState({ ...INITIAL, error: "Wallet not connected" });
        return;
      }
      setState({ ...INITIAL, loading: true });
      try {
        const tx = await contract.flagBatch(batchId, reason, TX_OVERRIDES);
        const receipt = await tx.wait();
        setState({ loading: false, success: true, error: null, txHash: receipt.hash });
      } catch (e) {
        setState({
          ...INITIAL,
          error: e instanceof Error ? e.message : "Flag submission failed",
        });
      }
    },
    [contract]
  );

  const reset = useCallback(() => setState(INITIAL), []);
  return { flagBatch, reset, ...state };
}
