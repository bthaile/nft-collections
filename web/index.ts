import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { evmFlowMainnet, evmFlowTestnet } from './chains';
import { NFTMetadata, createMetadata } from './types';
import MyNFTArtifact from '../artifacts/contracts/nft-contract.sol/MyNFT.json';
import deployedAddresses from '../deployed-addresses.json';

interface CollectionMetadata {
  name: string;
  description: string;
  image: string;
  external_link?: string;
}

const MyNFTAbi = MyNFTArtifact.abi;

declare global {
  interface Window {
    ethereum: any;
  }
}

let currentAccount: string | undefined;
let currentNetwork: string | undefined;
let walletClient: ReturnType<typeof createWalletClient>;
let publicClient: ReturnType<typeof createPublicClient>;

const CHAIN_ID_TO_NETWORK = {
  '0x2eb': 'evmFlowMainnet', // 747
  '0x221': 'evmFlowTestnet'  // 545
};

async function fetchCollectionMetadata(contractAddress: string): Promise<CollectionMetadata | null> {
  try {
    // First verify the contract exists
    const code = await publicClient.getBytecode({
      address: contractAddress as `0x${string}`
    });
    
    if (!code) {
      throw new Error(`No contract found at address ${contractAddress}`);
    }

    const uri = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: MyNFTAbi,
      functionName: 'contractURI',
      args: []
    });
    
    if (!uri || typeof uri !== 'string') {
      console.warn(`Contract URI not set for ${contractAddress}`);
      return {
        name: "NFT Collection",
        description: "Collection metadata not yet set",
        image: "https://placehold.co/600x400?text=Pending",
      };
    }

    const response = await fetch(uri);
    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.error('Error fetching collection metadata:', error);
    return null;
  }
}

async function updateCollectionDetails(contractAddress: string) {
  const collectionDetails = document.getElementById('collectionDetails');
  if (!collectionDetails) return;

  const metadata = await fetchCollectionMetadata(contractAddress);
  if (!metadata) {
    collectionDetails.innerHTML = '<p>No collection details available</p>';
    return;
  }

  collectionDetails.innerHTML = `
    <div class="flex flex-col gap-3">
      <img src="${metadata.image}" alt="${metadata.name}" 
        class="w-full h-40 object-cover rounded-lg shadow-sm">
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">${metadata.name}</h3>
        <p class="text-sm text-gray-600 leading-relaxed mb-3">${metadata.description}</p>
        ${metadata.external_link ? 
          `<a href="${metadata.external_link}" target="_blank" 
            class="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            View Collection
            <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>` 
          : ''}
      </div>
    </div>
  `;
}

async function loadContracts() {
  const select = document.getElementById('contractSelect') as HTMLSelectElement;
  select.innerHTML = ''; // Clear existing options

  if (!currentNetwork) return;

  const networkDeployments = deployedAddresses[currentNetwork];
  if (networkDeployments?.MyNFT?.history) {
    networkDeployments.MyNFT.history.forEach(deployment => {
      if (deployment.tag) {
        const option = document.createElement('option');
        option.value = deployment.tag;
        option.textContent = `${deployment.tag} (${deployment.address.slice(0,6)}...${deployment.address.slice(-4)})`;
        select.appendChild(option);
      }
    });
    
    // Update collection details when a contract is selected
    select.addEventListener('change', (e) => {
      const selectedTag = (e.target as HTMLSelectElement).value;
      const deployment = networkDeployments.MyNFT.history.find(d => d.tag === selectedTag);
      if (deployment) {
        updateCollectionDetails(deployment.address);
      }
    });

    // Show initial collection details
    if (networkDeployments.MyNFT.history.length > 0) {
      updateCollectionDetails(networkDeployments.MyNFT.history[0].address);
    }
  }
}

async function initClients(chainId: string) {
  const networkName = CHAIN_ID_TO_NETWORK[chainId as keyof typeof CHAIN_ID_TO_NETWORK];
  if (!networkName) {
    throw new Error('Unsupported network');
  }

  const chain = networkName === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet;

  publicClient = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.public.http[0])
  });

  walletClient = createWalletClient({
    chain,
    account: currentAccount as `0x${string}`,
    transport: custom(window.ethereum)
  });

  // Listen for network changes
  window.ethereum.on('chainChanged', handleNetworkChange);
}

async function handleNetworkChange(chainId: string) {
  const networkName = CHAIN_ID_TO_NETWORK[chainId as keyof typeof CHAIN_ID_TO_NETWORK];
  if (!networkName) {
    updateStatus('Please connect to Flow EVM Mainnet or Testnet', 'error');
    return;
  }
  currentNetwork = networkName;
  await initClients(chainId);
  updateNetworkDisplay();
  await loadContracts();
}

function updateNetworkDisplay() {
  const networkDiv = document.getElementById('network');
  if (networkDiv && currentNetwork) {
    const displayName = currentNetwork === 'evmFlowMainnet' ? 'Flow EVM Mainnet' : 'Flow EVM Testnet';
    networkDiv.textContent = `Network: ${displayName}`;
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    updateStatus('Please install MetaMask!', 'error');
    return;
  }

  try {
    // Get chain ID first
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    // Initialize clients with current chain
    await initClients(chainId);

    // Then request accounts
    const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentAccount = account;
    await handleNetworkChange(chainId);
    updateStatus(`Connected: ${account}`, 'success');
    document.getElementById('mintForm')?.classList.remove('hidden');
    return account;
  } catch (error) {
    console.error('Wallet connection error:', error);
    updateStatus('Failed to connect wallet: ' + error.message, 'error');
  }
}

async function mintNFT(name: string, description: string, imageUrl: string) {
  if (!currentAccount) {
    updateStatus('Please connect your wallet first', 'error');
    return;
  }

  const select = document.getElementById('contractSelect') as HTMLSelectElement;
  const contractSymbol = select.value;
  const contract = deployedAddresses[currentNetwork!]?.MyNFT?.history.find(
    d => d.tag === contractSymbol
  );

  if (!contract) {
    updateStatus('Please select a valid contract', 'error');
    return;
  }

  try {
    const tokenURI = createMetadata(name, description, imageUrl);
    
    updateStatus('Minting NFT...', 'info');
    const tx = await walletClient.writeContract({
      address: contract.address as `0x${string}`,
      abi: MyNFTAbi,
      functionName: 'mint',
      args: [tokenURI]
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    updateStatus('NFT minted successfully!', 'success');
  } catch (error) {
    updateStatus('Failed to mint NFT: ' + error.message, 'error');
  }
}

function updateStatus(message: string, type: 'success' | 'error' | 'info') {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.className = `fixed bottom-6 right-6 max-w-md p-4 rounded-lg shadow-lg ${
      type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
      type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
      'bg-blue-50 text-blue-800 border border-blue-200'
    }`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 5000);
  }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (window.ethereum) {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      await initClients(chainId);
    }
  } catch (error) {
    console.error('Initial chain setup error:', error);
  }

  // Connect wallet button
  document.getElementById('connectWallet')?.addEventListener('click', connectWallet);

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