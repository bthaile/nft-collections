// scripts/deploy.ts
import hre from "hardhat";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

async function saveDeployedAddress(address: string) {
  const network = hre.network.name;
  const filePath = join(__dirname, "../deployed-addresses.json");
  
  let addresses = {};
  try {
    addresses = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
  }

  addresses[network] = {
    ...addresses[network],
    MyNFT: address,
  };

  writeFileSync(filePath, JSON.stringify(addresses, null, 2));
}

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  console.log("Deploying contracts with the account:", deployer.account.address);
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log("Account balance:", balance.toString());

  // Deploy contract
  const nftContract = await hre.viem.deployContract("MyNFT", [deployer.account.address]);
  console.log("NFT Contract deployed to:", nftContract.address);
  
  await saveDeployedAddress(nftContract.address);
}

// Execute the main function and catch errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });