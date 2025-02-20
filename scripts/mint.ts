import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: any[];
}

interface DeployedAddresses {
  [network: string]: {
    MyNFT: string;
  };
}

async function getDeployedAddress(): Promise<string> {
  const network = hre.network.name;
  const addresses = JSON.parse(
    readFileSync(join(__dirname, "../deployed-addresses.json"), "utf-8")
  );
  return addresses[network].MyNFT;
}

async function main() {
  // Get count from command line args, default to 3
  const count = parseInt(process.argv[2] || "3");
  if (isNaN(count) || count < 1) {
    throw new Error("Please provide a valid number of NFTs to mint");
  }

  const NFT_CONTRACT_ADDRESS = await getDeployedAddress();
  const nftContract = await hre.viem.getContractAt("MyNFT", NFT_CONTRACT_ADDRESS as `0x${string}`);
  const publicClient = await hre.viem.getPublicClient();

  // Use the Gist URL for all NFTs
  const tokenURI = "https://gist.githubusercontent.com/bthaile/aaa6a6bc4e14a71b56031aa1633832ec/raw/23394baa632479e8c7260d530f2d0bfa577ba8b6/nft.json";

  console.log(`Minting ${count} NFTs...`);

  // Mint specified number of NFTs
  for (let i = 0; i < count; i++) {
    try {
      const hash = await nftContract.write.mint([tokenURI]);
      console.log(`Minted NFT ${i + 1}/${count}. Transaction hash: ${hash}`);
      
      // Wait for transaction with longer timeout and retries
      await publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 60_000, // 1 minute
        retryCount: 3
      });
      
      console.log(`NFT ${i + 1} confirmed!`);
    } catch (error) {
      console.error(`Failed to mint NFT ${i + 1}:`, error);
      // Wait a bit before trying the next mint
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 