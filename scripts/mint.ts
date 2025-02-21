import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeploymentByTag } from "./deploy";

task("mint", "Mint new NFTs")
  .addParam("symbol", "Token symbol")
  .addOptionalParam("count", "Number of NFTs to mint", "1")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const symbol = taskArgs.symbol.toUpperCase();
    const count = parseInt(taskArgs.count);
    
    if (isNaN(count) || count < 1) {
      throw new Error("Count must be a positive number");
    }

    const network = hre.network.name;
    const deployment = getDeploymentByTag(network, symbol);
    if (!deployment) {
      throw new Error(`No deployment found for symbol ${symbol}`);
    }

    const nftContract = await hre.viem.getContractAt("MyNFT", deployment.address as `0x${string}`);
    
    const tokenURI = await nftContract.read.contractURI();
    if (!tokenURI) {
      throw new Error("Contract URI not set");
    }

    console.log(`Minting ${count} NFTs for contract ${symbol} at ${deployment.address}`);
    console.log("Using URI:", tokenURI);

    for (let i = 0; i < count; i++) {
      try {
        const tx = await nftContract.write.mint([tokenURI]);
        console.log(`\nMinting NFT ${i + 1}/${count}`);
        console.log("Transaction hash:", tx);

        // Wait for transaction and get receipt
        const publicClient = await hre.viem.getPublicClient();
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

        // Find Transfer event
        const transferEvent = receipt.logs.find(log => 
          log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event topic
        );

        if (transferEvent && transferEvent.topics[3]) {
          const tokenId = parseInt(transferEvent.topics[3], 16);
          console.log("Minted token ID:", tokenId);
        }
      } catch (error) {
        console.error(`Error minting NFT ${i + 1}:`, error);
        break;
      }
    }
  }); 