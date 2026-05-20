import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    // Local Hardhat node for development and testing
    hardhat: {},
    // Polygon Amoy testnet for staging deployments
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "",
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
