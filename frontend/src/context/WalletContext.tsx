import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Find MetaMask specifically — avoids picking up Coinbase/Phantom when multiple wallets installed
function getMetaMaskProvider(): any {
  const eth = (window as any).ethereum;
  if (!eth) return null;
  // Multiple wallets inject into ethereum.providers[]
  if (eth.providers) {
    const mm = eth.providers.find((p: any) => p.isMetaMask && !p.isCoinbaseWallet);
    if (mm) return mm;
  }
  // Single wallet — check it's MetaMask
  if (eth.isMetaMask) return eth;
  return eth; // fallback: use whatever is there
}

interface WalletState {
  address: string | undefined;
  isConnected: boolean;
  chainId: number | undefined;
  walletProvider: any;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

const HARDHAT_CHAIN = {
  chainId: "0x7a69",
  chainName: "Hardhat Local",
  rpcUrls: ["http://127.0.0.1:8545"],
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: undefined,
    isConnected: false,
    chainId: undefined,
    walletProvider: undefined,
  });

  useEffect(() => {
    const eth = getMetaMaskProvider();
    if (!eth) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState({ address: undefined, isConnected: false, chainId: undefined, walletProvider: undefined });
      } else {
        setState(prev => ({ ...prev, address: accounts[0], isConnected: true, walletProvider: eth }));
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      setState(prev => ({ ...prev, chainId: parseInt(chainIdHex, 16) }));
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    eth.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts.length > 0) {
        eth.request({ method: "eth_chainId" }).then((hex: string) => {
          setState({ address: accounts[0], isConnected: true, chainId: parseInt(hex, 16), walletProvider: eth });
        });
      }
    });

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = async () => {
    const eth = getMetaMaskProvider();
    if (!eth) { alert("MetaMask chưa được cài. Vào metamask.io để cài nhé!"); return; }
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    const hex = await eth.request({ method: "eth_chainId" });
    setState({ address: accounts[0], isConnected: true, chainId: parseInt(hex, 16), walletProvider: eth });
  };

  const disconnect = () => {
    setState({ address: undefined, isConnected: false, chainId: undefined, walletProvider: undefined });
  };

  const switchNetwork = async (targetChainId: number) => {
    const eth = getMetaMaskProvider();
    if (!eth) return;
    const hexChainId = `0x${targetChainId.toString(16)}`;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
    } catch (err: any) {
      if (err.code === 4902 && targetChainId === 31337) {
        await eth.request({ method: "wallet_addEthereumChain", params: [HARDHAT_CHAIN] });
      }
    }
  };

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, switchNetwork }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used inside WalletProvider");
  return ctx;
}
