// Wallet hooks — thin wrappers around @web3modal/ethers.
// Using Web3Modal (AppKit) gives us MetaMask browser-extension support,
// WalletConnect QR for mobile wallets, EIP-6963 multi-injected detection,
// and a unified UI for connect/disconnect/network-switch flows.
import {
  useWeb3Modal,
  useWeb3ModalAccount,
  useWeb3ModalProvider,
  useDisconnect as useW3MDisconnect,
  useSwitchNetwork as useW3MSwitchNetwork,
} from "@web3modal/ethers/react";

export function useWalletConnect() {
  // open() launches the Web3Modal connection sheet
  return useWeb3Modal();
}

export function useWalletAccount() {
  // Returns address (0x string), isConnected, chainId (number)
  return useWeb3ModalAccount();
}

export function useWalletProvider() {
  // walletProvider is an EIP-1193 provider — works directly with ethers.BrowserProvider
  return useWeb3ModalProvider();
}

export function useDisconnect() {
  return useW3MDisconnect();
}

export function useSwitchNetwork() {
  return useW3MSwitchNetwork();
}
