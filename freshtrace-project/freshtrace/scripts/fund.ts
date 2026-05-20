import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// Local Hardhat helper: send test ETH to a wallet (e.g. your MetaMask).
// Target wallet defaults to WALLET_ADDRESS env var; pass --target as fallback.
async function main() {
  const [deployer] = await ethers.getSigners();
  const target = process.env.WALLET_ADDRESS;

  // Skip gracefully if no target wallet — the Hardhat #0 account already has
  // 10000 test ETH, so users who import its key into MetaMask need nothing extra.
  if (!target) {
    console.log("Skipping fund: WALLET_ADDRESS not set in .env.");
    console.log("→ Either set WALLET_ADDRESS=0x... to fund your MetaMask,");
    console.log("→ or import the Hardhat #0 private key (see .env.example) which already has 10000 ETH.");
    return;
  }

  const amount = ethers.parseEther("10");
  const tx = await deployer.sendTransaction({ to: target, value: amount });
  await tx.wait();
  console.log(`Sent 10 ETH to ${target}`);
  console.log(`Tx: ${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
