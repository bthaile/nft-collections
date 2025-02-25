import { createPublicClient, createWalletClient, custom, http, decodeEventLog } from 'viem';
import { evmFlowMainnet, evmFlowTestnet } from './chains';
import { NFTMetadata, createMetadata } from './types';
import MyNFTArtifact from '../artifacts/contracts/nft-contract.sol/MyNFT.json';
import deployedAddresses from '../deployed-addresses.json';
import { fetchContractTransactions } from './transactions';

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

interface MintHistoryItem {
  tokenId: number;
  timestamp: Date;
  txHash: `0x${string}`;
  collection?: string;
}

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
        <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <span class="text-xs text-gray-500">Contract:</span>
          <code class="text-xs font-mono text-gray-700">${contractAddress}</code>
          <button onclick="navigator.clipboard.writeText('${contractAddress}').then(() => showToast('Address copied!', 'success'))" 
            class="ml-auto p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          </button>
        </div>
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
    select.addEventListener('change', async (e) => {
      const selectedTag = (e.target as HTMLSelectElement).value;
      const deployment = networkDeployments.MyNFT.history.find(d => d.tag === selectedTag);
      if (deployment) {
        // Update collection details
        updateCollectionDetails(deployment.address);
        
        // Prepopulate mint form
        const metadata = await fetchCollectionMetadata(deployment.address);
        if (metadata) {
          const uriInput = document.querySelector('#tokenUri') as HTMLInputElement;
          const uriPreview = document.querySelector('#uriPreview') as HTMLTextAreaElement;
          
          // Get contractURI
          const contractUri = await publicClient.readContract({
            address: deployment.address as `0x${string}`,
            abi: MyNFTAbi,
            functionName: 'contractURI',
            args: []
          });
          
          uriInput.value = contractUri as string;
          uriPreview.value = JSON.stringify(metadata, null, 2);
        }
      }
    });

    // Show initial collection details and prepopulate form for first collection
    if (networkDeployments.MyNFT.history.length > 0) {
      const firstDeployment = networkDeployments.MyNFT.history[0];
      updateCollectionDetails(firstDeployment.address);
      fetchCollectionMetadata(firstDeployment.address).then(async metadata => {
        if (metadata) {
          const uriInput = document.querySelector('#tokenUri') as HTMLInputElement;
          const uriPreview = document.querySelector('#uriPreview') as HTMLTextAreaElement;
          
          // Get contractURI
          const contractUri = await publicClient.readContract({
            address: firstDeployment.address as `0x${string}`,
            abi: MyNFTAbi,
            functionName: 'contractURI',
            args: []
          });
          
          uriInput.value = contractUri as string;
          uriPreview.value = JSON.stringify(metadata, null, 2);
        }
      });
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
  await updateMintHistory();
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
    await updateMintHistory();
    return account;
  } catch (error) {
    console.error('Wallet connection error:', error);
    updateStatus('Failed to connect wallet: ' + error.message, 'error');
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info') {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `max-w-sm p-4 rounded-lg shadow-lg transform transition-all duration-500 ${
    type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
    type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
    'bg-blue-50 text-blue-800 border border-blue-200'
  }`;
  toast.textContent = message;
  
  toastContainer?.appendChild(toast);
  
  // Fade out and remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}

async function mintNFT(tokenUri: string) {
  const mintButton = document.getElementById('mintButton');
  const mintSpinner = document.getElementById('mintSpinner');
  const mintText = mintButton?.querySelector('span');

  if (!currentAccount) {
    updateStatus('Please connect your wallet first', 'error');
    showToast('Please connect your wallet first', 'error');
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
    // Update button state
    if (mintButton) (mintButton as HTMLButtonElement).disabled = true;
    if (mintSpinner) mintSpinner.classList.remove('hidden');
    if (mintText) mintText.textContent = 'Minting...';

    updateStatus('Minting NFT...', 'info');
    showToast('Starting mint transaction...', 'info');

    const tx = await walletClient.writeContract({
      account: currentAccount as `0x${string}`,
      address: contract.address as `0x${string}`,
      abi: MyNFTAbi,
      functionName: 'mint',
      args: [tokenUri],
      chain: currentNetwork === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet
    });
    
    showToast('Transaction submitted, waiting for confirmation...', 'info');
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    
    // Get NFT ID from transaction logs
    const mintEvent = receipt.logs.find(log => {
      try {
        const event = decodeEventLog({
          abi: MyNFTAbi,
          data: log.data,
          topics: log.topics,
        }) as unknown as { eventName: string; args: { from: string; to: string; tokenId: bigint } };
        return event?.eventName === 'Transfer' && event?.args?.from === '0x0000000000000000000000000000000000000000';
      } catch {
        return false;
      }
    });
    
    if (mintEvent) {
      const tokenId = mintEvent.topics[3];
      if (!tokenId) return;
      const nftId = parseInt(tokenId, 16);
      showToast(`NFT #${nftId} minted successfully!`, 'success');
      
      // Add to MetaMask if available
      if (window.ethereum?.isMetaMask) {
        const watchAssetParams = {
          type: 'ERC721',
          options: {
            address: contract.address,
            tokenId: tokenId,
          },
        };
        
        try {
          await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: watchAssetParams,
          });
          showToast('NFT added to MetaMask!', 'success');
        } catch (error) {
          console.error('Error adding NFT to MetaMask:', error);
        }
      }
    }

    updateStatus('NFT minted successfully!', 'success');
    showToast('NFT minted successfully!', 'success');
    await updateMintHistory();
  } catch (error) {
    updateStatus('Failed to mint NFT: ' + error.message, 'error');
    showToast('Failed to mint NFT', 'error');
  } finally {
    // Reset button state
    if (mintButton) (mintButton as HTMLButtonElement).disabled = false;
    if (mintSpinner) mintSpinner.classList.add('hidden');
    if (mintText) mintText.textContent = 'Mint NFT';
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

async function fetchUserMintHistory(address: string, contractAddress: string) {
  console.log('Fetching mint history for:', { address, contractAddress });
  try {
    const logs = await publicClient.getLogs({
      address: contractAddress as `0x${string}`,
      event: {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { type: 'address', name: 'from', indexed: true },
          { type: 'address', name: 'to', indexed: true },
          { type: 'uint256', name: 'tokenId', indexed: true }
        ]
      },
      args: {
        from: '0x0000000000000000000000000000000000000000',
        to: address as `0x${string}`
      }
    });
    console.log('Found transfer logs:', logs);
    
    const mintsWithTimestamps = await Promise.all(
      logs.map(async log => {
        const block = await publicClient.getBlock({ blockHash: log.blockHash });
        console.log('Block data for log:', { blockHash: log.blockHash, block });
        return {
          tokenId: parseInt(log.topics[3], 16),
          timestamp: new Date(Number(block.timestamp) * 1000),
          txHash: log.transactionHash
        };
      })
    );
    
    console.log('Processed mints:', mintsWithTimestamps);
    return mintsWithTimestamps;
  } catch (error) {
    console.error('Error fetching mint history:', error);
    return [];
  }
}

async function updateMintHistory() {
  console.log('Updating mint history with account:', currentAccount, 'network:', currentNetwork);
  if (!currentAccount || !currentNetwork) return;

  const historyContainer = document.getElementById('mintHistory');
  if (!historyContainer) return;

  const networkDeployments = deployedAddresses[currentNetwork];
  console.log('Network deployments:', networkDeployments);
  if (!networkDeployments?.MyNFT?.history) return;

  let allMints: MintHistoryItem[] = [];
  for (const deployment of networkDeployments.MyNFT.history) {
    console.log('Checking deployment:', deployment);
    const transactions = await fetchContractTransactions(deployment.address, currentAccount);
    const mints = transactions
      .filter(tx => tx.method === 'mint' && tx.status === 'ok')
      .map(tx => ({
        tokenId: parseInt(tx.decoded_input?.parameters[0]?.value || '0', 16),
        timestamp: new Date(tx.timestamp),
        txHash: tx.hash as `0x${string}`,
        collection: deployment.tag
      }));
    allMints.push(...mints);
  }

  console.log('All mints collected:', allMints);

  // Sort by timestamp, newest first
  allMints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const chain = currentNetwork === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet;
  historyContainer.innerHTML = `
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Your Mint History</h3>
    ${allMints.length === 0 ? 
      '<p class="text-sm text-gray-500">No minting activity found</p>' :
      `<div class="space-y-3">
        ${allMints.map(mint => `
          <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
            <div>
              <p class="font-medium text-gray-900">${mint.collection} #${mint.tokenId}</p>
              <p class="text-sm text-gray-500">${mint.timestamp.toLocaleString()}</p>
            </div>
            <a href="${chain.blockExplorers?.default.url}/tx/${mint.txHash}" 
               target="_blank"
               class="text-blue-600 hover:text-blue-800">
              View
            </a>
          </div>
        `).join('')}
      </div>`
    }
  `;
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

  // Add URI preview functionality
  document.getElementById('tokenUri')?.addEventListener('change', async (e) => {
    await updateUriPreview((e.target as HTMLInputElement).value);
  });

  document.getElementById('tokenUri')?.addEventListener('input', async (e) => {
    await updateUriPreview((e.target as HTMLInputElement).value);
  });

  async function updateUriPreview(uri: string) {
    try {
      const response = await fetch(uri);
      const metadata = await response.json();
      const uriPreview = document.getElementById('uriPreview') as HTMLTextAreaElement;
      uriPreview.value = JSON.stringify(metadata, null, 2);
    } catch (error) {
      const uriPreview = document.getElementById('uriPreview') as HTMLTextAreaElement;
      uriPreview.value = 'Error: Invalid URI or metadata format';
      console.error('Error fetching URI:', error);
    }
  }

  // Update mint form handler
  document.getElementById('mintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const tokenUri = (form.elements.namedItem('tokenUri') as HTMLInputElement).value;
    await mintNFT(tokenUri);
  });

  // Update mint history
  await updateMintHistory();
}); 