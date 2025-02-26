import { createWalletClient, custom } from 'viem';
import { evmFlowMainnet, evmFlowTestnet } from './chains';

export const CHAIN_ID_TO_NETWORK = {
  '0x2eb': 'evmFlowMainnet', // 747
  '0x221': 'evmFlowTestnet'  // 545
};

export interface AccountState {
  currentAccount?: string;
  network?: 'evmFlowMainnet' | 'evmFlowTestnet';
  walletClient?: ReturnType<typeof createWalletClient>;
}

const state: AccountState = {
  currentAccount: undefined,
  network: undefined,
  walletClient: undefined
};

export function getCurrentAccount() {
  return state.currentAccount;
}

export function getCurrentNetwork() {
  return state.network;
}

export function getWalletClient() {
  return state.walletClient;
}

export async function handleAccountChange(
  accounts: string[], 
  callbacks: {
    onDisconnect: () => void,
    onConnect: (account: string) => void,
    updateUI: () => void
  }
) {
  if (accounts.length === 0) {
    // User disconnected their wallet
    state.currentAccount = undefined;
    // Reset wallet client
    state.walletClient = createWalletClient({
      chain: state.network === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet,
      transport: custom(window.ethereum)
    });
    callbacks.onDisconnect();
  } else {
    // Get the currently selected account from MetaMask
    try {
      const [selectedAccount] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      state.currentAccount = selectedAccount;
      // Update wallet client with selected account
      state.walletClient = createWalletClient({
        chain: state.network === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet,
        account: state.currentAccount as `0x${string}`,
        transport: custom(window.ethereum)
      });
      callbacks.onConnect(selectedAccount);
    } catch (error) {
      console.error('Error getting selected account:', error);
      return;
    }
  }
  callbacks.updateUI();
}

export async function connectWallet(
  callbacks: {
    onDisconnect: () => void,
    onConnect: (account: string) => void,
    onError: (error: Error) => void,
    updateUI: () => void
  }
) {
  if (!window.ethereum) {
    callbacks.onError(new Error('Please install MetaMask!'));
    return;
  }

  try {
    // If already connected, disconnect
    if (state.currentAccount) {
      state.currentAccount = undefined;
      callbacks.onDisconnect();
      callbacks.updateUI();
      return;
    }

    // Get chain ID first
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    // Initialize network and wallet client
    const networkName = CHAIN_ID_TO_NETWORK[chainId as keyof typeof CHAIN_ID_TO_NETWORK];
    if (!networkName) {
      throw new Error('Unsupported network');
    }
    state.network = networkName as 'evmFlowMainnet' | 'evmFlowTestnet';
    
    const chain = networkName === 'evmFlowMainnet' ? evmFlowMainnet : evmFlowTestnet;
    
    // Then request accounts
    const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    state.currentAccount = account;
    
    state.walletClient = createWalletClient({
      chain,
      account: account as `0x${string}`,
      transport: custom(window.ethereum)
    });

    callbacks.onConnect(account);
    callbacks.updateUI();
    return account;
  } catch (error) {
    console.error('Wallet connection error:', error);
    callbacks.onError(error as Error);
  }
}

export function initAccountListeners(
  callbacks: {
    onNetworkChange: (chainId: string) => void,
    onAccountChange: (accounts: string[]) => void
  }
) {
  if (!window.ethereum) return;
  
  window.ethereum.on('chainChanged', callbacks.onNetworkChange);
  window.ethereum.on('accountsChanged', callbacks.onAccountChange);
}
