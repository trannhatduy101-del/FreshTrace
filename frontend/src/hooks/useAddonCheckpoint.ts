import { useCallback, useState } from "react";
import { Contract } from "ethers";
import { usePinata } from "./usePinata";
import { TX_OVERRIDES } from "../config/chains";

interface AddonState {
  loading: boolean;
  success: boolean;
  error: string | null;
  txHash: string | null;
}

const INITIAL: AddonState = { loading: false, success: false, error: null, txHash: null };

export function useAddonCheckpoint(contract: Contract | null) {
  const { uploadFile } = usePinata();
  const [state, setState] = useState<AddonState>(INITIAL);

  const logAddon = useCallback(
    async (batchId: string, addonLabel: string, location: string, file?: File | null) => {
      if (!contract) { setState({ ...INITIAL, error: "Wallet not connected" }); return; }
      if (!addonLabel.trim()) { setState({ ...INITIAL, error: "Process name required" }); return; }
      setState({ ...INITIAL, loading: true });
      try {
        let cid = "";
        if (file) cid = await uploadFile(file);
        const tx = await contract.logAddon(batchId, addonLabel.trim(), location, cid, TX_OVERRIDES);
        const receipt = await tx.wait();
        setState({ loading: false, success: true, error: null, txHash: receipt.hash });
      } catch (e) {
        setState({ ...INITIAL, error: e instanceof Error ? e.message : "Add-on failed" });
      }
    },
    [contract, uploadFile]
  );

  const reset = useCallback(() => setState(INITIAL), []);
  return { logAddon, reset, ...state };
}
