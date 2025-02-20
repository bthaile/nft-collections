import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";
import fetch from "node-fetch";

async function getDeployedAddress(): Promise<string> {
  const network = hre.network.name;
  const addresses = JSON.parse(
    readFileSync(join(__dirname, "../deployed-addresses.json"), "utf-8")
  );
  return addresses[network].MyNFT;
}

async function main() {
  const NFT_CONTRACT_ADDRESS = await getDeployedAddress();
  const nftContract = await hre.viem.getContractAt("MyNFT", NFT_CONTRACT_ADDRESS as `0x${string}`);

  console.log('\nChecking NFT Contract:', NFT_CONTRACT_ADDRESS);

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

    // Check first few tokens
    for (let i = 0; i < 3; i++) {
      try {
        const tokenURI = await nftContract.read.tokenURI([BigInt(i)]);
        console.log(`\nToken #${i} URI:`, tokenURI);

        const tokenResponse = await fetch(tokenURI as string);
        if (!tokenResponse.ok) {
          throw new Error(`HTTP error! status: ${tokenResponse.status}`);
        }
        const tokenMetadata = await tokenResponse.json();
        console.log(`Token #${i} Metadata:`, JSON.stringify(tokenMetadata, null, 2));

        if (tokenMetadata.image) {
          const imageResponse = await fetch(tokenMetadata.image);
          console.log(`Token #${i} Image Accessible:`, imageResponse.ok);
        }
      } catch (error) {
        console.log(`\nToken #${i} not found or error:`, error);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 