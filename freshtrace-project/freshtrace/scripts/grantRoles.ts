import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS!;
  const targetAddress = "0x7ceCf067854Ca5DA065DcFDF57dDA4056B2c5984";

  const contract = await ethers.getContractAt("FreshTrace", contractAddress, deployer);

  const roles = ["PRODUCER_ROLE", "LOGISTICS_ROLE", "RETAILER_ROLE", "AUDITOR_ROLE"];
  for (const roleName of roles) {
    const roleHash = await (contract as any)[roleName]();
    await contract.grantRole(roleHash, targetAddress);
    console.log(`Granted ${roleName} to ${targetAddress}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
