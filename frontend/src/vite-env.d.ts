/// <reference types="vite/client" />

// Strongly-typed env vars for autocompletion + compile-time safety
interface ImportMetaEnv {
  readonly VITE_POLYGON_AMOY_RPC_URL: string;
  readonly VITE_CONTRACT_ADDRESS: string;
  readonly VITE_PINATA_JWT: string;
  readonly VITE_PINATA_GATEWAY: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
