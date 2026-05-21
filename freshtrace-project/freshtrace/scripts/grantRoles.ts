import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// Grant roles on an already-deployed contract. Two modes, same as setup.ts:
//
//   1. Per-role mode: WALLET_PRODUCER, WALLET_LOGISTICS, WALLET_RETAILER,
//      WALLET_AUDITOR each receive their matching role.
//   2. Single-wallet mode (fallback): WALLET_ADDRESS receives all four.
//
// CONTRACT_ADDRESS env var must point at the deployed contract.
async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("Set CONTRACT_ADDRESS in .env (the deployed contract).");
    process.exitCode = 1;
    return;
  }

  const single = process.env.WALLET_ADDRESS;
  const perRole = {
    PRODUCER_ROLE:  process.env.WALLET_PRODUCER  || single,
    LOGISTICS_ROLE: process.env.WALLET_LOGISTICS || single,
    RETAILER_ROLE:  process.env.WALLET_RETAILER  || single,
    AUDITOR_ROLE:   process.env.WALLET_AUDITOR   || single,
  };

  if (Object.values(perRole).every((x) => !x)) {
    console.error("No target wallets set. Provide either WALLET_ADDRESS or the four WALLET_<ROLE> vars.");
    process.exitCode = 1;
    return;
  }

  const contract = await ethers.getContractAt("FreshTrace", contractAddress, deployer);
  console.log("Granting on contract:", contractAddress);
  console.log("From admin wallet:    ", deployer.address);

  for (const [roleName, target] of Object.entries(perRole)) {
    if (!target) {
      console.log(`Skipping ${roleName}: no target wallet provided`);
      continue;
    }
    const roleHash = await (contract as any)[roleName]();
    const tx = await contract.grantRole(roleHash, target);
    await tx.wait();
    console.log(`Granted ${roleName} -> ${target} (tx: ${tx.hash})`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
