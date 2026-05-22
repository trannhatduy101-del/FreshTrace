// One-off: grant the four participant roles to the deployer/admin wallet
// on an already deployed contract. Use when you want one wallet to test
// the full flow without switching MetaMask accounts.
//
// Reads CONTRACT_ADDRESS from .env; targets the running signer (deployer).
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("Set CONTRACT_ADDRESS in .env");
    process.exitCode = 1;
    return;
  }

  const contract = await ethers.getContractAt("FreshTrace", contractAddress, deployer);
  console.log("Contract:    ", contractAddress);
  console.log("Granting to: ", deployer.address);

  const roles = ["PRODUCER_ROLE", "LOGISTICS_ROLE", "RETAILER_ROLE", "AUDITOR_ROLE"];
  for (const name of roles) {
    const hash = await (contract as any)[name]();
    const has = await contract.hasRole(hash, deployer.address);
    if (has) {
      console.log(`Already has  ${name}`);
      continue;
    }
    const tx = await contract.grantRole(hash, deployer.address);
    await tx.wait();
    console.log(`Granted      ${name} (tx ${tx.hash})`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
