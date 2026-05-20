import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// Local Hardhat helper: send test ETH to a wallet (e.g. your MetaMask).
// Target wallet defaults to WALLET_ADDRESS env var; pass --target as fallback.
async function main() {
  const [deployer] = await ethers.getSigners();
  const target = process.env.WALLET_ADDRESS;
  if (!target) {
    console.error("Set WALLET_ADDRESS in .env to fund your MetaMask wallet.");
    process.exitCode = 1;
    return;
  }
  const amount = ethers.parseEther("10");

  const tx = await deployer.sendTransaction({ to: target, value: amount });
  await tx.wait();
  console.log(`Sent 10 ETH to ${target}`);
  console.log(`Tx: ${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
