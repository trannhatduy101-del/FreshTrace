// Polygon Amoy testnet definition — chainId 80002 is the official replacement
// for Mumbai (deprecated April 2024). RPC URL is env-configurable for flexibility.

export const POLYGON_AMOY_CHAIN_ID = 80002;
export const HARDHAT_CHAIN_ID = 31337;

// Which chain the app expects — driven by VITE_CHAIN_ID env var.
// Defaults to Hardhat local for dev; set to 80002 for Amoy production.
export const EXPECTED_CHAIN_ID: number =
  Number(import.meta.env.VITE_CHAIN_ID) || HARDHAT_CHAIN_ID;

// Read-only RPC endpoint for public reads (no wallet required)
export const POLYGON_AMOY_RPC_URL =
  (import.meta.env.VITE_POLYGON_AMOY_RPC_URL as string) ||
  "https://rpc-amoy.polygon.technology";

// PolygonScan explorer base — used for linking transactions in the UI
export const POLYGON_AMOY_EXPLORER = "https://amoy.polygonscan.com";

// Web3Modal-compatible chain object (shape required by @web3modal/ethers)
export const polygonAmoy = {
  chainId: POLYGON_AMOY_CHAIN_ID,
  name: "Polygon Amoy",
  currency: "POL",
  explorerUrl: POLYGON_AMOY_EXPLORER,
  rpcUrl: POLYGON_AMOY_RPC_URL,
};

// Polygon Amoy requires a minimum priority fee of 25 gwei.
// MetaMask's default estimate can fall below this, causing "gas tip cap below minimum" errors.
// Pass these overrides on every write transaction when on Amoy.
export const TX_OVERRIDES =
  EXPECTED_CHAIN_ID === POLYGON_AMOY_CHAIN_ID
    ? {
        maxPriorityFeePerGas: 30_000_000_000n, // 30 gwei tip (above 25 gwei minimum)
        maxFeePerGas: 60_000_000_000n,          // 60 gwei max
      }
    : {};

// Helper to build PolygonScan transaction links
export const txLink = (hash: string) => `${POLYGON_AMOY_EXPLORER}/tx/${hash}`;

// Helper to build PolygonScan address links
export const addressLink = (addr: string) =>
  `${POLYGON_AMOY_EXPLORER}/address/${addr}`;
