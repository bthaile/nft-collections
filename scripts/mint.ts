import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeploymentByTag } from "./deploy";

task("mint", "Mint a new NFT")
  .addParam("symbol", "Token symbol")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const symbol = taskArgs.symbol.toUpperCase();
    
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

    console.log(`Minting NFT for contract ${symbol} at ${deployment.address}`);
    console.log("Using URI:", tokenURI);

    const tx = await nftContract.write.mint([tokenURI]);
    console.log("Transaction hash:", tx);
}); 