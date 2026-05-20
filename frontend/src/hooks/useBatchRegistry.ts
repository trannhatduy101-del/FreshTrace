import { useCallback, useState } from "react";
import { Contract } from "ethers";
import { usePinata } from "./usePinata";
import { TX_OVERRIDES } from "../config/chains";

interface RegistryState {
  loading: boolean;
  success: boolean;
  error: string | null;
  batchId: string | null;
  txHash: string | null;
}

const INITIAL: RegistryState = {
  loading: false,
  success: false,
  error: null,
  batchId: null,
  txHash: null,
};

// Register a new batch end-to-end: optional Pinata upload, then on-chain tx,
// then parse the BatchRegistered event to surface the new batchId to the UI.
export function useBatchRegistry(contract: Contract | null) {
  const { uploadFile } = usePinata();
  const [state, setState] = useState<RegistryState>(INITIAL);

  const register = useCallback(
    async (
      productName: string,
      origin: string,
      harvestDate: number, // unix seconds
      quantity: number, // grams
      ocop: boolean,
      file?: File | null
    ) => {
      if (!contract) {
        setState({ ...INITIAL, error: "Wallet not connected" });
        return;
      }

      setState({ ...INITIAL, loading: true });

      try {
        // 1. Upload image first so failures don't waste a transaction
        let cid = "";
        if (file) {
          cid = await uploadFile(file);
        }

        // 2. Submit registerBatch transaction (signer-bound contract)
        const tx = await contract.registerBatch(
          productName,
          origin,
          harvestDate,
          quantity,
          ocop,
          cid,
          TX_OVERRIDES
        );

        // 3. Wait for inclusion, then extract batchId from the event
        const receipt = await tx.wait();

        // Parse BatchRegistered log emitted in the same tx
        let batchId: string | null = null;
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === "BatchRegistered") {
              batchId = parsed.args.batchId as string;
              break;
            }
          } catch {
            // Skip logs not matching this contract's ABI
          }
        }

        setState({
          loading: false,
          success: true,
          error: null,
          batchId,
          txHash: receipt.hash,
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "Registration failed — see console for details";
        setState({ ...INITIAL, error: msg });
      }
    },
    [contract, uploadFile]
  );

  // Allow callers to reset form state after handling success
  const reset = useCallback(() => setState(INITIAL), []);

  return { register, reset, ...state };
}
