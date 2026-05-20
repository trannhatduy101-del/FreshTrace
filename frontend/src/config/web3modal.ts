import { createWeb3Modal, defaultConfig } from "@web3modal/ethers";
import { polygonAmoy } from "./chains";

const projectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || "local_dev_placeholder";

const metadata = {
  name: "FreshTrace",
  description: "OCOP-certified supply chain audit log on Polygon",
  url: typeof window !== "undefined" ? window.location.origin : "https://freshtrace.app",
  icons: ["/leaf.svg"],
};

const ethersConfig = defaultConfig({
  metadata,
  enableEIP6963: true,
  enableInjected: true,
  enableCoinbase: false,
});

let initialized = false;

export function initWeb3Modal() {
  if (initialized) return;
  createWeb3Modal({
    ethersConfig,
    chains: [polygonAmoy],
    projectId,
    enableAnalytics: false,
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#059669",
      "--w3m-border-radius-master": "6px",
    },
  });
  initialized = true;
}

initWeb3Modal();
