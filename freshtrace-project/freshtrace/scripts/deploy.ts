import { ethers } from "hardhat";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying FreshTrace with account:", deployer.address);

  // Deploy the contract
  const FreshTrace = await ethers.getContractFactory("FreshTrace");
  const freshTrace = await FreshTrace.deploy();
  await freshTrace.waitForDeployment();

  const contractAddress = await freshTrace.getAddress();
  console.log("FreshTrace deployed to:", contractAddress);

  // Grant roles to test wallets from .env
  const roles = [
    { name: "PRODUCER_ROLE", address: process.env.TEST_PRODUCER },
    { name: "LOGISTICS_ROLE", address: process.env.TEST_LOGISTICS },
    { name: "RETAILER_ROLE", address: process.env.TEST_RETAILER },
    { name: "AUDITOR_ROLE", address: process.env.TEST_AUDITOR },
  ];

  for (const role of roles) {
    if (role.address) {
      const roleHash = await freshTrace[role.name as keyof typeof freshTrace]();
      await freshTrace.grantRole(roleHash as string, role.address);
      console.log(`Granted ${role.name} to ${role.address}`);
    } else {
      console.log(`Skipping ${role.name} — address not set in .env`);
    }
  }

  // Write deployments.json for frontend integration
  const network = await ethers.provider.getNetwork();
  const deploymentBlock = await ethers.provider.getBlockNumber();

  const deployment = {
    address: contractAddress,
    network: "amoy",
    chainId: Number(network.chainId),
    deployer: deployer.address,
    blockNumber: deploymentBlock,
    abi_path: "artifacts/contracts/FreshTrace.sol/FreshTrace.json",
  };

  fs.writeFileSync("deployments.json", JSON.stringify(deployment, null, 2));
  console.log("Saved deployments.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
