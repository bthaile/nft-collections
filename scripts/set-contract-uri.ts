import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

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

  // The collection metadata URI
  const collectionURI = "https://raw.githubusercontent.com/bthaile/nft-collections/refs/heads/main/metadata/VolcanicWonder.json";

  console.log('\nSetting Contract URI for:', NFT_CONTRACT_ADDRESS);
  console.log('New URI:', collectionURI);

  try {
    const hash = await nftContract.write.setContractURI([collectionURI]);
    console.log('\nTransaction hash:', hash);
    
    // Verify the update
    const newURI = await nftContract.read.contractURI();
    console.log('\nUpdated Contract URI:', newURI);
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