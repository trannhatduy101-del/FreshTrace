import { useEffect, useState } from "react";
import {
  useWalletAccount,
  useWalletProvider,
} from "./useWallet";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../config/contract";
import { POLYGON_AMOY_CHAIN_ID, POLYGON_AMOY_RPC_URL } from "../config/chains";

// Build a signer-bound contract instance from the connected wallet.
// Returns null when no wallet is connected (caller must guard).
export function useContract() {
  const { walletProvider } = useWalletProvider();
  const { address, isConnected, chainId } = useWalletAccount();
  const [contract, setContract] = useState<Contract | null>(null);

  useEffect(() => {
    // Reset when disconnected or on wrong network
    if (!walletProvider || !isConnected || !CONTRACT_ADDRESS) {
      setContract(null);
      return;
    }
    let cancelled = false;

    // Build signer asynchronously. Ethers v6 getSigner returns a Promise.
    (async () => {
      try {
        const provider = new BrowserProvider(walletProvider);
        const signer = await provider.getSigner();
        if (cancelled) return;
        setContract(new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer));
      } catch {
        if (!cancelled) setContract(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [walletProvider, isConnected, chainId]);

  return { contract, address, isConnected, chainId };
}

// Lightweight read-only contract for public pages (no wallet required).
// PublicNode is free, no API key, and supports browser CORS.
export function getReadOnlyContract(): Contract {
  const provider = new JsonRpcProvider(POLYGON_AMOY_RPC_URL);
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}
