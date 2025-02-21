import { createPublicClient, createWalletClient, custom, http, parseEther } from 'viem';
import { evmFlowMainnet } from './chains';
import { NFTMetadata, createMetadata } from './types';
import { MyNFTAbi } from './abi';

declare global {
  interface Window {
    ethereum: any;
  }
}

let currentAccount: string | undefined;
let walletClient: ReturnType<typeof createWalletClient>;
let publicClient: ReturnType<typeof createPublicClient>;

async function initClients() {
  publicClient = createPublicClient({
    chain: evmFlowMainnet,
    transport: http()
  });

  walletClient = createWalletClient({
    chain: evmFlowMainnet,
    transport: custom(window.ethereum)
  });
}

async function connectWallet() {
  if (!window.ethereum) {
    updateStatus('Please install MetaMask!', 'error');
    return;
  }

  try {
    const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentAccount = account;
    updateStatus(`Connected: ${account}`, 'success');
    document.getElementById('deployForm')?.classList.remove('hidden');
    return account;
  } catch (error) {
    updateStatus('Failed to connect wallet: ' + error.message, 'error');
  }
}

async function deployContract(name: string, symbol: string) {
  if (!currentAccount) {
    updateStatus('Please connect your wallet first', 'error');
    return;
  }

  try {
    updateStatus('Deploying contract...', 'info');
    
    const hash = await walletClient.deployContract({
      abi: MyNFTAbi,
      account: currentAccount as `0x${string}`,
      args: [name, symbol, currentAccount],
      bytecode: '0x...' // You'll need to get this from your contract compilation
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const contractAddress = receipt.contractAddress;
    
    updateStatus(`Contract deployed at: ${contractAddress}`, 'success');
    
    // Store the contract address
    localStorage.setItem('nftContract', contractAddress);
    document.getElementById('mintForm')?.classList.remove('hidden');
    
    return contractAddress;
  } catch (error) {
    updateStatus('Failed to deploy contract: ' + error.message, 'error');
  }
}

async function mintNFT(name: string, description: string, imageUrl: string) {
  if (!currentAccount) {
    updateStatus('Please connect your wallet first', 'error');
    return;
  }

  const contractAddress = localStorage.getItem('nftContract');
  if (!contractAddress) {
    updateStatus('Please deploy a contract first', 'error');
    return;
  }

  try {
    updateStatus('Creating metadata...', 'info');
    const tokenURI = createMetadata(name, description, imageUrl);
    
    updateStatus('Minting NFT...', 'info');
    const hash = await walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: MyNFTAbi,
      functionName: 'mint',
      args: [tokenURI]
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    // Find the Transfer event to get the token ID
    const transferEvent = receipt.logs.find(log => 
      log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    if (transferEvent && transferEvent.topics[3]) {
      const tokenId = parseInt(transferEvent.topics[3], 16);
      updateStatus(`NFT minted! Token ID: ${tokenId}`, 'success');
    }
  } catch (error) {
    updateStatus('Failed to mint NFT: ' + error.message, 'error');
  }
}

function updateStatus(message: string, type: 'success' | 'error' | 'info') {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.className = type;
    statusDiv.textContent = message;
  }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  await initClients();

  // Connect wallet button
  document.getElementById('connectWallet')?.addEventListener('click', connectWallet);

  // Deploy form
  document.getElementById('deployForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('contractName') as HTMLInputElement).value;
    const symbol = (form.elements.namedItem('contractSymbol') as HTMLInputElement).value;
    await deployContract(name, symbol);
  });

  // Mint form
  document.getElementById('mintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
    const imageUrl = (form.elements.namedItem('imageUrl') as HTMLInputElement).value;
    await mintNFT(name, description, imageUrl);
  });
}); 