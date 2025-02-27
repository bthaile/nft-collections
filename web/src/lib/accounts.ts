import { createWalletClient, custom } from "viem";
import { evmFlowMainnet, evmFlowTestnet } from "./chains";
import Onboard from '@web3-onboard/core';
import injectedModule from '@web3-onboard/injected-wallets';
import walletConnectModule from '@web3-onboard/walletconnect';

export const CHAIN_ID_TO_NETWORK = {
  "747": "evmFlowMainnet", 
  "0x2eb": "evmFlowMainnet", 
  "545": "evmFlowTestnet", 
  "0x221": "evmFlowTestnet", 
};

export interface AccountState {
  currentAccount?: string;
  network?: "evmFlowMainnet" | "evmFlowTestnet";
  walletClient?: ReturnType<typeof createWalletClient>;
}

const state: AccountState = {
  currentAccount: undefined,
  network: undefined,
  walletClient: undefined,
};

// Initialize modules
const injected = injectedModule();
const walletConnect = walletConnectModule({
  projectId: '952483bf424b889638c9088bd94493f9', // Public demo project ID - replace with your own for production
});

// Initialize Web3Onboard
const onboard = Onboard({
  wallets: [injected, walletConnect],
  chains: [
    {
      id: '0x2eb', // Flow Mainnet (747 decimal)
      token: 'FLOW',
      label: 'Flow EVM Mainnet',
      rpcUrl: 'https://evm.mainnet.flowlabs.io'
    },
    {
      id: '0x221', // Flow Testnet (545 decimal)
      token: 'FLOW',
      label: 'Flow EVM Testnet',
      rpcUrl: 'https://evm.testnet.flowlabs.io'
    }
  ],
  appMetadata: {
    name: 'NFT Minter',
    icon: '🖼️',
    description: 'Mint NFTs on Flow EVM',
    recommendedInjectedWallets: [
      { name: 'MetaMask', url: 'https://metamask.io' },
      { name: 'Coinbase', url: 'https://wallet.coinbase.com/' }
    ]
  }
});

export function getCurrentAccount() {
  return state.currentAccount;
}

export function getCurrentNetwork() {
  return state.network;
}

export function getWalletClient() {
  return state.walletClient;
}

/**
 * Requests the wallet to switch to a Flow EVM network or add it if it doesn't exist
 * @param isMainnet Whether to switch to mainnet (true) or testnet (false)
 */
export async function switchToFlowEVM(isMainnet = false): Promise<boolean> {
  if (!window.ethereum) return false;

  const targetChainId = isMainnet ? '0xF' : '0x10';

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainId }],
    });
    return true;
  } catch (switchError: any) {
    console.error('Error switching to Flow EVM network:', switchError);
    alert('Network not supported. Please add Flow EVM networks to your wallet manually.');
    return false;
  }
}

export async function connectWallet({
  onConnect,
  onDisconnect,
  onError,
  updateUI
}: {
  onConnect?: (account: string) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  updateUI?: () => void;
}) {
  try {
    // If already connected, disconnect
    if (state.currentAccount) {
      onboard.disconnectWallet({ label: 'All wallets' });
      state.currentAccount = undefined;
      state.walletClient = undefined;
      if (onDisconnect) onDisconnect();
      return;
    }

    // Connect with Web3Onboard
    const wallets = await onboard.connectWallet();
    
    if (wallets.length > 0) {
      const { accounts, chains, provider } = wallets[0];
      
      // Check if wallet has accounts
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in your wallet. Please create an account first.");
      }
      
      if (accounts.length > 0) {
        const chainId = chains[0].id;
        const networkType = CHAIN_ID_TO_NETWORK[chainId];
        
        if (!networkType) {
          throw new Error(`Unsupported network: ${chainId}. Please connect to Flow EVM Mainnet or Testnet.`);
        }
        
        state.currentAccount = accounts[0].address;
        state.network = networkType;
        
        // Create wallet client
        state.walletClient = createWalletClient({
          chain: networkType === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet,
          transport: custom(provider)
        });
        
        if (onConnect) onConnect(accounts[0].address);
        if (updateUI) updateUI();
      }
    } else {
      // No wallet was selected
      throw new Error("No wallet selected or wallet connection was cancelled.");
    }
  } catch (error) {
    console.error('Error connecting wallet:', error);
    // Improve error messages for common issues
    let errorMessage = (error as Error).message;
    if (errorMessage.includes("evm must has at least one account")) {
      errorMessage = "Your Flow wallet doesn't have any EVM accounts created. Please follow these steps:\n\n" +
        "1. Open your Flow wallet extension\n" +
        "2. Click on the account name at the top\n" +
        "3. Select 'Create/Import Account'\n" +
        "4. Choose 'Create a new account'\n" +
        "5. Select 'Flow EVM' as the network type\n" +
        "6. Follow the prompts to complete account creation\n\n" +
        "After creating your Flow EVM account, try connecting again.";
      
      // Log detailed information to help diagnose
      console.log("Wallet connection details:", {
        walletType: wallets[0]?.label || "Unknown wallet",
        accounts: wallets[0]?.accounts || [],
        chains: wallets[0]?.chains || []
      });
    }
    // Handle unsupported network error more gracefully
    if (errorMessage.includes("Unsupported network")) {
      const chainId = errorMessage.match(/0x[0-9a-fA-F]+/)?.[0] || '';
      errorMessage = `Your wallet is connected to an unsupported network (${chainId}). Please switch to Flow EVM Mainnet (Chain ID: 0x2eb) or Testnet (Chain ID: 0x221) in your wallet settings.`;
    }
    if (onError) onError(new Error(errorMessage));
  }
}

export const disconnectWallet = async ({
  onDisconnect
}: {
  onDisconnect?: () => void;
}) => {
  await onboard.disconnectWallet({ label: 'All wallets' });
  state.currentAccount = undefined;
  state.walletClient = undefined;
  if (onDisconnect) onDisconnect();
};

// Setup subscription to wallet state changes
onboard.state.select('wallets').subscribe(wallets => {
  if (wallets.length === 0) {
    // All wallets disconnected
    state.currentAccount = undefined;
    state.walletClient = undefined;
  } else {
    // Handle network changes
    const { accounts, chains } = wallets[0];
    if (accounts.length > 0 && chains.length > 0) {
      const chainId = chains[0].id;
      state.network = CHAIN_ID_TO_NETWORK[chainId];
      state.currentAccount = accounts[0].address;
    }
  }
});

export function initAccountListeners() {
  // No need for explicit listeners as Web3-Onboard handles this
  console.log('Account listeners initialized via Web3-Onboard');
}
