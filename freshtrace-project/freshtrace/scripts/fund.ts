import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const target = "0x7ceCf067854Ca5DA065DcFDF57dDA4056B2c5984";
  const amount = ethers.parseEther("10");

  const tx = await deployer.sendTransaction({ to: target, value: amount });
  await tx.wait();
  console.log(`Sent 10 ETH to ${target}`);
  console.log(`Tx: ${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
