import { useWalletConnect, useWalletAccount, useDisconnect, useSwitchNetwork } from "../hooks/useWallet";
import { useState } from "react";
import { EXPECTED_CHAIN_ID } from "../config/chains";
import { useI18n } from "../i18n/I18nContext";
import RoleBadges from "./RoleBadges";

export default function WalletConnect() {
  const { open } = useWalletConnect();
  const { address, isConnected, chainId } = useWalletAccount();
  const { disconnect } = useDisconnect();
  const { switchNetwork } = useSwitchNetwork();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={() => open()}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        {t("common.connect")}
      </button>
    );
  }

  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const networkLabel = chainId === 31337 ? "Hardhat Local" : chainId === 80002 ? "Polygon Amoy" : `Chain ${chainId}`;
  const expectedLabel = EXPECTED_CHAIN_ID === 80002 ? "Polygon Amoy" : "Hardhat Local";
  const wrongNetwork = isConnected && chainId !== EXPECTED_CHAIN_ID;

  if (wrongNetwork) {
    return (
      <button
        type="button"
        onClick={() => switchNetwork(EXPECTED_CHAIN_ID)}
        className="flex items-center gap-2 bg-red-100 hover:bg-red-200 border border-red-300 text-red-800 px-3 py-2 rounded-md text-sm font-medium transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-red-500" />
        {t("common.wrongNetwork")} {expectedLabel}
      </button>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      {/* Role badges sit next to the wallet pill so the audience can see
          which permissions the connected account currently has. */}
      <RoleBadges />

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium text-gray-800 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="font-mono">{truncated}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
              {networkLabel}
            </div>
            <button
              type="button"
              onClick={() => { disconnect(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("common.disconnect")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
