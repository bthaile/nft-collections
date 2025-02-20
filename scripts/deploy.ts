// scripts/deploy.ts
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { task, types } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

interface DeploymentRecord {
  address: string;
  timestamp: number;
  deployer: string;
  tag?: string;  // Optional tag for the deployment
}

interface NetworkDeployments {
  MyNFT: {
    latest: string;
    history: DeploymentRecord[];
  };
}

interface DeploymentAddresses {
  [network: string]: NetworkDeployments;
}

async function saveDeployedAddress(
  address: string, 
  deployerAddress: string, 
  tag: string,
  network: string  // Add network parameter
) {
  const filePath = join(__dirname, "../deployed-addresses.json");
  
  let addresses: DeploymentAddresses = {};
  try {
    addresses = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
  }

  // Initialize network object if it doesn't exist
  if (!addresses[network]) {
    addresses[network] = {
      MyNFT: {
        latest: "",
        history: []
      }
    };
  }

  // Create new deployment record
  const deploymentRecord: DeploymentRecord = {
    address,
    timestamp: Date.now(),
    deployer: deployerAddress,
    tag: tag || `deploy-${new Date().toISOString()}`  // Default tag if none provided
  };

  // Update the network deployments
  addresses[network].MyNFT.latest = address;
  addresses[network].MyNFT.history = [
    ...addresses[network].MyNFT.history || [],
    deploymentRecord
  ];

  writeFileSync(filePath, JSON.stringify(addresses, null, 2));
}

task("deploy", "Deploy the NFT contract")
  .addParam("symbol", "Token symbol", "MNFT")
  .addParam("name", "Token name", "MyNFT")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const name = taskArgs.name;
    const symbol = taskArgs.symbol.toUpperCase();
    
    const [deployer] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    
    console.log("Deploying contracts with the account:", deployer.account.address);
    console.log("NFT Name:", name);
    console.log("NFT Symbol:", symbol);
    const balance = await publicClient.getBalance({ address: deployer.account.address });
    console.log("Account balance:", balance.toString());

    const nftContract = await hre.viem.deployContract("MyNFT", [
      name,
      symbol,
      deployer.account.address
    ]);
    console.log("NFT Contract deployed to:", nftContract.address);
    
    await saveDeployedAddress(nftContract.address, deployer.account.address, symbol, hre.network.name);
});

task("get-deployment", "Get contract address for a symbol")
  .addParam("symbol", "Token symbol")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const deployment = getDeploymentByTag(hre.network.name, taskArgs.symbol.toUpperCase());
    if (!deployment) {
      throw new Error(`No deployment found for symbol ${taskArgs.symbol}`);
    }
    console.log(deployment.address);
    return deployment.address;
  });

task("verify-contract", "Verify contract for a given symbol")
  .addParam("symbol", "Token symbol")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const symbol = taskArgs.symbol.toUpperCase();
    const deployment = getDeploymentByTag(hre.network.name, symbol);
    if (!deployment) {
      throw new Error(`No deployment found for symbol ${symbol}`);
    }

    console.log(`Verifying contract ${symbol} at ${deployment.address}`);
    await hre.run("verify:verify", {
      address: deployment.address,
      constructorArguments: [
        symbol,  // name same as symbol for simplicity
        symbol,  // symbol
        deployment.deployer // owner address
      ],
    });
  });

task("set-uri", "Set contract URI")
  .addParam("symbol", "Token symbol")
  .addParam("uri", "Contract URI")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const symbol = taskArgs.symbol.toUpperCase();
    const deployment = getDeploymentByTag(hre.network.name, symbol);
    if (!deployment) {
      throw new Error(`No deployment found for symbol ${symbol}`);
    }

    const nftContract = await hre.viem.getContractAt("MyNFT", deployment.address as `0x${string}`);
    
    console.log(`Setting URI for contract ${symbol} at ${deployment.address}`);
    const tx = await nftContract.write.setContractURI([taskArgs.uri]);
    console.log("Transaction hash:", tx);
  });

export function getDeploymentByTag(network: string, tag: string): DeploymentRecord | undefined {
  const filePath = join(__dirname, "../deployed-addresses.json");
  const addresses: DeploymentAddresses = JSON.parse(readFileSync(filePath, "utf-8"));
  
  return addresses[network]?.MyNFT.history.find(
    (deployment) => deployment.tag === tag
  );
}

export function getLatestDeployment(network: string): DeploymentRecord | undefined {
  const filePath = join(__dirname, "../deployed-addresses.json");
  const addresses: DeploymentAddresses = JSON.parse(readFileSync(filePath, "utf-8"));
  
  const history = addresses[network]?.MyNFT.history;
  return history?.[history.length - 1];
}