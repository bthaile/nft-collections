import './styles/index.css'
import { createPublicClient, http, decodeEventLog } from 'viem';
import { evmFlowMainnet, evmFlowTestnet } from './chains';
import { 
  connectWallet, 
  handleAccountChange, 
  getCurrentAccount,
  getCurrentNetwork,
  getWalletClient,
  initAccountListeners,
  CHAIN_ID_TO_NETWORK,
  AccountState as State
} from './accounts';
import { MyNFTAbi } from './contracts/abi';
import deployedAddresses from '../../deployed-addresses.json';
import { fetchContractTransactions } from './transactions';

interface CollectionMetadata {
  name: string;
  description: string;
  image: string;
  external_link?: string;
}

declare global {
  interface Window {
    ethereum: any;
  }
}

let publicClient: ReturnType<typeof createPublicClient>;

interface MintHistoryItem {
  timestamp: Date;
  txHash: `0x${string}`;
  collection?: string;
}

const state = { currentNetwork: undefined } as State;

function resolveIpfsUri(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    // Replace ipfs:// with a gateway URL
    const ipfsId = uri.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${ipfsId}`;
  }
  return uri;
}

async function fetchCollectionMetadata(contractAddress: string): Promise<CollectionMetadata | null> {
  try {
    console.log('Fetching metadata for contract:', contractAddress, 'on network:', getCurrentNetwork());
    if (!publicClient) {
      console.error('Public client not initialized');
      return null;
    }

    // Check if contract exists using getBytecode
    const code = await publicClient.getBytecode({
      address: contractAddress as `0x${string}`
    });
    
    console.log('Contract bytecode:', code ? 'Found' : 'Not found');
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

    // Resolve IPFS URI if needed
    const resolvedUri = resolveIpfsUri(uri);
    const response = await fetch(resolvedUri);
    const metadata = await response.json();

    // Also resolve any IPFS images in the metadata
    if (metadata.image && metadata.image.startsWith('ipfs://')) {
      metadata.image = resolveIpfsUri(metadata.image);
    }

    return metadata;
  } catch (error) {
    console.error('Error fetching collection metadata:', error);
    return null;
  }
}

async function updateCollectionDetails(contractAddress: string, selectedTag: string) {
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
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          ${metadata.name} (${selectedTag})
        </h3>
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

  // Add default empty option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a collection';
  select.appendChild(defaultOption);

  const network = getCurrentNetwork();
  console.log('Loading contracts for network:', network);

  const networkDeployments = deployedAddresses[network || 'evmFlowTestnet'];
  console.log('Network deployments:', networkDeployments);

  if (networkDeployments?.MyNFT?.history) {
    networkDeployments.MyNFT.history.forEach(deployment => {
      if (deployment.tag) {
        const option = document.createElement('option');
        option.value = deployment.tag;
        option.textContent = `${deployment.tag} (${deployment.address.slice(0,6)}...${deployment.address.slice(-4)})`;
        select.appendChild(option);
      }
    });
    
    // Select first NFT contract and trigger change event
    if (networkDeployments.MyNFT.history.length > 0) {
      select.value = networkDeployments.MyNFT.history[0].tag;
      select.dispatchEvent(new Event('change'));
    }

    // Update collection details when a contract is selected
    select.addEventListener('change', async (e) => {
      const selectedTag = (e.target as HTMLSelectElement).value;
      const deployment = networkDeployments.MyNFT.history.find(d => d.tag === selectedTag);
      if (deployment) {
        // Update collection details
        updateCollectionDetails(deployment.address, deployment.tag);
        
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
      updateCollectionDetails(firstDeployment.address, firstDeployment.tag);
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
  console.log('Initializing clients for network:', networkName);
  if (!networkName) {
    throw new Error('Unsupported network');
  }

  const chain = networkName === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet;
  console.log('Using chain:', chain.name, 'with RPC:', chain.rpcUrls.public.http[0]);

  publicClient = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.public.http[0])
  });

  // Verify client is working
  try {
    await publicClient.getBlockNumber();
    console.log('Public client successfully initialized');
  } catch (error) {
    console.error('Error verifying public client:', error);
  }

  // Listen for network changes
  initAccountListeners({
    onNetworkChange: handleNetworkChange,
    onAccountChange: (accounts) => handleAccountChange(accounts, {
      onDisconnect: () => {
        const mintForm = document.getElementById('mintForm');
        const mintHistory = document.getElementById('mintHistory');
        const connectButton = document.getElementById('connectWallet');
        const collectionDetails = document.getElementById('collectionDetails');
        const contractSelect = document.getElementById('contractSelect') as HTMLSelectElement;
        if (connectButton) {
          connectButton.textContent = 'Connect';
          connectButton.classList.remove('bg-red-600', 'hover:bg-red-700');
          connectButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
        if (mintForm) mintForm.classList.add('hidden');
        if (mintHistory) mintHistory.innerHTML = '';
        if (collectionDetails) collectionDetails.innerHTML = '';
        if (contractSelect) contractSelect.innerHTML = '';
        updateStatus('Disconnected', 'info');
      },
      onConnect: (account) => {
        const connectButton = document.getElementById('connectWallet');
        if (connectButton) {
          connectButton.textContent = 'Disconnect';
          connectButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
          connectButton.classList.add('bg-red-600', 'hover:bg-red-700');
        }
        document.getElementById('mintForm')?.classList.remove('hidden');
        updateStatus(`Connected: ${account}`, 'success');
        updateMintHistory();
      },
      updateUI: () => {
        updateNetworkDisplay();
      }
    })
  });
}

async function handleNetworkChange(chainId: string) {
  const networkName = CHAIN_ID_TO_NETWORK[chainId as keyof typeof CHAIN_ID_TO_NETWORK];
  if (!networkName) {
    updateStatus('Please connect to Flow EVM Mainnet or Testnet', 'error');
    return;
  }
  state.network = networkName as 'evmFlowMainnet' | 'evmFlowTestnet';
  await initClients(chainId);
  updateNetworkDisplay();
  await loadContracts();
  await updateMintHistory();
}

function updateNetworkDisplay() {
  const networkDiv = document.getElementById('network');
  if (networkDiv && getCurrentNetwork()) {
    const displayName = getCurrentNetwork() === 'evmFlowMainnet' ? 'Flow EVM Mainnet' : 'Flow EVM Testnet';
    networkDiv.innerHTML = `
      <div class="flex items-center gap-4">
        <span>Network: ${displayName}</span>
        ${getCurrentAccount() ? `
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Account:</span>
            <code class="text-sm font-mono text-gray-700">${getCurrentAccount()?.slice(0,6)}...${getCurrentAccount()?.slice(-4)}</code>
            <button onclick="navigator.clipboard.writeText('${getCurrentAccount()}').then(() => showToast('Address copied!', 'success'))"
              class="p-1 text-gray-500 hover:text-gray-700 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    `;
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
  // Resolve IPFS URI if needed, but keep original URI for minting
  const resolvedUri = resolveIpfsUri(tokenUri);
  
  // Validate metadata format
  try {
    const response = await fetch(resolvedUri);
    const metadata = await response.json();
    if (!metadata.name || !metadata.description || !metadata.image) {
      throw new Error('Invalid metadata format - must include name, description, and image');
    }
  } catch (error) {
    updateStatus('Invalid metadata URI: ' + (error as Error).message, 'error');
    showToast('Invalid metadata URI', 'error');
    return;
  }

  const mintButton = document.getElementById('mintButton');
  const mintSpinner = document.getElementById('mintSpinner');
  const mintText = mintButton?.querySelector('span');

  if (!getCurrentAccount()) {
    updateStatus('Please connect your wallet first', 'error');
    showToast('Please connect your wallet first', 'error');
    return;
  }

  const select = document.getElementById('contractSelect') as HTMLSelectElement;
  const contractSymbol = select.value;
  const contract = deployedAddresses[getCurrentNetwork()!]?.MyNFT?.history.find(
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

    const tx = await getWalletClient()?.writeContract({
      account: getCurrentAccount() as `0x${string}`,
      address: contract.address as `0x${string}`,
      abi: MyNFTAbi,
      functionName: 'mint',
      args: [resolvedUri],
      chain: getCurrentNetwork() === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet
    });
    
    showToast('Transaction submitted, waiting for confirmation...', 'info');
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx as `0x${string}` });
    
    // Get NFT ID from transaction logs
    const log = receipt.logs[0];
    const decoded = decodeEventLog({
      abi: MyNFTAbi,
      data: log.data,
      topics: log.topics,
    }) as unknown as { 
      eventName: string;
      args: { from: string; to: string; tokenId: bigint }[];
    };
    
    const tokenId = decoded.args[2]; // tokenId is the third argument in the Transfer event

    updateStatus('NFT minted successfully!', 'success');
    showToast('NFT minted successfully!', 'success');
    
    // Wait a few seconds for blockchain indexing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update mint history
    await updateMintHistory();
  } catch (error) {
    updateStatus('Failed to mint NFT: ' + (error as Error).message, 'error');
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

async function updateMintHistory() {
  console.log('Updating mint history with account:', getCurrentAccount(), 'network:', getCurrentNetwork());
  if (!getCurrentAccount() || !getCurrentNetwork()) return;

  const historyContainer = document.getElementById('mintHistory');
  if (!historyContainer) return;

  const networkDeployments = deployedAddresses[getCurrentNetwork()!];
  console.log('Network deployments:', networkDeployments);
  if (!networkDeployments?.MyNFT?.history) return;

  let allMints: MintHistoryItem[] = [];
  for (const deployment of networkDeployments.MyNFT.history) {
    console.log('Checking deployment:', deployment);
    const transactions = await fetchContractTransactions(deployment.address, getCurrentAccount()!);
    const mints = transactions
      .filter(tx => 
        tx.method === 'mint' && 
        tx.status === 'ok' && 
        tx.from.hash.toLowerCase() === getCurrentAccount()?.toLowerCase()
      )
      .map(tx => {
        return {
          timestamp: new Date(tx.timestamp),
          txHash: tx.hash as `0x${string}`,
          collection: deployment.tag
        };
      });
    allMints.push(...mints);
  }

  console.log('All mints collected:', allMints);

  // Sort by timestamp, newest first
  allMints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const chain = getCurrentNetwork() === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet;
  historyContainer.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Your Mint History</h3>
      <button id="refreshHistory" class="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
    ${allMints.length === 0 ? 
      '<p class="text-sm text-gray-500">No minting activity found</p>' :
      `<div class="space-y-0.5">
        ${allMints.map(mint => `
          <div class="flex items-center gap-3 px-2 py-1 bg-white rounded border border-gray-100 hover:bg-gray-50">
            <span class="font-medium text-gray-900">${mint.collection}</span>
            <span class="text-xs text-gray-500">${mint.timestamp.toLocaleString()}</span>
            <a href="${chain.blockExplorers?.default.url}/tx/${mint.txHash}" 
              target="_blank"
              class="text-xs text-blue-600 hover:text-blue-800 ml-auto">
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
  // Handle URI preview updates
  document.getElementById('tokenUri')?.addEventListener('input', async (e) => {
    const uri = (e.target as HTMLInputElement).value;
    if (uri) {
      try {
        const resolvedUri = resolveIpfsUri(uri);
        const response = await fetch(resolvedUri);
        const metadata = await response.json();
        const preview = document.getElementById('uriPreview') as HTMLTextAreaElement;
        if (preview) {
          preview.value = JSON.stringify(metadata, null, 2);
        }
      } catch (error) {
        console.error('Error fetching URI:', error);
        const preview = document.getElementById('uriPreview') as HTMLTextAreaElement;
        if (preview) {
          preview.value = 'Error loading metadata. Please check the URI format.';
        }
      }
    }
  });

  // Refresh history button
  document.addEventListener('click', async (e) => {
    if ((e.target as Element).closest('#refreshHistory')) {
      await updateMintHistory();
      showToast('Mint history refreshed', 'success');
    }
  });

  // Connect wallet button
  document.getElementById('connectWallet')?.addEventListener('click', () => {
    connectWallet({
      onDisconnect: () => {
        const mintForm = document.getElementById('mintForm');
        const mintHistory = document.getElementById('mintHistory');
        const connectButton = document.getElementById('connectWallet');
        const collectionDetails = document.getElementById('collectionDetails');
        const contractSelect = document.getElementById('contractSelect') as HTMLSelectElement;
        if (connectButton) {
          connectButton.textContent = 'Connect';
          connectButton.classList.remove('bg-red-600', 'hover:bg-red-700');
          connectButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
        if (mintForm) mintForm.classList.add('hidden');
        if (mintHistory) mintHistory.innerHTML = '';
        if (collectionDetails) collectionDetails.innerHTML = '';
        if (contractSelect) contractSelect.innerHTML = '';
        updateStatus('Disconnected', 'info');
      },
      onConnect: async (account) => {
        const connectButton = document.getElementById('connectWallet');
        if (connectButton) {
          connectButton.textContent = 'Disconnect';
          connectButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
          connectButton.classList.add('bg-red-600', 'hover:bg-red-700');
        }
        // Initialize clients with current network
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        await initClients(chainId);
        document.getElementById('mintForm')?.classList.remove('hidden');
        updateStatus(`Connected: ${account}`, 'success');
        await loadContracts();
        await updateMintHistory();
      },
      onError: (error) => {
        updateStatus('Failed to connect wallet: ' + error.message, 'error');
      },
      updateUI: () => {
        updateNetworkDisplay();
      }
    });
  });

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