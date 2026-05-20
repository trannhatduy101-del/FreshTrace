import { useCallback, useState } from "react";
import { Contract } from "ethers";
import { TX_OVERRIDES } from "../config/chains";

interface ResolveState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

const INITIAL: ResolveState = { loading: false, success: false, error: null };

export function useResolveFlag(contract: Contract | null) {
  const [state, setState] = useState<ResolveState>(INITIAL);

  const resolveFlag = useCallback(
    async (batchId: string, flagIndex: number) => {
      if (!contract) { setState({ ...INITIAL, error: "Wallet not connected" }); return; }
      setState({ ...INITIAL, loading: true });
      try {
        const tx = await contract.resolveFlag(batchId, flagIndex, TX_OVERRIDES);
        await tx.wait();
        setState({ loading: false, success: true, error: null });
      } catch (e) {
        setState({ ...INITIAL, error: e instanceof Error ? e.message : "Resolve failed" });
      }
    },
    [contract]
  );

  const reset = useCallback(() => setState(INITIAL), []);
  return { resolveFlag, reset, ...state };
}
