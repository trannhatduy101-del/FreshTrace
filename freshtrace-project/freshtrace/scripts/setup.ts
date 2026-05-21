import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const CHAIN_IDS: Record<string, number> = {
  localhost: 31337,
  hardhat: 31337,
  amoy: 80002,
};

// Resolve which wallet should receive each role. We support two modes:
//
//  1. Per-role mode: WALLET_PRODUCER, WALLET_LOGISTICS, WALLET_RETAILER,
//     WALLET_AUDITOR each point to a distinct wallet. Useful for a realistic
//     supply-chain demo where each actor lives on its own MetaMask account.
//
//  2. Single-wallet mode: WALLET_ADDRESS gets all four roles. Useful when
//     one person wants to try the full flow from a single wallet.
//
//  On local Hardhat we ignore env vars entirely and use the deterministic
//  Hardhat default accounts #1-#4, one role per account. The deployer (#0)
//  always keeps DEFAULT_ADMIN_ROLE so they can grant/revoke later.
async function resolveRoleTargets(deployer: string): Promise<{
  producer: string;
  logistics: string;
  retailer: string;
  auditor: string;
  mode: string;
}> {
  // On a local Hardhat node, use the four well-known default accounts so the
  // demo can switch MetaMask between them. The same Hardhat node always
  // produces the same accounts in the same order.
  if (network.name === "localhost" || network.name === "hardhat") {
    const signers = await ethers.getSigners();
    return {
      producer:  signers[1].address,
      logistics: signers[2].address,
      retailer:  signers[3].address,
      auditor:   signers[4].address,
      mode: "hardhat-defaults (accounts #1-#4)",
    };
  }

  // Per-role env vars take priority on remote networks. Fall back to
  // WALLET_ADDRESS (and then the deployer) so a casual deploy still works.
  const single = process.env.WALLET_ADDRESS || deployer;
  return {
    producer:  process.env.WALLET_PRODUCER  || single,
    logistics: process.env.WALLET_LOGISTICS || single,
    retailer:  process.env.WALLET_RETAILER  || single,
    auditor:   process.env.WALLET_AUDITOR   || single,
    mode: process.env.WALLET_PRODUCER ? "per-role env vars" : "single wallet",
  };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const targets = await resolveRoleTargets(deployer.address);

  console.log("Deploying with:", deployer.address);
  console.log("Network:", network.name);
  console.log("Role assignment mode:", targets.mode);
  console.log("  PRODUCER  ->", targets.producer);
  console.log("  LOGISTICS ->", targets.logistics);
  console.log("  RETAILER  ->", targets.retailer);
  console.log("  AUDITOR   ->", targets.auditor);

  const FreshTrace = await ethers.getContractFactory("FreshTrace");
  const contract = await FreshTrace.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("Deployed to:", address);

  // Grant each role to its designated wallet. If the same address appears
  // more than once (single-wallet mode) AccessControl handles it as a no-op,
  // so the loop is safe regardless of mode.
  const grants: { role: string; to: string }[] = [
    { role: "PRODUCER_ROLE",  to: targets.producer  },
    { role: "LOGISTICS_ROLE", to: targets.logistics },
    { role: "RETAILER_ROLE",  to: targets.retailer  },
    { role: "AUDITOR_ROLE",   to: targets.auditor   },
  ];

  for (const { role, to } of grants) {
    const hash = await (contract as any)[role]();
    await contract.grantRole(hash, to);
    console.log(`Granted ${role} -> ${to}`);
  }

  const chainId = CHAIN_IDS[network.name] ?? 0;
  fs.writeFileSync(
    "deployments.json",
    JSON.stringify({ address, network: network.name, chainId, roles: targets }, null, 2)
  );

  // Auto-update the frontend .env. Works from any clone location.
  const frontendEnvPath = path.resolve(__dirname, "../../../frontend/.env");
  if (fs.existsSync(frontendEnvPath)) {
    let envContent = fs.readFileSync(frontendEnvPath, "utf8");
    envContent = envContent.replace(/VITE_CONTRACT_ADDRESS=.*/, `VITE_CONTRACT_ADDRESS=${address}`);
    if (chainId === 80002) {
      envContent = envContent.replace(/VITE_CHAIN_ID=.*/, `VITE_CHAIN_ID=80002`);
    }
    fs.writeFileSync(frontendEnvPath, envContent);
    console.log("Frontend .env updated:", address);
  } else {
    console.log("Frontend .env not found; set VITE_CONTRACT_ADDRESS manually:", address);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
