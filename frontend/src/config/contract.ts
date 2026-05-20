// Import ABI from sibling Hardhat project's compiled artifact.
// Vite resolves this at build time via JSON import; assertion required for TS.
// If the path changes during deployment, only this file needs to be updated.
import contractArtifact from "./FreshTrace.json";

// Deployed contract address loaded from env at build time
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

// ABI extracted from Hardhat artifact for ethers.Contract instantiation
export const CONTRACT_ABI = contractArtifact.abi;

// Runtime sanity check during dev: surface misconfiguration immediately
if (!CONTRACT_ADDRESS && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn("VITE_CONTRACT_ADDRESS is not set — contract calls will fail.");
}
