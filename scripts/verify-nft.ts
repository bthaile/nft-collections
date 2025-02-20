import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

async function getDeployedAddress(): Promise<string> {
  const network = hre.network.name;
  const addresses = JSON.parse(
    readFileSync(join(__dirname, "../deployed-addresses.json"), "utf-8")
  );
  return addresses[network].MyNFT as `0x${string}`;
}

interface NFTMetadata {
  title: string;
  type: string;
  properties: {
    name: { type: string; value: string; };
    description: { type: string; value: string; };
    image: { type: string; value: string; };
  };
}

async function main() {
  const NFT_CONTRACT_ADDRESS = await getDeployedAddress();
  const nftContract = await hre.viem.getContractAt("MyNFT", NFT_CONTRACT_ADDRESS as `0x${string}`);

  // Check first NFT (ID 0)
  const uri = await nftContract.read.tokenURI([0n]);
  console.log('\nRaw Token URI:', uri);
  
  // Decode base64 metadata
  const json = atob(uri.split(',')[1]);
  const metadata = JSON.parse(json) as NFTMetadata;
  console.log('\nDecoded Metadata:', JSON.stringify(metadata, null, 2));

  // Verify metadata format
  console.log('\nMetadata Format Check:');
  console.log('- Title:', metadata.title === "Asset Metadata" ? '✓' : '✗');
  console.log('- Type:', metadata.type === "object" ? '✓' : '✗');
  console.log('- Name:', metadata.properties.name?.value ? '✓' : '✗');
  console.log('- Description:', metadata.properties.description?.value ? '✓' : '✗');
  console.log('- Image:', metadata.properties.image?.value ? '✓' : '✗');
  
  // Try to fetch the image
  try {
    const response = await fetch(metadata.properties.image.value);
    console.log('- Image Accessibility:', response.ok ? '✓' : '✗');
    if (!response.ok) {
      console.log('  Image URL might be inaccessible:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('- Image Accessibility: ✗');
    console.log('  Error accessing image:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 