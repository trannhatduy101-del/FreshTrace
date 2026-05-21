import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// Local Hardhat helper: send test ETH to wallets that need it.
// Targets, in priority order:
//   1. WALLET_ADDRESS      (single-wallet demo)
//   2. WALLET_PRODUCER, WALLET_LOGISTICS, WALLET_RETAILER, WALLET_AUDITOR
//      (per-role demo, fund all four)
// If none are set we skip quietly: Hardhat default accounts already have
// 10000 ETH each, so importing those keys into MetaMask needs no top-up.
async function main() {
  const [deployer] = await ethers.getSigners();

  const candidates = [
    process.env.WALLET_ADDRESS,
    process.env.WALLET_PRODUCER,
    process.env.WALLET_LOGISTICS,
    process.env.WALLET_RETAILER,
    process.env.WALLET_AUDITOR,
  ].filter((x): x is string => !!x && x.startsWith("0x"));

  if (candidates.length === 0) {
    console.log("Skipping fund: no WALLET_* address set in .env.");
    console.log("  Either set WALLET_ADDRESS=0x... in .env to fund your MetaMask,");
    console.log("  or import a Hardhat default private key (see .env.example) which already has 10000 ETH.");
    return;
  }

  const amount = ethers.parseEther("10");
  // Dedupe so single-wallet mode doesn't get funded twice.
  const unique = Array.from(new Set(candidates.map(a => a.toLowerCase())));
  for (const target of unique) {
    const tx = await deployer.sendTransaction({ to: target, value: amount });
    await tx.wait();
    console.log(`Sent 10 ETH to ${target} (tx: ${tx.hash})`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
