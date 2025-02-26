// Import the ABI from the JSON file
import MyNFTJson from './MyNFT.json';

// Export the ABI as a const
export const MyNFTAbi = MyNFTJson.abi as const;

// Add type declarations for the ABI
declare module './MyNFT.json' {
  const value: {
    abi: typeof MyNFTAbi;
    bytecode: string;
  };
  export default value;
} 