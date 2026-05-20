// Wallet hooks — thin wrappers around WalletContext.
// Implementation uses window.ethereum (MetaMask) directly; the names are kept
// generic in case we add WalletConnect / other providers later.
import { useWalletContext } from "../context/WalletContext";

export function useWalletConnect() {
  const { connect } = useWalletContext();
  return { open: connect };
}

export function useWalletAccount() {
  const { address, isConnected, chainId } = useWalletContext();
  return { address, isConnected, chainId };
}

export function useWalletProvider() {
  const { walletProvider } = useWalletContext();
  return { walletProvider };
}

export function useDisconnect() {
  const { disconnect } = useWalletContext();
  return { disconnect };
}

export function useSwitchNetwork() {
  const { switchNetwork } = useWalletContext();
  return { switchNetwork };
}
