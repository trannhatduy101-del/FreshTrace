import { useWalletContext } from "../context/WalletContext";

export function useWeb3Modal() {
  const { connect } = useWalletContext();
  return { open: connect };
}

export function useWeb3ModalAccount() {
  const { address, isConnected, chainId } = useWalletContext();
  return { address, isConnected, chainId };
}

export function useWeb3ModalProvider() {
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
