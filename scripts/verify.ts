import { readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const network = process.env.NETWORK || "evmFlowTestnet";
  const addresses = JSON.parse(
    readFileSync(join(__dirname, "../deployed-addresses.json"), "utf-8")
  );
  
  const contractAddress = addresses[network].MyNFT;
  const accountAddress = process.env.ACCT_ADDRESS;

  if (!accountAddress) {
    throw new Error("Please set ACCT_ADDRESS in your environment");
  }

  const command = `pnpm hardhat verify --network ${network} ${contractAddress} ${accountAddress}`;
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 