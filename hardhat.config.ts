import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-viem";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    evmFlowTestnet: {
      url: "https://testnet.evm.nodes.onflow.org",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      chainId: 545,
    },
    evmFlowMainnet: {
      url: "https://mainnet.evm.nodes.onflow.org",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      chainId: 747,
    },
  },
  solidity: "0.8.28",
  etherscan: {
    apiKey: {
      evmFlowTestnet: "any", // Flow doesn't require an API key
      evmFlowMainnet: "any",
    },
    customChains: [
      {
        network: "evmFlowTestnet",
        chainId: 545,
        urls: {
          apiURL: "https://evm-testnet.flowscan.io/api",
          browserURL: "https://evm-testnet.flowscan.io",
        },
      },
      {
        network: "evmFlowMainnet",
        chainId: 747,
        urls: {
          apiURL: "https://evm.flowscan.io/api",
          browserURL: "https://evm.flowscan.io"
        },
      },
    ],
  },
  sourcify: {
    enabled: true
  }
};

export default config;