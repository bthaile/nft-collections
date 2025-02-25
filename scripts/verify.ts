import { readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const network = process.env.NETWORK || "evmFlowTestnet";
  const symbol = process.env.SYMBOL;
  
  if (!symbol) {
    console.error("Error: Please set SYMBOL in your environment");
    process.exit(1);
  }
  
  const addresses = JSON.parse(
    readFileSync(join(__dirname, "../deployed-addresses.json"), "utf-8")
  );
  
  // Find the deployment with the matching symbol
  const deployment = addresses[network]?.MyNFT?.history.find(
    (d: any) => d.tag === symbol
  );
  
  if (!deployment) {
    console.error(`Error: No deployment found for symbol ${symbol} on network ${network}`);
    process.exit(1);
  }
  
  const contractAddress = deployment.address;
  const deployerAddress = deployment.deployer;

  if (!deployerAddress) {
    console.error("Error: No deployer address found for this contract");
    process.exit(1);
  }

  console.log(`Verifying contract ${symbol} at ${contractAddress}`);
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployerAddress}`);

  const command = `pnpm hardhat verify --network ${network} ${contractAddress} ${deployerAddress}`;
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 