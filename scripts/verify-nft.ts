import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";
import { getDeploymentByTag } from "./deploy";

async function getDeployedAddressBySymbol(symbol: string): Promise<string> {
  const network = hre.network.name;
  const deployment = getDeploymentByTag(network, symbol);
  if (!deployment) {
    throw new Error(`No deployment found for symbol ${symbol}`);
  }
  return deployment.address as `0x${string}`;
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
  // Get symbol from command line arguments
  const symbol = process.argv.find((arg) => arg.startsWith("--symbol="))?.split("=")[1];
  if (!symbol) {
    throw new Error("Please provide a symbol with --symbol=SYMBOL");
  }

  const NFT_CONTRACT_ADDRESS = await getDeployedAddressBySymbol(symbol);
  const nftContract = await hre.viem.getContractAt("MyNFT", NFT_CONTRACT_ADDRESS as `0x${string}`);

  console.log(`\nVerifying NFT contract with symbol ${symbol} at ${NFT_CONTRACT_ADDRESS}`);

  // Check first NFT (ID 0)
  const uri = await nftContract.read.tokenURI([0n]) as string;
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
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log('- Image Accessibility: ✗');
      console.log('  Error accessing image:', error.message);
    } else {
      console.log('- Image Accessibility: ✗');
      console.log('  Error accessing image:', String(error));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  }); 