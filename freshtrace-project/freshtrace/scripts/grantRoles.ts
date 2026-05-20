import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const targetAddress = process.env.WALLET_ADDRESS;

  if (!contractAddress) {
    console.error("Set CONTRACT_ADDRESS in .env (the deployed contract).");
    process.exitCode = 1;
    return;
  }
  if (!targetAddress) {
    console.error("Set WALLET_ADDRESS in .env (the wallet to receive roles).");
    process.exitCode = 1;
    return;
  }

  const contract = await ethers.getContractAt("FreshTrace", contractAddress, deployer);

  const roles = ["PRODUCER_ROLE", "LOGISTICS_ROLE", "RETAILER_ROLE", "AUDITOR_ROLE"];
  for (const roleName of roles) {
    const roleHash = await (contract as any)[roleName]();
    await contract.grantRole(roleHash, targetAddress);
    console.log(`Granted ${roleName} to ${targetAddress}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
