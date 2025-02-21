import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeploymentByTag } from "./deploy";

task("batch-transfer", "Transfer multiple NFTs to an address")
  .addParam("symbol", "Token symbol")
  .addParam("to", "Destination address")
  .addParam("start", "Starting token ID")
  .addParam("count", "Number of tokens to transfer")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const symbol = taskArgs.symbol.toUpperCase();
    const toAddress = taskArgs.to as `0x${string}`;
    const startId = parseInt(taskArgs.start);
    const count = parseInt(taskArgs.count);

    const deployment = getDeploymentByTag(hre.network.name, symbol);
    if (!deployment) {
      throw new Error(`No deployment found for symbol ${symbol}`);
    }

    const nftContract = await hre.viem.getContractAt("MyNFT", deployment.address as `0x${string}`);
    
    console.log(`Transferring ${count} NFTs starting from ID ${startId} to ${toAddress}`);

    for (let i = 0; i < count; i++) {
      const tokenId = startId + i;
      try {
        const tx = await nftContract.write.transferFrom([
          deployment.deployer,
          toAddress,
          BigInt(tokenId)
        ]);
        console.log(`Transferring NFT #${tokenId}...`);
        
        const publicClient = await hre.viem.getPublicClient();
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log(`NFT #${tokenId} transferred!`);
      } catch (error) {
        console.error(`Failed to transfer NFT #${tokenId}:`, error);
      }
    }
  }); 