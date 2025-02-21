import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeploymentByTag } from "./deploy";

task("transfer", "Transfer NFTs to an address")
  .addParam("symbol", "Token symbol")
  .addParam("to", "Destination address")
  .addParam("tokenid", "Token ID to transfer")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const symbol = taskArgs.symbol.toUpperCase();
    const toAddress = taskArgs.to as `0x${string}`;
    const tokenId = BigInt(taskArgs.tokenid);

    const network = hre.network.name;
    const deployment = getDeploymentByTag(network, symbol);
    if (!deployment) {
      throw new Error(`No deployment found for symbol ${symbol}`);
    }

    const nftContract = await hre.viem.getContractAt("MyNFT", deployment.address as `0x${string}`);
    
    console.log(`Transferring NFT #${tokenId} to ${toAddress}`);
    console.log(`Contract: ${symbol} at ${deployment.address}`);

    try {
      const tx = await nftContract.write.transferFrom([
        deployment.deployer,
        toAddress,
        tokenId
      ]);
      console.log("Transaction hash:", tx);

      // Wait for confirmation
      const publicClient = await hre.viem.getPublicClient();
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log("Transfer confirmed!");
    } catch (error) {
      console.error("Transfer failed:", error);
    }
  }); 