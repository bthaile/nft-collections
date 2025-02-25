import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeploymentByTag } from "./deploy";
import fetch from "node-fetch";

task("verify-metadata", "Verify contract and NFT metadata")
  .addParam("symbol", "Token symbol")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const symbol = taskArgs.symbol.toUpperCase();
    const deployment = getDeploymentByTag(hre.network.name, symbol);
    if (!deployment) {
      throw new Error(`No deployment found for symbol ${symbol}`);
    }

    const nftContract = await hre.viem.getContractAt("MyNFT", deployment.address as `0x${string}`);
    console.log('\nChecking NFT Contract:', deployment.address);

    try {
      // Check contractURI
      const contractURI = await nftContract.read.contractURI();
      console.log('\nContract URI:', contractURI);

      // Fetch and verify collection metadata
      const response = await fetch(contractURI as string);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      try {
        const collectionMetadata = JSON.parse(text);
        console.log('\nCollection Metadata:', JSON.stringify(collectionMetadata, null, 2));
      } catch (e) {
        console.error('Invalid JSON in collection metadata. Raw response:', text);
        throw e;
      }

    } catch (error) {
      console.error('Error:', error);
    }
  }); 