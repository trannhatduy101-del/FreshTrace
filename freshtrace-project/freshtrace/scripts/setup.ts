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

async function main() {
  const [deployer] = await ethers.getSigners();
  // Wallet to grant participant roles to. Defaults to the deployer so a fresh
  // clone "just works" — set WALLET_ADDRESS in .env to grant a different wallet.
  const TARGET = process.env.WALLET_ADDRESS || deployer.address;

  console.log("Deploying with:", deployer.address);
  console.log("Granting roles to:", TARGET);
  console.log("Network:", network.name);

  const FreshTrace = await ethers.getContractFactory("FreshTrace");
  const contract = await FreshTrace.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("Deployed to:", address);

  const roles = ["PRODUCER_ROLE", "LOGISTICS_ROLE", "RETAILER_ROLE", "AUDITOR_ROLE"];
  for (const name of roles) {
    const hash = await (contract as any)[name]();
    await contract.grantRole(hash, TARGET);
    // Also grant to deployer if different — convenient for testing
    if (TARGET.toLowerCase() !== deployer.address.toLowerCase()) {
      await contract.grantRole(hash, deployer.address);
    }
    console.log(`Granted ${name}`);
  }

  const chainId = CHAIN_IDS[network.name] ?? 0;
  fs.writeFileSync(
    "deployments.json",
    JSON.stringify({ address, network: network.name, chainId }, null, 2)
  );

  // Auto-update frontend .env — works from any clone location
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
    console.log("Frontend .env not found — set VITE_CONTRACT_ADDRESS manually:", address);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
