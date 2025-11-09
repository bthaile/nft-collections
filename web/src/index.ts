import "./styles/index.css";
import { createPublicClient, http, decodeEventLog } from "viem";
import { evmFlowMainnet, evmFlowTestnet } from "./lib/chains";
import {
  connectWallet,
  getCurrentAccount,
  getCurrentNetwork,
  getWalletClient,
  CHAIN_ID_TO_NETWORK,
  AccountState as State,
  disconnectWallet,
  switchToFlowEVM,
} from "./lib/accounts";
import { MyNFTAbi } from "./lib/abi";
import deployedAddresses from "./lib/deployed-addresses.json";
import { fetchContractTransactions } from "./lib/transactions";
import {
  renderEmptyNftState,
  renderNftLoadingState,
  renderNftTable,
} from "./lib/nftTable";
import { fetchUserNfts } from "./lib/nftFetcher";

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

// Declare but don't initialize the publicClient until we know the network
let publicClient: ReturnType<typeof createPublicClient> | undefined;

interface MintHistoryItem {
  timestamp: Date;
  txHash: `0x${string}`;
  collection?: string;
}

const state = { currentNetwork: undefined } as State;

type DeploymentInfo = {
  address: string;
  tag?: string;
  timestamp?: number;
  deployer?: string;
};

function formatDeploymentLabel(deployment: DeploymentInfo): string {
  if (deployment.tag) return deployment.tag;
  const address = deployment.address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function resolveIpfsUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    // Replace ipfs:// with a gateway URL
    const ipfsId = uri.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${ipfsId}`;
  }
  return uri;
}

async function fetchCollectionMetadata(
  contractAddress: string
): Promise<CollectionMetadata | null> {
  try {
    console.log(
      "Fetching metadata for contract:",
      contractAddress,
      "on network:",
      getCurrentNetwork()
    );
    if (!publicClient) {
      console.error("Public client not initialized - initializing now");
      // Initialize with current network if available
      const network = getCurrentNetwork();
      const chainId = network === "evmFlowMainnet" ? "0x2eb" : "0x221";
      await initClients(chainId);

      if (!publicClient) {
        throw new Error("Failed to initialize public client");
      }
    }

    // Check if contract exists using getBytecode
    const code = await publicClient.getBytecode({
      address: contractAddress as `0x${string}`,
    });

    console.log("Contract bytecode:", code ? "Found" : "Not found");
    if (!code) {
      throw new Error(`No contract found at address ${contractAddress}`);
    }

    const uri = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: MyNFTAbi,
      functionName: "contractURI",
    });

    if (!uri || typeof uri !== "string") {
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
    if (metadata.image && metadata.image.startsWith("ipfs://")) {
      metadata.image = resolveIpfsUri(metadata.image);
    }

    return metadata;
  } catch (error) {
    console.error("Error fetching collection metadata:", error);
    return null;
  }
}

async function updateCollectionDetails(
  contractAddress: string,
  selectedTag: string
) {
  const collectionDetails = document.getElementById("collectionDetails");
  if (!collectionDetails) return;

  const metadata = await fetchCollectionMetadata(contractAddress);
  if (!metadata) {
    collectionDetails.innerHTML = "<p>No collection details available</p>";
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
        <p class="text-sm text-gray-600 leading-relaxed mb-3">${
          metadata.description
        }</p>
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
        ${
          metadata.external_link
            ? `<a href="${metadata.external_link}" target="_blank" 
            class="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            View Collection
            <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>`
            : ""
        }
      </div>
    </div>
  `;
}

async function loadContracts() {
  const select = document.getElementById("contractSelect") as HTMLSelectElement;
  select.innerHTML = ""; // Clear existing options

  // Add default empty option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select a collection";
  select.appendChild(defaultOption);

  const network = getCurrentNetwork();
  console.log("Loading contracts for network:", network);

  const networkKey = network || "evmFlowTestnet";
  const deployments = getMyNftDeployments(networkKey);
  console.log("Network deployments:", deployments);

  if (deployments.length) {
    deployments.forEach((deployment) => {
      const option = document.createElement("option");
      option.value = deployment.address;
      option.textContent = `${formatDeploymentLabel(deployment)} (${deployment.address.slice(
        0,
        6
      )}...${deployment.address.slice(-4)})`;
      select.appendChild(option);
    });

    // Select first NFT contract and trigger change event
    select.value = deployments[0].address;
    select.dispatchEvent(new Event("change"));

    // Update collection details when a contract is selected
    select.addEventListener("change", async (e) => {
      const selectedAddress = (e.target as HTMLSelectElement).value;
      const deployment = deployments.find(
        (d) => d.address === selectedAddress
      );
      if (deployment) {
        // Update collection details
        updateCollectionDetails(
          deployment.address,
          formatDeploymentLabel(deployment)
        );

        // Prepopulate mint form
        const metadata = await fetchCollectionMetadata(deployment.address);
        if (metadata) {
          const uriInput = document.querySelector(
            "#tokenUri"
          ) as HTMLInputElement;
          const uriPreview = document.querySelector(
            "#uriPreview"
          ) as HTMLTextAreaElement;

          // Get contractURI
          const contractUri = await publicClient?.readContract({
            address: deployment.address as `0x${string}`,
            abi: MyNFTAbi,
            functionName: "contractURI",
          });

          uriInput.value = contractUri as string;
          uriPreview.value = JSON.stringify(metadata, null, 2);
        }
      }
    });

    // Show initial collection details and prepopulate form for first collection
    const firstDeployment = deployments[0];
    updateCollectionDetails(
      firstDeployment.address,
      formatDeploymentLabel(firstDeployment)
    );
    fetchCollectionMetadata(firstDeployment.address).then(
      async (metadata) => {
        if (metadata) {
          const uriInput = document.querySelector(
            "#tokenUri"
          ) as HTMLInputElement;
          const uriPreview = document.querySelector(
            "#uriPreview"
          ) as HTMLTextAreaElement;

          // Get contractURI
          const contractUri = await publicClient?.readContract({
            address: firstDeployment.address as `0x${string}`,
            abi: MyNFTAbi,
            functionName: "contractURI",
          });

          uriInput.value = contractUri as string;
          uriPreview.value = JSON.stringify(metadata, null, 2);
        }
      }
    );
  }
}

async function initClients(chainId: string) {
  console.log("Initializing clients with chainId:", chainId);

  // Fix chainId format if needed
  if (!chainId.startsWith("0x")) {
    chainId = "0x" + Number(chainId).toString(16);
  }

  let networkName =
    CHAIN_ID_TO_NETWORK[chainId as keyof typeof CHAIN_ID_TO_NETWORK];
  if (!networkName) {
    console.warn(
      `Unsupported network: ${chainId}. Defaulting to Flow EVM Testnet`
    );
    networkName = "evmFlowTestnet";
  }

  const chain =
    networkName === "evmFlowMainnet" ? evmFlowMainnet : evmFlowTestnet;
  console.log("Initializing clients for network:", networkName);
  console.log(
    "Using chain:",
    chain.name,
    "with RPC:",
    chain.rpcUrls.public.http[0]
  );

  publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  // Return the client for immediate use if needed
  return publicClient;
}

function updateNetworkDisplay() {
  const networkDiv = document.getElementById("network");
  if (networkDiv && getCurrentNetwork()) {
    const displayName =
      getCurrentNetwork() === "evmFlowMainnet"
        ? "Flow EVM Mainnet"
        : "Flow EVM Testnet";
    networkDiv.innerHTML = `
      <div class="flex items-center gap-4">
        <span>Network: ${displayName}</span>
        ${
          getCurrentAccount()
            ? `
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Account:</span>
            <code class="text-sm font-mono text-gray-700">${getCurrentAccount()?.slice(
              0,
              6
            )}...${getCurrentAccount()?.slice(-4)}</code>
            <button onclick="navigator.clipboard.writeText('${getCurrentAccount()}').then(() => showToast('Address copied!', 'success'))"
              class="p-1 text-gray-500 hover:text-gray-700 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
          </div>
        `
            : ""
        }
      </div>
    `;
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `max-w-xs p-3 rounded-lg shadow-lg ${
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' : 'bg-blue-600'
  } text-white text-sm`;
  toast.innerHTML = message; // Allow HTML content
  
  container.appendChild(toast);
  
  // Remove toast after a delay
  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, duration);
}

async function mintNFT(tokenUri: string) {
  if (!getCurrentAccount()) {
    showToast("Please connect your wallet first", "error");
    return;
  }

  const contractSelect = document.getElementById(
    "contractSelect"
  ) as HTMLSelectElement;
  if (!contractSelect.value) {
    showToast("Please select a collection first", "error");
    return;
  }

  const network = getCurrentNetwork()!;
  const deployments = getMyNftDeployments(network);
  const selectedAddress = contractSelect.value;
  const deployment = deployments.find(
    (d) => d.address === selectedAddress
  );

  if (!deployment) {
    showToast("Selected collection not found", "error");
    return;
  }

  // Set loading state
  const mintButton = document.getElementById("mintButton");
  const mintSpinner = document.getElementById("mintSpinner");
  const buttonText = mintButton?.querySelector("span");
  if (mintButton) mintButton.setAttribute("disabled", "true");
  if (mintSpinner) mintSpinner.classList.remove("hidden");
  if (buttonText) buttonText.textContent = "Minting...";

  try {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error("Wallet client not initialized");

    console.log("Minting NFT with URI:", tokenUri);
    console.log("Contract address:", deployment.address);

    // Call mint function on the contract
    const tx = await walletClient.writeContract({
      address: deployment.address as `0x${string}`,
      abi: MyNFTAbi,
      functionName: "mint",
      args: [tokenUri],
      account: getCurrentAccount() as `0x${string}`,
      chain: getCurrentNetwork() === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet
    });

    console.log("Transaction hash:", tx);

    showToast("Transaction submitted, waiting for confirmation...", "info");
    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx as `0x${string}`,
    });

    // Get NFT ID from transaction logs
    const log = receipt?.logs[0];
    if (log) {
      try {
        const decoded = decodeEventLog({
          abi: MyNFTAbi,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === "Transfer") {
          const tokenId = decoded.args.tokenId?.toString();
          console.log("Minted NFT with ID:", tokenId);

          showToast(`Successfully minted NFT ID: ${tokenId}`, "success");

          // Update mint history after a significant delay to allow blockchain indexers to update
          setTimeout(async () => {
            // Show refreshing animation
            const refreshIcon = document.getElementById("refreshHistory");
            if (refreshIcon) {
              refreshIcon.classList.add("animate-spin");
            }

            await updateMintHistory();
          await updateOwnedNfts();
            showToast("Mint history updated", "success");

            // Stop refreshing animation
            if (refreshIcon) {
              refreshIcon.classList.remove("animate-spin");
            }
          }, 2000); // 2 second delay
        }
      } catch (error) {
        console.error("Error decoding log:", error);
      }
    } else {
      console.log("No logs found in transaction receipt");
    }
  } catch (error) {
    console.error("Error minting NFT:", error);
    showToast("Error minting NFT: " + (error as Error).message, "error");
  } finally {
    // Reset button state
    if (mintButton) mintButton.removeAttribute("disabled");
    if (mintSpinner) mintSpinner.classList.add("hidden");
    if (buttonText) buttonText.textContent = "Mint NFT";
  }
}

async function updateOwnedNfts() {
  if (!getCurrentAccount() || !getCurrentNetwork() || !publicClient) {
    renderEmptyNftState();
    return;
  }

  const deployments = getMyNftDeployments(getCurrentNetwork()!);
  if (!deployments.length) {
    renderEmptyNftState();
    return;
  }

  renderNftLoadingState();

  try {
    const rows = await fetchUserNfts({
      client: publicClient,
      account: getCurrentAccount() as `0x${string}`,
      deployments,
      resolveUri: resolveIpfsUri,
    });

    if (!rows.length) {
      renderEmptyNftState();
      return;
    }

    renderNftTable(rows);
  } catch (error) {
    console.error("Failed to load owned NFTs:", error);
    renderEmptyNftState();
    showToast("Unable to load NFTs from your wallet.", "error");
  }
}

function updateStatus(message: string, type: "success" | "error" | "info") {
  const statusDiv = document.getElementById("status");
  if (statusDiv) {
    statusDiv.className = `fixed bottom-6 right-6 max-w-md p-4 rounded-lg shadow-lg ${
      type === "success"
        ? "bg-green-50 text-green-800 border border-green-200"
        : type === "error"
        ? "bg-red-50 text-red-800 border border-red-200"
        : "bg-blue-50 text-blue-800 border border-blue-200"
    }`;
    statusDiv.textContent = message;
    statusDiv.classList.remove("hidden");
    setTimeout(() => {
      statusDiv.classList.add("hidden");
    }, 5000);
  }
}

async function updateMintHistory() {
  console.log(
    "Updating mint history with account:",
    getCurrentAccount(),
    "network:",
    getCurrentNetwork()
  );
  if (!getCurrentAccount() || !getCurrentNetwork()) return;

  const historyContainer = document.getElementById("mintHistory");
  if (!historyContainer) return;

  historyContainer.innerHTML = `
    <div class="flex items-center justify-center py-6 text-sm text-gray-500 gap-2">
      <svg class="w-5 h-5 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2a10 10 0 00-8 16.9l2-1.73A7.963 7.963 0 014 12z"></path>
      </svg>
      Loading mint history...
    </div>
  `;

  const deployments = getMyNftDeployments(getCurrentNetwork()!);
  console.log("Network deployments:", deployments);
  if (!deployments.length) return;

  let allMints: MintHistoryItem[] = [];
  for (const deployment of deployments) {
    console.log("Checking deployment:", deployment);
    const transactions = await fetchContractTransactions(
      deployment.address,
      getCurrentAccount()!
    );
    const mints = transactions
      .filter(
        (tx) =>
          tx.method === "mint" &&
          tx.status === "ok" &&
          tx.from.hash.toLowerCase() === getCurrentAccount()?.toLowerCase()
      )
      .map((tx) => {
        return {
          timestamp: new Date(tx.timestamp),
          txHash: tx.hash as `0x${string}`,
          collection: formatDeploymentLabel(deployment),
        };
      });
    allMints.push(...mints);
  }

  console.log("All mints collected:", allMints);

  // Sort by timestamp, newest first
  allMints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const chain =
    getCurrentNetwork() === "evmFlowMainnet" ? evmFlowMainnet : evmFlowTestnet;
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
    ${
      allMints.length === 0
        ? '<p class="text-sm text-gray-500">No minting activity found</p>'
        : `<div class="space-y-0.5">
        ${allMints
          .map(
            (mint) => `
          <div class="flex items-center gap-3 px-2 py-1 bg-white rounded border border-gray-100 hover:bg-gray-50">
            <span class="font-medium text-gray-900">${mint.collection}</span>
            <span class="text-xs text-gray-500">${mint.timestamp.toLocaleString()}</span>
            <a href="${chain.blockExplorers?.default.url}/tx/${mint.txHash}" 
              target="_blank"
              class="text-xs text-blue-600 hover:text-blue-800 ml-auto">
              View
            </a>
          </div>
        `
          )
          .join("")}
      </div>`
    }
  `;

  // Add event listener to refresh history button
  document
    .getElementById("refreshHistory")
    ?.addEventListener("click", async () => {
      showToast("Refreshing mint history...", "info");

      // Add spinning animation to the refresh icon
      const refreshIcon = document.getElementById("refreshHistory");
      if (refreshIcon) {
        refreshIcon.classList.add("animate-spin");
      }

      await updateMintHistory();
      await updateOwnedNfts();
      showToast("Mint history updated", "success");

      // Remove animation when done
      if (refreshIcon) {
        refreshIcon.classList.remove("animate-spin");
      }
    });
}

function getMyNftDeployments(networkKey: string): DeploymentInfo[] {
  const networkConfig =
    (deployedAddresses as Record<string, any>)[networkKey] ?? undefined;
  const myNftConfig = networkConfig?.MyNFT;
  if (!myNftConfig) return [];

  const history: DeploymentInfo[] = Array.isArray(myNftConfig.history)
    ? [...myNftConfig.history]
    : [];

  const historyByAddress = new Map(
    history.map((deployment) => [deployment.address.toLowerCase(), deployment])
  );

  const seen = new Set<string>();
  const deployments: DeploymentInfo[] = [];

  if (typeof myNftConfig.latest === "string") {
    const latestLower = myNftConfig.latest.toLowerCase();
    const historyMatch = historyByAddress.get(latestLower);
    const latestTag = historyMatch?.tag ?? "LATEST";
    deployments.push({
      address: myNftConfig.latest,
      tag: latestTag,
      timestamp: historyMatch?.timestamp,
      deployer: historyMatch?.deployer,
    });
    seen.add(latestLower);
  }

  history
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .forEach((deployment) => {
      const key = deployment.address.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deployments.push(deployment);
      }
    });

  return deployments;
}

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  renderEmptyNftState();
  // Handle network switching buttons
  document
    .getElementById("switchToTestnet")
    ?.addEventListener("click", async () => {
      showToast("Configure Flow EVM Testnet in MetaMask", "info");
      alert(`To add Flow EVM Testnet to MetaMask:
1. Open MetaMask and click on the network dropdown at the top
2. Click "Add network" 
3. Scroll down and click "Add network manually"
4. Enter the following details:
   - Network Name: Flow EVM Testnet
   - RPC URL: https://evm.testnet.flowlabs.io
   - Chain ID: 545 (or 0x221 in hex)
   - Currency Symbol: FLOW
   - Block Explorer URL: https://evm-explorer.testnet.flowlabs.io
5. Click Save and connect to the network`);
    });

  document
    .getElementById("switchToMainnet")
    ?.addEventListener("click", async () => {
      showToast("Configure Flow EVM Mainnet in MetaMask", "info");
      alert(`To add Flow EVM Mainnet to MetaMask:
1. Open MetaMask and click on the network dropdown at the top
2. Click "Add network" 
3. Scroll down and click "Add network manually"
4. Enter the following details:
   - Network Name: Flow EVM Mainnet
   - RPC URL: https://evm.mainnet.flowlabs.io
   - Chain ID: 747 (or 0x2eb in hex)
   - Currency Symbol: FLOW
   - Block Explorer URL: https://evm-explorer.mainnet.flowlabs.io
5. Click Save and connect to the network`);
    });

  // Handle URI preview updates
  document.getElementById("tokenUri")?.addEventListener("input", async (e) => {
    const uri = (e.target as HTMLInputElement).value;
    if (uri) {
      try {
        const resolvedUri = resolveIpfsUri(uri);
        const response = await fetch(resolvedUri);
        const metadata = await response.json();
        const preview = document.getElementById(
          "uriPreview"
        ) as HTMLTextAreaElement;
        if (preview) {
          preview.value = JSON.stringify(metadata, null, 2);
        }
      } catch (error) {
        console.error("Error fetching URI:", error);
        const preview = document.getElementById(
          "uriPreview"
        ) as HTMLTextAreaElement;
        if (preview) {
          preview.value =
            "Error loading metadata. Please check the URI format.";
        }
      }
    }
  });

  // Connect wallet button
  document.getElementById("connectWallet")?.addEventListener("click", () => {
    if (getCurrentAccount()) {
      // Already connected, so disconnect
      disconnectWallet({
        onDisconnect: () => {
          const mintForm = document.getElementById("mintForm");
          const mintHistory = document.getElementById("mintHistory");
          const connectButton = document.getElementById("connectWallet");
          const collectionDetails =
            document.getElementById("collectionDetails");
          const contractSelect = document.getElementById(
            "contractSelect"
          ) as HTMLSelectElement;
          if (connectButton) {
            connectButton.textContent = "Connect Wallet";
            connectButton.classList.remove("bg-red-600", "hover:bg-red-700");
            connectButton.classList.add("bg-blue-600", "hover:bg-blue-700");
          }
          if (mintForm) mintForm.classList.add("hidden");
          if (mintHistory) mintHistory.innerHTML = "";
          if (collectionDetails) collectionDetails.innerHTML = "";
          if (contractSelect) contractSelect.innerHTML = "";
          renderEmptyNftState();
          updateStatus("Disconnected", "info");
        },
      });
      return;
    }

    // Show a pre-connection guide for Flow wallet users
    showToast("Checking wallet connection...", "info");
    if (window.ethereum && window.ethereum.isFlowEVM) {
      const flowGuide = document.createElement('div');
      flowGuide.innerHTML = `
        <div class="p-4 mb-4 border rounded bg-blue-50 text-sm">
          <h3 class="font-medium mb-2">Using Flow Wallet?</h3>
          <p class="mb-2">Make sure you've created a Flow EVM account in your wallet:</p>
          <ol class="list-decimal pl-5 mb-2 space-y-1">
            <li>Open your Flow wallet</li>
            <li>Create a new account with "Flow EVM" network type</li>
            <li>Switch to this account before connecting</li>
          </ol>
        </div>
      `;
      
      // Insert the guide before the connection form
      const connectionForm = document.querySelector('.container');
      if (connectionForm && connectionForm.parentNode) {
        connectionForm.parentNode.insertBefore(flowGuide, connectionForm);
        
        // Auto-remove after connection or 30 seconds
        setTimeout(() => {
          if (flowGuide.parentNode) {
            flowGuide.parentNode.removeChild(flowGuide);
          }
        }, 30000);
      }
    }

    connectWallet({
      onDisconnect: () => {
        const mintForm = document.getElementById("mintForm");
        const mintHistory = document.getElementById("mintHistory");
        const connectButton = document.getElementById("connectWallet");
        const collectionDetails = document.getElementById("collectionDetails");
        const contractSelect = document.getElementById(
          "contractSelect"
        ) as HTMLSelectElement;
        if (connectButton) {
          connectButton.textContent = "Connect Wallet";
          connectButton.classList.remove("bg-red-600", "hover:bg-red-700");
          connectButton.classList.add("bg-blue-600", "hover:bg-blue-700");
        }
        if (mintForm) mintForm.classList.add("hidden");
        if (mintHistory) mintHistory.innerHTML = "";
        if (collectionDetails) collectionDetails.innerHTML = "";
        if (contractSelect) contractSelect.innerHTML = "";
        renderEmptyNftState();
        updateStatus("Disconnected", "info");
      },
      onConnect: async (account) => {
        const connectButton = document.getElementById("connectWallet");
        if (connectButton) {
          connectButton.textContent = "Disconnect";
          connectButton.classList.remove("bg-blue-600", "hover:bg-blue-700");
          connectButton.classList.add("bg-red-600", "hover:bg-red-700");
        }
        // Get the actual network from the wallet connection
        const network = getCurrentNetwork();
        console.log("Connected to network:", network);
        const chainId = network === "evmFlowMainnet" ? "0x2eb" : "0x221"; // Use the actual chain IDs
        await initClients(chainId);
        document.getElementById("mintForm")?.classList.remove("hidden");
        updateStatus(`Connected: ${account}`, "success");
        await loadContracts();
        await updateMintHistory();
        await updateOwnedNfts();
      },
      onError: (error) => {
        updateStatus("Failed to connect wallet: " + error.message, "error");
        
        // Format error message for toast notifications with line breaks
        const errorLines = error.message.split('\n').filter(line => line.trim() !== '');
        const firstLine = errorLines[0];
        const detailLines = errorLines.slice(1).join(' ');
        
        // Show short message in toast with button for details
        showToast(`Connection failed: ${firstLine} <button id="showMoreError" class="ml-2 px-2 py-0.5 text-xs bg-red-700 rounded">Details</button>`, "error", 10000);
        
        // Add click handler for the details button
        setTimeout(() => {
          document.getElementById('showMoreError')?.addEventListener('click', () => {
            alert(error.message);
          });
        }, 100);

        // If it's a network error, show the switch network buttons
        if (error.message.includes("unsupported network")) {
          const switchBtns = document.getElementById("networkSwitchButtons");
          if (switchBtns) {
            switchBtns.classList.remove("hidden");
          }
        }
      },
      updateUI: () => {
        updateNetworkDisplay();
      },
    });
  });

  // Update mint form handler
  document.getElementById("mintForm")?.addEventListener("submit", async (e) => {
    e.preventDefault(); // This prevents the page from refreshing
    const form = e.target as HTMLFormElement;
    const tokenUri = (form.elements.namedItem("tokenUri") as HTMLInputElement)
      .value;
    await mintNFT(tokenUri);
  });

  // Update mint history
  await updateMintHistory();
});
